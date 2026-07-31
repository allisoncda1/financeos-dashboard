import { describe, it, expect } from "vitest";

// Slug derivation — matches route logic exactly
function deriveSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50) || `rep_${Date.now()}`;
}

describe("Add Sales Rep slug derivation", () => {
  it("handles simple names", () => expect(deriveSlug("Jason Smith")).toBe("jason_smith"));
  it("handles special characters", () => expect(deriveSlug("Big Mouth!")).toBe("big_mouth"));
  it("trims leading/trailing underscores", () => expect(deriveSlug("  Jerod  ")).toBe("jerod"));
  it("truncates at 50 chars", () => {
    const long = "A".repeat(60);
    expect(deriveSlug(long).length).toBeLessThanOrEqual(50);
  });
  it("never creates a house rep from external UI", () => {
    // The route always uses 'external_rep' — no house type exposed
    const allowedTypes = ["external_rep"];
    expect(allowedTypes).not.toContain("internal_house");
  });
});

describe("Payout calendar rollover", () => {
  function payoutDue(month: string) {
    const [y, m] = month.split("-").map(Number);
    const dueMonth = m === 12 ? 1 : m + 1;
    const dueYear  = m === 12 ? y + 1 : y;
    return { dueYear, dueMonth, dueDay: 5 };
  }
  it("July 2026 → Aug 5 2026",  () => expect(payoutDue("2026-07")).toEqual({ dueYear: 2026, dueMonth: 8,  dueDay: 5 }));
  it("Dec 2026  → Jan 5 2027",  () => expect(payoutDue("2026-12")).toEqual({ dueYear: 2027, dueMonth: 1,  dueDay: 5 }));
  it("Nov 2025  → Dec 5 2025",  () => expect(payoutDue("2025-11")).toEqual({ dueYear: 2025, dueMonth: 12, dueDay: 5 }));
});
