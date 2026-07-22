/**
 * Prebuild: bake logo PNG/SVG files as base64 data URIs into a TypeScript constants file.
 *
 * This runs before esbuild so logos are bundled as inlined strings — no runtime
 * filesystem reads, no path-resolution surprises in Replit or any other host.
 *
 * Output: src/reports/renderers/logoAssets.generated.ts
 * (committed; re-generated on every build to stay in sync with source files)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));

const LOGO_FILES = [
  { key: "cardealer_ai",     relPath: "../financeos/public/logos/cardealer-ai.png" },
  { key: "t3_marketing",     relPath: "../financeos/public/logos/t3-marketing.png" },
  { key: "topmrktr",         relPath: "../financeos/public/logos/topmrktr.png" },
  // smile-more.png has a SOLID BLACK background (corner pixel RGBA 0,0,0,255).
  // On dark report covers the CSS filter brightness(0)+invert(1)+opacity(0.7) turns
  // every pixel — including the black background — into a gray rectangle.
  // smile-more-dark.png has a TRANSPARENT background with white/yellow content,
  // identical to how the three working company logos are structured.
  // The key stays "smile_more" so the logo path /logos/smile-more.png resolves
  // correctly through getBakedLogo() without touching entity definitions.
  { key: "smile_more",       relPath: "../financeos/public/logos/smile-more-dark.png" },
  { key: "portfolio",        relPath: "../financeos/public/logos/portfolio.png" },
  { key: "financeos_lockup_light", relPath: "../financeos/public/branding/financeos-lockup-light.png" },
];

function mimeForPath(p) {
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

export async function prebuildLogos(artifactDir) {
  const base = artifactDir ?? __dir;
  const lines = [
    "// GENERATED — do not edit by hand. Run 'node prebuildLogos.mjs' or 'pnpm build'.",
    "// Keys map to the logo paths used in ENTITY_DEFINITIONS and branding.",
    "",
    "/** Pre-baked logo data URIs keyed by logo filename stem. Null when file was missing at build time. */",
    "export const BAKED_LOGOS: Record<string, string | null> = {",
  ];

  for (const { key, relPath } of LOGO_FILES) {
    const absPath = resolve(base, relPath);
    if (!existsSync(absPath)) {
      console.warn(`[prebuildLogos] MISSING: ${absPath} — entry will be null`);
      lines.push(`  "${key}": null,`);
      continue;
    }
    const bytes = readFileSync(absPath);
    const b64 = bytes.toString("base64");
    const mime = mimeForPath(absPath);
    const dataUri = `data:${mime};base64,${b64}`;
    console.info(`[prebuildLogos] Baked ${basename(absPath)} (${bytes.length} bytes)`);
    lines.push(`  "${key}": "${dataUri}",`);
  }

  lines.push("};");
  lines.push("");
  lines.push("/**");
  lines.push(" * Maps the logo paths from ENTITY_DEFINITIONS (e.g. '/logos/cardealer-ai.png')");
  lines.push(" * to their pre-baked data URI. Returns null if the logo was not found at build time.");
  lines.push(" */");
  lines.push("export function getBakedLogo(logoPath: string | null): string | null {");
  lines.push("  if (!logoPath) return null;");
  lines.push("  // Normalise: strip leading slash, strip path prefix, strip extension");
  lines.push("  const file = logoPath.replace(/^\\/+/, '').split('/').pop() ?? '';");
  lines.push("  const key = file.replace(/\\.[^.]+$/, '').replace(/-/g, '_');");
  lines.push("  return BAKED_LOGOS[key] ?? null;");
  lines.push("}");

  const out = resolve(base, "src/reports/renderers/logoAssets.generated.ts");
  writeFileSync(out, lines.join("\n") + "\n");
  console.info(`[prebuildLogos] Written: ${out}`);
}

// Allow direct invocation: `node prebuildLogos.mjs`
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  prebuildLogos(__dir).catch((e) => { console.error(e); process.exit(1); });
}
