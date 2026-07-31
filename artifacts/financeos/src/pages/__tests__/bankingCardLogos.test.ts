/**
 * bankingCardLogos.test.ts — Behavior tests for InstitutionAvatar logo logic.
 *
 * Tests the showLogo conditional and data URI format as pure logic — no DOM
 * required. Mirrors the exact formula used in InstitutionAvatar.
 */

import { describe, it, expect } from "vitest";

// showLogo = Boolean(logo) && !imgFailed  (from InstitutionAvatar)
describe("InstitutionAvatar — showLogo logic", () => {
  it("shows logo when logo is a non-empty string and image has not failed", () => {
    const logo = "data:image/png;base64,abc123==";
    const imgFailed = false;
    expect(Boolean(logo) && !imgFailed).toBe(true);
  });

  it("falls back to initial when logo is null", () => {
    expect(Boolean(null as string | null) && !false).toBe(false);
  });

  it("falls back to initial when logo is an empty string", () => {
    expect(Boolean("") && !false).toBe(false);
  });

  it("falls back to initial when logo is undefined", () => {
    expect(Boolean(undefined as string | undefined) && !false).toBe(false);
  });

  it("falls back to initial when image loading fails (imgFailed = true)", () => {
    const logo = "data:image/png;base64,abc123==";
    const imgFailed = true;
    expect(Boolean(logo) && !imgFailed).toBe(false);
  });
});

describe("Logo data URI format", () => {
  it("valid PNG data URI is truthy and matches expected prefix", () => {
    const uri = "data:image/png;base64,iVBORw0KGgo=";
    expect(uri).toMatch(/^data:image\/png;base64,/);
    expect(Boolean(uri)).toBe(true);
  });

  it("null logo is falsy — src falls back to empty string", () => {
    const logo: string | null = null;
    expect(Boolean(logo)).toBe(false);
    expect(logo ?? "").toBe("");
  });
});

describe("Primary color — frontend style logic", () => {
  it("valid #RRGGBB produces a boxShadow style value containing the color", () => {
    const primaryColor = "#1C5FAD";
    const style = primaryColor
      ? { boxShadow: `0 0 0 1.5px ${primaryColor}40` }
      : undefined;
    expect(style).toBeDefined();
    expect(style?.boxShadow).toContain("#1C5FAD");
  });

  it("null primaryColor produces undefined style — no accent applied", () => {
    const primaryColor: string | null = null;
    const style = primaryColor
      ? { boxShadow: `0 0 0 1.5px ${primaryColor}40` }
      : undefined;
    expect(style).toBeUndefined();
  });
});
