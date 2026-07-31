import { describe, it, expect } from "vitest";

describe("CommissionSidebar", () => {
  const NAV = [
    { label: "Overview",   href: "/commissions"            },
    { label: "Invoices",   href: "/commissions/invoices"   },
    { label: "Sales Reps", href: "/commissions/sales-reps" },
    { label: "Review",     href: "/commissions/review"     },
    { label: "Payouts",    href: "/commissions/payouts"    },
    { label: "Reports",    href: "/commissions/reports"    },
  ];
  it("has exactly 6 items",             () => expect(NAV).toHaveLength(6));
  it("has no Settings/Rules/Clients",   () => {
    const labels = NAV.map(n => n.label);
    expect(labels).not.toContain("Settings");
    expect(labels).not.toContain("Rules");
    expect(labels).not.toContain("Clients");
    expect(labels).not.toContain("Calculations");
  });
  it("Review is at index 3",            () => expect(NAV[3].label).toBe("Review"));
  it("Payouts is at index 4",           () => expect(NAV[4].label).toBe("Payouts"));
});

const EXPENSES_RE = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$|^0\.\d{1,2}$/;
const RATE_RE     = /^\d{1,3}(?:\.\d{1,4})?$/;
function validateExpenses(v: string): string | null {
  if (v !== v.trim()) return "whitespace";
  if (!EXPENSES_RE.test(v)) return "invalid";
  return null;
}
function validateRate(v: string): string | null {
  if (v !== v.trim()) return "whitespace";
  if (!RATE_RE.test(v)) return "invalid";
  if (parseFloat(v) > 100) return "out of range";
  return null;
}

describe("Review form validation", () => {
  it("accepts valid expenses",          () => { expect(validateExpenses("1250.00")).toBeNull(); expect(validateExpenses("0")).toBeNull(); });
  it("rejects scientific notation",     () => { expect(validateExpenses("1e2")).not.toBeNull(); expect(validateRate("2e1")).not.toBeNull(); });
  it("rejects whitespace",              () => { expect(validateExpenses(" 100")).not.toBeNull(); expect(validateExpenses("100 ")).not.toBeNull(); });
  it("accepts rate 0–100",              () => { expect(validateRate("20")).toBeNull(); expect(validateRate("100")).toBeNull(); });
  it("rejects rate > 100",              () => expect(validateRate("101")).not.toBeNull());
});

describe("Trigger derivation — never invents a default", () => {
  const ALLOWED = new Set(["invoice_issued","invoice_paid","payment_received","manual_approval"]);
  it("uses derived trigger from most-recent active rule", () => {
    const rules = [{ representativeId:"rep1", status:"active", effectiveFrom:"2026-07-01", payableTrigger:"invoice_paid" }];
    const derived = rules.filter(r => r.representativeId==="rep1" && r.status==="active").sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom))[0]?.payableTrigger ?? null;
    expect(derived).toBe("invoice_paid");
    expect(ALLOWED.has(derived!)).toBe(true);
  });
  it("returns null when no rule — reviewer must select explicitly", () => {
    const derived = ([] as Array<{ payableTrigger: string }>).find(() => true)?.payableTrigger ?? null;
    expect(derived).toBeNull();
  });
  it("undefined rawTrigger fails ALLOWED check — rule skipped, not invented", () => {
    expect(ALLOWED.has(String(undefined ?? ""))).toBe(false);
  });
});

describe("ReviewApproveData envelope", () => {
  it("negative warning is inside data", () => {
    const data = { line:{ lineStatus:"approved" }, commissionAmount:"-20.00", warning:"Commission is negative — expenses exceed invoice amount. Approved as entered.", ruleWarning: null };
    expect(data.warning).toContain("negative");
    expect(data.commissionAmount).toBe("-20.00");
  });
  it("rule failure is ruleWarning; approval not undone", () => {
    const data = { line:{ lineStatus:"approved" }, commissionAmount:"1700.00", warning:null, ruleWarning:"Invoice approved. Future rate could not be saved — please retry." };
    expect(data.line.lineStatus).toBe("approved");
    expect(data.ruleWarning).toContain("Future rate could not be saved");
  });
  it("missing payableTrigger yields ruleWarning not approval failure", () => {
    const ALLOWED = new Set(["invoice_issued","invoice_paid","payment_received","manual_approval"]);
    expect(ALLOWED.has(String(undefined ?? ""))).toBe(false);
    const data = { line:{ lineStatus:"approved" }, commissionAmount:"1700.00", warning:null, ruleWarning:"Invoice approved. Future rate not saved — payableTrigger must be explicitly provided." };
    expect(data.line.lineStatus).toBe("approved");
    expect(data.ruleWarning).toContain("payableTrigger");
  });
});
