/**
 * RC-017 consolidated History tests.
 *
 * Covers the pure `buildHistoryResponse` reducer that powers /analyze/history:
 * server-side aggregation, month-over-month math, chronological ordering,
 * negative/zero preservation, null-not-zero for missing months, duplicate
 * (entity, period) collapsing, partial/unavailable states, health-score
 * availability, and a stable response schema. Also exercises getHistoryFromNeon
 * against a stubbed Drizzle chain to prove entity filtering, monthly-only
 * scoping, and parameterized SQL (no injection).
 *
 * No real database connection is used.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: { select: vi.fn() },
  cashFlowStatementsTable: {},
  entitiesTable: { id: "entities.id", slug: "entities.slug", displayName: "entities.display_name" },
  financialPeriodsTable: {
    entityId: "fp.entity_id",
    periodType: "fp.period_type",
    periodStart: "fp.period_start",
    periodEnd: "fp.period_end",
    revenue: "fp.revenue",
    netIncome: "fp.net_income",
  },
  portfolioSnapshotsTable: {},
  syncRunsTable: {},
  validationResultsTable: {},
  entitySnapshotsTable: {},
  invoicesTable: {},
  billsTable: {},
  accountsTable: {},
  transactionsTable: {},
  customersTable: {},
  alertsTable: {},
}));

const captured: { whereArgs: unknown[] } = { whereArgs: [] };
vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ _tag: "and", conditions: a }),
  eq: (col: unknown, val: unknown) => ({ _tag: "eq", col, val }),
  desc: (col: unknown) => ({ _tag: "desc", col }),
  inArray: (col: unknown, vals: unknown[]) => {
    captured.whereArgs.push({ _tag: "inArray", col, vals });
    return { _tag: "inArray", col, vals };
  },
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ _tag: "sql", strings, vals }),
}));

// Stub the snapshot store so health-score reads are controllable and no pg pool
// is opened. Overridden per-test via mockResolvedValue.
const getMetricSnapshots = vi.fn();
vi.mock("../snapshotStore", () => ({
  getMetricSnapshots: (...a: unknown[]) => getMetricSnapshots(...a),
}));

import {
  buildHistoryResponse,
  getHistoryFromNeon,
  type HistoryEntityInput,
  type HistoryHealthInput,
} from "../neonSource";
import type { EntitySlug } from "../types";
import { db } from "@workspace/db";

const CD = "CarDealer_ai" as EntitySlug;
const T3 = "T3_Marketing" as EntitySlug;
const TM = "TopMrktr" as EntitySlug;
const SM = "Smile_More" as EntitySlug;

function month(period: string, revenue: number | null, net_income: number | null) {
  return {
    period,
    period_start: `${period}-01`,
    period_end: `${period}-28`,
    revenue,
    net_income,
  };
}

describe("buildHistoryResponse (pure reducer)", () => {
  it("1. one entity, multiple months → correct revenue/net_income arrays", () => {
    const e: HistoryEntityInput = {
      slug: CD,
      entity: "CarDealer.ai",
      months: [month("2026-01", 100, 20), month("2026-02", 150, 30)],
    };
    const r = buildHistoryResponse([e], []);
    expect(r.monthly.map(m => m.revenue)).toEqual([100, 150]);
    expect(r.monthly.map(m => m.net_income)).toEqual([20, 30]);
    expect(r.status).toBe("available");
  });

  it("2. all four entities → server-side consolidation is correct", () => {
    const mk = (slug: EntitySlug, name: string, rev: number, ni: number): HistoryEntityInput => ({
      slug, entity: name, months: [month("2026-01", rev, ni)],
    });
    const r = buildHistoryResponse([
      mk(CD, "CarDealer.ai", 100, 10),
      mk(T3, "T3", 200, 20),
      mk(TM, "TopMrktr", 300, 30),
      mk(SM, "Smile More", 400, 40),
    ], []);
    expect(r.monthly[0].revenue).toBe(1000);
    expect(r.monthly[0].net_income).toBe(100);
    expect(r.monthly[0].by_entity[CD]).toEqual({ revenue: 100, net_income: 10 });
  });

  it("3. months are chronologically ordered regardless of input order", () => {
    const e: HistoryEntityInput = {
      slug: CD, entity: "CD",
      months: [month("2026-03", 3, 3), month("2026-01", 1, 1), month("2026-02", 2, 2)],
    };
    const r = buildHistoryResponse([e], []);
    expect(r.monthly.map(m => m.period)).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("4. negative values are preserved (Smile More)", () => {
    const e: HistoryEntityInput = {
      slug: SM, entity: "Smile More", months: [month("2026-01", 500, -120)],
    };
    const r = buildHistoryResponse([e], []);
    expect(r.monthly[0].net_income).toBe(-120);
    expect(r.snapshots[0].net_income).toBe(-120);
  });

  it("5. zero values are preserved (not treated as missing)", () => {
    const e: HistoryEntityInput = {
      slug: CD, entity: "CD", months: [month("2026-01", 0, 0)],
    };
    const r = buildHistoryResponse([e], []);
    expect(r.monthly[0].revenue).toBe(0);
    expect(r.monthly[0].net_income).toBe(0);
  });

  it("6. a month missing for an entity → null, never zero", () => {
    const a: HistoryEntityInput = { slug: CD, entity: "CD", months: [month("2026-01", 100, 10), month("2026-02", 200, 20)] };
    const b: HistoryEntityInput = { slug: T3, entity: "T3", months: [month("2026-02", 50, 5)] }; // no Jan
    const r = buildHistoryResponse([a, b], []);
    const jan = r.monthly.find(m => m.period === "2026-01")!;
    expect(jan.by_entity[T3]).toEqual({ revenue: null, net_income: null });
    // Jan total is CD only (100) — not 100+0.
    expect(jan.revenue).toBe(100);
  });

  it("6b. a period where NO entity reported → null totals", () => {
    const a: HistoryEntityInput = { slug: CD, entity: "CD", months: [month("2026-01", null, null)] };
    const r = buildHistoryResponse([a], []);
    expect(r.monthly[0].revenue).toBeNull();
    expect(r.monthly[0].net_income).toBeNull();
  });

  it("7. duplicate (entity, period) rows are collapsed (last wins, no double count)", () => {
    const e: HistoryEntityInput = {
      slug: CD, entity: "CD",
      months: [month("2026-01", 100, 10), month("2026-01", 175, 15)],
    };
    const r = buildHistoryResponse([e], []);
    expect(r.monthly).toHaveLength(1);
    expect(r.monthly[0].revenue).toBe(175);
    expect(r.snapshots).toHaveLength(1);
  });

  it("9. prior month = zero → pct change is null (dollar change still computed)", () => {
    const e: HistoryEntityInput = {
      slug: CD, entity: "CD", months: [month("2026-01", 0, 0), month("2026-02", 100, 50)],
    };
    const r = buildHistoryResponse([e], []);
    const feb = r.changes.find(c => c.period === "2026-02")!;
    expect(feb.revenue_change_pct).toBeNull();
    expect(feb.revenue_change).toBe(100);
  });

  it("10. MoM dollar change = current - prior", () => {
    const e: HistoryEntityInput = {
      slug: CD, entity: "CD", months: [month("2026-01", 100, 40), month("2026-02", 130, 25)],
    };
    const r = buildHistoryResponse([e], []);
    const feb = r.changes[0];
    expect(feb.revenue_change).toBe(30);
    expect(feb.net_income_change).toBe(-15);
  });

  it("11. MoM pct change = (current - prior)/|prior|*100, using absolute prior", () => {
    const e: HistoryEntityInput = {
      slug: CD, entity: "CD", months: [month("2026-01", -100, -100), month("2026-02", -50, -50)],
    };
    const r = buildHistoryResponse([e], []);
    // (-50 - -100)/|-100|*100 = +50
    expect(r.changes[0].revenue_change_pct).toBe(50);
    expect(r.changes[0].net_income_change_pct).toBe(50);
  });

  it("11b. pct change is null when current or prior is null", () => {
    const e: HistoryEntityInput = {
      slug: CD, entity: "CD", months: [month("2026-01", null, 10), month("2026-02", 100, null)],
    };
    const r = buildHistoryResponse([e], []);
    expect(r.changes[0].revenue_change_pct).toBeNull();
    expect(r.changes[0].revenue_change).toBeNull();
    expect(r.changes[0].net_income_change_pct).toBeNull();
  });

  it("12. partial availability — some entities have no monthly data", () => {
    const a: HistoryEntityInput = { slug: CD, entity: "CD", months: [month("2026-01", 100, 10)] };
    const b: HistoryEntityInput = { slug: T3, entity: "T3", months: [] };
    const r = buildHistoryResponse([a, b], []);
    expect(r.status).toBe("partial");
    expect(r.available).toBe(true);
    // Missing entity contributes nothing to totals.
    expect(r.monthly[0].by_entity[T3]).toBeUndefined();
    expect(r.monthly[0].revenue).toBe(100);
  });

  it("13. no monthly data at all → status='unavailable'", () => {
    const a: HistoryEntityInput = { slug: CD, entity: "CD", months: [] };
    const r = buildHistoryResponse([a], []);
    expect(r.status).toBe("unavailable");
    expect(r.available).toBe(false);
    expect(r.monthly).toEqual([]);
    expect(r.period_start).toBeNull();
    expect(r.period_end).toBeNull();
  });

  it("16. health score unavailable when no historical score persisted", () => {
    const e: HistoryEntityInput = { slug: CD, entity: "CD", months: [month("2026-01", 100, 10)] };
    const r = buildHistoryResponse([e], []);
    expect(r.health_score_available).toBe(false);
    expect(r.health_score_history).toBeNull();
    expect(r.health_score_unavailable_reason).toBe("no_historical_health_scores_persisted");
  });

  it("17. health score available and correct when persisted", () => {
    const e: HistoryEntityInput = { slug: CD, entity: "CD", months: [month("2026-01", 100, 10), month("2026-02", 100, 10)] };
    const health: HistoryHealthInput[] = [
      { slug: CD, scoresByMonth: new Map([["2026-01", 80], ["2026-02", 90]]) },
    ];
    const r = buildHistoryResponse([e], health);
    expect(r.health_score_available).toBe(true);
    expect(r.health_score_history).toEqual([
      { period: "2026-01", score: 80 },
      { period: "2026-02", score: 90 },
    ]);
    expect(r.health_score_unavailable_reason).toBeUndefined();
  });

  it("20. response schema is stable (all documented keys present)", () => {
    const e: HistoryEntityInput = { slug: CD, entity: "CD", months: [month("2026-01", 1, 1)] };
    const r = buildHistoryResponse([e], [], "2026-07-15T00:00:00.000Z");
    expect(Object.keys(r).sort()).toEqual(
      [
        "available", "changes", "entities", "generated_at",
        "health_score_available", "health_score_history",
        "health_score_unavailable_reason", "monthly", "period_end",
        "period_start", "snapshots", "status",
      ].sort(),
    );
    expect(r.generated_at).toBe("2026-07-15T00:00:00.000Z");
  });

  it("8b. entity display order preserved in snapshots", () => {
    const a: HistoryEntityInput = { slug: CD, entity: "CD", months: [month("2026-01", 1, 1)] };
    const b: HistoryEntityInput = { slug: SM, entity: "Smile More", months: [month("2026-01", 2, 2)] };
    const r = buildHistoryResponse([a, b], []);
    expect(r.snapshots.map(s => s.slug)).toEqual([CD, SM]);
  });
});

// ── DB-facing getHistoryFromNeon: filtering, monthly-only, parameterization ──

/** Build a fake Drizzle query chain returning `rows` for the terminal await. */
function fakeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const ret = () => chain;
  chain["from"] = ret;
  chain["innerJoin"] = ret;
  chain["where"] = (arg: unknown) => { captured.whereArgs.push(arg); return chain; };
  chain["orderBy"] = ret;
  chain["limit"] = ret;
  chain["then"] = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return chain;
}

describe("getHistoryFromNeon (DB-facing)", () => {
  beforeEach(() => {
    captured.whereArgs = [];
    getMetricSnapshots.mockReset();
    getMetricSnapshots.mockResolvedValue({
      CarDealer_ai: [], T3_Marketing: [], TopMrktr: [], Smile_More: [],
    });
  });

  it("15. empty slug list → unavailable, no DB call, no mock fallback", async () => {
    const r = await getHistoryFromNeon([]);
    expect(r.status).toBe("unavailable");
    expect(r.monthly).toEqual([]);
    expect((db.select as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("8+14. filters to selected slugs and monthly period_type only", async () => {
    // First select() → entity id/name rows; second select() → monthly fp rows.
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeChain([
        { slug: "cardealer_ai", displayName: "CarDealer.ai" },
        { slug: "t3_marketing", displayName: "T3 Marketing" },
      ]))
      .mockReturnValueOnce(fakeChain([
        { slug: "cardealer_ai", periodStart: "2026-01-01", periodEnd: "2026-01-31", revenue: "100", netIncome: "10" },
        { slug: "cardealer_ai", periodStart: "2026-02-01", periodEnd: "2026-02-28", revenue: "150", netIncome: "20" },
      ]));

    const r = await getHistoryFromNeon([CD]);
    expect(r.entities).toContain("CarDealer.ai");
    expect(r.monthly.map(m => m.revenue)).toEqual([100, 150]);

    // period_type='monthly' equality condition present.
    const flat = JSON.stringify(captured.whereArgs);
    expect(flat).toContain("monthly");
    // inArray used for slug filtering (parameterized, not string-concatenated).
    const inArrayCall = captured.whereArgs.find(
      (w: unknown) => (w as { conditions?: unknown[] })?.conditions?.some?.(
        (c: unknown) => (c as { _tag?: string })._tag === "inArray",
      ),
    );
    expect(inArrayCall).toBeTruthy();
  });

  it("19. slug values are passed as parameters (inArray), never interpolated", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeChain([{ slug: "cardealer_ai", displayName: "CarDealer.ai" }]))
      .mockReturnValueOnce(fakeChain([]));

    const injection = "cardealer_ai'; DROP TABLE financial_periods;--" as EntitySlug;
    await getHistoryFromNeon([injection]);

    // The raw slug value must appear only inside an inArray `vals` array (a bound
    // parameter list), never as a concatenated SQL fragment.
    const inArrayVals = captured.whereArgs
      .flatMap((w: unknown) => (w as { conditions?: unknown[] })?.conditions ?? [])
      .filter((c: unknown) => (c as { _tag?: string })._tag === "inArray")
      .flatMap((c: unknown) => (c as { vals: unknown[] }).vals);
    expect(inArrayVals).toContain(injection.toLowerCase());
  });

  it("17b. health scores from metric_snapshots feed the trend", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeChain([{ slug: "cardealer_ai", displayName: "CarDealer.ai" }]))
      .mockReturnValueOnce(fakeChain([
        { slug: "cardealer_ai", periodStart: "2026-01-01", periodEnd: "2026-01-31", revenue: "100", netIncome: "10" },
      ]));
    getMetricSnapshots.mockResolvedValue({
      CarDealer_ai: [{ month: "2026-01", as_of: "2026-01-31", metrics: { health_score: 88 } }],
      T3_Marketing: [], TopMrktr: [], Smile_More: [],
    });

    const r = await getHistoryFromNeon([CD]);
    expect(r.health_score_available).toBe(true);
    expect(r.health_score_history).toEqual([{ period: "2026-01", score: 88 }]);
  });

  it("16b. health degrades gracefully if metric_snapshots read throws", async () => {
    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(fakeChain([{ slug: "cardealer_ai", displayName: "CarDealer.ai" }]))
      .mockReturnValueOnce(fakeChain([
        { slug: "cardealer_ai", periodStart: "2026-01-01", periodEnd: "2026-01-31", revenue: "100", netIncome: "10" },
      ]));
    getMetricSnapshots.mockRejectedValue(new Error("no table"));

    const r = await getHistoryFromNeon([CD]);
    expect(r.status).toBe("available"); // monthly data still served
    expect(r.health_score_available).toBe(false);
  });
});
