/**
 * Commission Document Processing — async orchestration, recoverable without
 * an external queue platform.
 *
 * Reliability model (see db/commissionDocuments.ts for the underlying
 * primitives):
 *   1. The upload route persists the document row (status='uploaded')
 *      BEFORE responding 202 — state exists durably before the client is
 *      told to expect processing.
 *   2. scheduleExtraction() fires a detached in-process job via
 *      setImmediate(). If the process crashes between step 1 and this job
 *      actually running, the document is simply left in 'uploaded' —
 *      inert, but never lost and never silently retried in a loop.
 *   3. runExtraction() always starts by calling claimDocumentForProcessing(),
 *      an atomic UPDATE that only succeeds for an 'uploaded' document or a
 *      'processing' document whose lease has expired. This is what makes
 *      it safe to call runExtraction() more than once for the same
 *      document (manual retry, a resumed sweep, or an actual race) — at
 *      most one caller's claim can ever succeed at a time.
 *   4. resumeAbandonedDocuments() is the "self-heal" sweep: called
 *      opportunistically (from the document list route) to find anything
 *      stuck in 'uploaded' or lease-expired 'processing' and re-trigger
 *      extraction for it. No document is ever permanently stuck.
 *   5. On completion (success or failure), the lease is always cleared.
 *      On failure, next_retry_at is stamped with an exponential backoff so
 *      the same document isn't immediately re-offered to every sweep call.
 *
 * This is explicitly a single-instance-simple mechanism, not a durable
 * distributed queue: a claim only protects against a SECOND concurrent
 * attempt on the SAME document row, backed by Postgres row locking — it
 * does not provide cross-restart exactly-once delivery guarantees beyond
 * "the document row itself is the durable queue".
 */
import {
  getCommissionDocumentById,
  claimDocumentForProcessing,
  completeProcessing,
  findClaimableDocuments,
  replaceDocumentLines,
  recordDocumentEvent,
} from "../db/commissionDocuments";
import { retrieveDocument } from "./commissionDocumentStorage";
import { extractPdfText, PdfProcessingError } from "./pdfExtraction";
import { getAiProviderReadiness } from "./readiness";
import { getProvider } from "../ai/provider";

export const MAX_EXTRACTION_ATTEMPTS = 5;
export const LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes — must comfortably exceed pdf-parse + AI call time
const BASE_RETRY_DELAY_MS = 30 * 1000; // 30s, doubles per attempt, capped

/** Strips anything that looks like a file path, stack frame, or long token from an error message. */
function sanitizeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return raw
    .replace(/\/[^\s"']+/g, "[path]")
    .replace(/at .+\(.+\)/g, "[stack]")
    .slice(0, 500);
}

function computeNextRetryDelayMs(attempts: number): number {
  const capped = Math.min(attempts, 6);
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** (capped - 1), 30 * 60 * 1000); // cap at 30 minutes
}

/**
 * scheduleExtraction — fire-and-forget. Never rejects the caller's promise
 * chain; all errors are caught and persisted onto the document row itself
 * via completeProcessing(). Call this AFTER the HTTP response for upload
 * has already been sent (or without awaiting it) so extraction never
 * blocks the upload request.
 */
export function scheduleExtraction(entityId: string, documentId: string, performedBy: string): void {
  setImmediate(() => {
    runExtraction(entityId, documentId, performedBy).catch((err) => {
      console.error(`[documentProcessing] Unhandled extraction error for ${documentId}: ${sanitizeError(err)}`);
    });
  });
}

/**
 * runExtraction — claims the document, runs the pipeline, and always
 * completes (success or failure) so the lease never lingers. Safe to call
 * repeatedly for the same document: if the claim fails (already being
 * processed by someone else, or not in a claimable state), this is a
 * silent, harmless no-op — never a duplicate extraction.
 */
export async function runExtraction(entityId: string, documentId: string, performedBy: string): Promise<{ ran: boolean; reason?: string }> {
  const document = await getCommissionDocumentById(entityId, documentId);
  if (!document) return { ran: false, reason: "not_found" };

  if (document.attempts >= MAX_EXTRACTION_ATTEMPTS) {
    await completeProcessing(documentId, {
      status: "failed",
      lastError: `Extraction attempt limit reached (${MAX_EXTRACTION_ATTEMPTS}). Manual intervention required.`,
      nextRetryAt: null,
    });
    return { ran: false, reason: "attempt_limit_reached" };
  }

  const claim = await claimDocumentForProcessing(documentId, LEASE_DURATION_MS);
  if (!claim.claimed) {
    // Someone else already has the lease, or it's in a non-claimable state
    // (needs_review/applied/archived/etc.) — never treated as an error.
    return { ran: false, reason: claim.reason };
  }

  await recordDocumentEvent({ documentId, eventType: "extraction_started", performedBy });

  try {
    // Defense-in-depth backstop: routes/commissionDocuments.ts already
    // refuses upload/retry with 503 before this function is ever reached,
    // but resumeAbandonedDocuments() is a fire-and-forget sweep with no
    // HTTP request to refuse — this is the one path that reaches
    // runExtraction() without having passed that route-level gate. Checked
    // before any storage read or PDF parsing, not just before the AI call,
    // since none of that work is worth doing if this fails anyway.
    const readiness = getAiProviderReadiness();
    if (!readiness.ready) {
      throw new Error(readiness.reason ?? "AI provider is not configured for production use.");
    }

    const retrieved = await retrieveDocument(document.storageKey);
    if (!retrieved.available) {
      throw new Error(retrieved.reason);
    }

    const { text } = await extractPdfText(retrieved.data);

    const provider = getProvider();
    const aiResponse = await provider.extractCommissionDocument({ documentText: text, fileName: document.fileName });

    const structured = aiResponse.structured as
      | { vendorName: string | null; documentNumber: string | null; documentDate: string | null;
          documentTotal: string | null; lines: Array<{ lineIndex: number; clientName: string | null;
          amount: string | null; description: string | null; proofPage: number | null; ambiguous: boolean }> }
      | undefined;

    if (!structured) {
      await completeProcessing(documentId, {
        status: "failed",
        lastError: "AI provider did not return a valid, parseable extraction result.",
        nextRetryAt: new Date(Date.now() + computeNextRetryDelayMs(claim.document.attempts)).toISOString(),
      });
      await recordDocumentEvent({ documentId, eventType: "extraction_failed", performedBy, reason: "invalid_ai_response" });
      return { ran: true };
    }

    let periodYear: number | null = null;
    let periodMonth: number | null = null;
    if (structured.documentDate && /^\d{4}-\d{2}-\d{2}$/.test(structured.documentDate)) {
      const [y, m] = structured.documentDate.split("-").map(Number);
      periodYear = y;
      periodMonth = m;
    }

    await replaceDocumentLines(documentId, structured.lines.map((l) => ({
      lineIndex: l.lineIndex,
      rawText: null,
      extractedClientName: l.clientName,
      extractedAmount: l.amount,
      extractedDescription: l.description,
      proofPage: l.proofPage,
    })));

    // Extraction always requires human review before anything can be
    // applied — no line is ever auto-confirmed, regardless of confidence.
    await completeProcessing(documentId, {
      status: "needs_review",
      vendorName: structured.vendorName,
      documentNumber: structured.documentNumber,
      documentDate: structured.documentDate,
      documentTotal: structured.documentTotal,
      periodYear,
      periodMonth,
    });
    await recordDocumentEvent({
      documentId, eventType: "extraction_succeeded", performedBy,
      afterSnapshot: { lineCount: structured.lines.length, ambiguousCount: structured.lines.filter((l) => l.ambiguous).length },
    });
    return { ran: true };
  } catch (err: unknown) {
    const message = err instanceof PdfProcessingError ? err.message : sanitizeError(err);
    await completeProcessing(documentId, {
      status: "failed",
      lastError: message,
      nextRetryAt: new Date(Date.now() + computeNextRetryDelayMs(claim.document.attempts)).toISOString(),
    });
    await recordDocumentEvent({ documentId, eventType: "extraction_failed", performedBy, reason: message });
    return { ran: true };
  }
}

/**
 * retryExtraction — the manual "relancer une extraction échouée" action.
 * Idempotent: relies entirely on claimDocumentForProcessing's atomic
 * guard, so calling this twice in quick succession (double-click, retried
 * request) never runs extraction twice — the second call's claim simply
 * fails with "not_claimable" once the first has already claimed the row.
 */
export async function retryExtraction(entityId: string, documentId: string, performedBy: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const document = await getCommissionDocumentById(entityId, documentId);
  if (!document) return { ok: false, reason: "not_found" };
  if (document.attempts >= MAX_EXTRACTION_ATTEMPTS) {
    return { ok: false, reason: "attempt_limit_reached" };
  }
  // Only failed documents, or processing documents whose lease has expired,
  // are meaningfully "retryable" from a human's perspective — the route
  // layer enforces this for the UI; runExtraction's claim enforces it for
  // real regardless of what the route checked.
  await recordDocumentEvent({ documentId, eventType: "extraction_retried", performedBy });
  const result = await runExtraction(entityId, documentId, performedBy);
  if (!result.ran && result.reason === "not_claimable") {
    return { ok: false, reason: "not_claimable" };
  }
  return { ok: true };
}

/**
 * resumeAbandonedDocuments — the opportunistic self-heal sweep. Called from
 * the document list route so simply loading the page re-triggers
 * extraction for anything left in 'uploaded' (process died before its
 * setImmediate fired) or 'processing' past its lease (process died
 * mid-extraction). Never awaited by the caller — fire-and-forget, same as
 * scheduleExtraction, so listing documents is never slowed down by this.
 */
export function resumeAbandonedDocuments(entityId: string, performedBy: string): void {
  setImmediate(async () => {
    try {
      const claimable = await findClaimableDocuments(entityId);
      for (const doc of claimable) {
        await recordDocumentEvent({ documentId: doc.id, eventType: "extraction_abandoned_resumed", performedBy });
        await runExtraction(entityId, doc.id, performedBy);
      }
    } catch (err: unknown) {
      console.error(`[documentProcessing] resumeAbandonedDocuments failed for entity ${entityId}: ${sanitizeError(err)}`);
    }
  });
}
