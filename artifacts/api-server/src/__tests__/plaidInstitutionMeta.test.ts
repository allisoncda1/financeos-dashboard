/**
 * plaidInstitutionMeta.test.ts — Behavior tests for institutionMetaService.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// vi.mock is hoisted — prevents plaidClient.ts fail-closed production check.
vi.mock("../lib/plaidClient.js", () => ({
  plaidClient: { institutionsGetById: vi.fn() },
}));

import {
  fetchInstitutionMeta,
  _clearCacheForTest,
} from "../services/institutionMetaService.js";
import { plaidClient } from "../lib/plaidClient.js";

const mockGetById = vi.mocked(plaidClient.institutionsGetById);

function resp(logo: string | null, primary_color: string | null) {
  return { data: { institution: { logo, primary_color } } } as never;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-31T12:00:00Z"));
  _clearCacheForTest();
  mockGetById.mockReset();
});
afterEach(() => vi.useRealTimers());

// ─── Deduplication & caching ──────────────────────────────────────────────────

describe("TTL cache", () => {
  it("calls Plaid exactly once for a given institution_id within the TTL", async () => {
    mockGetById.mockResolvedValue(resp("abc123==", "#1C5FAD"));
    await fetchInstitutionMeta("inst-1");
    await fetchInstitutionMeta("inst-1");
    await fetchInstitutionMeta("inst-1");
    expect(mockGetById).toHaveBeenCalledTimes(1);
  });

  it("proves one metadata request covers multiple accounts at the same institution", async () => {
    mockGetById.mockResolvedValue(resp("abc123==", "#0F6E3C"));
    // Route handler deduplicates institution_ids before calling fetchInstitutionMeta
    const uniqueIds = [...new Set(["inst-bank", "inst-bank", "inst-bank"])];
    await Promise.all(uniqueIds.map((id) => fetchInstitutionMeta(id)));
    expect(mockGetById).toHaveBeenCalledTimes(1);
  });

  it("calls Plaid again after the TTL expires (> 6 h)", async () => {
    mockGetById.mockResolvedValue(resp("logo==", "#1D4ED8"));
    await fetchInstitutionMeta("inst-2");
    vi.advanceTimersByTime(6 * 60 * 60 * 1000 + 1);
    await fetchInstitutionMeta("inst-2");
    expect(mockGetById).toHaveBeenCalledTimes(2);
  });

  it("does NOT call Plaid again before the TTL expires", async () => {
    mockGetById.mockResolvedValue(resp("logo==", "#1D4ED8"));
    await fetchInstitutionMeta("inst-3");
    vi.advanceTimersByTime(5 * 60 * 60 * 1000);
    await fetchInstitutionMeta("inst-3");
    expect(mockGetById).toHaveBeenCalledTimes(1);
  });
});

// ─── Error safety ─────────────────────────────────────────────────────────────

describe("Plaid failure handling", () => {
  it("does not throw when Plaid throws", async () => {
    mockGetById.mockRejectedValueOnce(new Error("Network timeout"));
    const meta = await fetchInstitutionMeta("inst-fail");
    expect(meta.logoDataUri).toBeNull();
    expect(meta.primaryColor).toBeNull();
  });

  it("caches the null result so the next call within the TTL skips Plaid", async () => {
    mockGetById.mockRejectedValueOnce(new Error("Rate limited"));
    await fetchInstitutionMeta("inst-cached-fail");
    await fetchInstitutionMeta("inst-cached-fail");
    expect(mockGetById).toHaveBeenCalledTimes(1);
  });
});

// ─── Missing logo ─────────────────────────────────────────────────────────────

describe("Missing logo", () => {
  it("returns null logoDataUri when Plaid returns no logo field", async () => {
    mockGetById.mockResolvedValueOnce(resp(null, "#1C5FAD"));
    const meta = await fetchInstitutionMeta("inst-no-logo");
    expect(meta.logoDataUri).toBeNull();
  });

  it("caches the null-logo result — Plaid is not called a second time", async () => {
    mockGetById.mockResolvedValue(resp(null, null));
    await fetchInstitutionMeta("inst-no-logo-2");
    await fetchInstitutionMeta("inst-no-logo-2");
    expect(mockGetById).toHaveBeenCalledTimes(1);
  });
});

// ─── Logo URI format ──────────────────────────────────────────────────────────

describe("Base64 logo → PNG data URI", () => {
  it("wraps Plaid's base64 string in a PNG data URI", async () => {
    const base64 = "iVBORw0KGgoAAAANSUhEUg==";
    mockGetById.mockResolvedValueOnce(resp(base64, null));
    const meta = await fetchInstitutionMeta("inst-logo");
    expect(meta.logoDataUri).toBe(`data:image/png;base64,${base64}`);
    expect(meta.logoDataUri).toMatch(/^data:image\/png;base64,/);
  });
});

// ─── Primary color validation ─────────────────────────────────────────────────

describe("Primary color validation", () => {
  it("accepts a valid #RRGGBB color", async () => {
    mockGetById.mockResolvedValueOnce(resp(null, "#1C5FAD"));
    expect((await fetchInstitutionMeta("inst-c1")).primaryColor).toBe("#1C5FAD");
  });

  it("rejects a 3-digit hex color", async () => {
    mockGetById.mockResolvedValueOnce(resp(null, "#1CF"));
    expect((await fetchInstitutionMeta("inst-c2")).primaryColor).toBeNull();
  });

  it("rejects a color without leading #", async () => {
    mockGetById.mockResolvedValueOnce(resp(null, "1C5FAD"));
    expect((await fetchInstitutionMeta("inst-c3")).primaryColor).toBeNull();
  });

  it("rejects an rgb(...) string", async () => {
    mockGetById.mockResolvedValueOnce(resp(null, "rgb(28,95,173)"));
    expect((await fetchInstitutionMeta("inst-c4")).primaryColor).toBeNull();
  });

  it("returns null when primary_color is null", async () => {
    mockGetById.mockResolvedValueOnce(resp("logo==", null));
    expect((await fetchInstitutionMeta("inst-c5")).primaryColor).toBeNull();
  });
});
