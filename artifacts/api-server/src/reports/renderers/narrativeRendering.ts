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
import { getSectionBlocks, getSectionTexts, getSectionOverride } from "../narrativeContext.js";
import type { NarrativeBlockSpec } from "./designSystem.js";

/** Extract the NarrativeContext attached to a report (set by the preview/draft route). */
export function getCtx(report: BuiltReport): NarrativeContext | null {
  return (report as any).__narrativeContext ?? null;
}

/** True when rendering for the live draft preview (enables inline-edit markers). */
export function isPreviewMode(report: BuiltReport): boolean {
  return getCtx(report)?.isPreview ?? false;
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

const EDITABLE_TYPES = new Set(["management_commentary", "recommended_action"]);

/**
 * Returns narrative blocks for a section, carrying id/type metadata for
 * inline editing. Management-authored blocks are marked editable=true;
 * FinanceOS Analysis blocks are always locked.
 *
 * Falls back to plain text specs when no ctx is present (final generation
 * without a draft, or auto-generated reports). Fallback blocks have
 * editable=false and id=null.
 */
export function getCtxBlocks(
  report: BuiltReport,
  sectionKey: string,
  fallback: string[],
): NarrativeBlockSpec[] {
  const ctx = getCtx(report);
  const isPreview = ctx?.isPreview ?? false;
  if (!ctx) {
    return fallback.map((t) => ({ id: null, text: t, type: "financeos_analysis", editable: false }));
  }
  const blocks = getSectionBlocks(ctx, sectionKey);
  if (blocks.length > 0) {
    return blocks.map((b) => ({
      id:       b.id,
      text:     b.content,
      type:     b.commentaryType,
      editable: isPreview && EDITABLE_TYPES.has(b.commentaryType),
    }));
  }
  return fallback.map((t) => ({ id: null, text: t, type: "financeos_analysis", editable: false }));
}

/**
 * Formerly rendered an approval badge inside the report body.
 * Now returns "" unconditionally — approval is operational metadata
 * and must not appear inside generated report content or PDFs.
 * Approval is still stored in draft metadata, Report History, and API responses.
 *
 * @deprecated All call sites have been removed; function kept for test coverage continuity.
 */
export function renderApprovalBadge(_report: BuiltReport): string {
  return "";
}
