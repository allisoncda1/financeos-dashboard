/**
 * Strict runtime validation of the AI provider's document-extraction JSON —
 * the exact defense that makes an invalid/malformed model response fail
 * closed (structured: undefined -> caller treats as failed) rather than
 * silently accepting a malformed or partially-wrong shape.
 */
import { describe, it, expect } from "vitest";
import { isValidExtractionResult } from "../ai/provider";
import { MockProvider } from "../ai/provider";

describe("isValidExtractionResult — fails closed on malformed AI JSON", () => {
  it("accepts a well-formed result", () => {
    expect(isValidExtractionResult({
      vendorName: "MCA", documentNumber: "MCA2026_016", documentDate: "2026-07-31", documentTotal: "1446.53",
      lines: [{ lineIndex: 0, clientName: "Precision Roofing", amount: "75.00", description: null, proofPage: 1, ambiguous: false }],
    })).toBe(true);
  });

  it("rejects a bare string (model returned prose instead of JSON)", () => {
    expect(isValidExtractionResult("Sorry, I cannot process this document.")).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isValidExtractionResult(null)).toBe(false);
    expect(isValidExtractionResult(undefined)).toBe(false);
  });

  it("rejects a result missing the required 'lines' array", () => {
    expect(isValidExtractionResult({ vendorName: "MCA", documentNumber: null, documentDate: null, documentTotal: null })).toBe(false);
  });

  it("rejects amount as a number instead of a string (avoids float coercion of money)", () => {
    expect(isValidExtractionResult({
      vendorName: null, documentNumber: null, documentDate: null, documentTotal: null,
      lines: [{ lineIndex: 0, clientName: "X", amount: 75.0, description: null, proofPage: null, ambiguous: false }],
    })).toBe(false);
  });

  it("rejects a line missing the required 'ambiguous' boolean", () => {
    expect(isValidExtractionResult({
      vendorName: null, documentNumber: null, documentDate: null, documentTotal: null,
      lines: [{ lineIndex: 0, clientName: "X", amount: "75.00", description: null, proofPage: null }],
    })).toBe(false);
  });

  it("rejects a lines array containing a non-object entry", () => {
    expect(isValidExtractionResult({
      vendorName: null, documentNumber: null, documentDate: null, documentTotal: null,
      lines: ["not an object"],
    })).toBe(false);
  });

  it("accepts an empty lines array (a genuinely empty document, not a schema violation)", () => {
    expect(isValidExtractionResult({ vendorName: null, documentNumber: null, documentDate: null, documentTotal: null, lines: [] })).toBe(true);
  });
});

describe("MockProvider.extractCommissionDocument — deterministic, no network", () => {
  it("returns structured:undefined-safe shape even for text with zero recognizable lines", async () => {
    const provider = new MockProvider();
    const response = await provider.extractCommissionDocument({ documentText: "no structured content here", fileName: "x.pdf" });
    expect(response.structured).toBeTruthy();
    expect((response.structured as { lines: unknown[] }).lines).toEqual([]);
  });
});
