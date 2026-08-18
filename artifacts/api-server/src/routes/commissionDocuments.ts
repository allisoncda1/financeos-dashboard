/**
 * Commission Documents routes.
 *
 * Authorization:
 *   - requireAuth: all endpoints
 *   - requirePermission("financials"): upload, confirm/ignore lines, create allocations, apply, archive, reopen
 *   - requirePermission("control"): retry extraction (operational action)
 *
 * Every endpoint is scoped by :slug -> entityId exactly like routes/commissions.ts
 * (slugGuard + getCachedEntityId 404 guard) — a document belonging to one
 * entity can never be read or mutated via another entity's slug.
 *
 * Feature flag: every endpoint on this router is gated behind
 * COMMISSION_DOCUMENTS_ENABLED (see requireCommissionDocumentsEnabled below,
 * applied once via router.use() so no individual route can accidentally
 * skip it). When disabled, every request short-circuits with a clean 404
 * before reaching any handler — no db/commissionDocuments query, no object
 * storage call, no AI provider call, ever happens. This is deliberately
 * separate from and unrelated to routes/commissions.ts's router, which is
 * never touched by this flag.
 *
 * Production AI readiness: upload and retry are ALSO gated behind
 * requireAiProviderReadyForProduction, which refuses with 503
 * AI_PROVIDER_NOT_CONFIGURED — before any storage or DB call — whenever
 * NODE_ENV=production and no real AI provider/credential is configured.
 * MockProvider is never used implicitly for a real document in production;
 * it remains the correct default everywhere else (dev/test/CI). The same
 * check backs both this gate and GET .../documents/readiness (see
 * services/readiness.ts), and services/documentProcessing.ts's
 * runExtraction() re-checks it immediately before ever calling the AI
 * provider, as a defense-in-depth backstop for the one fire-and-forget path
 * (the abandoned-document resume sweep) these two route-level gates don't
 * cover.
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { requireAuth } from "../auth/middleware";
import { requirePermission } from "../auth/permissions";
import { isCommissionDocumentsEnabled } from "../config/featureFlags";
import { getCachedEntityId } from "../services/entityCache";
import {
  createCommissionDocument,
  deleteCommissionDocumentRow,
  getCommissionDocumentById,
  listCommissionDocuments,
  archiveDocument,
  reopenDocument,
  getDocumentLines,
  confirmDocumentLineMatch,
  ignoreDocumentLine,
  createAllocations,
  getAllocationsForDocumentLine,
  getActiveAllocationsForRunLine,
  recalculateRunLineAfterAllocation,
  getDocumentEvents,
  markDocumentApplied,
  recordDocumentEvent,
  DOCUMENT_STATUSES,
} from "../db/commissionDocuments";
import { isValidUuid, getCommissionLines } from "../db/commissions";
import { validatePdfUpload, MAX_FILE_SIZE_BYTES } from "../services/pdfExtraction";
import { storeDocument, deleteDocument, sha256hex } from "../services/commissionDocumentStorage";
import { scheduleExtraction, retryExtraction, resumeAbandonedDocuments, MAX_EXTRACTION_ATTEMPTS } from "../services/documentProcessing";
import { computeReadiness, getAiProviderReadiness } from "../services/readiness";

const router: IRouter = Router();
const SLUG_RE = /^[a-zA-Z0-9_]{2,50}$/;
function slugGuard(slug: string): boolean { return SLUG_RE.test(slug); }

/**
 * requireCommissionDocumentsEnabled — the single gate for this entire
 * router. Reads the flag fresh on every request (never cached), so it
 * reflects the current process.env at request time. Applied via
 * router.use() below, before any route — no handler in this file, no
 * multer parsing, no DB/storage/AI call, is ever reached when disabled.
 */
function requireCommissionDocumentsEnabled(_req: Request, res: Response, next: NextFunction): void {
  if (!isCommissionDocumentsEnabled()) {
    res.status(404).json({ ok: false, error: "Commission Documents is not enabled.", code: "FEATURE_DISABLED" });
    return;
  }
  next();
}
router.use(requireCommissionDocumentsEnabled);

/**
 * requireAiProviderReadyForProduction — the production kill switch for the
 * mock AI provider. Outside production this always passes (MockProvider is
 * the correct default for dev/test/CI). In production, refuses with 503
 * BEFORE any storage or DB call — applied ahead of multer on the upload
 * route specifically so a request that will be rejected never even pays for
 * multipart parsing, let alone an object-storage call. The message is a
 * fixed, generic string: it never names the missing env var, the expected
 * provider, or any secret.
 */
function requireAiProviderReadyForProduction(_req: Request, res: Response, next: NextFunction): void {
  const readiness = getAiProviderReadiness();
  if (!readiness.ready) {
    res.status(503).json({
      ok: false,
      error: "Document processing is not available right now. Please try again later or contact an administrator.",
      code: "AI_PROVIDER_NOT_CONFIGURED",
    });
    return;
  }
  next();
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

function currentUser(req: unknown): { name?: string; email?: string } | undefined {
  return (req as { user?: { name?: string; email?: string } }).user;
}
function actorId(req: unknown): string {
  const u = currentUser(req);
  return u?.email ?? u?.name ?? "unknown";
}

// ─── GET /:slug/documents/readiness — operational status for the Upload button ─
// Authorized users only (same "financials" tier as upload itself) — never
// public. Returns four plain booleans and nothing else: no connection
// string, no secret value or name, no provider name. Read-only: a SELECT 1
// ping and a storage-availability probe, no writes.
router.get("/:slug/documents/readiness", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const readiness = await computeReadiness();
  return res.json({ ok: true, data: readiness });
});

// ─── POST /:slug/documents — upload a vendor PDF ──────────────────────────────
// Sequencing (storage/DB compensation):
//   1. Validate (MIME/size/signature) — reject before touching storage or DB.
//   2. Attempt object storage FIRST. If unavailable → honest 503, NO
//      database row is created at all (never a phantom "uploaded" document
//      that can never be processed because its bytes don't exist anywhere).
//   3. Object stored → create the DB row. If THAT fails, the just-stored
//      object is deleted (compensating action) so nothing orphaned is left
//      in object storage with no database reference.
//   4. DB row created → schedule extraction, respond 202.
router.post("/:slug/documents", requireAuth, requirePermission("financials"), requireAiProviderReadyForProduction, upload.single("file"), async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ ok: false, error: "No file uploaded (expected multipart field 'file')" });

  const validation = validatePdfUpload({ mimetype: file.mimetype, size: file.size, buffer: file.buffer });
  if (!validation.valid) return res.status(400).json({ ok: false, error: validation.reason });

  const storeResult = await storeDocument(entityId, file.buffer);
  if (!storeResult.stored) {
    // Honest 503 — never a silent fallback to local disk, never a DB row
    // for a document whose bytes don't exist anywhere.
    return res.status(503).json({ ok: false, error: "Document storage is currently unavailable. Please try again shortly.", code: "STORAGE_UNAVAILABLE" });
  }

  const idempotencyHeader = req.headers["idempotency-key"];
  const idempotencyKey = typeof idempotencyHeader === "string" && idempotencyHeader.trim()
    ? idempotencyHeader.trim()
    : `${entityId}:${storeResult.sha256}`;

  try {
    const { document, created } = await createCommissionDocument({
      entityId,
      fileName: file.originalname,
      contentType: file.mimetype,
      fileSize: file.size,
      sha256: storeResult.sha256,
      storageKey: storeResult.storageKey,
      storageProvider: storeResult.provider,
      createdBy: actorId(req),
      idempotencyKey,
    });

    if (created) {
      await recordDocumentEvent({ documentId: document.id, eventType: "uploaded", performedBy: actorId(req) });
      scheduleExtraction(entityId, document.id, actorId(req));
    } else {
      // Idempotent retry of the same upload — the object we just stored is
      // a duplicate of what's already referenced by the existing row.
      // Compensate: this new object has no reference and would be orphaned.
      await deleteDocument(storeResult.storageKey);
    }

    return res.status(created ? 202 : 200).json({ ok: true, data: document });
  } catch (err: unknown) {
    if (err instanceof Error && (err as { code?: string }).code === "DUPLICATE_DOCUMENT") {
      // Compensating action: the object was stored successfully, but the
      // row could not be created because this exact document already
      // exists for this entity — delete the just-stored duplicate object.
      await deleteDocument(storeResult.storageKey);
      return res.status(409).json({ ok: false, error: "This exact document has already been uploaded for this entity.", code: "DUPLICATE_DOCUMENT" });
    }
    // Any other DB failure — compensate by deleting the orphaned object.
    await deleteDocument(storeResult.storageKey);
    const log = (req as unknown as { log?: { error?(...a: unknown[]): void } }).log;
    log?.error?.({ err }, "[commission-documents] upload internal error");
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ─── GET /:slug/documents — list ──────────────────────────────────────────────
// Opportunistically self-heals abandoned documents: fires (never awaits) a
// sweep for anything stuck in 'uploaded' or lease-expired 'processing' for
// this entity, so simply viewing the list can recover a document a crashed
// process never got around to extracting. Never slows down the list
// response itself.
router.get("/:slug/documents", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const status = (req.query["status"] as string) || undefined;
  if (status && !DOCUMENT_STATUSES.has(status)) return res.status(400).json({ ok: false, error: "Invalid status" });

  resumeAbandonedDocuments(entityId, actorId(req));

  try {
    const documents = await listCommissionDocuments(entityId, status);
    return res.json({ ok: true, data: documents, ts: new Date().toISOString() });
  } catch {
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
});

// ─── GET /:slug/documents/:id — detail (document + lines) ─────────────────────
router.get("/:slug/documents/:id", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id)) return res.status(400).json({ ok: false, error: "Invalid document id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });

  const lines = await getDocumentLines(id);
  return res.json({ ok: true, data: { document, lines }, ts: new Date().toISOString() });
});

// ─── GET /:slug/documents/:id/events — audit trail ────────────────────────────
router.get("/:slug/documents/:id/events", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id)) return res.status(400).json({ ok: false, error: "Invalid document id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });

  const events = await getDocumentEvents(id);
  return res.json({ ok: true, data: events, ts: new Date().toISOString() });
});

// ─── GET /:slug/documents/:id/file — stream the original PDF (proof view) ────
router.get("/:slug/documents/:id/file", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id)) return res.status(400).json({ ok: false, error: "Invalid document id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });

  const { retrieveDocument } = await import("../services/commissionDocumentStorage");
  const result = await retrieveDocument(document.storageKey);
  if (!result.available) {
    return res.status(404).json({ ok: false, error: "Original file is not available." });
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(document.fileName)}"`);
  return res.send(result.data);
});

// ─── POST /:slug/documents/:id/retry — manual re-extraction ───────────────────
router.post("/:slug/documents/:id/retry", requireAuth, requirePermission("control"), requireAiProviderReadyForProduction, async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id)) return res.status(400).json({ ok: false, error: "Invalid document id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  // Idempotent: retryExtraction relies on claimDocumentForProcessing's
  // atomic guard — calling this endpoint twice in quick succession (double
  // click, client retry) never runs extraction twice.
  const result = await retryExtraction(entityId, id, actorId(req));
  if (!result.ok && result.reason === "not_found") return res.status(404).json({ ok: false, error: "Document not found" });
  if (!result.ok && result.reason === "attempt_limit_reached") {
    return res.status(422).json({ ok: false, error: `Extraction attempt limit reached (${MAX_EXTRACTION_ATTEMPTS}).`, code: "ATTEMPT_LIMIT_REACHED" });
  }
  if (!result.ok && result.reason === "not_claimable") {
    return res.status(409).json({ ok: false, error: "This document is not currently retryable (already processing, or in a state that can't be retried).", code: "NOT_CLAIMABLE" });
  }
  return res.json({ ok: true, ts: new Date().toISOString() });
});

// ─── GET /:slug/documents/:id/lines/:lineId/candidates — proposed matches ─────
// Read-only: computes candidate commission_run_lines by entity + period +
// client-name proximity + amount proximity. Never writes anything —
// matching only ever affects data once a human calls /confirm below.
router.get("/:slug/documents/:id/lines/:lineId/candidates", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  const lineId = req.params["lineId"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id) || !isValidUuid(lineId)) return res.status(400).json({ ok: false, error: "Invalid id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });

  const lines = await getDocumentLines(id);
  const line = lines.find((l) => l.id === lineId);
  if (!line) return res.status(404).json({ ok: false, error: "Document line not found" });

  const { lines: runLines } = await getCommissionLines({
    entityId,
    periodYear: document.periodYear ?? undefined,
    periodMonth: document.periodMonth ?? undefined,
    limit: 500,
  });

  const clientName = (line.extractedClientName ?? "").toLowerCase().trim();
  const extractedAmount = line.extractedAmount != null ? parseFloat(line.extractedAmount) : null;

  const candidates = runLines
    .filter((rl) => rl.lineStatus !== "locked")
    .map((rl) => {
      let score = 0;
      const rlName = (rl.customerName ?? "").toLowerCase().trim();
      if (clientName && rlName) {
        if (rlName === clientName) score += 0.6;
        else if (rlName.includes(clientName) || clientName.includes(rlName)) score += 0.3;
      }
      if (extractedAmount != null && rl.invoiceAmount != null) {
        const diff = Math.abs(parseFloat(rl.invoiceAmount) - extractedAmount);
        if (diff < 0.01) score += 0.4;
        else if (diff / Math.max(extractedAmount, 1) < 0.2) score += 0.15;
      }
      return { commissionRunLine: rl, confidence: Math.min(1, score) };
    })
    .filter((c) => c.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);

  return res.json({ ok: true, data: candidates, ts: new Date().toISOString() });
});

// ─── POST /:slug/documents/:id/lines/:lineId/confirm — human confirms a match ─
router.post("/:slug/documents/:id/lines/:lineId/confirm", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  const lineId = req.params["lineId"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id) || !isValidUuid(lineId)) return res.status(400).json({ ok: false, error: "Invalid id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const commissionRunLineId = body["commissionRunLineId"];
  if (!isValidUuid(commissionRunLineId)) return res.status(400).json({ ok: false, error: "commissionRunLineId is required and must be a valid UUID" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });
  if (document.status === "applied" || document.status === "archived") {
    return res.status(422).json({ ok: false, error: `Document is ${document.status} — reopen it before changing matches.` });
  }

  try {
    await confirmDocumentLineMatch(entityId, lineId, String(commissionRunLineId), actorId(req));
    await recordDocumentEvent({ documentId: id, eventType: "line_matched", performedBy: actorId(req),
      afterSnapshot: { lineId, commissionRunLineId } });
    return res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err: unknown) {
    const log = (req as unknown as { log?: { error?(...a: unknown[]): void } }).log;
    log?.error?.({ err }, "[commission-documents] confirm match internal error");
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ─── POST /:slug/documents/:id/lines/:lineId/ignore ───────────────────────────
router.post("/:slug/documents/:id/lines/:lineId/ignore", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  const lineId = req.params["lineId"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id) || !isValidUuid(lineId)) return res.status(400).json({ ok: false, error: "Invalid id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });

  await ignoreDocumentLine(lineId, actorId(req));
  await recordDocumentEvent({ documentId: id, eventType: "line_ignored", performedBy: actorId(req), afterSnapshot: { lineId } });
  return res.json({ ok: true, ts: new Date().toISOString() });
});

// ─── GET /:slug/documents/:id/lines/:lineId/preview — allocation preview ──────
// Read-only: shows revenue / existing expenses / proposed new allocation /
// gross profit / rate / proposed commission WITHOUT writing anything.
router.get("/:slug/documents/:id/lines/:lineId/preview", requireAuth, async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  const lineId = req.params["lineId"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id) || !isValidUuid(lineId)) return res.status(400).json({ ok: false, error: "Invalid id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });

  const lines = await getDocumentLines(id);
  const line = lines.find((l) => l.id === lineId);
  if (!line) return res.status(404).json({ ok: false, error: "Document line not found" });
  if (!line.confirmedInvoiceId) return res.status(422).json({ ok: false, error: "Confirm a match before previewing an allocation" });

  const existingAllocations = await getActiveAllocationsForRunLine(line.confirmedInvoiceId);
  return res.json({
    ok: true,
    data: {
      documentLine: line,
      existingAllocations,
      newAllocationAmount: line.extractedAmount,
    },
    ts: new Date().toISOString(),
  });
});

// ─── POST /:slug/documents/:id/lines/:lineId/allocations — create allocation(s) ─
router.post("/:slug/documents/:id/lines/:lineId/allocations", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  const lineId = req.params["lineId"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id) || !isValidUuid(lineId)) return res.status(400).json({ ok: false, error: "Invalid id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });
  if (document.status === "applied" || document.status === "archived") {
    return res.status(422).json({ ok: false, error: `Document is ${document.status} — reopen it before creating new allocations.` });
  }

  const body = req.body as Record<string, unknown>;
  const allocations = body["allocations"];
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ ok: false, error: "allocations must be a non-empty array" });
  }

  try {
    const created = await createAllocations(
      lineId,
      allocations.map((a: Record<string, unknown>) => ({
        commissionRunLineId: String(a["commissionRunLineId"]),
        allocationMethod: String(a["allocationMethod"]),
        allocatedAmount: String(a["allocatedAmount"]),
        reason: String(a["reason"] ?? ""),
        overrideAuthorizedBy: a["overrideAuthorizedBy"] ? String(a["overrideAuthorizedBy"]) : undefined,
        overrideReason: a["overrideReason"] ? String(a["overrideReason"]) : undefined,
      })),
      actorId(req),
    );

    const recalculated = [];
    for (const alloc of created) {
      const result = await recalculateRunLineAfterAllocation(alloc.commissionRunLineId);
      recalculated.push({ commissionRunLineId: alloc.commissionRunLineId, ...result });
    }

    await recordDocumentEvent({
      documentId: id, eventType: "allocation_created", performedBy: actorId(req),
      afterSnapshot: { lineId, allocationIds: created.map((a) => a.id) },
    });

    return res.status(201).json({ ok: true, data: { allocations: created, recalculated }, ts: new Date().toISOString() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    if (code === "ALLOCATION_EXCEEDS_SOURCE") return res.status(422).json({ ok: false, error: msg, code });
    if (code === "RUN_LINE_LOCKED") return res.status(409).json({ ok: false, error: "Target commission line is locked.", code });
    if (code === "RUN_LINE_NOT_FOUND" || code === "DOCUMENT_LINE_NOT_FOUND") return res.status(404).json({ ok: false, error: msg, code });
    const log = (req as unknown as { log?: { error?(...a: unknown[]): void } }).log;
    log?.error?.({ err }, "[commission-documents] create allocations internal error");
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// ─── POST /:slug/documents/:id/apply — finalize (immutable after this) ───────
router.post("/:slug/documents/:id/apply", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id)) return res.status(400).json({ ok: false, error: "Invalid document id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });
  if (document.status === "applied") return res.status(409).json({ ok: false, error: "Document is already applied.", code: "ALREADY_APPLIED" });
  if (document.status === "archived") return res.status(422).json({ ok: false, error: "Cannot apply an archived document." });

  const lines = await getDocumentLines(id);
  const unresolved = lines.filter((l) => l.status === "unmatched" || l.status === "suggested");
  if (unresolved.length > 0) {
    return res.status(422).json({
      ok: false,
      error: `${unresolved.length} line(s) are not yet confirmed or ignored — every line must be resolved before applying.`,
      code: "UNRESOLVED_LINES",
    });
  }

  await markDocumentApplied(entityId, id, actorId(req));
  await recordDocumentEvent({ documentId: id, eventType: "applied", performedBy: actorId(req) });
  return res.json({ ok: true, ts: new Date().toISOString() });
});

// ─── POST /:slug/documents/:id/archive ────────────────────────────────────────
router.post("/:slug/documents/:id/archive", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id)) return res.status(400).json({ ok: false, error: "Invalid document id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });

  await archiveDocument(entityId, id, actorId(req));
  await recordDocumentEvent({ documentId: id, eventType: "archived", performedBy: actorId(req) });
  return res.json({ ok: true, ts: new Date().toISOString() });
});

// ─── POST /:slug/documents/:id/reopen — applied documents are immutable ───────
// except via this explicit, audited reopen (requires a reason).
router.post("/:slug/documents/:id/reopen", requireAuth, requirePermission("financials"), async (req, res) => {
  const slug = req.params["slug"] as string;
  const id = req.params["id"] as string;
  if (!slugGuard(slug)) return res.status(404).json({ ok: false, error: "Invalid slug" });
  if (!isValidUuid(id)) return res.status(400).json({ ok: false, error: "Invalid document id" });
  const entityId = await getCachedEntityId(slug);
  if (!entityId) return res.status(404).json({ ok: false, error: "Entity not found" });

  const body = req.body as Record<string, unknown>;
  const reason = body["reason"];
  if (typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ ok: false, error: "reason is required to reopen an applied document" });
  }

  const document = await getCommissionDocumentById(entityId, id);
  if (!document) return res.status(404).json({ ok: false, error: "Document not found" });
  if (document.status !== "applied") return res.status(422).json({ ok: false, error: "Only an applied document can be reopened." });

  await reopenDocument(entityId, id, actorId(req), reason);
  await recordDocumentEvent({ documentId: id, eventType: "reopened", performedBy: actorId(req), reason });
  return res.json({ ok: true, ts: new Date().toISOString() });
});

export default router;
