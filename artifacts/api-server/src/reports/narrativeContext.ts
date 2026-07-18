/**
 * Shared Narrative Context.
 *
 * Supplies commentary to all six report renderers from a single source.
 * Renderers pull the sections they need; they never construct commentary
 * themselves or duplicate this logic.
 *
 * Sources (in order of authority):
 *   1. Approved Management Commentary (user-edited)
 *   2. FinanceOS Analysis (deterministic, auto-generated)
 *   3. Recommended Actions (auto-suggested or user-added)
 *
 * Renderers always label content by source so readers know the origin.
 */

import type { CommentaryEntry } from "../db/reportDrafts.js";
import type { AnalysisStatement } from "./analysis.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type NarrativeBlock = {
  id: string;
  commentaryType: "financeos_analysis" | "management_commentary" | "recommended_action";
  content: string;
  /** Human-readable source label for the report footer/label */
  sourceLabel: string;
  included: boolean;
  sortOrder: number;
  /** Only present for financeos_analysis blocks */
  provenance?: unknown;
  /** Approval state of this individual block */
  approved: boolean;
};

export type SectionNarrative = {
  sectionKey: string;
  blocks: NarrativeBlock[];
  /** True if the section has at least one included management commentary block */
  hasManagementCommentary: boolean;
  /** True if the section has at least one included FinanceOS analysis block */
  hasAnalysis: boolean;
  /** True if the section has at least one included recommended action */
  hasRecommendedActions: boolean;
};

export type NarrativeContext = {
  /** Draft ID this narrative came from (null = no draft, using auto-analysis only) */
  draftId: string | null;
  /** Draft version number */
  draftVersion: number | null;
  /** Overall approval status */
  approvalStatus: "draft" | "ready_for_review" | "approved" | "auto_approved" | null;
  /** Who approved this draft */
  approvedBy: string | null;
  /** When the draft was approved */
  approvedAt: string | null;
  /** Custom report title (if set by editor) */
  reportTitle: string | null;
  /** Map of sectionKey → SectionNarrative */
  sections: Record<string, SectionNarrative>;
  /** Section-level overrides (heading, intro, conclusion, notes) from editable_content */
  sectionOverrides: Record<string, {
    heading?: string;
    intro?: string;
    conclusion?: string;
    notes?: string;
  }>;
  /**
   * True when rendering for the live draft preview (not final generation).
   * Enables inline-edit data attributes on management-authored blocks.
   * Final HTML/PDF generation always uses false so no editing scaffolding
   * appears in the delivered document.
   */
  isPreview?: boolean;
};

// ─── Source labels ────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  financeos_analysis:    "FinanceOS Analysis",
  management_commentary: "Management Commentary",
  recommended_action:    "Recommended Action",
};

// ─── Builder ──────────────────────────────────────────────────────────────────

function isAnalysisStatement(entry: CommentaryEntry | AnalysisStatement): entry is AnalysisStatement {
  // CommentaryEntry always has entitySlug; AnalysisStatement never does.
  return !("entitySlug" in entry);
}

function toNarrativeBlock(entry: CommentaryEntry | AnalysisStatement): NarrativeBlock {
  if (isAnalysisStatement(entry)) {
    const a = entry as AnalysisStatement;
    return {
      id:             a.id,
      commentaryType: "financeos_analysis",
      content:        a.content,
      sourceLabel:    SOURCE_LABELS["financeos_analysis"]!,
      included:       true,
      sortOrder:      a.sortOrder,
      provenance:     a.provenance,
      approved:       false,
    };
  }

  // CommentaryEntry (from DB)
  const c = entry as CommentaryEntry;
  return {
    id:             c.id,
    commentaryType: c.commentaryType,
    content:        c.content,
    sourceLabel:    SOURCE_LABELS[c.commentaryType] ?? c.commentaryType,
    included:       c.included,
    sortOrder:      c.sortOrder,
    provenance:     c.provenance,
    approved:       c.status === "approved",
  };
}

function buildSectionNarrative(
  sectionKey: string,
  blocks: NarrativeBlock[],
): SectionNarrative {
  const included = blocks.filter((b) => b.included);
  return {
    sectionKey,
    blocks: included,
    hasManagementCommentary: included.some((b) => b.commentaryType === "management_commentary"),
    hasAnalysis:             included.some((b) => b.commentaryType === "financeos_analysis"),
    hasRecommendedActions:   included.some((b) => b.commentaryType === "recommended_action"),
  };
}

/**
 * Build a NarrativeContext from a mix of DB commentary entries (from an
 * approved draft) and/or auto-generated analysis statements.
 *
 * DB entries take precedence for the same sectionKey — they represent the
 * user-reviewed and approved version of the narrative. Auto-generated
 * statements fill in any sections not covered by the DB.
 */
export function buildNarrativeContext(opts: {
  draftId?: string | null;
  draftVersion?: number | null;
  approvalStatus?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  editableContent?: unknown;
  dbEntries?: CommentaryEntry[];
  generatedAnalysis?: AnalysisStatement[];
}): NarrativeContext {
  const allBlocks: NarrativeBlock[] = [];

  // Load auto-generated analysis first (lowest priority)
  for (const stmt of opts.generatedAnalysis ?? []) {
    allBlocks.push(toNarrativeBlock(stmt));
  }

  // Overlay DB commentary (higher priority — replaces auto blocks where sectionKey matches)
  const dbBySectionKey = new Map<string, CommentaryEntry[]>();
  for (const entry of opts.dbEntries ?? []) {
    const arr = dbBySectionKey.get(entry.sectionKey) ?? [];
    arr.push(entry);
    dbBySectionKey.set(entry.sectionKey, arr);
  }

  if (dbBySectionKey.size > 0) {
    // Remove auto-generated blocks for sections covered by DB commentary
    const covered = new Set<string>(dbBySectionKey.keys());
    const filtered = allBlocks.filter(
      (b) => b.commentaryType !== "financeos_analysis" || !covered.has(b.id.split(":")[0]!),
    );
    allBlocks.length = 0;
    allBlocks.push(...filtered);

    // Add DB entries
    for (const entries of dbBySectionKey.values()) {
      for (const entry of entries) {
        allBlocks.push(toNarrativeBlock(entry));
      }
    }
  }

  // Group by sectionKey
  const bySectionKey = new Map<string, NarrativeBlock[]>();
  for (const block of allBlocks) {
    // Derive sectionKey: AnalysisStatement has sectionKey directly; CommentaryEntry has sectionKey
    const key = (block as any).sectionKey ?? "general";
    const arr = bySectionKey.get(key) ?? [];
    arr.push(block);
    bySectionKey.set(key, arr);
  }

  // For analysis statements, the sectionKey is embedded in provenance or the block itself.
  // We need to group correctly. Re-do grouping using explicit sectionKey from the raw data.
  const sectionMap = new Map<string, NarrativeBlock[]>();

  // From generatedAnalysis
  for (const stmt of opts.generatedAnalysis ?? []) {
    const arr = sectionMap.get(stmt.sectionKey) ?? [];
    arr.push(toNarrativeBlock(stmt));
    sectionMap.set(stmt.sectionKey, arr);
  }

  // From DB (overrides for those sections)
  for (const [sectionKey, entries] of dbBySectionKey) {
    const arr: NarrativeBlock[] = [];
    for (const entry of entries) {
      arr.push(toNarrativeBlock(entry));
    }
    // Replace auto-generated for this section if DB has commentary
    sectionMap.set(sectionKey, arr);
  }

  const sections: Record<string, SectionNarrative> = {};
  for (const [sectionKey, blocks] of sectionMap) {
    sections[sectionKey] = buildSectionNarrative(
      sectionKey,
      blocks.sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }

  // Parse editable content
  const editable = opts.editableContent as any ?? {};
  const sectionOverrides: NarrativeContext["sectionOverrides"] = editable.sectionOverrides ?? {};

  return {
    draftId:        opts.draftId ?? null,
    draftVersion:   opts.draftVersion ?? null,
    approvalStatus: (opts.approvalStatus as NarrativeContext["approvalStatus"]) ?? null,
    approvedBy:     opts.approvedBy ?? null,
    approvedAt:     opts.approvedAt ?? null,
    reportTitle:    editable.reportTitle ?? null,
    sections,
    sectionOverrides,
  };
}

// ─── Renderer helpers ─────────────────────────────────────────────────────────

/**
 * Get all narrative blocks for a section, sorted by sortOrder.
 * Returns empty array if the section has no blocks.
 */
export function getSectionBlocks(
  ctx: NarrativeContext | null,
  sectionKey: string,
): NarrativeBlock[] {
  if (!ctx) return [];
  return ctx.sections[sectionKey]?.blocks ?? [];
}

/**
 * Get the merged narrative text for a section as a bulleted string array.
 * Only included blocks are returned.
 */
export function getSectionTexts(
  ctx: NarrativeContext | null,
  sectionKey: string,
): string[] {
  return getSectionBlocks(ctx, sectionKey).map((b) => b.content);
}

/**
 * Get section override values (custom heading, intro, conclusion, notes).
 */
export function getSectionOverride(
  ctx: NarrativeContext | null,
  sectionKey: string,
): { heading?: string; intro?: string; conclusion?: string; notes?: string } {
  if (!ctx) return {};
  return ctx.sectionOverrides[sectionKey] ?? {};
}

/**
 * Render a source attribution badge string for use in report HTML.
 * Returns empty string when ctx is null (backward-compatible).
 */
export function renderSourceBadge(block: NarrativeBlock): string {
  const color =
    block.commentaryType === "financeos_analysis"
      ? "#0ea5e9"
      : block.commentaryType === "management_commentary"
        ? "#8b5cf6"
        : "#f59e0b";

  return `<span style="display:inline-block;font-size:8pt;padding:1px 6px;border-radius:3px;background:${color}1A;color:${color};font-family:system-ui,Arial,sans-serif;margin-left:6px;vertical-align:middle;">${block.sourceLabel}</span>`;
}
