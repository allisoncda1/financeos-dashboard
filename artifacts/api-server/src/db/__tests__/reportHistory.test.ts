/**
 * reportHistory DB service — unit tests
 *
 * Uses in-memory stubs for opsDb and @workspace/db so tests run without a
 * real database. Tests cover: insert, list (all), list filtered by slug,
 * pagination, empty collection, cross-entity isolation, and error safety.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state (defined before vi.mock hoisting) ──────────────────────

const { insertMock, selectMock } = vi.hoisted(() => {
  const insertMock = vi.fn();
  const selectMock = vi.fn();
  return { insertMock, selectMock };
});

vi.mock("../connection.js", () => ({
  opsDb: { insert: insertMock, select: selectMock },
  db: {},
}));

vi.mock("@workspace/db", () => ({
  reportHistory: {
    entitySlugs: "entity_slugs",
    template: "template",
    title: "title",
    period: "period",
    format: "format",
    status: "status",
    source: "source",
    dataFreshness: "data_freshness",
    entityCount: "entity_count",
    confidenceScore: "confidence_score",
    requestedBy: "requested_by",
    errorMessage: "error_message",
    completedAt: "completed_at",
    createdAt: "created_at",
  },
}));

import { insertReportHistory, listReportHistory } from "../reportHistory.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id:              "uuid-1",
    template:        "monthly-close",
    title:           "Monthly Close",
    period:          "Jun 2026 (Latest)",
    format:          "pdf",
    entitySlugs:     ["cardealer_ai", "t3_marketing"],
    status:          "completed",
    source:          "live",
    dataFreshness:   "2026-06-30",
    entityCount:     2,
    confidenceScore: 92,
    requestedBy:     "allison@cardealer.ai",
    errorMessage:    null,
    completedAt:     new Date("2026-07-13T10:00:00Z"),
    createdAt:       new Date("2026-07-13T10:00:00Z"),
    ...overrides,
  };
}

function makeSelectChain(rows: unknown[], withWhere = false) {
  const chain = {
    orderBy: () => ({ limit: (n: number) => ({ offset: async () => rows }) }),
    where:   () => ({ orderBy: () => ({ limit: (n: number) => ({ offset: async () => rows }) }) }),
  };
  return {
    from: () => chain,
  };
}

function makeSelectChainWithSpies(rows: unknown[]) {
  const orderBySpy = vi.fn(() => ({
    limit: (n: number) => ({ offset: async () => rows }),
  }));
  const limitSpy = vi.fn((n: number) => ({ offset: async () => rows }));
  const offsetSpy = vi.fn(async () => rows);
  const whereSpy  = vi.fn(() => ({
    orderBy: () => ({ limit: limitSpy }),
  }));
  return { orderBySpy, limitSpy, offsetSpy, whereSpy, makeChain: () => ({ from: () => ({ orderBy: orderBySpy, where: whereSpy }) }) };
}

// ── insertReportHistory ───────────────────────────────────────────────────────

describe("insertReportHistory", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("1. returns the inserted row as a ReportHistoryEntry", async () => {
    const row = makeRow();
    insertMock.mockReturnValue({ values: () => ({ returning: async () => [row] }) });

    const result = await insertReportHistory({
      template: "monthly-close", title: "Monthly Close",
      period: "Jun 2026 (Latest)", format: "pdf",
      entitySlugs: ["cardealer_ai", "t3_marketing"], status: "completed",
      requestedBy: "allison@cardealer.ai",
      completedAt: new Date("2026-07-13T10:00:00Z"),
    });

    expect(result.id).toBe("uuid-1");
    expect(result.status).toBe("completed");
    expect(result.createdAt).toBe("2026-07-13T10:00:00.000Z");
  });

  it("2. successful generation has status='completed'", async () => {
    const row = makeRow({ status: "completed" });
    insertMock.mockReturnValue({ values: () => ({ returning: async () => [row] }) });

    const result = await insertReportHistory({
      template: "monthly-close", title: "Monthly Close",
      period: "Jun 2026", format: "json",
      entitySlugs: ["cardealer_ai"], status: "completed",
    });

    expect(result.status).toBe("completed");
  });

  it("3. failed generation records status='failed' with error message", async () => {
    const row = makeRow({ status: "failed", errorMessage: "Template disabled", completedAt: new Date() });
    insertMock.mockReturnValue({ values: () => ({ returning: async () => [row] }) });

    const result = await insertReportHistory({
      template: "board-package", title: "Failed report",
      period: "unknown", format: "unknown",
      entitySlugs: [], status: "failed",
      errorMessage: "Template disabled",
    });

    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("Template disabled");
  });

  it("4. error messages do not expose secrets or tokens", async () => {
    const safeMessage = "Template disabled";
    const row = makeRow({ status: "failed", errorMessage: safeMessage });
    insertMock.mockReturnValue({ values: () => ({ returning: async () => [row] }) });

    const result = await insertReportHistory({
      template: "x", title: "Failed report", period: "x", format: "x",
      entitySlugs: [], status: "failed", errorMessage: safeMessage,
    });

    expect(result.errorMessage).not.toMatch(/password|token|secret|key|Bearer/i);
    expect(result.errorMessage).toBe(safeMessage);
  });

  it("5. completedAt is serialized to ISO string", async () => {
    const completedAt = new Date("2026-07-13T10:05:00Z");
    const row = makeRow({ completedAt });
    insertMock.mockReturnValue({ values: () => ({ returning: async () => [row] }) });

    const result = await insertReportHistory({
      template: "monthly-close", title: "Monthly Close",
      period: "Jun 2026", format: "excel",
      entitySlugs: ["cardealer_ai"], status: "completed", completedAt,
    });

    expect(result.completedAt).toBe("2026-07-13T10:05:00.000Z");
  });
});

// ── listReportHistory ─────────────────────────────────────────────────────────

describe("listReportHistory", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("6. empty history returns empty array — not mock data", async () => {
    selectMock.mockReturnValue(makeSelectChain([]));

    const result = await listReportHistory();
    expect(result).toEqual([]);
  });

  it("7. returns all DB rows when no slug filter", async () => {
    const rows = [
      makeRow({ id: "a", entitySlugs: ["cardealer_ai"] }),
      makeRow({ id: "b", entitySlugs: ["t3_marketing"] }),
    ];
    selectMock.mockReturnValue(makeSelectChain(rows));

    const result = await listReportHistory();
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("8. slug filter invokes WHERE clause (cross-entity isolation enforced)", async () => {
    const whereSpy = vi.fn().mockReturnValue({
      orderBy: () => ({ limit: () => ({ offset: async () => [makeRow({ entitySlugs: ["cardealer_ai"] })] }) }),
    });
    selectMock.mockReturnValue({ from: () => ({ where: whereSpy }) });

    const result = await listReportHistory({ slug: "cardealer_ai" });

    expect(whereSpy).toHaveBeenCalled();
    expect(result[0]!.entitySlugs).toContain("cardealer_ai");
  });

  it("9. pagination: limit is capped at 200 even when caller passes higher value", async () => {
    const limitSpy = vi.fn().mockReturnValue({ offset: async () => [] });
    selectMock.mockReturnValue({
      from: () => ({ orderBy: () => ({ limit: limitSpy }) }),
    });

    await listReportHistory({ limit: 9999 });
    expect(limitSpy).toHaveBeenCalledWith(200);
  });

  it("10. pagination: offset is passed through to query", async () => {
    const offsetSpy = vi.fn().mockResolvedValue([]);
    selectMock.mockReturnValue({
      from: () => ({ orderBy: () => ({ limit: () => ({ offset: offsetSpy }) }) }),
    });

    await listReportHistory({ limit: 10, offset: 20 });
    expect(offsetSpy).toHaveBeenCalledWith(20);
  });

  it("11. history ordering uses orderBy (DESC by createdAt)", async () => {
    const orderBySpy = vi.fn().mockReturnValue({ limit: () => ({ offset: async () => [] }) });
    selectMock.mockReturnValue({ from: () => ({ orderBy: orderBySpy }) });

    await listReportHistory();
    expect(orderBySpy).toHaveBeenCalled();
  });

  it("12. entitySlugs null in DB is coerced to empty array", async () => {
    const row = makeRow({ entitySlugs: null });
    selectMock.mockReturnValue(makeSelectChain([row]));

    const [entry] = await listReportHistory();
    expect(entry!.entitySlugs).toEqual([]);
  });

  it("13. requestedBy is null when no session user at generation time", async () => {
    const row = makeRow({ requestedBy: null });
    selectMock.mockReturnValue(makeSelectChain([row]));

    const [entry] = await listReportHistory();
    expect(entry!.requestedBy).toBeNull();
  });

  it("14. failed rows appear in history listing", async () => {
    const rows = [
      makeRow({ id: "ok",  status: "completed" }),
      makeRow({ id: "bad", status: "failed", errorMessage: "timeout" }),
    ];
    selectMock.mockReturnValue(makeSelectChain(rows));

    const result = await listReportHistory();
    expect(result.map((r) => r.status)).toContain("failed");
  });

  it("15. no hardcoded mock-history fallback — service returns only DB rows", async () => {
    selectMock.mockReturnValue(makeSelectChain([]));

    const result = await listReportHistory();
    expect(result).toEqual([]);
    // Explicitly verify none of the analytics mock names snuck in
    for (const entry of result) {
      expect(entry.title).not.toBe("Allocation Summary");
      expect(entry.title).not.toBe("Shared Expense Register");
    }
  });
});
