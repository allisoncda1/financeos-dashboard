/**
 * PDF Text Extraction — local, no network call.
 *
 * Runs entirely in-process (pdf-parse). The extracted text is later handed
 * to an AIProvider as untrusted DATA (see ai/promptBuilder.ts's injection
 * guard) — this module itself does nothing with the text beyond returning
 * it, and never executes anything found inside a PDF.
 *
 * Also validates the file is a genuine PDF by signature (magic bytes), not
 * just by its declared MIME type or file extension — both are attacker-
 * controlled and must never be trusted alone.
 *
 * KNOWN LIMITATION — timeout is NOT a hard kill:
 *   pdf-parse (via its bundled pdfjs) does CPU-bound, synchronous-ish
 *   parsing work that is NOT true async I/O. Racing it against a timeout
 *   Promise stops US from waiting past the deadline, but does NOT stop the
 *   underlying parse from continuing to consume the event loop in the
 *   background until it finishes on its own — Node has no way to cancel a
 *   synchronous computation short of running it in a Worker thread (not
 *   done here, to keep this MVP's process model simple). The real defense
 *   against a pathological PDF is therefore the TIGHT UPFRONT BOUNDS below
 *   (file size, page count, text length), not the timeout, which is only
 *   a best-effort signal to fail the request faster from the caller's
 *   point of view.
 */
import pdfParse from "pdf-parse";

const PDF_MAGIC = Buffer.from("%PDF-");
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB — enforced again below at the Multer layer
const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);
const MAX_PAGES = 50; // vendor invoices are not 500-page documents; bounds pdf-parse's own work
const MAX_TEXT_LENGTH = 300_000; // characters — bounds the AI prompt size/cost regardless of source page count
const PARSE_TIMEOUT_MS = 20_000; // best-effort only — see module doc above

export class PdfProcessingError extends Error {
  readonly code: "ENCRYPTED" | "CORRUPTED" | "TIMEOUT" | "TOO_MANY_PAGES";
  constructor(code: PdfProcessingError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "PdfProcessingError";
  }
}

export type PdfValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

/**
 * validatePdfUpload — checks MIME type, file size, and the PDF file
 * signature (magic bytes) before any parsing is attempted. A file with a
 * spoofed .pdf extension or Content-Type but non-PDF bytes is rejected
 * here, before pdf-parse ever sees it. This is the SAME check enforced a
 * second time at the Multer layer (routes/commissionDocuments.ts's
 * `limits: { fileSize }`) — defense in depth, not a single point of trust.
 */
export function validatePdfUpload(file: { mimetype: string; size: number; buffer: Buffer }): PdfValidationResult {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return { valid: false, reason: `Unsupported content type: ${file.mimetype}. Only application/pdf is accepted.` };
  }
  if (file.size <= 0) {
    return { valid: false, reason: "Empty file." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, reason: `File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit.` };
  }
  if (!file.buffer.subarray(0, 5).equals(PDF_MAGIC)) {
    return { valid: false, reason: "File does not start with the PDF signature (%PDF-) — not a genuine PDF." };
  }
  return { valid: true };
}

export interface ExtractedPdfText {
  text: string;
  numPages: number;
  truncated: boolean;
}

function classifyParseError(err: unknown): PdfProcessingError {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  // Best-effort classification — pdf-parse's underlying pdfjs does not
  // expose a stable, documented error-code contract, so this matches on
  // known substrings rather than a type. Any parse failure we cannot
  // positively identify as an encryption issue is treated as corrupted,
  // never surfaced with the raw underlying message (which could contain
  // internal paths).
  if (lower.includes("encrypt") || lower.includes("password")) {
    return new PdfProcessingError("ENCRYPTED", "This PDF is password-protected or encrypted and cannot be processed. Please upload an unprotected copy.");
  }
  return new PdfProcessingError("CORRUPTED", "This PDF could not be parsed — it may be corrupted or use an unsupported format.");
}

/**
 * extractPdfText — pure local extraction, bounded on every axis available:
 *   - MAX_PAGES passed to pdf-parse itself, so it never attempts to parse
 *     beyond a reasonable vendor-invoice page count.
 *   - A best-effort timeout race (see module doc — not a hard kill).
 *   - Extracted text is truncated to MAX_TEXT_LENGTH before being returned,
 *     regardless of source size, bounding what ever reaches the AI prompt.
 * Throws PdfProcessingError (ENCRYPTED/CORRUPTED/TIMEOUT) on failure; the
 * caller (documentProcessing.ts) persists err.message directly for these
 * (already user-safe, no internal detail) rather than sanitizing further.
 */
export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdfText> {
  const parsePromise = pdfParse(buffer, { max: MAX_PAGES }).catch((err: unknown) => {
    throw classifyParseError(err);
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new PdfProcessingError("TIMEOUT", "PDF parsing exceeded the time limit for this document.")), PARSE_TIMEOUT_MS);
  });

  const result = await Promise.race([parsePromise, timeoutPromise]);

  const truncated = result.text.length > MAX_TEXT_LENGTH;
  const text = truncated ? result.text.slice(0, MAX_TEXT_LENGTH) : result.text;

  return { text, numPages: result.numpages, truncated };
}

export { MAX_FILE_SIZE_BYTES, MAX_PAGES, MAX_TEXT_LENGTH, PARSE_TIMEOUT_MS };
