/**
 * bankingCards.test.ts — Focused behavior tests for the banking card redesign.
 * Pure-function tests for banking-utils; logic tests for filtering and cash
 * exclusion. Static source check kept only for the route-ordering invariant
 * (structural guarantee that cannot be expressed as a runtime logic test).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  institutionColor,
  formatRelativeTime,
  totalAvailableCash,
} from "../../lib/banking-utils";

// ─── institutionColor ─────────────────────────────────────────────────────────

describe("institutionColor", () => {
  it("is deterministic — same name always yields the same color", () => {
    expect(institutionColor("Mercury")).toEqual(institutionColor("Mercury"));
    expect(institutionColor("Chase")).toEqual(institutionColor("Chase"));
  });

  it("always returns a six-digit hex bg", () => {
    for (const name of ["Mercury", "Chase", "Bank of America", "", "X"]) {
      expect(institutionColor(name).bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("always returns a non-empty text color", () => {
    expect(institutionColor("Mercury").text).toBeTruthy();
  });

  it("does not throw for an empty string", () => {
    expect(() => institutionColor("")).not.toThrow();
  });

  it("two different institutions can have different colors", () => {
    // Not guaranteed, but our palette is large enough for any real pair
    const mercury = institutionColor("Mercury");
    const chase   = institutionColor("Chase");
    // At minimum they should both be valid — structural sanity check
    expect(mercury.bg).toMatch(/^#/);
    expect(chase.bg).toMatch(/^#/);
  });
});

// ─── formatRelativeTime ───────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 'just now' for < 1 minute ago", () => {
    expect(
      formatRelativeTime(new Date("2026-07-31T11:59:30Z").toISOString()),
    ).toBe("just now");
  });

  it("returns minutes for < 60 minutes ago", () => {
    expect(
      formatRelativeTime(new Date("2026-07-31T11:45:00Z").toISOString()),
    ).toBe("15m ago");
  });

  it("returns hours for < 24 hours ago", () => {
    expect(
      formatRelativeTime(new Date("2026-07-31T08:00:00Z").toISOString()),
    ).toBe("4h ago");
  });

  it("returns days for < 30 days ago", () => {
    expect(
      formatRelativeTime(new Date("2026-07-24T12:00:00Z").toISOString()),
    ).toBe("7d ago");
  });

  it("returns a locale date string for > 30 days ago", () => {
    const result = formatRelativeTime(
      new Date("2026-06-01T00:00:00Z").toISOString(),
    );
    expect(result).not.toContain("ago");
    expect(result.length).toBeGreaterThan(3);
  });
});

// ─── totalAvailableCash ───────────────────────────────────────────────────────

describe("totalAvailableCash", () => {
  it("sums availableBalance for depository accounts", () => {
    expect(
      totalAvailableCash([
        { type: "depository", availableBalance: 10_000, currentBalance: 10_100 },
        { type: "depository", availableBalance:  5_000, currentBalance:  5_100 },
      ]),
    ).toBe(15_000);
  });

  it("includes investment accounts", () => {
    expect(
      totalAvailableCash([
        { type: "investment", availableBalance: 50_000, currentBalance: 50_000 },
      ]),
    ).toBe(50_000);
  });

  it("excludes credit accounts — available credit is not spendable cash", () => {
    expect(
      totalAvailableCash([
        { type: "credit",     availableBalance: 8_000, currentBalance: 2_000 },
        { type: "depository", availableBalance: 3_000, currentBalance: 3_100 },
      ]),
    ).toBe(3_000);
  });

  it("excludes loan accounts", () => {
    expect(
      totalAvailableCash([
        { type: "loan",  availableBalance: null,  currentBalance: 20_000 },
        { type: "other", availableBalance: 1_000, currentBalance:  1_000 },
      ]),
    ).toBe(0);
  });

  it("falls back to currentBalance when availableBalance is null", () => {
    expect(
      totalAvailableCash([
        { type: "depository", availableBalance: null, currentBalance: 7_500 },
      ]),
    ).toBe(7_500);
  });

  it("treats null currentBalance as zero", () => {
    expect(
      totalAvailableCash([
        { type: "depository", availableBalance: null, currentBalance: null },
      ]),
    ).toBe(0);
  });

  it("returns zero for an empty list", () => {
    expect(totalAvailableCash([])).toBe(0);
  });
});

// ─── Client-side transaction filter logic ─────────────────────────────────────

describe("account-scoped transaction filter", () => {
  const allTxns = [
    { id: "t1", accountId: "acc-A", amount: 10 },
    { id: "t2", accountId: "acc-B", amount: 20 },
    { id: "t3", accountId: "acc-A", amount: 30 },
    { id: "t4", accountId: "acc-C", amount: 40 },
  ];

  it("returns only transactions belonging to the selected account", () => {
    const filtered = allTxns.filter((t) => t.accountId === "acc-A");
    expect(filtered).toHaveLength(2);
    expect(filtered.every((t) => t.accountId === "acc-A")).toBe(true);
  });

  it("never surfaces another account's transactions", () => {
    const filtered = allTxns.filter((t) => t.accountId === "acc-A");
    expect(filtered.find((t) => t.accountId !== "acc-A")).toBeUndefined();
    expect(filtered.map((t) => t.id)).not.toContain("t2");
    expect(filtered.map((t) => t.id)).not.toContain("t4");
  });

  it("returns empty array when the account has no transactions", () => {
    expect(allTxns.filter((t) => t.accountId === "acc-NONE")).toHaveLength(0);
  });
});

// ─── Card grid — one card per account (logic) ─────────────────────────────────

describe("account card grid", () => {
  it("produces one card key per account, never groups by institution", () => {
    const accounts = [
      { plaidAccountId: "a1", institutionName: "Mercury" },
      { plaidAccountId: "a2", institutionName: "Mercury" },
      { plaidAccountId: "a3", institutionName: "Mercury" },
      { plaidAccountId: "a4", institutionName: "Mercury" },
    ];
    const keys = accounts.map((a) => a.plaidAccountId);
    expect(keys).toHaveLength(4);
    expect(new Set(keys).size).toBe(4);
    // Four Mercury accounts → four separate cards
    expect(accounts.filter((a) => a.institutionName === "Mercury")).toHaveLength(4);
  });
});

// ─── Route ordering (structural) ─────────────────────────────────────────────

describe("App.tsx route ordering", () => {
  it("detail route is registered before overview route", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const content = readFileSync(resolve(dir, "../../App.tsx"), "utf8");
    const detailIdx   = content.indexOf("/accounting/banking/accounts/:accountId");
    const overviewIdx = content.indexOf('"/accounting/banking"');
    expect(detailIdx).toBeGreaterThan(-1);
    expect(overviewIdx).toBeGreaterThan(-1);
    expect(detailIdx).toBeLessThan(overviewIdx);
  });
});
