/**
 * RC-017 route-ordering integration test.
 *
 * Proves that `GET /api/model/history` is handled by the consolidated History
 * handler (which calls dataSource.getHistory) and is NEVER intercepted by the
 * dynamic `GET /api/model/:slug` handler (which calls getEntityMetrics). If the
 * dynamic route were registered first, "history" would be treated as an entity
 * slug and this test would fail.
 *
 * The router is mounted directly on a bare express app (no requireAuth gate),
 * with req.log stubbed, and every dataSource loader mocked, so the test asserts
 * pure routing/handler-dispatch behavior — no database is touched.
 */
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { HistoryResponse } from "../lib/types";

// Mock the data source: each loader records that it was invoked so we can prove
// which handler fired. getHistory returns a valid HistoryResponse shape.
const getHistory = vi.fn();
const getEntityMetrics = vi.fn();
const getEntityAnomalies = vi.fn();
const getDataFreshness = vi.fn();
const getConsolidatedCashFlow = vi.fn();
const getEntityHistory = vi.fn();

vi.mock("../lib/dataSource", () => ({
  getPortfolioSummary: vi.fn(),
  getValidationSummary: vi.fn(),
  getDataFreshness: (...a: unknown[]) => getDataFreshness(...a),
  getEntityMetrics: (...a: unknown[]) => getEntityMetrics(...a),
  getEntityAnomalies: (...a: unknown[]) => getEntityAnomalies(...a),
  getEntityFinancials: vi.fn(),
  getEntityHistory: (...a: unknown[]) => getEntityHistory(...a),
  getEntityCustomers: vi.fn(),
  getEntityVendors: vi.fn(),
  getEntityBanking: vi.fn(),
  getConsolidatedCashFlow: (...a: unknown[]) => getConsolidatedCashFlow(...a),
  getHistory: (...a: unknown[]) => getHistory(...a),
}));

// snapshotStore is imported by the model router; stub it so no pg pool opens.
vi.mock("../lib/snapshotStore", () => ({
  archiveMetricSnapshot: vi.fn().mockResolvedValue(undefined),
  getMetricSnapshots: vi.fn().mockResolvedValue([]),
}));

import modelRouter from "../routes/model";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>)["log"] = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    next();
  });
  app.use("/api", modelRouter);
  return app;
}

const HISTORY: HistoryResponse = {
  available: true,
  status: "available",
  entities: ["CarDealer.ai"],
  period_start: "2026-01",
  period_end: "2026-02",
  generated_at: "2026-07-15T00:00:00.000Z",
  monthly: [
    { period: "2026-01", period_start: "2026-01-01", period_end: "2026-01-31", revenue: 100, net_income: 10, by_entity: {}, partial: false, contributing: ["CarDealer_ai"], missing: [] },
    { period: "2026-02", period_start: "2026-02-01", period_end: "2026-02-28", revenue: 150, net_income: 25, by_entity: {}, partial: false, contributing: ["CarDealer_ai"], missing: [] },
  ],
  changes: [
    { period: "2026-02", revenue_change: 50, revenue_change_pct: 50, net_income_change: 15, net_income_change_pct: 150 },
  ],
  snapshots: [],
  health_score_history: null,
  health_score_available: false,
  health_score_coverage: { status: "none", available_periods: 0, total_periods: 2, missing_periods: 2, missing_months: ["2026-01", "2026-02"] },
  health_score_unavailable_reason: "no_historical_health_scores_persisted",
};

describe("GET /api/model/history — route ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dispatches to the History handler, not the :slug handler", async () => {
    getHistory.mockResolvedValue({ data: HISTORY, source: "db" });
    const res = await request(createApp()).get("/api/model/history");

    expect(res.status).toBe(200);
    // The History handler ran…
    expect(getHistory).toHaveBeenCalledTimes(1);
    // …and the dynamic :slug handler did NOT (it would have called
    // getEntityMetrics with slug="history").
    expect(getEntityMetrics).not.toHaveBeenCalled();
  });

  it("returns a HistoryResponse-shaped payload", async () => {
    getHistory.mockResolvedValue({ data: HISTORY, source: "db" });
    const res = await request(createApp()).get("/api/model/history");

    expect(res.body.ok).toBe(true);
    expect(res.body.source).toBe("db");
    const data = res.body.data as HistoryResponse;
    // Response shape matches HistoryResponse.
    expect(data.status).toBe("available");
    expect(Array.isArray(data.monthly)).toBe(true);
    expect(Array.isArray(data.changes)).toBe(true);
    expect(Array.isArray(data.snapshots)).toBe(true);
    expect(data).toHaveProperty("health_score_available");
    expect(data).toHaveProperty("period_start");
    expect(data).toHaveProperty("period_end");
  });

  it("passes ?slugs= through to getHistory (entity filter honored)", async () => {
    getHistory.mockResolvedValue({ data: HISTORY, source: "db" });
    await request(createApp()).get("/api/model/history?slugs=cardealer_ai,smile_more");

    expect(getHistory).toHaveBeenCalledTimes(1);
    const passed = getHistory.mock.calls[0]![0] as string[];
    // Case-insensitive slug resolution maps to canonical ENTITY_SLUGS values.
    expect(passed).toContain("CarDealer_ai");
    expect(passed).toContain("Smile_More");
    expect(getEntityMetrics).not.toHaveBeenCalled();
  });

  it("a real entity slug still routes to the :slug handler", async () => {
    getEntityMetrics.mockResolvedValue({ data: { as_of: "2026-06-30" }, source: "db" });
    getEntityAnomalies.mockResolvedValue({ data: [], source: "db" });
    getDataFreshness.mockResolvedValue({ data: {}, source: "db" });

    const res = await request(createApp()).get("/api/model/CarDealer_ai");

    expect(res.status).toBe(200);
    // The :slug handler ran; the History handler did not.
    expect(getEntityMetrics).toHaveBeenCalledTimes(1);
    expect(getHistory).not.toHaveBeenCalled();
  });
});
