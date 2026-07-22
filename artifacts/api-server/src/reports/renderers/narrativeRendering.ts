/**
 * Shared NarrativeContext rendering helpers for all six report renderers.
 *
 * Each renderer calls getCtxParagraphs() for narrative sections. When a
 * NarrativeContext is present (from an approved/draft edit session), its
 * blocks replace the auto-generated text. When absent, the renderer falls
 * back to its own auto-generated paragraphs — maintaining full backward
 * compatibility with the existing report generation pipeline.
 *
 * Financial values remain authoritative and are NEVER replaced by narrative
 * context. Only prose sections (executive summary, management comments,
 * recommendations) are overridable.
 */

import type { BuiltReport } from "../builder.js";
import type { NarrativeContext } from "../narrativeContext.js";
import { getSectionTexts, getSectionOverride } from "../narrativeContext.js";

/** Extract the NarrativeContext attached to a report (set by the preview/draft route). */
export function getCtx(report: BuiltReport): NarrativeContext | null {
  return (report as any).__narrativeContext ?? null;
}

/**
 * Returns narrative paragraphs for a section.
 * If ctx has included blocks for `sectionKey`, those are used.
 * Otherwise falls back to the provided `fallback` paragraphs.
 */
export function getCtxParagraphs(
  report: BuiltReport,
  sectionKey: string,
  fallback: string[],
): string[] {
  const ctx = getCtx(report);
  if (!ctx) return fallback;
  const ctxTexts = getSectionTexts(ctx, sectionKey);
  return ctxTexts.length > 0 ? ctxTexts : fallback;
}

/**
 * Returns a section heading override, or the default heading.
 */
export function getCtxHeading(
  report: BuiltReport,
  sectionKey: string,
  defaultHeading: string,
): string {
  const ctx = getCtx(report);
  if (!ctx) return defaultHeading;
  return getSectionOverride(ctx, sectionKey).heading ?? defaultHeading;
}

/**
 * Returns the custom report title if set in the draft, or the default.
 */
export function getCtxTitle(
  report: BuiltReport,
  defaultTitle: string,
): string {
  const ctx = getCtx(report);
  if (!ctx) return defaultTitle;
  return ctx.reportTitle ?? defaultTitle;
}

/**
 * Render a provenance citation badge for use inside HTML report pages.
 * Only shown when NarrativeContext is present (draft preview mode).
 */
export function renderApprovalBadge(report: BuiltReport): string {
  const ctx = getCtx(report);
  if (!ctx) return "";
  if (ctx.approvalStatus !== "approved") return "";

  const approvedBy = ctx.approvedBy ?? "FinanceOS";
  const approvedAt = ctx.approvedAt
    ? new Date(ctx.approvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "";

  return `<div style="margin:0 0 16pt;padding:8pt 12pt;background:#f0fdf4;border-left:3px solid #16a34a;font-size:8pt;color:#15803d;font-family:system-ui,Arial,sans-serif;">
    ✓ Approved by ${approvedBy}${approvedAt ? ` &middot; ${approvedAt}` : ""} &middot; FinanceOS Draft Review
  </div>`;
}
