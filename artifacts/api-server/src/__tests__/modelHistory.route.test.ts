/**
 * RC-017 route-ordering regression — full production stack.
 *
 * The previous version of this test mounted modelRouter directly at /api,
 * bypassing requireAuth and the outer routes/index.ts composition. A route
 * registered by another router BEFORE modelRouter in the outer chain would
 * have been undetectable by that setup. This version loads the ACTUAL
 * production router (routes/index.ts → requireAuth → modelRouter) so the
 * full Express handler chain is exercised.
 *
 * Why vi.mock("@workspace/db") is required:
 *   routes/index.ts transitively imports budgetRouter and reportsRouter, both
 *   of which import from @workspace/db. The db package throws
 *   "CORE_DATABASE_URL must be set" at module evaluation time when no real
 *   database env is present. Mocking it here prevents that throw so the
 *   production router graph can be loaded without a real database.
 *
 * Scenarios proved via real Supertest HTTP calls:
 *   1. Unauthenticated → 401 (requireAuth gate works through the outer router)
 *   2. GET /api/model/history → History handler, NOT /:slug entity handler
 *   3. GET /api/model/history payload shape matches HistoryResponse contract
 *   4. ?slugs= query param is passed through; lowercase slugs resolve to
 *      their canonical cased form (CarDealer_ai, Smile_More, …)
 *   5. GET /api/model/cashflow → cash-flow handler, NOT /:slug entity handler
 *   6. GET /api/model/<real-slug> → entity handler (correct /:slug dispatch)
 *   7. GET /api/model/<unknown-slug> → 404 entity-not-found
 */

// Must be hoisted before any router imports. Replaces @workspace/db so the
// Pool constructor and "must be set" guards never run during test module
// evaluation. The mock stubs are empty objects — route handlers never execute
// during this test because every dataSource function is mocked independently.
vi.mock("@workspace/db", () => ({
  db: {},
  opsDb: {},
  pool: {},
  opsPool: {},
  entities: {},
  budgets: {},
  financialPeriods: {},
  cashFlowStatements: {},
  metricSnapshots: {},
  reportHistory: {},
  accounts: {},
  transactions: {},
  syncRuns: {},
  invoices: {},
  bills: {},
}));

// ── dataSource spy handles ────────────────────────────────────────────────────
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

vi.mock("../lib/snapshotStore", () => ({
  archiveMetricSnapshot: vi.fn().mockResolvedValue(undefined),
  getMetricSnapshots: vi.fn().mockResolvedValue([]),
}));

// ── Stubs for modules used only by OTHER routes in routes/index.ts ───────────
// These mocks exist only to prevent import-time failures; the routes that use
// them are never exercised by this test.
vi.mock("../lib/neonSource", () => ({
  getHistoryFromNeon: vi.fn(),
  getAlertsFromNeon: vi.fn(),
  getConsolidatedCashFlowFromNeon: vi.fn(),
}));
vi.mock("../lib/driveLoader", () => ({
  driveStatus: vi.fn(),
  invalidateCache: vi.fn(),
}));
vi.mock("../ai/context", () => ({ buildAIContextWithSource: vi.fn() }));
vi.mock("../ai/provider", () => ({
  getProvider: vi.fn(),
  getAIOptions: vi.fn(),
}));
vi.mock("../ai/cache", () => ({
  getCached: vi.fn(),
  setCached: vi.fn(),
  withDedupe: vi.fn(),
  getCacheStats: vi.fn(),
  getUsageStats: vi.fn(),
  recordUsage: vi.fn(),
}));
vi.mock("../ai/formatter", () => ({
  formatBriefingResponse: vi.fn(),
  formatAnalysisResponse: vi.fn(),
}));
vi.mock("../ai/briefing", () => ({ generateBriefing: vi.fn() }));
vi.mock("../rules/engine", () => ({
  RulesEngine: class {
    constructor() {}
  },
}));
vi.mock("../reports/engine", () => ({ generateReport: vi.fn() }));
vi.mock("../services/entityCache", () => ({ getCachedEntityId: vi.fn() }));
vi.mock("../lib/validationMatrix", () => ({ buildValidationMatrix: vi.fn() }));

// ── Test setup ────────────────────────────────────────────────────────────────
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { HistoryResponse } from "../lib/types";

// Import the REAL production outer router — the same module chain that the
// running application uses. This is the key difference from the previous
// version: we are no longer importing modelRouter in isolation.
import indexRouter from "../routes/index";

function createApp({ authenticated = true } = {}) {
  const app = express();
  app.use(express.json());
  // Stub req.log (used by all route handlers via pino-http request logger).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>)["log"] = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    next();
  });
  // Stub req.session so requireAuth works without a real express-session store.
  // Pass authenticated=false to simulate an unauthenticated caller.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>)["session"] = authenticated
      ? { user: { email: "test@example.com", role: "admin" } }
      : {};
    next();
  });
  // Mount the production outer router at /api — identical to app.ts.
  app.use("/api", indexRouter);
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
    {
      period: "2026-01",
      period_start: "2026-01-01",
      period_end: "2026-01-31",
      revenue: 100,
      net_income: 10,
      by_entity: {},
      partial: false,
      contributing: ["CarDealer_ai"],
      missing: [],
    },
    {
      period: "2026-02",
      period_start: "2026-02-01",
      period_end: "2026-02-28",
      revenue: 150,
      net_income: 25,
      by_entity: {},
      partial: false,
      contributing: ["CarDealer_ai"],
      missing: [],
    },
  ],
  changes: [
    {
      period: "2026-02",
      revenue_change: 50,
      revenue_change_pct: 50,
      net_income_change: 15,
      net_income_change_pct: 150,
    },
  ],
  snapshots: [],
  health_score_history: null,
  health_score_available: false,
  health_score_coverage: {
    status: "none",
    available_periods: 0,
    total_periods: 2,
    missing_periods: 2,
    missing_months: ["2026-01", "2026-02"],
  },
  health_score_unavailable_reason: "no_historical_health_scores_persisted",
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("Route ordering — full production stack (routes/index.ts + requireAuth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth gate ──────────────────────────────────────────────────────────────
  it("enforces auth: unauthenticated request to /model/history gets 401, no handler runs", async () => {
    const res = await request(createApp({ authenticated: false })).get(
      "/api/model/history",
    );

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.code).toBe("NOT_AUTHENTICATED");
    expect(getHistory).not.toHaveBeenCalled();
    expect(getEntityMetrics).not.toHaveBeenCalled();
  });

  // ── /model/history static route ────────────────────────────────────────────
  it("GET /api/model/history dispatches to History handler, never to /:slug entity handler", async () => {
    getHistory.mockResolvedValue({ data: HISTORY, source: "db" });

    const res = await request(createApp()).get(
      "/api/model/history?slugs=cardealer_ai,topmrktr,smile_more,t3_marketing",
    );

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // History handler ran.
    expect(getHistory).toHaveBeenCalledTimes(1);
    // Entity /:slug handler must NOT have run — "history" is not an entity slug.
    expect(getEntityMetrics).not.toHaveBeenCalled();
  });

  it("GET /api/model/history response matches HistoryResponse contract", async () => {
    getHistory.mockResolvedValue({ data: HISTORY, source: "db" });

    const res = await request(createApp()).get("/api/model/history");

    expect(res.body.ok).toBe(true);
    const data = res.body.data as HistoryResponse;
    expect(data.status).toBe("available");
    expect(Array.isArray(data.monthly)).toBe(true);
    expect(Array.isArray(data.changes)).toBe(true);
    expect(Array.isArray(data.snapshots)).toBe(true);
    expect(data).toHaveProperty("health_score_available");
    expect(data).toHaveProperty("health_score_coverage");
    expect(data).toHaveProperty("period_start");
    expect(data).toHaveProperty("period_end");
  });

  it("?slugs= lowercase input is normalised to canonical cased entity slugs before reaching getHistory", async () => {
    getHistory.mockResolvedValue({ data: HISTORY, source: "db" });

    await request(createApp()).get(
      "/api/model/history?slugs=cardealer_ai,smile_more",
    );

    expect(getHistory).toHaveBeenCalledTimes(1);
    const passed = getHistory.mock.calls[0]![0] as string[];
    expect(passed).toContain("CarDealer_ai");
    expect(passed).toContain("Smile_More");
    expect(getEntityMetrics).not.toHaveBeenCalled();
  });

  // ── /model/cashflow static route ───────────────────────────────────────────
  it("GET /api/model/cashflow dispatches to cash-flow handler, never to /:slug entity handler", async () => {
    getConsolidatedCashFlow.mockResolvedValue({ data: { periods: [] }, source: "db" });

    const res = await request(createApp()).get("/api/model/cashflow");

    expect(res.status).toBe(200);
    expect(getConsolidatedCashFlow).toHaveBeenCalledTimes(1);
    expect(getEntityMetrics).not.toHaveBeenCalled();
  });

  // ── /model/:slug dynamic route ─────────────────────────────────────────────
  it("GET /api/model/<real-slug> dispatches to entity handler (/:slug match)", async () => {
    getEntityMetrics.mockResolvedValue({
      data: { as_of: "2026-06-30" },
      source: "db",
    });
    getEntityAnomalies.mockResolvedValue({ data: [], source: "db" });
    getDataFreshness.mockResolvedValue({ data: {}, source: "db" });

    const res = await request(createApp()).get("/api/model/CarDealer_ai");

    expect(res.status).toBe(200);
    expect(getEntityMetrics).toHaveBeenCalledTimes(1);
    expect(getHistory).not.toHaveBeenCalled();
  });

  it("GET /api/model/<unknown-slug> returns 404 entity-not-found", async () => {
    const res = await request(createApp()).get("/api/model/not_a_real_entity");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
    expect(getHistory).not.toHaveBeenCalled();
    expect(getEntityMetrics).not.toHaveBeenCalled();
  });
});
