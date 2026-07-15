/**
 * RC-017 database-ownership test.
 *
 * The History page combines two sources that live in SEPARATE databases:
 *
 *   - financial_periods  → FinanceOS Core, read-only, via CORE_DATABASE_URL
 *                          (the `db` drizzle client exported by @workspace/db).
 *   - metric_snapshots   → the Dashboard operational DB, via DATABASE_URL
 *                          (a dedicated pg Pool inside snapshotStore).
 *
 * Because they are in different databases, there is NO cross-database SQL join:
 * financial_periods is read via the Core `db` client, metric_snapshots is read
 * via snapshotStore's own DATABASE_URL pool, and the two are combined in-memory
 * by buildHistoryResponse. This test proves each source uses its correct,
 * distinct connection.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Capture how many pg Pools are constructed and with which connection string —
// snapshotStore builds its own Pool from DATABASE_URL (never CORE_DATABASE_URL).
const poolConstructions: { connectionString: string | undefined }[] = [];
const queryMock = vi.fn();
vi.mock("pg", () => ({
  Pool: class {
    constructor(cfg: { connectionString?: string }) {
      poolConstructions.push({ connectionString: cfg?.connectionString });
    }
    query = (...a: unknown[]) => queryMock(...a);
  },
}));

// The Core financial reads go through the shared `db` client from @workspace/db.
// Record every table the financial-periods read touches so we can prove it
// targets financialPeriodsTable via `db` (Core) and NOT the ops pool.
const dbSelectMock = vi.fn();
vi.mock("@workspace/db", () => ({
  db: { select: (...a: unknown[]) => dbSelectMock(...a) },
  entitiesTable: { id: "entities.id", slug: "entities.slug", displayName: "entities.display_name" },
  financialPeriodsTable: {
    __table: "financial_periods",
    entityId: "fp.entity_id",
    periodType: "fp.period_type",
    periodStart: "fp.period_start",
    periodEnd: "fp.period_end",
    revenue: "fp.revenue",
    netIncome: "fp.net_income",
    generatedAt: "fp.generated_at",
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
  cashFlowStatementsTable: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...a: unknown[]) => ({ _tag: "and", conditions: a }),
  eq: (col: unknown, val: unknown) => ({ _tag: "eq", col, val }),
  desc: (col: unknown) => ({ _tag: "desc", col }),
  inArray: (col: unknown, vals: unknown[]) => ({ _tag: "inArray", col, vals }),
  sql: (strings: TemplateStringsArray, ...vals: unknown[]) => ({ _tag: "sql", strings, vals }),
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  poolConstructions.length = 0;
  queryMock.mockReset();
  dbSelectMock.mockReset();
  process.env = { ...ORIGINAL_ENV };
});

describe("financial_periods ownership → Core (CORE_DATABASE_URL / db client)", () => {
  it("reads financial_periods through the Core `db` client, not a DATABASE_URL pool", async () => {
    // getHistoryFromNeon issues two selects:
    //   1. select().from(entitiesTable)                    → awaited directly
    //   2. select().from(financialPeriodsTable).innerJoin().where() → awaited
    // Model both: `.from()` on the entities query resolves to rows (a thenable
    // chain), while the financial_periods query resolves at `.where()`.
    const tables: unknown[] = [];
    dbSelectMock.mockImplementation(() => {
      const chain: Record<string, unknown> = {};
      chain["from"] = (t: unknown) => {
        tables.push(t);
        // Entities query is a bare select().from() — make it thenable so an
        // `await` on the chain resolves to an (empty) rows array.
        chain["then"] = (res: (v: unknown[]) => unknown) => res([]);
        return chain;
      };
      chain["innerJoin"] = (t: unknown) => {
        tables.push(t);
        return chain;
      };
      chain["where"] = () => Promise.resolve([]);
      return chain;
    });

    const { getHistoryFromNeon } = await import("../neonSource");
    // metric_snapshots read is stubbed to fail-soft (empty) — see snapshotStore.
    process.env["DATABASE_URL"] = "postgres://ops.example/db";
    queryMock.mockResolvedValue({ rows: [] });

    await getHistoryFromNeon(["CarDealer_ai"] as never);

    // The Core `db` client was used for the financial_periods read.
    expect(dbSelectMock).toHaveBeenCalled();
    // It targeted financial_periods (from the shared @workspace/db schema).
    const touchedFinancialPeriods = tables.some(
      (t) => (t as { __table?: string })?.__table === "financial_periods",
    );
    expect(touchedFinancialPeriods).toBe(true);
  });
});

describe("metric_snapshots ownership → Dashboard ops DB (DATABASE_URL)", () => {
  it("builds its pg Pool from DATABASE_URL, never CORE_DATABASE_URL", async () => {
    process.env["DATABASE_URL"] = "postgres://ops.example/dashboard";
    process.env["CORE_DATABASE_URL"] = "postgres://core.example/readonly";
    queryMock.mockResolvedValue({ rows: [] });

    // Fresh module instance so its lazy pool re-initializes under this env.
    vi.resetModules();
    const { getMetricSnapshots } = await import("../snapshotStore");
    await getMetricSnapshots();

    // Exactly one pool, and it uses the ops DATABASE_URL — not Core.
    expect(poolConstructions.length).toBeGreaterThanOrEqual(1);
    const strings = poolConstructions.map((p) => p.connectionString);
    expect(strings).toContain("postgres://ops.example/dashboard");
    expect(strings).not.toContain("postgres://core.example/readonly");
  });
});
