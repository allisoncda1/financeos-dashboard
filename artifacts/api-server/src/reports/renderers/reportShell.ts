/**
 * Report Shell — shared foundation for all editorial report renderers.
 *
 * Provides: cover page builder, HTML document wrapper, header function builder,
 * entity color map, wrapPage helper, and shared SHELL_EXTRA_STYLES.
 *
 * All renderer files import from here instead of duplicating these primitives.
 */

import type { BuiltReport } from "../builder.js";
import { BRAND, buildBaseStyles, embedLogoPath, escHtml, refPageHeader } from "./designSystem.js";

export type HeaderFn = (title: string) => string;

export const SHELL_EXTRA_STYLES = `
  .page-section { padding: 22pt 0 16pt; page-break-before: always; }
  .toc-list { margin: 8pt 0 16pt; }
  .toc-entry { display: flex; align-items: baseline; gap: 4pt; padding: 5pt 0; border-bottom: 1px solid #f3f4f6; }
  .toc-entry__title { font-size: 9.5pt; color: #1e293b; min-width: 200pt; }
  .toc-entry__dots { flex: 1; border-bottom: 1px dotted #d1d5db; margin: 0 6pt; height: 0; position: relative; top: -4pt; }
  .toc-entry__page { font-size: 9pt; color: #6b7280; min-width: 20pt; text-align: right; }
`;

export function entityColor(slug: string): string {
  const map: Record<string, string> = {
    CarDealer_ai: "#00d4b8",
    T3_Marketing: "#f59e0b",
    TopMrktr: "#8b5cf6",
    Smile_More: "#ec4899",
  };
  return map[slug] ?? BRAND.accent;
}

export function wrapPage(content: string): string {
  return `<div class="page-section">${content}</div>`;
}

export function buildCoverPage(
  report: BuiltReport,
  opts: { eyebrow: string; subtitle: string; confidentiality?: string },
): string {
  const { branding, period, generatedAt } = report;
  const { eyebrow, subtitle, confidentiality = "Confidential — For Internal Management Use Only" } = opts;
  const primary = branding.primaryEntity;
  const isPortfolio = branding.mode === "consolidated" && branding.entities.length > 1;
  const prepared = new Date(generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (isPortfolio) {
    const fineosLogoSrc = embedLogoPath("/branding/financeos-lockup-light.png");
    const fineosLogoEl = fineosLogoSrc
      ? `<img class="cover__logo" src="${fineosLogoSrc}" alt="FinanceOS" />`
      : `<div class="cover__logo-text" style="background:${BRAND.accent}">FO</div>`;
    const entityLogoStrip = branding.entities
      .map((e) => {
        const src = embedLogoPath(e.logoPath ?? null);
        const color = entityColor(e.slug);
        return src
          ? `<img class="cover__entity-logo" src="${src}" alt="${escHtml(e.name)}" title="${escHtml(e.name)}" />`
          : `<span class="cover__entity-badge" style="background:${escHtml(color)}">${escHtml(e.name.slice(0, 2).toUpperCase())}</span>`;
      })
      .join("");
    return `<div class="cover" style="--entity-color:${BRAND.accent}">
  <div class="cover__strip"></div>
  <div class="cover__body">
    <div class="cover__logo-wrap">${fineosLogoEl}</div>
    <div class="cover__eyebrow">${escHtml(eyebrow)}</div>
    <div class="cover__period">${escHtml(period)}</div>
    <div class="cover__subtitle">${escHtml(subtitle)}</div>
    <div class="cover__divider"></div>
    <div class="cover__entity-strip">${entityLogoStrip}</div>
    <div class="cover__meta">
      <div class="cover__meta-item"><div class="cover__meta-label">REPORTING PERIOD</div><div class="cover__meta-value">${escHtml(period)}</div></div>
      <div class="cover__meta-item"><div class="cover__meta-label">PREPARED</div><div class="cover__meta-value">${escHtml(prepared)}</div></div>
      <div class="cover__meta-item"><div class="cover__meta-label">ENTITIES COVERED</div><div class="cover__meta-value">${escHtml(branding.entities.map((e) => e.name).join(", "))}</div></div>
      <div class="cover__meta-item"><div class="cover__meta-label">DATA SOURCE</div><div class="cover__meta-value">QuickBooks Online via FinanceOS</div></div>
    </div>
  </div>
  <div class="cover__footer">${escHtml(confidentiality)}</div>
</div>`;
  }

  // Single-entity cover
  const entityName = primary?.name ?? branding.entities[0]?.name ?? "Report";
  const accentColor = primary?.primaryColor ?? BRAND.accent;
  const logoPath = primary?.logoPath ?? branding.entities[0]?.logoPath ?? null;
  const logoSrc = embedLogoPath(logoPath);
  const logoEl = logoSrc
    ? `<img class="cover__logo" src="${logoSrc}" alt="${escHtml(entityName)}" />`
    : `<!-- MISSING LOGO: ${escHtml(logoPath ?? "no path")} --><div class="cover__logo-text" style="background:${escHtml(accentColor)}">${escHtml(entityName.slice(0, 2).toUpperCase())}</div>`;

  return `<div class="cover" style="--entity-color:${escHtml(accentColor)}">
  <div class="cover__strip"></div>
  <div class="cover__body">
    <div class="cover__logo-wrap">${logoEl}</div>
    <div class="cover__eyebrow">${escHtml(eyebrow)}</div>
    <div class="cover__period">${escHtml(period)}</div>
    <div class="cover__subtitle">${escHtml(subtitle)}</div>
    <div class="cover__divider"></div>
    <div class="cover__meta">
      <div class="cover__meta-item"><div class="cover__meta-label">REPORTING PERIOD</div><div class="cover__meta-value">${escHtml(period)}</div></div>
      <div class="cover__meta-item"><div class="cover__meta-label">PREPARED</div><div class="cover__meta-value">${escHtml(prepared)}</div></div>
      <div class="cover__meta-item"><div class="cover__meta-label">ENTITY</div><div class="cover__meta-value">${escHtml(entityName)}</div></div>
      <div class="cover__meta-item"><div class="cover__meta-label">DATA SOURCE</div><div class="cover__meta-value">QuickBooks Online via FinanceOS</div></div>
    </div>
  </div>
  <div class="cover__footer">${escHtml(confidentiality)}</div>
</div>`;
}

export function buildReportHtml(opts: {
  title: string;
  accent: string;
  pages: string[];
  extraStyles?: string;
}): string {
  const { title, accent, pages, extraStyles } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escHtml(title)}</title>
${buildBaseStyles(accent)}
${extraStyles ? `<style>${extraStyles}</style>` : ""}
</head>
<body>
${pages.join("\n")}
</body>
</html>`;
}

export function buildReportHeaderFn(report: BuiltReport): {
  headerFn: HeaderFn;
  primaryName: string;
  primaryColor: string;
  isPortfolio: boolean;
} {
  const primary = report.branding.primaryEntity;
  const isPortfolio = report.branding.mode === "consolidated" && report.branding.entities.length > 1;
  const headerLogoPath = isPortfolio ? "/branding/financeos-lockup-light.png" : (primary?.logoPath ?? null);
  const primaryName = isPortfolio
    ? "FinanceOS Portfolio"
    : (primary?.name ?? report.branding.entities[0]?.name ?? "Report");
  const primaryColor = isPortfolio ? BRAND.accent : (primary?.primaryColor ?? BRAND.accent);
  const headerFn: HeaderFn = (title) => refPageHeader(headerLogoPath, primaryName, title, primaryColor);
  return { headerFn, primaryName, primaryColor, isPortfolio };
}
