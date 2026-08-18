/**
 * Commission Documents — operational DB queries (opsDb / COMMISSION_DATABASE_URL only).
 *
 * Same security constraints as db/commissions.ts:
 *   - Never reads from or writes to Neon Core invoices/entities directly here
 *     (matching amounts against invoices is done by the caller, which reads
 *     commission_run_lines — already ingested Core data — not Core itself).
 *   - All user-supplied values go through parameterized sql`` tags.
 *   - Locked commission_run_lines are never allocated against.
 *   - Applied documents are immutable — archive + reopen only, both audited.
 *   - Allocations are never UPDATEd in place — supersede + insert, so the
 *     full history survives.
 *
 * Lease/retry model (no external queue platform — see services/documentProcessing.ts):
 *   - claimDocumentForProcessing() is the ONLY way a document transitions
 *     into 'processing'. It is a single atomic UPDATE guarded by a WHERE
 *     clause that only matches 'uploaded' documents or 'processing'
 *     documents whose lease has expired. Postgres row-level locking makes
 *     concurrent claims safe without an advisory lock: if two callers race,
 *     the second's UPDATE re-evaluates its WHERE clause against the row
 *     state the first one just committed and affects zero rows.
 *   - findClaimableDocuments() lets the caller "self-heal" — any document
 *     stuck in 'uploaded' (process died before its setImmediate fired) or
 *     in 'processing' past its lease (process died mid-extraction) is
 *     discoverable and re-claimable, so nothing is ever permanently stuck.
 */
import { getCommissionOpsDb } from "./ops-connection";
import { sql } from "drizzle-orm";
import { isValidUuid, assertValidUuid } from "./commissions";
import { sumAmounts, computeGrossProfit } from "../services/expenseAllocation";
import { applyFormula } from "../services/commissionEngine";
import type { CommissionRule } from "./commissions";

const DOCUMENT_STATUSES = new Set([
  "uploaded", "processing", "needs_review", "ready_to_apply", "applied", "failed", "archived",
]);
const LINE_STATUSES = new Set(["unmatched", "suggested", "confirmed", "ignored"]);
const ALLOCATION_METHODS = new Set(["fixed_amount", "percentage_of_expense", "full_expense", "prorata_revenue"]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CommissionDocument {
  id: string;
  entityId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  storageKey: string;
  storageProvider: string;
  status: string;
  vendorName: string | null;
  documentNumber: string | null;
  documentDate: string | null;
  periodYear: number | null;
  periodMonth: number | null;
  documentTotal: string | null;
  attempts: number;
  processingStartedAt: string | null;
  leaseExpiresAt: string | null;
  nextRetryAt: string | null;
  lastError: string | null;
  appliedAt: string | null;
  appliedBy: string | null;
  archivedAt: string | null;
  archivedBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionDocumentLine {
  id: string;
  documentId: string;
  lineIndex: number;
  rawText: string | null;
  extractedClientName: string | null;
  extractedAmount: string | null;
  extractedDescription: string | null;
  proofPage: number | null;
  status: string;
  suggestedInvoiceId: string | null;
  suggestedConfidence: string | null;
  confirmedInvoiceId: string | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
}

export interface CommissionExpenseAllocation {
  id: string;
  documentLineId: string;
  commissionRunLineId: string;
  allocationMethod: string;
  allocatedAmount: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  supersededAt: string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapDocument(r: Record<string, unknown>): CommissionDocument {
  return {
    id: r.id as string,
    entityId: r.entity_id as string,
    fileName: r.file_name as string,
    contentType: r.content_type as string,
    fileSize: Number(r.file_size),
    sha256: r.sha256 as string,
    storageKey: r.storage_key as string,
    storageProvider: r.storage_provider as string,
    status: r.status as string,
    vendorName: (r.vendor_name as string) ?? null,
    documentNumber: (r.document_number as string) ?? null,
    documentDate: (r.document_date as string) ?? null,
    periodYear: r.period_year != null ? Number(r.period_year) : null,
    periodMonth: r.period_month != null ? Number(r.period_month) : null,
    documentTotal: (r.document_total as string) ?? null,
    attempts: Number(r.attempts ?? 0),
    processingStartedAt: (r.processing_started_at as string) ?? null,
    leaseExpiresAt: (r.lease_expires_at as string) ?? null,
    nextRetryAt: (r.next_retry_at as string) ?? null,
    lastError: (r.last_error as string) ?? null,
    appliedAt: (r.applied_at as string) ?? null,
    appliedBy: (r.applied_by as string) ?? null,
    archivedAt: (r.archived_at as string) ?? null,
    archivedBy: (r.archived_by as string) ?? null,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function mapLine(r: Record<string, unknown>): CommissionDocumentLine {
  return {
    id: r.id as string,
    documentId: r.document_id as string,
    lineIndex: Number(r.line_index),
    rawText: (r.raw_text as string) ?? null,
    extractedClientName: (r.extracted_client_name as string) ?? null,
    extractedAmount: (r.extracted_amount as string) ?? null,
    extractedDescription: (r.extracted_description as string) ?? null,
    proofPage: r.proof_page != null ? Number(r.proof_page) : null,
    status: r.status as string,
    suggestedInvoiceId: (r.suggested_invoice_id as string) ?? null,
    suggestedConfidence: (r.suggested_confidence as string) ?? null,
    confirmedInvoiceId: (r.confirmed_invoice_id as string) ?? null,
    confirmedBy: (r.confirmed_by as string) ?? null,
    confirmedAt: (r.confirmed_at as string) ?? null,
  };
}

function mapAllocation(r: Record<string, unknown>): CommissionExpenseAllocation {
  return {
    id: r.id as string,
    documentLineId: r.document_line_id as string,
    commissionRunLineId: r.commission_run_line_id as string,
    allocationMethod: r.allocation_method as string,
    allocatedAmount: r.allocated_amount as string,
    reason: r.reason as string,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    supersededAt: (r.superseded_at as string) ?? null,
  };
}

// ─── Documents ────────────────────────────────────────────────────────────────

export async function createCommissionDocument(input: {
  entityId: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  sha256: string;
  storageKey: string;
  storageProvider: string;
  createdBy: string;
  idempotencyKey: string;
}): Promise<{ document: CommissionDocument; created: boolean }> {
  assertValidUuid(input.entityId, "entityId");
  const db = getCommissionOpsDb();

  // Idempotency: if a document was already created with this key, return it
  // instead of creating a duplicate (safe retry of the same upload request).
  const existing = await db.execute(sql`
    SELECT * FROM commission_documents WHERE idempotency_key = ${input.idempotencyKey} LIMIT 1
  `);
  if (existing.rows.length > 0) {
    return { document: mapDocument(existing.rows[0] as Record<string, unknown>), created: false };
  }

  try {
    const rows = await db.execute(sql`
      INSERT INTO commission_documents
        (entity_id, file_name, content_type, file_size, sha256, storage_key,
         storage_provider, status, created_by, idempotency_key)
      VALUES
        (${input.entityId}::uuid, ${input.fileName}, ${input.contentType}, ${input.fileSize},
         ${input.sha256}, ${input.storageKey}, ${input.storageProvider}, 'uploaded',
         ${input.createdBy}, ${input.idempotencyKey})
      RETURNING *
    `);
    return { document: mapDocument(rows.rows[0] as Record<string, unknown>), created: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("uq_commission_documents_entity_sha256")) {
      throw Object.assign(new Error("duplicate_document"), { code: "DUPLICATE_DOCUMENT" });
    }
    throw err;
  }
}

/** Hard-delete — used ONLY as a compensating action when the object was
 * stored but the DB row could not be created (see routes/commissionDocuments.ts).
 * Never used once a document has any lines/events/allocations attached —
 * ON DELETE RESTRICT on those tables would reject it anyway. */
export async function deleteCommissionDocumentRow(documentId: string): Promise<void> {
  assertValidUuid(documentId, "documentId");
  await getCommissionOpsDb().execute(sql`DELETE FROM commission_documents WHERE id = ${documentId}::uuid`);
}

export async function getCommissionDocumentById(entityId: string, documentId: string): Promise<CommissionDocument | null> {
  assertValidUuid(entityId, "entityId");
  assertValidUuid(documentId, "documentId");
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT * FROM commission_documents WHERE id = ${documentId}::uuid AND entity_id = ${entityId}::uuid LIMIT 1
  `);
  if (rows.rows.length === 0) return null;
  return mapDocument(rows.rows[0] as Record<string, unknown>);
}

export async function listCommissionDocuments(entityId: string, status?: string): Promise<CommissionDocument[]> {
  assertValidUuid(entityId, "entityId");
  if (status && !DOCUMENT_STATUSES.has(status)) throw new Error(`Invalid status: ${status}`);
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT * FROM commission_documents
    WHERE entity_id = ${entityId}::uuid
      ${status ? sql`AND status = ${status}` : sql``}
    ORDER BY created_at DESC
    LIMIT 200
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapDocument);
}

// ─── Lease claim (the single entry point into 'processing') ──────────────────

export type ClaimResult =
  | { claimed: true; document: CommissionDocument }
  | { claimed: false; reason: "not_found" | "not_claimable" };

/**
 * claimDocumentForProcessing — atomically transitions a document into
 * 'processing' and stamps a fresh lease. Safe under concurrency: the WHERE
 * clause is re-checked by Postgres against the current row before the
 * UPDATE is allowed to proceed, so only one caller's claim can ever
 * succeed for a given document at a given moment — no advisory lock
 * needed for this specific operation.
 *
 * Claimable states: 'uploaded' (never started), or 'processing' with an
 * expired lease (a previous worker died mid-extraction).
 */
export async function claimDocumentForProcessing(
  documentId: string,
  leaseDurationMs: number,
): Promise<ClaimResult> {
  assertValidUuid(documentId, "documentId");
  const rows = await getCommissionOpsDb().execute(sql`
    UPDATE commission_documents SET
      status                = 'processing',
      processing_started_at = now(),
      lease_expires_at       = now() + (${leaseDurationMs}::text || ' milliseconds')::interval,
      attempts               = attempts + 1,
      updated_at             = now()
    WHERE id = ${documentId}::uuid
      AND (status = 'uploaded' OR (status = 'processing' AND lease_expires_at < now()))
    RETURNING *
  `);
  if (rows.rows.length === 0) {
    const existsRows = await getCommissionOpsDb().execute(sql`SELECT 1 FROM commission_documents WHERE id = ${documentId}::uuid`);
    return { claimed: false, reason: existsRows.rows.length === 0 ? "not_found" : "not_claimable" };
  }
  return { claimed: true, document: mapDocument(rows.rows[0] as Record<string, unknown>) };
}

/**
 * findClaimableDocuments — the "self-heal" query. Called opportunistically
 * (e.g. when a user loads the document list) to surface documents that are
 * claimable right now: still 'uploaded' or 'processing' with an expired
 * lease. Callers use this to re-trigger extraction for anything abandoned,
 * without needing a durable background worker.
 */
export async function findClaimableDocuments(entityId: string, limit = 20): Promise<CommissionDocument[]> {
  assertValidUuid(entityId, "entityId");
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT * FROM commission_documents
    WHERE entity_id = ${entityId}::uuid
      AND (status = 'uploaded' OR (status = 'processing' AND lease_expires_at < now()))
      AND (next_retry_at IS NULL OR next_retry_at < now())
    ORDER BY created_at ASC
    LIMIT ${limit}
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapDocument);
}

/**
 * completeProcessing — marks the outcome of an extraction attempt and
 * always clears the lease (processing_started_at, lease_expires_at) since
 * the document is no longer "in flight" either way. On failure, stamps
 * next_retry_at with the caller-provided backoff so findClaimableDocuments
 * does not immediately re-offer a just-failed document in a tight loop.
 */
export async function completeProcessing(
  documentId: string,
  outcome:
    | { status: "needs_review"; vendorName: string | null; documentNumber: string | null;
        documentDate: string | null; documentTotal: string | null; periodYear: number | null; periodMonth: number | null }
    | { status: "failed"; lastError: string; nextRetryAt: string | null },
): Promise<void> {
  assertValidUuid(documentId, "documentId");
  const db = getCommissionOpsDb();
  if (outcome.status === "needs_review") {
    await db.execute(sql`
      UPDATE commission_documents SET
        status                = 'needs_review',
        processing_started_at = NULL,
        lease_expires_at       = NULL,
        next_retry_at          = NULL,
        last_error             = NULL,
        vendor_name            = COALESCE(${outcome.vendorName}, vendor_name),
        document_number        = COALESCE(${outcome.documentNumber}, document_number),
        document_date          = COALESCE(${outcome.documentDate}, document_date)::date,
        period_year            = COALESCE(${outcome.periodYear}, period_year),
        period_month           = COALESCE(${outcome.periodMonth}, period_month),
        document_total         = COALESCE(${outcome.documentTotal}, document_total),
        updated_at              = now()
      WHERE id = ${documentId}::uuid
    `);
  } else {
    await db.execute(sql`
      UPDATE commission_documents SET
        status                = 'failed',
        processing_started_at = NULL,
        lease_expires_at       = NULL,
        next_retry_at          = ${outcome.nextRetryAt}::timestamptz,
        last_error              = ${outcome.lastError},
        updated_at              = now()
      WHERE id = ${documentId}::uuid
    `);
  }
}

export async function archiveDocument(entityId: string, documentId: string, archivedBy: string): Promise<void> {
  assertValidUuid(entityId, "entityId");
  assertValidUuid(documentId, "documentId");
  await getCommissionOpsDb().execute(sql`
    UPDATE commission_documents
    SET status = 'archived', archived_at = now(), archived_by = ${archivedBy}, updated_at = now()
    WHERE id = ${documentId}::uuid AND entity_id = ${entityId}::uuid
  `);
}

export async function reopenDocument(entityId: string, documentId: string, reopenedBy: string, reason: string): Promise<void> {
  assertValidUuid(entityId, "entityId");
  assertValidUuid(documentId, "documentId");
  if (!reason || !reason.trim()) throw new Error("reason is required to reopen an applied document");
  await getCommissionOpsDb().execute(sql`
    UPDATE commission_documents
    SET status = 'needs_review', reopened_at = now(), reopened_by = ${reopenedBy},
        reopen_reason = ${reason}, updated_at = now()
    WHERE id = ${documentId}::uuid AND entity_id = ${entityId}::uuid AND status = 'applied'
  `);
}

// ─── Document lines ───────────────────────────────────────────────────────────

/**
 * replaceDocumentLines — DELETE + INSERT in one transaction. Idempotent by
 * construction: re-running extraction for the same document always
 * produces exactly the freshly-extracted set of lines, never accumulates
 * duplicates from a prior (possibly abandoned/retried) attempt.
 */
export async function replaceDocumentLines(
  documentId: string,
  lines: Array<{
    lineIndex: number; rawText: string | null; extractedClientName: string | null;
    extractedAmount: string | null; extractedDescription: string | null; proofPage: number | null;
  }>,
): Promise<void> {
  assertValidUuid(documentId, "documentId");
  const db = getCommissionOpsDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`DELETE FROM commission_document_lines WHERE document_id = ${documentId}::uuid`);
    for (const line of lines) {
      await tx.execute(sql`
        INSERT INTO commission_document_lines
          (document_id, line_index, raw_text, extracted_client_name, extracted_amount,
           extracted_description, proof_page, status)
        VALUES
          (${documentId}::uuid, ${line.lineIndex}, ${line.rawText}, ${line.extractedClientName},
           ${line.extractedAmount}, ${line.extractedDescription}, ${line.proofPage}, 'unmatched')
      `);
    }
  });
}

export async function getDocumentLines(documentId: string): Promise<CommissionDocumentLine[]> {
  assertValidUuid(documentId, "documentId");
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT * FROM commission_document_lines WHERE document_id = ${documentId}::uuid ORDER BY line_index ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapLine);
}

export async function suggestDocumentLineMatch(
  lineId: string,
  suggestedInvoiceId: string,
  confidence: number,
): Promise<void> {
  assertValidUuid(lineId, "lineId");
  assertValidUuid(suggestedInvoiceId, "suggestedInvoiceId");
  await getCommissionOpsDb().execute(sql`
    UPDATE commission_document_lines
    SET status = 'suggested', suggested_invoice_id = ${suggestedInvoiceId}::uuid,
        suggested_confidence = ${confidence}, updated_at = now()
    WHERE id = ${lineId}::uuid AND status = 'unmatched'
  `);
}

export async function confirmDocumentLineMatch(
  entityId: string,
  lineId: string,
  invoiceRunLineId: string,
  confirmedBy: string,
): Promise<void> {
  assertValidUuid(entityId, "entityId");
  assertValidUuid(lineId, "lineId");
  assertValidUuid(invoiceRunLineId, "invoiceRunLineId");
  await getCommissionOpsDb().execute(sql`
    UPDATE commission_document_lines
    SET status = 'confirmed', confirmed_invoice_id = ${invoiceRunLineId}::uuid,
        confirmed_by = ${confirmedBy}, confirmed_at = now(), updated_at = now()
    WHERE id = ${lineId}::uuid
  `);
}

export async function ignoreDocumentLine(lineId: string, ignoredBy: string): Promise<void> {
  assertValidUuid(lineId, "lineId");
  await getCommissionOpsDb().execute(sql`
    UPDATE commission_document_lines
    SET status = 'ignored', confirmed_by = ${ignoredBy}, confirmed_at = now(), updated_at = now()
    WHERE id = ${lineId}::uuid
  `);
}

// ─── Expense allocations ──────────────────────────────────────────────────────

/**
 * createAllocations — atomically creates one or more allocations for a
 * document line, enforcing:
 *   - SELECT ... FOR UPDATE on the SOURCE commission_document_lines row —
 *     real row-level pessimistic locking, not just an advisory lock. Two
 *     concurrent createAllocations calls against the same document line
 *     serialize: the second blocks on the FOR UPDATE until the first's
 *     transaction commits or rolls back, then re-reads the (now current)
 *     sum of active allocations before deciding whether the new total fits.
 *   - sum of active allocations for the SOURCE document line never exceeds
 *     its extracted_amount, unless override fields are both provided
 *   - the target commission_run_line must not be locked
 * Never UPDATEs an existing allocation — always inserts a new row; a prior
 * active allocation is only ever superseded via supersedeAllocation(),
 * preserving full history.
 *
 * A CHECK constraint could NOT enforce the multi-row sum invariant above —
 * see the migration file's comment on commission_expense_allocations.
 */
export async function createAllocations(
  documentLineId: string,
  allocations: Array<{
    commissionRunLineId: string;
    allocationMethod: string;
    allocatedAmount: string;
    reason: string;
    overrideAuthorizedBy?: string;
    overrideReason?: string;
  }>,
  createdBy: string,
): Promise<CommissionExpenseAllocation[]> {
  assertValidUuid(documentLineId, "documentLineId");
  for (const a of allocations) {
    assertValidUuid(a.commissionRunLineId, "commissionRunLineId");
    if (!ALLOCATION_METHODS.has(a.allocationMethod)) throw new Error(`Invalid allocation method: ${a.allocationMethod}`);
    if (!a.reason || !a.reason.trim()) throw new Error("reason is required for every allocation");
  }

  const db = getCommissionOpsDb();
  return db.transaction(async (tx) => {
    // Row-level lock on the SOURCE document line — blocks any concurrent
    // createAllocations call against the same source until this
    // transaction commits or rolls back.
    const lineRows = await tx.execute(sql`
      SELECT extracted_amount FROM commission_document_lines
      WHERE id = ${documentLineId}::uuid
      FOR UPDATE
    `);
    if (lineRows.rows.length === 0) throw Object.assign(new Error("document_line_not_found"), { code: "DOCUMENT_LINE_NOT_FOUND" });
    const extractedAmount = (lineRows.rows[0] as { extracted_amount: string | null }).extracted_amount;
    if (extractedAmount == null) throw Object.assign(new Error("no_extracted_amount"), { code: "NO_EXTRACTED_AMOUNT" });

    // Any run line targeted must exist and not be locked.
    for (const a of allocations) {
      const runLineRows = await tx.execute(sql`
        SELECT line_status FROM commission_run_lines WHERE id = ${a.commissionRunLineId}::uuid
      `);
      if (runLineRows.rows.length === 0) throw Object.assign(new Error("commission_run_line_not_found"), { code: "RUN_LINE_NOT_FOUND" });
      if ((runLineRows.rows[0] as { line_status: string }).line_status === "locked") {
        throw Object.assign(new Error("commission_run_line_locked"), { code: "RUN_LINE_LOCKED" });
      }
    }

    // Re-read the sum of active allocations WHILE HOLDING the FOR UPDATE
    // lock above — this is the value a concurrent transaction would not
    // see updated until this one commits, which is exactly what makes the
    // over-allocation check below atomic across concurrent callers.
    const activeRows = await tx.execute(sql`
      SELECT allocated_amount FROM commission_expense_allocations
      WHERE document_line_id = ${documentLineId}::uuid AND superseded_at IS NULL
    `);
    const existingTotal = sumAmounts(
      (activeRows.rows as Array<{ allocated_amount: string }>).map((r) => r.allocated_amount),
    );
    const newTotal = sumAmounts([existingTotal, ...allocations.map((a) => a.allocatedAmount)]);

    const hasOverride = allocations.some((a) => a.overrideAuthorizedBy && a.overrideReason);
    if (parseFloat(newTotal) > parseFloat(extractedAmount) && !hasOverride) {
      throw Object.assign(
        new Error(`allocation_exceeds_source: existing ${existingTotal} + new allocations would total ${newTotal}, exceeding source amount ${extractedAmount}`),
        { code: "ALLOCATION_EXCEEDS_SOURCE" },
      );
    }

    const created: CommissionExpenseAllocation[] = [];
    for (const a of allocations) {
      const rows = await tx.execute(sql`
        INSERT INTO commission_expense_allocations
          (document_line_id, commission_run_line_id, allocation_method, allocated_amount,
           reason, created_by, override_authorized_by, override_reason)
        VALUES
          (${documentLineId}::uuid, ${a.commissionRunLineId}::uuid, ${a.allocationMethod},
           ${a.allocatedAmount}, ${a.reason}, ${createdBy},
           ${a.overrideAuthorizedBy ?? null}, ${a.overrideReason ?? null})
        RETURNING *
      `);
      created.push(mapAllocation(rows.rows[0] as Record<string, unknown>));
    }
    return created;
  });
}

export async function getActiveAllocationsForRunLine(commissionRunLineId: string): Promise<CommissionExpenseAllocation[]> {
  assertValidUuid(commissionRunLineId, "commissionRunLineId");
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT * FROM commission_expense_allocations
    WHERE commission_run_line_id = ${commissionRunLineId}::uuid AND superseded_at IS NULL
    ORDER BY created_at ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapAllocation);
}

export async function getAllocationsForDocumentLine(documentLineId: string): Promise<CommissionExpenseAllocation[]> {
  assertValidUuid(documentLineId, "documentLineId");
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT * FROM commission_expense_allocations
    WHERE document_line_id = ${documentLineId}::uuid
    ORDER BY created_at ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map(mapAllocation);
}

export async function supersedeAllocation(allocationId: string, supersededBy: string): Promise<void> {
  assertValidUuid(allocationId, "allocationId");
  await getCommissionOpsDb().execute(sql`
    UPDATE commission_expense_allocations
    SET superseded_at = now(), superseded_by = ${supersededBy}
    WHERE id = ${allocationId}::uuid AND superseded_at IS NULL
  `);
}

// ─── Audit events ─────────────────────────────────────────────────────────────

export async function recordDocumentEvent(input: {
  documentId: string;
  eventType: string;
  performedBy: string | null;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  reason?: string | null;
}): Promise<void> {
  assertValidUuid(input.documentId, "documentId");
  await getCommissionOpsDb().execute(sql`
    INSERT INTO commission_document_events
      (document_id, event_type, performed_by, before_snapshot, after_snapshot, reason)
    VALUES
      (${input.documentId}::uuid, ${input.eventType}, ${input.performedBy},
       ${input.beforeSnapshot != null ? JSON.stringify(input.beforeSnapshot) : null}::jsonb,
       ${input.afterSnapshot != null ? JSON.stringify(input.afterSnapshot) : null}::jsonb,
       ${input.reason ?? null})
  `);
}

export async function getDocumentEvents(documentId: string): Promise<Array<{
  id: string; eventType: string; performedBy: string | null;
  beforeSnapshot: unknown; afterSnapshot: unknown; reason: string | null; createdAt: string;
}>> {
  assertValidUuid(documentId, "documentId");
  const rows = await getCommissionOpsDb().execute(sql`
    SELECT * FROM commission_document_events WHERE document_id = ${documentId}::uuid ORDER BY created_at ASC
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    eventType: r.event_type as string,
    performedBy: (r.performed_by as string) ?? null,
    beforeSnapshot: r.before_snapshot ?? null,
    afterSnapshot: r.after_snapshot ?? null,
    reason: (r.reason as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function markDocumentApplied(entityId: string, documentId: string, appliedBy: string): Promise<void> {
  assertValidUuid(entityId, "entityId");
  assertValidUuid(documentId, "documentId");
  await getCommissionOpsDb().execute(sql`
    UPDATE commission_documents
    SET status = 'applied', applied_at = now(), applied_by = ${appliedBy}, updated_at = now()
    WHERE id = ${documentId}::uuid AND entity_id = ${entityId}::uuid AND status != 'applied'
  `);
}

// ─── Recalculation after allocation ───────────────────────────────────────────

export interface RecalculationResult {
  eligibleRevenue: string | null;
  confirmedAllocatedExpenses: string;
  grossProfit: string | null;
  commissionAmount: string | null;
  lineStatus: string;
  configured: boolean; // false when no active commission rule/rate exists — never invents a rate
}

/**
 * recalculateRunLineAfterAllocation — re-runs the SAME formula already
 * resolved for this line at ingestion time (commission_rule_id), now that
 * gross_profit is known from confirmed expense allocations. Deliberately
 * does NOT re-resolve attribution or pick a different rule — only
 * re-evaluates applyFormula with the new grossProfit/expensesAmount inputs.
 *
 * Preserves the existing payable_trigger gate exactly as commissionEngine.ts
 * already enforces it — a not-yet-paid invoice never becomes "calculated"
 * just because its expenses are now known; provisional calculation, cash
 * received, and payable commission remain three distinct concepts.
 *
 * Never invents a commission rate: if no active rule with a non-null rate
 * exists for this representative/customer, gross_profit and
 * expenses_amount are still updated (so the dashboard can show the
 * provisional math), but commission_amount stays null and line_status
 * becomes 'needs_configuration' — configured:false signals this to callers.
 *
 * Locked lines are never touched — the caller must check this beforehand
 * and refuse the allocation instead (already enforced in createAllocations).
 */
export async function recalculateRunLineAfterAllocation(commissionRunLineId: string): Promise<RecalculationResult> {
  assertValidUuid(commissionRunLineId, "commissionRunLineId");
  const db = getCommissionOpsDb();

  const lineRows = await db.execute(sql`
    SELECT invoice_amount::text, invoice_status, commission_rule_id, line_status
    FROM commission_run_lines WHERE id = ${commissionRunLineId}::uuid
  `);
  if (lineRows.rows.length === 0) throw Object.assign(new Error("commission_run_line_not_found"), { code: "RUN_LINE_NOT_FOUND" });
  const line = lineRows.rows[0] as { invoice_amount: string | null; invoice_status: string | null; commission_rule_id: string | null; line_status: string };

  if (line.line_status === "locked") {
    throw Object.assign(new Error("commission_run_line_locked"), { code: "RUN_LINE_LOCKED" });
  }

  const activeRows = await db.execute(sql`
    SELECT allocated_amount FROM commission_expense_allocations
    WHERE commission_run_line_id = ${commissionRunLineId}::uuid AND superseded_at IS NULL
  `);
  const confirmedAllocatedExpenses = sumAmounts(
    (activeRows.rows as Array<{ allocated_amount: string }>).map((r) => r.allocated_amount),
  );

  const eligibleRevenue = line.invoice_amount;
  const grossProfit = eligibleRevenue != null ? computeGrossProfit(eligibleRevenue, confirmedAllocatedExpenses) : null;

  let commissionAmount: string | null = null;
  let lineStatus = "needs_configuration";
  let configured = false;

  if (line.commission_rule_id) {
    const ruleRows = await db.execute(sql`
      SELECT id, entity_id, representative_id, core_customer_id, customer_name_pattern,
             formula_type, calculation_basis, commission_rate::text, fixed_amount::text,
             payable_trigger, rule_version, status, effective_from::text, effective_to::text, notes
      FROM commission_rules WHERE id = ${line.commission_rule_id}::uuid
    `);
    if (ruleRows.rows.length > 0) {
      const r = ruleRows.rows[0] as Record<string, unknown>;
      const rule: CommissionRule = {
        id: r.id as string,
        entityId: r.entity_id as string,
        representativeId: r.representative_id as string,
        coreCustomerId: (r.core_customer_id as string) ?? null,
        customerNamePattern: (r.customer_name_pattern as string) ?? null,
        formulaType: r.formula_type as string,
        calculationBasis: (r.calculation_basis as string) ?? null,
        commissionRate: (r.commission_rate as string) ?? null,
        fixedAmount: (r.fixed_amount as string) ?? null,
        payableTrigger: r.payable_trigger as string,
        ruleVersion: Number(r.rule_version),
        status: r.status as string,
        effectiveFrom: r.effective_from as string,
        effectiveTo: (r.effective_to as string) ?? null,
        notes: (r.notes as string) ?? null,
      };

      if (rule.commissionRate != null || rule.fixedAmount != null) {
        configured = true;
        const result = applyFormula(rule, {
          invoiceAmount: eligibleRevenue,
          amountPaid: null,
          grossProfit,
          expensesAmount: confirmedAllocatedExpenses,
          invoiceStatus: line.invoice_status,
        });
        commissionAmount = result.commissionAmount;
        lineStatus = result.lineStatus;
      }
    }
  }

  await db.execute(sql`
    UPDATE commission_run_lines SET
      expenses_amount   = ${confirmedAllocatedExpenses}::numeric,
      gross_profit      = ${grossProfit}::numeric,
      commission_amount = ${commissionAmount}::numeric,
      line_status       = ${lineStatus},
      updated_at        = now()
    WHERE id = ${commissionRunLineId}::uuid
  `);

  return { eligibleRevenue, confirmedAllocatedExpenses, grossProfit, commissionAmount, lineStatus, configured };
}

export { isValidUuid, DOCUMENT_STATUSES, LINE_STATUSES, ALLOCATION_METHODS };
