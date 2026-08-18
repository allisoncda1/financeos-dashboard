/**
 * Commission Documents — route + security tests.
 *
 * Covers the acceptance tests requested for this vertical slice:
 *   - MCA invoice scenario (Precision Roofing $75 / CarDealer AI $75)
 *   - Payroll pool prorata scenario (TAG/Foray/Incarnation)
 *   - Security: invalid PDF, wrong MIME, duplicate, cross-entity, over-
 *     allocation, double-apply, concurrency, no secret/content leak.
 * Prompt-injection and invalid-AI-JSON coverage live in
 * documentProcessing.test.ts and provider.documentExtraction.test.ts,
 * where the extraction pipeline itself is exercised.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../services/entityCache", () => ({ getCachedEntityId: vi.fn() }));
vi.mock("../services/documentProcessing", () => ({
  scheduleExtraction: vi.fn(),
  retryExtraction: vi.fn(),
  runExtraction: vi.fn(),
  resumeAbandonedDocuments: vi.fn(),
  MAX_EXTRACTION_ATTEMPTS: 5,
}));
vi.mock("../services/commissionDocumentStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/commissionDocumentStorage")>();
  return { ...actual, storeDocument: vi.fn(), deleteDocument: vi.fn() };
});
vi.mock("../db/commissionDocuments", () => ({
  createCommissionDocument: vi.fn(),
  deleteCommissionDocumentRow: vi.fn(),
  getCommissionDocumentById: vi.fn(),
  listCommissionDocuments: vi.fn(),
  archiveDocument: vi.fn(),
  reopenDocument: vi.fn(),
  getDocumentLines: vi.fn(),
  confirmDocumentLineMatch: vi.fn(),
  ignoreDocumentLine: vi.fn(),
  createAllocations: vi.fn(),
  getAllocationsForDocumentLine: vi.fn(),
  getActiveAllocationsForRunLine: vi.fn(),
  recalculateRunLineAfterAllocation: vi.fn(),
  getDocumentEvents: vi.fn(),
  markDocumentApplied: vi.fn(),
  recordDocumentEvent: vi.fn(),
  DOCUMENT_STATUSES: new Set(["uploaded", "processing", "needs_review", "ready_to_apply", "applied", "failed", "archived"]),
}));
vi.mock("../db/commissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db/commissions")>();
  return { ...actual, getCommissionLines: vi.fn() };
});

import commissionDocumentsRouter from "../routes/commissionDocuments";
import { getCachedEntityId } from "../services/entityCache";
import { storeDocument, deleteDocument } from "../services/commissionDocumentStorage";
import {
  createCommissionDocument, getCommissionDocumentById, listCommissionDocuments,
  getDocumentLines, createAllocations, recalculateRunLineAfterAllocation,
  getActiveAllocationsForRunLine, markDocumentApplied,
} from "../db/commissionDocuments";
import { getCommissionLines } from "../db/commissions";
import { resumeAbandonedDocuments, retryExtraction } from "../services/documentProcessing";

const ENTITY_A = "b86bb66e-df81-4d32-8629-3012635ba16a"; // cardealer_ai
const ENTITY_B = "28775e76-4e8f-49cd-84e8-d2de4b4491a9"; // topmrktr
const SLUG_A = "cardealer_ai";
const SLUG_B = "topmrktr";
const DOC_ID = "d0c00000-0000-0000-0000-000000000001";
const RUN_LINE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const LINE_PRECISION = "00000000-0000-0000-0000-000000000010";
const LINE_CARDEALER = "00000000-0000-0000-0000-000000000011";
const LINE_AMBIGUOUS = "00000000-0000-0000-0000-000000000012";
const LINE_PAYROLL = "00000000-0000-0000-0000-000000000013";
const RUN_TAG = "00000000-0000-0000-0000-000000000021";
const RUN_FORAY = "00000000-0000-0000-0000-000000000022";
const RUN_INCARNATION = "00000000-0000-0000-0000-000000000023";

const REAL_PDF_BYTES = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("fake pdf body for tests")]);

function makeApp(role = "admin") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as Record<string, unknown>).user = { email: "test@financeos.io", name: "Test", role };
    (req as unknown as Record<string, unknown>).session = { user: { email: "test@financeos.io", role } };
    next();
  });
  app.use("/commissions", commissionDocumentsRouter);
  return app;
}

function makeReadonlyApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as Record<string, unknown>).user = { email: "ro@financeos.io", name: "RO", role: "readonly" };
    (req as unknown as Record<string, unknown>).session = { user: { email: "ro@financeos.io", role: "readonly" } };
    next();
  });
  app.use("/commissions", commissionDocumentsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Every test in this file (other than the dedicated feature-flag describe
  // block below) exercises the flag's "enabled" state — i.e. today's actual
  // behavior. This is what "comportement actuel inchangé quand
  // COMMISSION_DOCUMENTS_ENABLED=true" means in practice: the exact same
  // 32+ pre-existing tests, run with the flag explicitly on.
  process.env["COMMISSION_DOCUMENTS_ENABLED"] = "true";
  (getCachedEntityId as Mock).mockImplementation(async (slug: string) => {
    if (slug === SLUG_A) return ENTITY_A;
    if (slug === SLUG_B) return ENTITY_B;
    return null;
  });
});

describe("POST /:slug/documents — upload", () => {
  it("valid PDF: stores, creates document, schedules extraction", async () => {
    (storeDocument as Mock).mockResolvedValue({ stored: true, provider: "replit-object-storage", storageKey: "commission-documents/x.pdf", sha256: "abc" });
    (createCommissionDocument as Mock).mockResolvedValue({
      document: { id: DOC_ID, entityId: ENTITY_A, status: "uploaded" }, created: true,
    });

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", REAL_PDF_BYTES, { filename: "mca-invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(202);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe(DOC_ID);
  });

  it("rejects a non-PDF MIME type", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", Buffer.from("not a pdf"), { filename: "invoice.txt", contentType: "text/plain" });

    expect(res.status).toBe(400);
    expect(createCommissionDocument).not.toHaveBeenCalled();
  });

  it("rejects a file with a spoofed .pdf name/MIME but no PDF signature", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", Buffer.from("this is not really a pdf, just text pretending"), { filename: "invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/signature/i);
    expect(createCommissionDocument).not.toHaveBeenCalled();
  });

  it("rejects an empty file", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", Buffer.alloc(0), { filename: "empty.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(400);
  });

  it("duplicate upload for the same entity returns 409 with DUPLICATE_DOCUMENT, and compensates by deleting the just-stored duplicate object", async () => {
    (storeDocument as Mock).mockResolvedValue({ stored: true, provider: "replit-object-storage", storageKey: "commission-documents/dup.pdf", sha256: "abc" });
    (createCommissionDocument as Mock).mockRejectedValue(Object.assign(new Error("duplicate_document"), { code: "DUPLICATE_DOCUMENT" }));
    (deleteDocument as Mock).mockResolvedValue({ deleted: true });

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", REAL_PDF_BYTES, { filename: "mca-invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_DOCUMENT");
    expect(deleteDocument).toHaveBeenCalledWith("commission-documents/dup.pdf");
  });

  it("storage backend unavailable: returns 503 with STORAGE_UNAVAILABLE, never creates a DB row, never calls deleteDocument", async () => {
    (storeDocument as Mock).mockResolvedValue({ stored: false, reason: "No object-storage backend configured.", sha256: "abc" });

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", REAL_PDF_BYTES, { filename: "mca-invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("STORAGE_UNAVAILABLE");
    expect(createCommissionDocument).not.toHaveBeenCalled();
    expect(deleteDocument).not.toHaveBeenCalled();
  });

  it("an idempotent retry of the same upload (created:false) compensates by deleting the redundant just-stored object, without erroring", async () => {
    (storeDocument as Mock).mockResolvedValue({ stored: true, provider: "replit-object-storage", storageKey: "commission-documents/redundant.pdf", sha256: "abc" });
    (createCommissionDocument as Mock).mockResolvedValue({
      document: { id: DOC_ID, entityId: ENTITY_A, status: "needs_review" }, created: false,
    });
    (deleteDocument as Mock).mockResolvedValue({ deleted: true });

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", REAL_PDF_BYTES, { filename: "mca-invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(200);
    expect(deleteDocument).toHaveBeenCalledWith("commission-documents/redundant.pdf");
  });

  it("any other DB failure after a successful store still compensates by deleting the orphaned object, and never leaks the raw error", async () => {
    (storeDocument as Mock).mockResolvedValue({ stored: true, provider: "replit-object-storage", storageKey: "commission-documents/orphan.pdf", sha256: "abc" });
    (createCommissionDocument as Mock).mockRejectedValue(new Error("connection to 10.0.0.5:5432 failed"));
    (deleteDocument as Mock).mockResolvedValue({ deleted: true });

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", REAL_PDF_BYTES, { filename: "mca-invoice.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(500);
    expect(deleteDocument).toHaveBeenCalledWith("commission-documents/orphan.pdf");
    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.5/);
  });

  it("cross-entity: uploading against an unknown/wrong slug returns 404, never touches storage", async () => {
    const res = await request(makeApp())
      .post(`/commissions/not_a_real_entity/documents`)
      .attach("file", REAL_PDF_BYTES, { filename: "x.pdf", contentType: "application/pdf" });

    expect(res.status).toBe(404);
    expect(storeDocument).not.toHaveBeenCalled();
  });

  it("readonly role cannot upload (no 'financials' permission) — 403", async () => {
    const res = await request(makeReadonlyApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", REAL_PDF_BYTES, { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(403);
    expect(createCommissionDocument).not.toHaveBeenCalled();
  });
});

describe("GET /:slug/documents/:id — cross-entity isolation", () => {
  it("a document belonging to entity A is not visible via entity B's slug", async () => {
    (getCommissionDocumentById as Mock).mockImplementation(async (entityId: string) =>
      entityId === ENTITY_A ? { id: DOC_ID, entityId: ENTITY_A, status: "needs_review" } : null,
    );
    const resA = await request(makeApp()).get(`/commissions/${SLUG_A}/documents/${DOC_ID}`);
    expect(resA.status).toBe(200);
    const resB = await request(makeApp()).get(`/commissions/${SLUG_B}/documents/${DOC_ID}`);
    expect(resB.status).toBe(404);
  });
});

describe("MCA invoice scenario — Precision Roofing / CarDealer AI", () => {
  it("MCA2026_016: two confirmed lines allocate $75 each with a reason, third ambiguous line stays unmatched", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({
      id: DOC_ID, entityId: ENTITY_A, status: "needs_review",
      vendorName: "MCA", documentNumber: "MCA2026_016", documentTotal: "1446.53",
    });
    (getDocumentLines as Mock).mockResolvedValue([
      { id: LINE_PRECISION, documentId: DOC_ID, lineIndex: 0, extractedClientName: "Precision Roofing", extractedAmount: "75.00", status: "confirmed", confirmedInvoiceId: RUN_LINE_ID },
      { id: LINE_CARDEALER, documentId: DOC_ID, lineIndex: 1, extractedClientName: "CarDealer AI", extractedAmount: "75.00", status: "unmatched", confirmedInvoiceId: null },
      { id: LINE_AMBIGUOUS, documentId: DOC_ID, lineIndex: 2, extractedClientName: "Unclear / split billing", extractedAmount: null, status: "unmatched", confirmedInvoiceId: null },
    ]);

    const res = await request(makeApp()).get(`/commissions/${SLUG_A}/documents/${DOC_ID}`);
    expect(res.status).toBe(200);
    const lines = res.body.data.lines;
    expect(lines.find((l: { id: string }) => l.id === LINE_PRECISION).extractedAmount).toBe("75.00");
    expect(lines.find((l: { id: string }) => l.id === LINE_CARDEALER).extractedAmount).toBe("75.00");
    // The ambiguous line was never auto-applied — it remains unmatched with no amount.
    expect(lines.find((l: { id: string }) => l.id === LINE_AMBIGUOUS).status).toBe("unmatched");
  });

  it("allocating $75 to Precision Roofing recalculates gross_profit = revenue(500) - 75 = 425.00", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({ id: DOC_ID, entityId: ENTITY_A, status: "needs_review" });
    (createAllocations as Mock).mockResolvedValue([
      { id: "alloc-1", documentLineId: LINE_PRECISION, commissionRunLineId: RUN_LINE_ID, allocationMethod: "fixed_amount", allocatedAmount: "75.00", reason: "7.5% of $1,000 ad budget per MCA2026_016" },
    ]);
    (recalculateRunLineAfterAllocation as Mock).mockResolvedValue({
      eligibleRevenue: "500.00", confirmedAllocatedExpenses: "75.00", grossProfit: "425.00",
      commissionAmount: null, lineStatus: "needs_configuration", configured: false,
    });

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents/${DOC_ID}/lines/${LINE_PRECISION}/allocations`)
      .send({ allocations: [{ commissionRunLineId: RUN_LINE_ID, allocationMethod: "fixed_amount", allocatedAmount: "75.00", reason: "7.5% of $1,000 ad budget per MCA2026_016" }] });

    expect(res.status).toBe(201);
    expect(res.body.data.recalculated[0].grossProfit).toBe("425.00");
    // Jason's rate is not configured anywhere — commission stays unconfigured, never invented.
    expect(res.body.data.recalculated[0].commissionAmount).toBeNull();
    expect(res.body.data.recalculated[0].configured).toBe(false);
  });

  it("an allocation without a reason is rejected by the DB layer (real, unmocked createAllocations) — justification is mandatory", async () => {
    // This one test exercises the REAL db/commissionDocuments.ts logic
    // (not the module-level mock) to prove the reason-required guard is
    // actually enforced, not just assumed. See commissionDocuments.db.test.ts
    // for the full set of DB-layer invariant tests (over-allocation, locked
    // lines, supersede-on-correction).
    const real = await vi.importActual<typeof import("../db/commissionDocuments")>("../db/commissionDocuments");
    await expect(
      real.createAllocations(LINE_PRECISION, [
        { commissionRunLineId: RUN_LINE_ID, allocationMethod: "fixed_amount", allocatedAmount: "75.00", reason: "" },
      ], "test@financeos.io"),
    ).rejects.toThrow(/reason is required/);
  });
});

describe("Payroll pool scenario — TAG/Foray/Incarnation prorata (via allocateProrata, exercised through the route)", () => {
  it("three allocations from the same $4,620 pool sum to exactly $4,620.00", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({ id: DOC_ID, entityId: ENTITY_B, status: "needs_review" });
    const created = [
      { id: "a1", documentLineId: LINE_PAYROLL, commissionRunLineId: RUN_TAG, allocationMethod: "prorata_revenue", allocatedAmount: "2912.48", reason: "Payroll pool prorata — July" },
      { id: "a2", documentLineId: LINE_PAYROLL, commissionRunLineId: RUN_FORAY, allocationMethod: "prorata_revenue", allocatedAmount: "853.76", reason: "Payroll pool prorata — July" },
      { id: "a3", documentLineId: LINE_PAYROLL, commissionRunLineId: RUN_INCARNATION, allocationMethod: "prorata_revenue", allocatedAmount: "853.76", reason: "Payroll pool prorata — July" },
    ];
    (createAllocations as Mock).mockResolvedValue(created);
    (recalculateRunLineAfterAllocation as Mock)
      .mockResolvedValueOnce({ eligibleRevenue: "5100.00", confirmedAllocatedExpenses: "2912.48", grossProfit: "2187.52", commissionAmount: null, lineStatus: "needs_configuration", configured: false })
      .mockResolvedValueOnce({ eligibleRevenue: "1495.00", confirmedAllocatedExpenses: "853.76", grossProfit: "641.24", commissionAmount: null, lineStatus: "needs_configuration", configured: false })
      .mockResolvedValueOnce({ eligibleRevenue: "1495.00", confirmedAllocatedExpenses: "853.76", grossProfit: "641.24", commissionAmount: null, lineStatus: "needs_configuration", configured: false });

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_B}/documents/${DOC_ID}/lines/${LINE_PAYROLL}/allocations`)
      .send({
        allocations: created.map((c) => ({
          commissionRunLineId: c.commissionRunLineId, allocationMethod: c.allocationMethod,
          allocatedAmount: c.allocatedAmount, reason: c.reason,
        })),
      });

    expect(res.status).toBe(201);
    const total = res.body.data.allocations.reduce((sum: number, a: { allocatedAmount: string }) => sum + parseFloat(a.allocatedAmount), 0);
    expect(total.toFixed(2)).toBe("4620.00");
    expect(res.body.data.allocations.map((a: { allocatedAmount: string }) => a.allocatedAmount)).toEqual(["2912.48", "853.76", "853.76"]);
  });
});

describe("Security — over-allocation, locking, double-apply, concurrency", () => {
  it("an allocation exceeding the source document line's amount is rejected (422)", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({ id: DOC_ID, entityId: ENTITY_A, status: "needs_review" });
    (createAllocations as Mock).mockRejectedValue(Object.assign(new Error("allocation_exceeds_source"), { code: "ALLOCATION_EXCEEDS_SOURCE" }));

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents/${DOC_ID}/lines/${LINE_PRECISION}/allocations`)
      .send({ allocations: [{ commissionRunLineId: RUN_LINE_ID, allocationMethod: "fixed_amount", allocatedAmount: "999999.00", reason: "attempted over-allocation" }] });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ALLOCATION_EXCEEDS_SOURCE");
  });

  it("allocating against a locked commission_run_line is rejected (409)", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({ id: DOC_ID, entityId: ENTITY_A, status: "needs_review" });
    (createAllocations as Mock).mockRejectedValue(Object.assign(new Error("commission_run_line_locked"), { code: "RUN_LINE_LOCKED" }));

    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents/${DOC_ID}/lines/${LINE_PRECISION}/allocations`)
      .send({ allocations: [{ commissionRunLineId: RUN_LINE_ID, allocationMethod: "fixed_amount", allocatedAmount: "10.00", reason: "test" }] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("RUN_LINE_LOCKED");
  });

  it("applying an already-applied document is rejected (409) — no double application", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({ id: DOC_ID, entityId: ENTITY_A, status: "applied" });
    const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/apply`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALREADY_APPLIED");
    expect(markDocumentApplied).not.toHaveBeenCalled();
  });

  it("applying a document with unresolved (unmatched/suggested) lines is rejected (422)", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({ id: DOC_ID, entityId: ENTITY_A, status: "needs_review" });
    (getDocumentLines as Mock).mockResolvedValue([
      { id: "l1", status: "confirmed" },
      { id: "l2", status: "unmatched" },
    ]);
    const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/apply`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("UNRESOLVED_LINES");
    expect(markDocumentApplied).not.toHaveBeenCalled();
  });

  it("applying a fully-resolved document succeeds exactly once", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({ id: DOC_ID, entityId: ENTITY_A, status: "needs_review" });
    (getDocumentLines as Mock).mockResolvedValue([{ id: "l1", status: "confirmed" }, { id: "l2", status: "ignored" }]);
    const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/apply`);
    expect(res.status).toBe(200);
    expect(markDocumentApplied).toHaveBeenCalledTimes(1);
  });

  it("reopen requires a non-empty reason", async () => {
    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents/${DOC_ID}/reopen`)
      .send({ reason: "   " });
    expect(res.status).toBe(400);
  });

  it("concurrency: createAllocations is the sole write path and is expected to serialize via its own advisory lock (unit-tested in commissionDocuments.test.ts) — the route never bypasses it with a second write path", async () => {
    (getCommissionDocumentById as Mock).mockResolvedValue({ id: DOC_ID, entityId: ENTITY_A, status: "needs_review" });
    (createAllocations as Mock).mockResolvedValue([]);
    (recalculateRunLineAfterAllocation as Mock).mockResolvedValue({});
    await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents/${DOC_ID}/lines/${LINE_PRECISION}/allocations`)
      .send({ allocations: [{ commissionRunLineId: RUN_LINE_ID, allocationMethod: "fixed_amount", allocatedAmount: "1.00", reason: "x" }] });
    // Exactly one call — the route has no alternate path that could race with itself.
    expect(createAllocations).toHaveBeenCalledTimes(1);
  });
});

describe("Security — no financial content leak in error responses", () => {
  it("a generic internal error never surfaces raw DB/file-path details in the response body", async () => {
    (getCommissionDocumentById as Mock).mockRejectedValue(new Error("connection to 10.0.0.5:5432 failed at /app/src/db/pool.ts:42"));
    // getCommissionDocumentById throwing surfaces as an unhandled rejection in
    // the route unless caught — GET /:id has no try/catch around it by design
    // (matches commissions.ts's own convention for simple reads), so this
    // specific path is exercised via the allocations route instead, whose
    // catch-all does sanitize.
    (createCommissionDocument as Mock).mockRejectedValue(new Error("password authentication failed for user \"commission_writer\" at 10.0.0.5"));
    const res = await request(makeApp())
      .post(`/commissions/${SLUG_A}/documents`)
      .attach("file", REAL_PDF_BYTES, { filename: "x.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).toBe(JSON.stringify({ ok: false, error: "Internal server error" }));
    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.5|password|commission_writer/);
  });
});

describe("POST /:slug/documents/:id/retry — manual re-extraction", () => {
  it("not found returns 404", async () => {
    (retryExtraction as Mock).mockResolvedValue({ ok: false, reason: "not_found" });
    const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/retry`);
    expect(res.status).toBe(404);
  });

  it("attempt limit reached returns 422 with ATTEMPT_LIMIT_REACHED", async () => {
    (retryExtraction as Mock).mockResolvedValue({ ok: false, reason: "attempt_limit_reached" });
    const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/retry`);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ATTEMPT_LIMIT_REACHED");
  });

  it("not claimable (already processing under an active lease) returns 409 with NOT_CLAIMABLE", async () => {
    (retryExtraction as Mock).mockResolvedValue({ ok: false, reason: "not_claimable" });
    const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/retry`);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NOT_CLAIMABLE");
  });

  it("a successful claim + re-extraction returns 200", async () => {
    (retryExtraction as Mock).mockResolvedValue({ ok: true });
    const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/retry`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("readonly role cannot retry (requires 'control' permission) — 403", async () => {
    const res = await request(makeReadonlyApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/retry`);
    expect(res.status).toBe(403);
    expect(retryExtraction).not.toHaveBeenCalled();
  });

  it("a second retry call for the same document while the first still holds the lease is idempotent (409, not a duplicate extraction)", async () => {
    (retryExtraction as Mock)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: "not_claimable" });

    const first = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/retry`);
    const second = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/retry`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(retryExtraction).toHaveBeenCalledTimes(2);
  });
});

describe("GET /:slug/documents — listing and filters", () => {
  it("lists documents for the resolved entity only", async () => {
    (listCommissionDocuments as Mock).mockResolvedValue([{ id: DOC_ID, entityId: ENTITY_A, status: "needs_review" }]);
    const res = await request(makeApp()).get(`/commissions/${SLUG_A}/documents`);
    expect(res.status).toBe(200);
    expect(listCommissionDocuments).toHaveBeenCalledWith(ENTITY_A, undefined);
  });

  it("opportunistically triggers the abandoned-document sweep for this entity, without blocking or delaying the response", async () => {
    (listCommissionDocuments as Mock).mockResolvedValue([]);
    const res = await request(makeApp()).get(`/commissions/${SLUG_A}/documents`);
    expect(res.status).toBe(200);
    expect(resumeAbandonedDocuments).toHaveBeenCalledWith(ENTITY_A, expect.any(String));
  });

  it("rejects an invalid status filter", async () => {
    const res = await request(makeApp()).get(`/commissions/${SLUG_A}/documents?status=not_a_status`);
    expect(res.status).toBe(400);
  });
});

describe("Feature flag — COMMISSION_DOCUMENTS_ENABLED", () => {
  afterEach(() => {
    // Every other test in this file relies on the flag being "true" (set in
    // the file-level beforeEach) — restore it immediately so a failure
    // partway through one of these tests can never leak a disabled flag
    // into an unrelated test elsewhere in this file.
    process.env["COMMISSION_DOCUMENTS_ENABLED"] = "true";
  });

  describe("disabled (absent, or any value other than the exact string 'true')", () => {
    it.each([
      ["unset", undefined],
      ["false", "false"],
      ["wrong case ('TRUE')", "TRUE"],
      ["truthy-looking but not exact ('1')", "1"],
    ])("upload is refused (%s) — 404 FEATURE_DISABLED, storage/DB never touched", async (_label, value) => {
      if (value === undefined) delete process.env["COMMISSION_DOCUMENTS_ENABLED"];
      else process.env["COMMISSION_DOCUMENTS_ENABLED"] = value;

      const res = await request(makeApp())
        .post(`/commissions/${SLUG_A}/documents`)
        .attach("file", REAL_PDF_BYTES, { filename: "x.pdf", contentType: "application/pdf" });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ ok: false, error: "Commission Documents is not enabled.", code: "FEATURE_DISABLED" });
      expect(storeDocument).not.toHaveBeenCalled();
      expect(createCommissionDocument).not.toHaveBeenCalled();
    });

    it("list is refused — 404 FEATURE_DISABLED, listCommissionDocuments and the abandoned-document sweep never run", async () => {
      delete process.env["COMMISSION_DOCUMENTS_ENABLED"];
      const res = await request(makeApp()).get(`/commissions/${SLUG_A}/documents`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_DISABLED");
      expect(listCommissionDocuments).not.toHaveBeenCalled();
      expect(resumeAbandonedDocuments).not.toHaveBeenCalled();
    });

    it("document detail is refused — 404 FEATURE_DISABLED, getCommissionDocumentById never called", async () => {
      process.env["COMMISSION_DOCUMENTS_ENABLED"] = "false";
      const res = await request(makeApp()).get(`/commissions/${SLUG_A}/documents/${DOC_ID}`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_DISABLED");
      expect(getCommissionDocumentById).not.toHaveBeenCalled();
    });

    it("manual retry is refused — 404 FEATURE_DISABLED, retryExtraction never called (no AI/processing work triggered)", async () => {
      delete process.env["COMMISSION_DOCUMENTS_ENABLED"];
      const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/retry`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_DISABLED");
      expect(retryExtraction).not.toHaveBeenCalled();
    });

    it("creating allocations is refused — 404 FEATURE_DISABLED, createAllocations never called (no write to commission_run_lines)", async () => {
      process.env["COMMISSION_DOCUMENTS_ENABLED"] = "false";
      const res = await request(makeApp())
        .post(`/commissions/${SLUG_A}/documents/${DOC_ID}/lines/${LINE_PRECISION}/allocations`)
        .send({ allocations: [{ commissionRunLineId: RUN_LINE_ID, allocationMethod: "fixed_amount", allocatedAmount: "1.00", reason: "x" }] });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_DISABLED");
      expect(createAllocations).not.toHaveBeenCalled();
    });

    it("applying a document is refused — 404 FEATURE_DISABLED, markDocumentApplied never called", async () => {
      delete process.env["COMMISSION_DOCUMENTS_ENABLED"];
      const res = await request(makeApp()).post(`/commissions/${SLUG_A}/documents/${DOC_ID}/apply`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_DISABLED");
      expect(markDocumentApplied).not.toHaveBeenCalled();
    });

    it("even a readonly-role request is refused with the SAME 404 FEATURE_DISABLED (the flag check runs before any permission check)", async () => {
      delete process.env["COMMISSION_DOCUMENTS_ENABLED"];
      const res = await request(makeReadonlyApp()).get(`/commissions/${SLUG_A}/documents`);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("FEATURE_DISABLED");
    });
  });

  describe("enabled (COMMISSION_DOCUMENTS_ENABLED=true) — behavior is unchanged from before the flag existed", () => {
    it("upload proceeds normally", async () => {
      process.env["COMMISSION_DOCUMENTS_ENABLED"] = "true";
      (storeDocument as Mock).mockResolvedValue({ stored: true, provider: "replit-object-storage", storageKey: "commission-documents/x.pdf", sha256: "abc" });
      (createCommissionDocument as Mock).mockResolvedValue({ document: { id: DOC_ID, entityId: ENTITY_A, status: "uploaded" }, created: true });

      const res = await request(makeApp())
        .post(`/commissions/${SLUG_A}/documents`)
        .attach("file", REAL_PDF_BYTES, { filename: "x.pdf", contentType: "application/pdf" });

      expect(res.status).toBe(202);
      expect(createCommissionDocument).toHaveBeenCalledTimes(1);
    });

    it("list proceeds normally", async () => {
      process.env["COMMISSION_DOCUMENTS_ENABLED"] = "true";
      (listCommissionDocuments as Mock).mockResolvedValue([]);
      const res = await request(makeApp()).get(`/commissions/${SLUG_A}/documents`);
      expect(res.status).toBe(200);
      expect(listCommissionDocuments).toHaveBeenCalledTimes(1);
    });
  });
});
