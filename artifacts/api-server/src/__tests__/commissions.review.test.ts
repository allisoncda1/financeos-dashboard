/**
 * Commission review — backend unit tests.
 * BigInt arithmetic exactness and engine branch semantics.
 */
import { describe, it, expect } from "vitest";
import { mulMoney, addMoney, applyFormula } from "../services/commissionEngine";
import type { CommissionRule } from "../db/commissions";

function parseCents(s: string): bigint {
  const m = s.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) throw new Error(`invalid: "${s}"`);
  const [, sign, int, frac = ""] = m;
  const cents = BigInt(int) * 100n + BigInt(frac.padEnd(2, "0"));
  return sign === "-" ? -cents : cents;
}

describe("mulMoney — BigInt exact arithmetic", () => {
  it("(10000.00 - 1500.00) * 0.200000 = 1700.00", () => {
    const basis  = addMoney("10000.00", "-1500.00");
    const result = mulMoney(basis, "0.200000");
    expect(parseCents(result)).toBe(parseCents("1700.00"));
    expect(result).toBe("1700.00");
  });
  it("negative preserved when expenses exceed invoice", () => {
    const basis  = addMoney("500.00", "-600.00");
    const result = mulMoney(basis, "0.200000");
    expect(result).toBe("-20.00");
    expect(parseCents(result)).toBe(-2000n);
  });
  it("half-away-from-zero: 1.00 * 0.005000 = 0.01", () => {
    expect(mulMoney("1.00", "0.005000")).toBe("0.01");
  });
});

describe("applyFormula — percentage_of_adjusted_gp branch", () => {
  const baseRule: CommissionRule = {
    id: "r1", entityId: "e1", representativeId: "rep1",
    coreCustomerId: null, customerNamePattern: null,
    formulaType: "percentage_of_adjusted_gp",
    calculationBasis: "adjusted_gp",
    commissionRate: "0.200000", fixedAmount: null,
    payableTrigger: "invoice_issued",
    ruleVersion: 1, status: "active",
    effectiveFrom: "2026-07-01", effectiveTo: null, notes: null,
  };

  it("returns needs_review / expenses_required for any input", () => {
    const result = applyFormula(baseRule, {
      invoiceAmount: "10000.00", amountPaid: null,
      grossProfit: null, expensesAmount: null, invoiceStatus: "Paid",
    });
    expect(result.lineStatus).toBe("needs_review");
    expect(result.exclusionReason).toBe("expenses_required");
    expect(result.commissionAmount).toBeNull();
    expect(result.calculationBasis).toBe("adjusted_gp");
  });

  it("never auto-calculates even when all inputs are present", () => {
    const result = applyFormula(baseRule, {
      invoiceAmount: "10000.00", amountPaid: "10000.00",
      grossProfit: "8000.00", expensesAmount: "1500.00", invoiceStatus: "Paid",
    });
    expect(result.commissionAmount).toBeNull();
    expect(result.lineStatus).toBe("needs_review");
  });

  it("unknown formula type gives unknown_formula_type", () => {
    const bad = { ...baseRule, formulaType: "not_real" };
    const result = applyFormula(bad, {
      invoiceAmount: "1000.00", amountPaid: null,
      grossProfit: null, expensesAmount: null, invoiceStatus: "Paid",
    });
    expect(result.exclusionReason).toBe("unknown_formula_type");
  });
});
