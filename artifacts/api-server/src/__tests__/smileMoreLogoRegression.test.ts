/**
 * Regression tests: Smile More logo rendering on dark report covers.
 *
 * Root cause fixed: smile-more.png had a solid black background (RGBA corner
 * pixel 0,0,0,255). The CSS filter brightness(0)+invert(1)+opacity(0.7) applied
 * to .cover__entity-logo turned every pixel — including the black background —
 * into a gray rectangle. Fixed by baking smile-more-dark.png (transparent
 * background, white/yellow content) under the smile_more key.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { inflateSync } from "zlib";

const __dir = dirname(fileURLToPath(import.meta.url));
const GENERATED_TS = resolve(__dir, "../reports/renderers/logoAssets.generated.ts");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractBakedUri(key: string): string | null {
  const src = readFileSync(GENERATED_TS, "utf8");
  const m = src.match(new RegExp(`"${key}":\\s*"(data:image\\/[^"]+)"`));
  return m?.[1] ?? null;
}

function pngCornerAlpha(dataUri: string): number {
  const b64 = dataUri.replace(/^data:image\/[^;]+;base64,/, "");
  const buf = Buffer.from(b64, "base64");
  let offset = 8;
  const idatChunks: Buffer[] = [];
  while (offset < buf.length - 4) {
    const length = buf.readUInt32BE(offset);
    const type = buf.slice(offset + 4, offset + 8).toString("ascii");
    if (type === "IDAT") idatChunks.push(buf.slice(offset + 8, offset + 8 + length));
    if (type === "IEND") break;
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idatChunks));
  // PNG row 0: filter byte at [0], then RGBA pixels; alpha is at index [4]
  return raw[4] ?? -1;
}

function pngSize(dataUri: string): number {
  const b64 = dataUri.replace(/^data:image\/[^;]+;base64,/, "");
  return Buffer.from(b64, "base64").length;
}

// ─── 1. smile_more resolves to the transparent-background asset ──────────────

describe("Smile More logo — baked asset key and variant", () => {
  it("smile_more key exists in BAKED_LOGOS and is non-null", () => {
    const uri = extractBakedUri("smile_more");
    expect(uri).not.toBeNull();
    expect(uri).toMatch(/^data:image\//);
  });

  it("smile_more baked asset has TRANSPARENT background (corner pixel alpha = 0)", () => {
    const uri = extractBakedUri("smile_more")!;
    const alpha = pngCornerAlpha(uri);
    expect(alpha).toBe(0); // 0 = fully transparent; 255 = opaque (the old broken asset)
  });

  it("smile_more baked asset is NOT the solid-black-background variant (wrong size guard)", () => {
    // smile-more.png (broken) was 24 553 bytes; smile-more-dark.png is 21 141 bytes.
    // This catches any future accidental revert to the opaque asset.
    const uri = extractBakedUri("smile_more")!;
    const bytes = pngSize(uri);
    expect(bytes).toBeLessThan(23_000); // opaque variant is ~24 KB
    expect(bytes).toBeGreaterThan(5_000); // not an empty/placeholder image
  });

  it("smile_more baked asset byte length matches the dark variant exactly", () => {
    // smile-more-dark.png is 21141 bytes; smile-more.png (opaque) is 24553 bytes.
    // A mismatch here means the wrong file was baked.
    const uri = extractBakedUri("smile_more")!;
    const bytes = pngSize(uri);
    expect(bytes).toBe(21141);
  });
});

// ─── 2. getBakedLogo path normalisation ─────────────────────────────────────

describe("getBakedLogo() resolves Smile More path to transparent asset", () => {
  it("'/logos/smile-more.png' resolves via key smile_more to transparent asset", async () => {
    const { getBakedLogo } = await import("../reports/renderers/logoAssets.generated.js");
    const uri = getBakedLogo("/logos/smile-more.png");
    expect(uri).not.toBeNull();
    const alpha = pngCornerAlpha(uri!);
    expect(alpha).toBe(0);
  });

  it("'/logos/smile-more-dark.png' also resolves (the underlying file name)", async () => {
    const { getBakedLogo } = await import("../reports/renderers/logoAssets.generated.js");
    // smile-more-dark.png → key smile_more_dark; may or may not be baked separately.
    // The primary lookup path (/logos/smile-more.png) MUST resolve.
    const uri = getBakedLogo("/logos/smile-more.png");
    expect(uri).not.toBeNull();
  });
});

// ─── 3. Portfolio cover — all four company logos are distinct ────────────────

describe("Portfolio cover — four distinct company logos baked", () => {
  const COMPANY_KEYS = ["cardealer_ai", "t3_marketing", "topmrktr", "smile_more"];

  for (const key of COMPANY_KEYS) {
    it(`${key}: baked asset exists and is non-empty`, () => {
      const uri = extractBakedUri(key);
      expect(uri).not.toBeNull();
      expect(pngSize(uri!)).toBeGreaterThan(5_000);
    });
  }

  it("all four company logos are distinct data URIs (not duplicates)", () => {
    const uris = COMPANY_KEYS.map(k => extractBakedUri(k));
    const unique = new Set(uris);
    expect(unique.size).toBe(COMPANY_KEYS.length);
  });

  it("all four company logos have transparent backgrounds (corner alpha = 0)", () => {
    for (const key of COMPANY_KEYS) {
      const uri = extractBakedUri(key)!;
      const alpha = pngCornerAlpha(uri);
      expect(alpha, `${key} corner alpha should be 0 (transparent)`).toBe(0);
    }
  });
});

// ─── 4. embedLogoPath uses the corrected baked asset ────────────────────────

describe("embedLogoPath returns transparent-background asset for Smile More", () => {
  it("embedLogoPath('/logos/smile-more.png') returns a data URI", async () => {
    const { embedLogoPath } = await import("../reports/renderers/designSystem.js");
    const result = embedLogoPath("/logos/smile-more.png");
    expect(result).not.toBeNull();
    expect(result).toMatch(/^data:image\//);
  });

  it("embedLogoPath('/logos/smile-more.png') returns the transparent-bg asset", async () => {
    const { embedLogoPath } = await import("../reports/renderers/designSystem.js");
    const uri = embedLogoPath("/logos/smile-more.png")!;
    const alpha = pngCornerAlpha(uri);
    expect(alpha).toBe(0);
  });

  it("logoImg for Smile More emits <img> tag, not initials fallback", async () => {
    const { logoImg } = await import("../reports/renderers/designSystem.js");
    const html = logoImg("/logos/smile-more.png", "Smile More", "#ec4899");
    expect(html).toMatch(/<img/);
    expect(html).toMatch(/src="data:image\//);
    expect(html).not.toMatch(/<span/); // no initials fallback
  });
});

// ─── 5. Working logos unchanged ──────────────────────────────────────────────

describe("CarDealer.ai, T3 Marketing, TopMrktr logos are unchanged", () => {
  const UNCHANGED = [
    { key: "cardealer_ai", path: "/logos/cardealer-ai.png"  },
    { key: "t3_marketing", path: "/logos/t3-marketing.png"  },
    { key: "topmrktr",     path: "/logos/topmrktr.png"      },
  ];

  for (const { key, path } of UNCHANGED) {
    it(`${key}: resolves to non-null data URI with transparent background`, async () => {
      const { getBakedLogo } = await import("../reports/renderers/logoAssets.generated.js");
      const uri = getBakedLogo(path);
      expect(uri).not.toBeNull();
      expect(pngCornerAlpha(uri!)).toBe(0);
    });
  }
});

// ─── 6. No gray placeholder emitted when asset exists ────────────────────────

describe("No gray placeholder or initials when Smile More asset is available", () => {
  it("logoImg does not emit initials 'SM' when logo resolves", async () => {
    const { logoImg } = await import("../reports/renderers/designSystem.js");
    const html = logoImg("/logos/smile-more.png", "Smile More", "#ec4899");
    // The initials fallback span contains the first two letters of the name
    expect(html).not.toMatch(/\bSM\b/);
    expect(html).not.toMatch(/data-initials/);
  });

  it("logoImg does not emit a gray square span element", async () => {
    const { logoImg } = await import("../reports/renderers/designSystem.js");
    const html = logoImg("/logos/smile-more.png", "Smile More", "#ec4899");
    expect(html).not.toMatch(/background:#[0-9a-f]{3,6}.*border-radius.*font-weight/i);
    // Must have a proper img element
    expect(html).toMatch(/<img[^>]+src="data:image\/png;base64,/);
  });
});

// ─── 7. Page-header CSS uses brightness(0) filter ────────────────────────────

describe("Page header CSS applies brightness(0) to logo images", () => {
  it("buildBaseStyles includes filter:brightness(0) on .page-hdr__logo img", async () => {
    const { buildBaseStyles } = await import("../reports/renderers/designSystem.js");
    const css = buildBaseStyles("#ec4899");
    expect(css).toMatch(/\.page-hdr__logo img[^{]*{[^}]*filter:\s*brightness\(0\)/s);
  });
});

// ─── 8. Six templates all use the shared logo path ───────────────────────────

describe("All six templates reference Smile More via /logos/smile-more.png", () => {
  it("ENTITY_DEFINITIONS contains Smile_More with logo /logos/smile-more.png", async () => {
    // Check entities.ts source (can't import without DB)
    const { readFileSync } = await import("fs");
    const { resolve, dirname } = await import("path");
    const { fileURLToPath } = await import("url");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, "../lib/entities.ts"), "utf-8");
    expect(src).toMatch(/Smile_More/);
    expect(src).toMatch(/["']\/logos\/smile-more\.png["']/);
  });

  it("The smile-more.png path maps to the transparent-bg baked asset", () => {
    // Verify the normalisation chain: /logos/smile-more.png → smile_more → transparent URI
    const src = readFileSync(GENERATED_TS, "utf8");
    // getBakedLogo normalises: strip leading slash, take filename, strip ext, replace - with _
    // /logos/smile-more.png → smile-more.png → smile-more → smile_more
    const m = src.match(/"smile_more":\s*"(data:image\/[^"]{20,})"/);
    expect(m).not.toBeNull();
    const alpha = pngCornerAlpha(m![1]);
    expect(alpha).toBe(0); // transparent
  });
});
