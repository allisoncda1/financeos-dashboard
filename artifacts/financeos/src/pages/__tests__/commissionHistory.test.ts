/**
 * Commission history utility — focused tests
 *
 * CH1.  June 2026 invoice → isHistoricalInvoice = true
 * CH2.  July 2026 invoice  → isHistoricalInvoice = false
 * CH3.  isHistoricalPeriod("2026-06") = true
 * CH4.  isHistoricalPeriod("2026-07") = false
 * CH5.  isHistoricalPeriod(null) = false  (all-time is NOT historical-only)
 * CH6.  isHistoricalPeriod("2025-12") = true
 * CH7.  isHistoricalInvoice(null) = false  (missing date is not historical)
 * CH8.  Historical June invoice → needsConfig contribution = 0
 * CH9.  Live July invoice → needsConfig contribution = 1
 * CH10. Calendar rollover: July 30 2026 → earningMonth=July 2026, dueMonth=August 2026
 * CH11. Calendar rollover: December 31 2026 → earningMonth=December 2026, dueMonth=January 2027
 * CH12. Rendered output must not contain "payout_eligible ="
 */

import { describe, it, expect } from "vitest";
import {
  isHistoricalInvoice,
  isHistoricalPeriod,
  getNextPayoutInfo,
  COMMISSION_LIVE_START_DATE,
} from "@/lib/commission-history";

describe("COMMISSION_LIVE_START_DATE", () => {
  it("is 2026-07-01", () => {
    expect(COMMISSION_LIVE_START_DATE).toBe("2026-07-01");
  });
});

describe("isHistoricalInvoice (CH1, CH2, CH7)", () => {
  it("CH1: June 30 2026 → historical", () => {
    expect(isHistoricalInvoice("2026-06-30")).toBe(true);
  });
  it("CH1: June 1 2026 → historical", () => {
    expect(isHistoricalInvoice("2026-06-01")).toBe(true);
  });
  it("CH1: any 2025 date → historical", () => {
    expect(isHistoricalInvoice("2025-11-15")).toBe(true);
  });
  it("CH2: July 1 2026 → NOT historical (live start)", () => {
    expect(isHistoricalInvoice("2026-07-01")).toBe(false);
  });
  it("CH2: July 31 2026 → NOT historical", () => {
    expect(isHistoricalInvoice("2026-07-31")).toBe(false);
  });
  it("CH2: August 2026 → NOT historical", () => {
    expect(isHistoricalInvoice("2026-08-05")).toBe(false);
  });
  it("CH7: null → false (not historical)", () => {
    expect(isHistoricalInvoice(null)).toBe(false);
  });
  it("CH7: undefined → false", () => {
    expect(isHistoricalInvoice(undefined)).toBe(false);
  });
});

describe("isHistoricalPeriod (CH3, CH4, CH5, CH6)", () => {
  it("CH3: 2026-06 → true", () => {
    expect(isHistoricalPeriod("2026-06")).toBe(true);
  });
  it("CH4: 2026-07 → false (live start month)", () => {
    expect(isHistoricalPeriod("2026-07")).toBe(false);
  });
  it("CH4: 2026-08 → false", () => {
    expect(isHistoricalPeriod("2026-08")).toBe(false);
  });
  it("CH5: null (all-time) → false", () => {
    expect(isHistoricalPeriod(null)).toBe(false);
  });
  it("CH6: 2025-12 → true", () => {
    expect(isHistoricalPeriod("2025-12")).toBe(true);
  });
  it("CH6: 2026-01 → true", () => {
    expect(isHistoricalPeriod("2026-01")).toBe(true);
  });
});

describe("Needs Action count logic (CH8, CH9)", () => {
  function needsActionForPeriod(period: string | null, needsConfig: number, needsReview: number): number {
    if (isHistoricalPeriod(period)) return 0;
    return needsConfig + needsReview;
  }

  it("CH8: June 2026 period → Needs Action = 0 even with missing config", () => {
    expect(needsActionForPeriod("2026-06", 5, 3)).toBe(0);
  });
  it("CH9: July 2026 period → Needs Action = actual count", () => {
    expect(needsActionForPeriod("2026-07", 5, 3)).toBe(8);
  });
  it("CH9: null (all-time) → Needs Action = actual count", () => {
    expect(needsActionForPeriod(null, 2, 1)).toBe(3);
  });
});

describe("getNextPayoutInfo — calendar rollover (CH10, CH11)", () => {
  it("CH10: July 30 2026 → earningMonth=July 2026, dueMonth=August 2026", () => {
    const r = getNextPayoutInfo(new Date(2026, 6, 30));
    expect(r.earningMonth).toBe("July 2026");
    expect(r.dueMonth).toBe("August 2026");
    expect(r.dueMonthShort).toBe("AUG");
    expect(r.dueDay).toBe(5);
    expect(r.dueYear).toBe(2026);
  });
  it("CH11: December 31 2026 → earningMonth=December 2026, dueMonth=January 2027", () => {
    const r = getNextPayoutInfo(new Date(2026, 11, 31));
    expect(r.earningMonth).toBe("December 2026");
    expect(r.dueMonth).toBe("January 2027");
    expect(r.dueMonthShort).toBe("JAN");
    expect(r.dueYear).toBe(2027);
  });
  it("August 2026 → dueMonth=September 2026", () => {
    const r = getNextPayoutInfo(new Date(2026, 7, 15));
    expect(r.earningMonth).toBe("August 2026");
    expect(r.dueMonth).toBe("September 2026");
  });
  it("November 2026 → dueMonth=December 2026 (not January)", () => {
    const r = getNextPayoutInfo(new Date(2026, 10, 1));
    expect(r.dueMonth).toBe("December 2026");
    expect(r.dueYear).toBe(2026);
  });
});

describe("CH12: No rendered commission UI contains 'payout_eligible ='", () => {
  it("overview.tsx source does not contain 'payout_eligible ='", async () => {
    const fs   = await import("fs");
    const path = await import("path");
    const src  = fs.readFileSync(
      path.resolve(__dirname, "../../pages/commissions/overview.tsx"), "utf8"
    );
    expect(src).not.toContain("payout_eligible =");
  });
  it("sales-reps.tsx source does not contain 'payout_eligible ='", async () => {
    const fs   = await import("fs");
    const path = await import("path");
    const src  = fs.readFileSync(
      path.resolve(__dirname, "../../pages/commissions/sales-reps.tsx"), "utf8"
    );
    expect(src).not.toContain("payout_eligible =");
  });
  it("CommissionStatusTable.tsx source does not contain 'payout_eligible ='", async () => {
    const fs   = await import("fs");
    const path = await import("path");
    const src  = fs.readFileSync(
      path.resolve(__dirname, "../../components/commission/CommissionStatusTable.tsx"), "utf8"
    );
    expect(src).not.toContain("payout_eligible =");
  });
});
