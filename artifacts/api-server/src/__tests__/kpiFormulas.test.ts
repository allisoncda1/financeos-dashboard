/**
 * kpiFormulas.test.ts
 *
 * Regression tests for all server-side KPI formulas:
 * 1. computeStandardDso — standard DSO formula, null guards, zero revenue
 * 2. computeCashRunwayMonths — date-aware, no hardcoded divisor
 * 3. computeNetMarginPct / computeGrossMarginPct — basic margin math
 * 4. Entity isolation — each entity's DSO/runway is independent
 * 5. Smile More negative values are never replaced with zero
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeStandardDso,
  computeCashRunwayMonths,
  computeNetMarginPct,
  computeGrossMarginPct,
} from "../services/kpi";

// ── computeStandardDso ────────────────────────────────────────────────────────

describe("computeStandardDso", () => {
  it("computes standard DSO: (openAr / revenue) * periodDays", () => {
    // openAr=30000, revenue=360000, periodDays=180 → 30000/360000 * 180 = 15 days
    expect(computeStandardDso(30_000, 360_000, 180)).toBeCloseTo(15, 5);
  });

  it("returns null when revenue is zero", () => {
    expect(computeStandardDso(10_000, 0, 180)).toBeNull();
  });

  it("returns null when revenue is negative", () => {
    expect(computeStandardDso(10_000, -5_000, 180)).toBeNull();
  });

  it("returns null when openAr is NaN", () => {
    expect(computeStandardDso(NaN, 100_000, 180)).toBeNull();
  });

  it("returns null when revenue is NaN", () => {
    expect(computeStandardDso(10_000, NaN, 180)).toBeNull();
  });

  it("returns null when periodDays is zero", () => {
    expect(computeStandardDso(10_000, 100_000, 0)).toBeNull();
  });

  it("returns null when periodDays is negative", () => {
    expect(computeStandardDso(10_000, 100_000, -30)).toBeNull();
  });

  it("handles zero openAr (no AR outstanding) — returns 0, not null", () => {
    // Zero AR with positive revenue is valid: DSO = 0 days
    expect(computeStandardDso(0, 100_000, 180)).toBeCloseTo(0, 5);
  });

  it("Smile More: negative openAr (credit position) is preserved — not zeroed", () => {
    // A credit AR balance is unusual but must not be silently zeroed
    const result = computeStandardDso(-5_000, 100_000, 180);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(0);
  });

  it("full-year period: periodDays=365 produces correct annual DSO", () => {
    // openAr=91250, revenue=730000, days=365 → 91250/730000 * 365 = 45.625 days
    expect(computeStandardDso(91_250, 730_000, 365)).toBeCloseTo(45.625, 2);
  });

  it("entity isolation: different entities produce independent DSO values", () => {
    const entity1 = computeStandardDso(50_000, 200_000, 180); // 45 days
    const entity2 = computeStandardDso(20_000, 400_000, 180); // 9 days
    expect(entity1).toBeCloseTo(45, 1);
    expect(entity2).toBeCloseTo(9, 1);
    expect(entity1).not.toEqual(entity2);
  });
});

// ── computeCashRunwayMonths ───────────────────────────────────────────────────

describe("computeCashRunwayMonths — date-aware (no hardcoded /6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("July: 7 months elapsed — opex $70k → $10k/mo; $60k cash = 6 months runway", () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(computeCashRunwayMonths(60_000, 70_000)).toBeCloseTo(6.0, 4);
  });

  it("January: 1 month elapsed — opex $10k → $10k/mo; $60k cash = 6 months runway", () => {
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    expect(computeCashRunwayMonths(60_000, 10_000)).toBeCloseTo(6.0, 4);
  });

  it("PROOF: same cash and monthly burn gives same runway regardless of month", () => {
    // If /6 were hardcoded, July and January would give different results
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    const july = computeCashRunwayMonths(60_000, 70_000); // opex=$70k over 7 months

    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    const jan = computeCashRunwayMonths(60_000, 10_000);  // opex=$10k over 1 month

    expect(july).toBeCloseTo(jan!, 4);
  });

  it("returns null for zero cash (no runway to compute)", () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(computeCashRunwayMonths(0, 50_000)).toBeNull();
  });

  it("Smile More: returns null for negative cash — visible as no runway, not zero months", () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(computeCashRunwayMonths(-12_000, 50_000)).toBeNull();
  });

  it("returns null for zero opex", () => {
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    expect(computeCashRunwayMonths(50_000, 0)).toBeNull();
  });
});

// ── computeNetMarginPct / computeGrossMarginPct ───────────────────────────────

describe("margin computations", () => {
  it("net margin: 30k income / 100k revenue = 30%", () => {
    expect(computeNetMarginPct(30_000, 100_000)).toBeCloseTo(30, 5);
  });

  it("net margin returns NaN (not 0) when revenue is zero — signals absent data", () => {
    expect(Number.isNaN(computeNetMarginPct(0, 0))).toBe(true);
  });

  it("gross margin: 60k gross / 100k revenue = 60%", () => {
    expect(computeGrossMarginPct(60_000, 100_000)).toBeCloseTo(60, 5);
  });

  it("Smile More: negative net income produces negative margin — not zeroed", () => {
    const result = computeNetMarginPct(-15_000, 80_000);
    expect(result).toBeLessThan(0);
    expect(result).toBeCloseTo(-18.75, 2);
  });
});
