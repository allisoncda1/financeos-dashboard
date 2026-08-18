/**
 * createCommissionDocument — duplicate-detection unwrapping (real, unmocked
 * db/commissionDocuments.ts; only the DB connection itself is faked).
 *
 * Regression test for a real bug the CI-only PostgreSQL integration script
 * (scripts/test-commission-documents-pg.ts) caught against a genuine
 * Postgres instance: drizzle-orm (0.4x) wraps every driver error in a
 * DrizzleQueryError whose own `.message` is just "Failed query: <sql>" —
 * not the underlying Postgres error text. The real pg DatabaseError (with
 * the SQLSTATE `code` and `constraint` name) lives in `.cause`. Matching on
 * `err.message` directly never matched, so a genuine duplicate upload fell
 * through to a raw 500 instead of the intended 409 DUPLICATE_DOCUMENT. This
 * test reproduces that exact wrapping shape without needing a live database.
 */
import { describe, it, expect, vi } from "vitest";

const executeMock = vi.fn();

vi.mock("../db/ops-connection", () => ({
  getCommissionOpsDb: () => ({ execute: executeMock }),
}));

import { createCommissionDocument } from "../db/commissionDocuments";

function drizzleWrappedUniqueViolation(constraint: string) {
  const pgError = Object.assign(
    new Error(`duplicate key value violates unique constraint "${constraint}"`),
    { code: "23505", constraint },
  );
  // Mirrors drizzle-orm's DrizzleQueryError: outer message is the failed
  // query text, not the driver error — the real error is in `.cause`.
  return Object.assign(
    new Error("Failed query: INSERT INTO commission_documents (...) VALUES (...)\nparams: [...]"),
    { cause: pgError },
  );
}

describe("createCommissionDocument — duplicate detection survives drizzle's error wrapping", () => {
  it("a unique_violation on uq_commission_documents_entity_sha256, wrapped in a DrizzleQueryError-shaped cause, is classified as DUPLICATE_DOCUMENT", async () => {
    executeMock
      .mockResolvedValueOnce({ rows: [] }) // idempotency-key lookup: no existing row
      .mockRejectedValueOnce(drizzleWrappedUniqueViolation("uq_commission_documents_entity_sha256"));

    await expect(
      createCommissionDocument({
        entityId: "b86bb66e-df81-4d32-8629-3012635ba16a", fileName: "x.pdf", contentType: "application/pdf",
        fileSize: 100, sha256: "sha-x", storageKey: "key-x", storageProvider: "replit-object-storage",
        createdBy: "test", idempotencyKey: "idem-x",
      }),
    ).rejects.toMatchObject({ code: "DUPLICATE_DOCUMENT" });
  });

  it("a unique_violation on a DIFFERENT constraint (e.g. the idempotency-key index) is NOT misclassified as DUPLICATE_DOCUMENT", async () => {
    executeMock
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(drizzleWrappedUniqueViolation("uq_commission_documents_idempotency"));

    await expect(
      createCommissionDocument({
        entityId: "b86bb66e-df81-4d32-8629-3012635ba16a", fileName: "x.pdf", contentType: "application/pdf",
        fileSize: 100, sha256: "sha-y", storageKey: "key-y", storageProvider: "replit-object-storage",
        createdBy: "test", idempotencyKey: "idem-y",
      }),
    ).rejects.not.toMatchObject({ code: "DUPLICATE_DOCUMENT" });
  });

  it("a completely unrelated error (e.g. connection failure) propagates unchanged, not misclassified", async () => {
    executeMock
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("connection terminated unexpectedly"));

    await expect(
      createCommissionDocument({
        entityId: "b86bb66e-df81-4d32-8629-3012635ba16a", fileName: "x.pdf", contentType: "application/pdf",
        fileSize: 100, sha256: "sha-z", storageKey: "key-z", storageProvider: "replit-object-storage",
        createdBy: "test", idempotencyKey: "idem-z",
      }),
    ).rejects.toThrow("connection terminated unexpectedly");
  });
});
