import { describe, it, expect } from "vitest";
import {
  allocateProrata,
  allocateFixedAmount,
  allocatePercentageOfExpense,
  allocateFullExpense,
  sumAmounts,
  computeGrossProfit,
} from "../services/expenseAllocation";

describe("allocateProrata — TAG/Foray/Incarnation payroll pool (confirmed business example)", () => {
  it("splits $4,620.00 across three invoices by revenue share, exact to the cent", () => {
    const shares = allocateProrata("4620.00", [
      { id: "tag", revenue: "5100.00" },
      { id: "foray", revenue: "1495.00" },
      { id: "incarnation", revenue: "1495.00" },
    ]);
    const byId = Object.fromEntries(shares.map((s) => [s.id, s.amount]));
    expect(byId["tag"]).toBe("2912.48");
    expect(byId["foray"]).toBe("853.76");
    expect(byId["incarnation"]).toBe("853.76");
  });

  it("the three shares sum to exactly the pool amount — no reliquat lost or invented", () => {
    const shares = allocateProrata("4620.00", [
      { id: "tag", revenue: "5100.00" },
      { id: "foray", revenue: "1495.00" },
      { id: "incarnation", revenue: "1495.00" },
    ]);
    expect(sumAmounts(shares.map((s) => s.amount))).toBe("4620.00");
  });

  it("deterministic remainder distribution — same inputs always produce the same result", () => {
    const inputs = [
      { id: "a", revenue: "333.33" },
      { id: "b", revenue: "333.33" },
      { id: "c", revenue: "333.34" },
    ];
    const r1 = allocateProrata("1000.00", inputs);
    const r2 = allocateProrata("1000.00", inputs);
    expect(r1).toEqual(r2);
    expect(sumAmounts(r1.map((s) => s.amount))).toBe("1000.00");
  });

  it("tie-breaks by id ascending when two entries have an identical fractional remainder", () => {
    // Two identical revenues -> identical remainders -> leftover cents go to
    // whichever entries need it, tie-broken deterministically by id.
    const shares = allocateProrata("100.01", [
      { id: "z-later", revenue: "50.00" },
      { id: "a-earlier", revenue: "50.00" },
    ]);
    // 100.01 / 2 = 50.005 each -> floors to 50.00 each, 1 cent leftover ->
    // goes to "a-earlier" (ascending id) since remainders are tied.
    const byId = Object.fromEntries(shares.map((s) => [s.id, s.amount]));
    expect(byId["a-earlier"]).toBe("50.01");
    expect(byId["z-later"]).toBe("50.00");
  });

  it("rejects an empty input list rather than silently dropping the pool", () => {
    expect(() => allocateProrata("100.00", [])).toThrow();
  });

  it("rejects zero total eligible revenue rather than dividing by zero", () => {
    expect(() => allocateProrata("100.00", [{ id: "a", revenue: "0.00" }])).toThrow();
  });
});

describe("Precision Roofing — MCA fixed/percentage allocation (confirmed business example)", () => {
  it("percentage_of_expense: 7.5% of a $1,000.00 ad budget is exactly $75.00", () => {
    expect(allocatePercentageOfExpense("1000.00", "7.5")).toBe("75.00");
  });

  it("fixed_amount: $75.00 entered directly is preserved exactly", () => {
    expect(allocateFixedAmount("75.00")).toBe("75.00");
  });

  it("gross_profit = eligible_revenue - confirmed_allocated_expenses: 500.00 - 75.00 = 425.00", () => {
    expect(computeGrossProfit("500.00", "75.00")).toBe("425.00");
  });

  it("full_expense: the entire source amount allocates to a single invoice", () => {
    expect(allocateFullExpense("1446.53")).toBe("1446.53");
  });
});

describe("sumAmounts / computeGrossProfit — BigInt exactness", () => {
  it("sums many small amounts without floating-point drift", () => {
    const amounts = Array.from({ length: 10 }, () => "0.10");
    expect(sumAmounts(amounts)).toBe("1.00");
  });

  it("gross profit can be negative when expenses exceed revenue — never clamped to zero", () => {
    expect(computeGrossProfit("100.00", "150.00")).toBe("-50.00");
  });

  it("rejects a non-2dp amount rather than silently truncating", () => {
    expect(() => allocateFixedAmount("75.005")).toThrow();
  });
});
