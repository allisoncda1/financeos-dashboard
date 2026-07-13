/**
 * RC-016 Cash Flow Neon integration tests.
 *
 * Tests cover:
 * 1. parseCashFlowSectionsJson — pure JSONB contract validation
 * 2. getCashFlowFromNeon — filter behavior (passed+published only), entity
 *    selection, row ordering; via mocked drizzle db
 *
 * No real database connection is used.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CashFlowStatement } from "../types";

// ── Drizzle mock ──────────────────────────────────────────────────────────────
// vi.mock() factories are hoisted to the top of the file by vitest, so they
// execute before any top-level variable declarations. Use vi.hoisted() to
// declare the mock functions so they are available when the factory runs.

const { _mockWhere, _mockOrderBy, _mockLimit, _mockFrom, _mockSelect } =
  vi.hoisted(() => ({
    _mockWhere:   vi.fn(),
    _mockOrderBy: vi.fn(),
    _mockLimit:   vi.fn(),
    _mockFrom:    vi.fn(),
    _mockSelect:  vi.fn(),
  }));

let _mockRows: unknown[] = [];

function resetMockChain(rows: unknown[] = []) {
  _mockRows = rows;
  _mockLimit.mockResolvedValue(_mockRows);
  _mockOrderBy.mockReturnValue({ limit: _mockLimit });
  _mockWhere.mockReturnValue({ orderBy: _mockOrderBy });
  _mockFrom.mockReturnValue({ where: _mockWhere });
  _mockSelect.mockReturnValue({ from: _mockFrom });
}

vi.mock("@workspace/db", () => ({
  db: { select: _mockSelect },
  cashFlowStatementsTable: {
    entityId:          "entity_id_col",
    validationStatus:  "validation_status_col",
    publicationStatus: "publication_status_col",
    periodEnd:         "period_end_col",
    sections:          "sections_col",
  },
  entitiesTable: { id: "id_col", slug: "slug_col" },
  financialPeriodsTable: {},
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

// Minimal drizzle-orm mock — returns simple tagged objects so we can inspect them
vi.mock("drizzle-orm", () => ({
  and:  (...args: unknown[]) => ({ _tag: "and",  conditions: args }),
  eq:   (col: unknown, val: unknown) => ({ _tag: "eq", col, val }),
  desc: (col: unknown) => ({ _tag: "desc", col }),
  sql:  Object.assign(vi.fn(), { raw: vi.fn() }),
  or:   (...args: unknown[]) => ({ _tag: "or", conditions: args }),
  gte:  (col: unknown, val: unknown) => ({ _tag: "gte", col, val }),
  lte:  (col: unknown, val: unknown) => ({ _tag: "lte", col, val }),
}));

import {
  parseCashFlowSectionsJson,
  getCashFlowFromNeon,
} from "../neonSource";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_CF_JSON: CashFlowStatement = {
  as_of: "2026-07-13",
  sections: [
    {
      name: "Operating Activities",
      lines: [
        { label: "Net Income",    amount: 9000,   is_subtotal: false },
        { label: "Depreciation",  amount: 500,    is_subtotal: false },
        { label: "AR change",     amount: -1500,  is_subtotal: false },
        { label: "Net Operating", amount: 8000,   is_subtotal: true  },
      ],
      net_cash: 8000,
    },
    {
      name: "Investing Activities",
      lines: [{ label: "Equipment", amount: -2000, is_subtotal: false }],
      net_cash: -2000,
    },
    {
      name: "Financing Activities",
      lines: [{ label: "Loan repayment", amount: -1000, is_subtotal: false }],
      net_cash: -1000,
    },
  ],
  net_cash_change: 5000,
  cash_at_end: 12000,
};

function makeRow(overrides: Partial<{ sections: unknown; validationStatus: string; publicationStatus: string; periodEnd: string }> = {}) {
  return {
    sections:          VALID_CF_JSON,
    validationStatus:  "passed",
    publicationStatus: "published",
    periodEnd:         "2026-07-13",
    ...overrides,
  };
}

// ── 1. parseCashFlowSectionsJson ──────────────────────────────────────────────

describe("parseCashFlowSectionsJson — JSONB contract validation", () => {
  // Shape validation
  it("returns null for null input", () => {
    expect(parseCashFlowSectionsJson(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseCashFlowSectionsJson("string")).toBeNull();
    expect(parseCashFlowSectionsJson(42)).toBeNull();
    expect(parseCashFlowSectionsJson([])).toBeNull();
  });

  it("returns null when as_of is missing", () => {
    const { as_of: _, ...noAsOf } = VALID_CF_JSON;
    expect(parseCashFlowSectionsJson(noAsOf)).toBeNull();
  });

  it("returns null when sections is not an array", () => {
    expect(parseCashFlowSectionsJson({ ...VALID_CF_JSON, sections: {} })).toBeNull();
    expect(parseCashFlowSectionsJson({ ...VALID_CF_JSON, sections: null })).toBeNull();
  });

  it("returns a typed CashFlowStatement for valid JSONB", () => {
    const result = parseCashFlowSectionsJson(VALID_CF_JSON);
    expect(result).not.toBeNull();
    expect(result!.as_of).toBe("2026-07-13");
    expect(result!.sections).toHaveLength(3);
    expect(result!.net_cash_change).toBe(5000);
    expect(result!.cash_at_end).toBe(12000);
  });

  // API JSON matches CashFlowStatement contract
  it("result has exactly the CashFlowStatement shape", () => {
    const result = parseCashFlowSectionsJson(VALID_CF_JSON)!;
    expect(typeof result.as_of).toBe("string");
    expect(Array.isArray(result.sections)).toBe(true);
    for (const sec of result.sections) {
      expect(typeof sec.name).toBe("string");
      expect(typeof sec.net_cash).toBe("number");
      expect(Array.isArray(sec.lines)).toBe(true);
    }
  });

  // Line amount finite-number contract
  it("every exposed line amount is a finite number", () => {
    const result = parseCashFlowSectionsJson(VALID_CF_JSON)!;
    for (const sec of result.sections) {
      for (const line of sec.lines) {
        expect(Number.isFinite(line.amount)).toBe(true);
      }
    }
  });

  it("returns null when a line amount is null (not valid per TS type)", () => {
    const broken = {
      ...VALID_CF_JSON,
      sections: [
        {
          name: "Operating Activities",
          lines: [{ label: "Net Income", amount: null, is_subtotal: false }],
          net_cash: 8000,
        },
      ],
    };
    expect(parseCashFlowSectionsJson(broken)).toBeNull();
  });

  it("returns null when a line amount is NaN", () => {
    const broken = {
      ...VALID_CF_JSON,
      sections: [
        {
          name: "Operating Activities",
          lines: [{ label: "Net Income", amount: NaN, is_subtotal: false }],
          net_cash: 8000,
        },
      ],
    };
    expect(parseCashFlowSectionsJson(broken)).toBeNull();
  });

  it("returns null when a line amount is Infinity", () => {
    const broken = {
      ...VALID_CF_JSON,
      sections: [
        {
          name: "Operating Activities",
          lines: [{ label: "Net Income", amount: Infinity, is_subtotal: false }],
          net_cash: 8000,
        },
      ],
    };
    expect(parseCashFlowSectionsJson(broken)).toBeNull();
  });

  it("accepts a legitimate zero line amount", () => {
    const withZero = {
      ...VALID_CF_JSON,
      sections: [
        {
          name: "Investing Activities",
          lines: [{ label: "No investments", amount: 0, is_subtotal: false }],
          net_cash: 0,
        },
      ],
    };
    const result = parseCashFlowSectionsJson(withZero);
    expect(result).not.toBeNull();
    expect(result!.sections[0].lines[0].amount).toBe(0);
  });

  it("accepts negative line amounts", () => {
    const result = parseCashFlowSectionsJson(VALID_CF_JSON)!;
    const invLines = result.sections.find((s) => s.name === "Investing Activities")!.lines;
    expect(invLines[0].amount).toBe(-2000);
  });

  // Missing optional lines — section with empty lines array is valid
  it("missing optional lines do not crash — empty lines array is valid", () => {
    const noLines = {
      ...VALID_CF_JSON,
      sections: [
        { name: "Operating Activities", lines: [], net_cash: 5000 },
      ],
    };
    const result = parseCashFlowSectionsJson(noLines);
    expect(result).not.toBeNull();
    expect(result!.sections[0].lines).toHaveLength(0);
  });

  it("returns null when section net_cash is non-finite", () => {
    const broken = {
      ...VALID_CF_JSON,
      sections: [{ name: "Operating", lines: [], net_cash: NaN }],
    };
    expect(parseCashFlowSectionsJson(broken)).toBeNull();
  });

  it("returns null when section net_cash is null", () => {
    const broken = {
      ...VALID_CF_JSON,
      sections: [{ name: "Operating", lines: [], net_cash: null }],
    };
    expect(parseCashFlowSectionsJson(broken)).toBeNull();
  });

  it("net_cash_change=null is valid (not yet published)", () => {
    const result = parseCashFlowSectionsJson({ ...VALID_CF_JSON, net_cash_change: null });
    expect(result).not.toBeNull();
    expect(result!.net_cash_change).toBeNull();
  });

  it("net_cash_change=NaN is rejected", () => {
    expect(parseCashFlowSectionsJson({ ...VALID_CF_JSON, net_cash_change: NaN })).toBeNull();
  });

  it("cash_at_end=null is valid", () => {
    const result = parseCashFlowSectionsJson({ ...VALID_CF_JSON, cash_at_end: null });
    expect(result).not.toBeNull();
    expect(result!.cash_at_end).toBeNull();
  });
});

// ── 2. getCashFlowFromNeon — filter and selection behavior ────────────────────

describe("getCashFlowFromNeon — filter and row selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockChain();
  });

  // No eligible report
  it("returns null when no rows match the filter", async () => {
    resetMockChain([]);
    const result = await getCashFlowFromNeon("entity-abc");
    expect(result).toBeNull();
  });

  // Malformed JSONB is rejected
  it("returns null when JSONB sections are malformed", async () => {
    resetMockChain([makeRow({ sections: { not: "valid" } })]);
    const result = await getCashFlowFromNeon("entity-abc");
    expect(result).toBeNull();
  });

  it("returns null when sections column is null", async () => {
    resetMockChain([makeRow({ sections: null })]);
    const result = await getCashFlowFromNeon("entity-abc");
    expect(result).toBeNull();
  });

  // Valid published row is returned
  it("returns CashFlowStatement for a valid published row", async () => {
    resetMockChain([makeRow()]);
    const result = await getCashFlowFromNeon("entity-abc");
    expect(result).not.toBeNull();
    expect(result!.as_of).toBe("2026-07-13");
  });

  // Filter conditions verified: validationStatus and publicationStatus
  it("queries with validation_status='passed' and publication_status='published'", async () => {
    resetMockChain([]);
    await getCashFlowFromNeon("entity-test");

    // Inspect WHERE conditions — drizzle-orm is mocked to return tagged objects
    const whereCondition = _mockWhere.mock.calls[0]?.[0] as {
      _tag: string;
      conditions: Array<{ _tag: string; col: unknown; val: unknown }>;
    };
    expect(whereCondition._tag).toBe("and");

    // Three eq() conditions: entityId, validationStatus, publicationStatus
    const eqs = whereCondition.conditions;
    expect(eqs).toHaveLength(3);

    const statusEqs = eqs.filter((c) => c._tag === "eq");
    const vals = statusEqs.map((c) => c.val);
    expect(vals).toContain("passed");
    expect(vals).toContain("published");
  });

  // Entity isolation: entityId is included in WHERE
  it("includes entityId in the WHERE clause", async () => {
    resetMockChain([]);
    await getCashFlowFromNeon("entity-xyz");

    const whereCondition = _mockWhere.mock.calls[0]?.[0] as {
      _tag: string;
      conditions: Array<{ _tag: string; col: unknown; val: unknown }>;
    };
    const vals = whereCondition.conditions.map((c: { val: unknown }) => c.val);
    expect(vals).toContain("entity-xyz");
  });

  // Latest eligible report selected: orderBy(desc(periodEnd))
  it("orders by period_end DESC to select latest report", async () => {
    resetMockChain([makeRow()]);
    await getCashFlowFromNeon("entity-abc");

    const orderByArg = _mockOrderBy.mock.calls[0]?.[0] as { _tag: string; col: unknown };
    expect(orderByArg._tag).toBe("desc");
  });

  // LIMIT 1
  it("applies LIMIT 1", async () => {
    resetMockChain([makeRow()]);
    await getCashFlowFromNeon("entity-abc");
    expect(_mockLimit).toHaveBeenCalledWith(1);
  });

  // Backward compatibility: existing FinancialsData shape has cash_flow field
  it("returns typed CashFlowStatement matching FinancialsData.cash_flow type", async () => {
    resetMockChain([makeRow()]);
    const result = await getCashFlowFromNeon("entity-abc");
    // The result is assignable to CashFlowStatement | null
    const cashFlow: CashFlowStatement | null = result;
    if (cashFlow !== null) {
      expect(typeof cashFlow.as_of).toBe("string");
      expect(Array.isArray(cashFlow.sections)).toBe(true);
    }
  });

  // Newer invalid row is ignored (only passed+published rows returned)
  it("ignores a newer row with invalid JSONB in favour of null (no fallback)", async () => {
    // Simulate: the newest row has bad sections; only that one is returned by DB
    // (DB already filtered by passed+published; if the JSONB is still corrupt,
    // parseCashFlowSectionsJson rejects it → null returned)
    resetMockChain([makeRow({ sections: "corrupted" })]);
    const result = await getCashFlowFromNeon("entity-abc");
    expect(result).toBeNull();
  });
});
