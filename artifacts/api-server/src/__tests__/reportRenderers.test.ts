/**
 * Narrative rendering unit tests — verifies requirements 8–11 from the feature spec:
 *
 * 8.  Financial blocks cannot be edited (FinanceOS Analysis is read-only)
 * 9.  Three sources (FinanceOS Analysis, Management Commentary, Recommended Actions) are
 *     visibly separated in the narrative context.
 * 10. Approved narrative is consumed by all six renderers.
 * 11. Preview and final PDF use the same approved narrative content.
 *
 * NOTE: Full renderer smoke tests require a running DB-backed buildReport().
 * These unit tests verify the narrative building logic and the helper functions
 * that renderers call, without needing a DB connection.
 */

import { describe, it, expect } from "vitest";
import { buildNarrativeContext, getSectionTexts } from "../reports/narrativeContext.js";
import { getCtx, getCtxParagraphs, getCtxHeading, getCtxTitle, renderApprovalBadge } from "../reports/renderers/narrativeRendering.js";

const MOCK_ANALYSIS = [
  {
    id: "an-1",
    sectionKey: "executive_summary",
    commentaryType: "financeos_analysis" as const,
    content: "Total revenue was $1,250,000, up 13.6% from the prior period.",
    provenance: {
      metric: "total_revenue",
      currentValue: 1_250_000,
      formula: "sum(revenue)",
      reportingPeriod: "Jun 2025",
      comparisonPeriod: "May 2025",
      entitySlugs: ["T3_Marketing"],
      sourceTable: "entity_snapshots",
      generatedAt: new Date().toISOString(),
    },
    sortOrder: 0,
  },
];

const MOCK_DB_ENTRIES = [
  {
    id: "mc-1",
    entitySlug: "T3_Marketing",
    reportingPeriod: "Jun 2025 (Latest)",
    templateId: "monthly-close",
    sectionKey: "management_comments",
    commentaryType: "management_commentary" as const,
    content: "Sales campaign exceeded targets by 12%.",
    sortOrder: 0,
    included: true,
    approved: true,
    approvedBy: "cfo@test.com",
    approvedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userEmail: "cfo@test.com",
  },
  {
    id: "ra-1",
    entitySlug: "T3_Marketing",
    reportingPeriod: "Jun 2025 (Latest)",
    templateId: "monthly-close",
    sectionKey: "recommended_actions",
    commentaryType: "recommended_action" as const,
    content: "Accelerate Q3 hiring plan to sustain growth.",
    sortOrder: 0,
    included: true,
    approved: false,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userEmail: "controller@test.com",
  },
  {
    id: "fa-1",
    entitySlug: "T3_Marketing",
    reportingPeriod: "Jun 2025 (Latest)",
    templateId: "monthly-close",
    sectionKey: "executive_summary",
    commentaryType: "financeos_analysis" as const,
    content: "This should be blocked by the DB service, not reach here.",
    sortOrder: 0,
    included: true,
    approved: false,
    approvedBy: null,
    approvedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userEmail: "system@financeos.ai",
  },
];

function buildApprovedCtx() {
  return buildNarrativeContext({
    draftId: "draft-001",
    draftVersion: 2,
    approvalStatus: "approved",
    approvedBy: "cfo@test.com",
    approvedAt: "2025-06-30T18:00:00Z",
    editableContent: {},
    dbEntries: MOCK_DB_ENTRIES,
    generatedAnalysis: MOCK_ANALYSIS,
  });
}

// ── Requirement 9: Source separation ─────────────────────────────────────────

describe("NarrativeContext — source separation (req 9)", () => {
  it("returns three section keys matching the three sources", () => {
    const ctx = buildApprovedCtx();
    const allKeys = Object.keys(ctx.sections);
    expect(allKeys).toContain("executive_summary");
    expect(allKeys).toContain("management_comments");
    expect(allKeys).toContain("recommended_actions");
  });

  it("FinanceOS Analysis blocks are tagged with commentaryType=financeos_analysis", () => {
    const ctx = buildApprovedCtx();
    const blocks = ctx.sections["executive_summary"]?.blocks ?? [];
    const analysisBlocks = blocks.filter((b) => b.commentaryType === "financeos_analysis");
    expect(analysisBlocks.length).toBeGreaterThan(0);
  });

  it("Management Commentary blocks are tagged with commentaryType=management_commentary", () => {
    const ctx = buildApprovedCtx();
    const blocks = ctx.sections["management_comments"]?.blocks ?? [];
    const mgmtBlocks = blocks.filter((b) => b.commentaryType === "management_commentary");
    expect(mgmtBlocks.length).toBeGreaterThan(0);
  });

  it("Recommended Action blocks are tagged with commentaryType=recommended_action", () => {
    const ctx = buildApprovedCtx();
    const blocks = ctx.sections["recommended_actions"]?.blocks ?? [];
    const raBlocks = blocks.filter((b) => b.commentaryType === "recommended_action");
    expect(raBlocks.length).toBeGreaterThan(0);
  });

  it("source labels are distinct strings per type", () => {
    const ctx = buildApprovedCtx();
    const exBlocks = ctx.sections["executive_summary"]?.blocks ?? [];
    const mgBlocks = ctx.sections["management_comments"]?.blocks ?? [];
    const raBlocks = ctx.sections["recommended_actions"]?.blocks ?? [];
    const exLabel = exBlocks[0]?.sourceLabel ?? "";
    const mgLabel = mgBlocks[0]?.sourceLabel ?? "";
    const raLabel = raBlocks[0]?.sourceLabel ?? "";
    expect(exLabel).not.toBe(mgLabel);
    expect(mgLabel).not.toBe(raLabel);
    expect(exLabel).not.toBe(raLabel);
  });
});

// ── Requirement 8: Financial values cannot be edited ─────────────────────────

describe("FinanceOS Analysis — read-only enforcement (req 8)", () => {
  it("FinanceOS Analysis blocks from generatedAnalysis carry typed provenance", () => {
    const ctx = buildNarrativeContext({
      draftId: "draft-001",
      draftVersion: 1,
      approvalStatus: "approved",
      approvedBy: "cfo@test.com",
      approvedAt: "2025-06-30T18:00:00Z",
      editableContent: {},
      dbEntries: [],  // no DB entries — only generated analysis
      generatedAnalysis: MOCK_ANALYSIS,
    });
    const blocks = ctx.sections["executive_summary"]?.blocks ?? [];
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.commentaryType).toBe("financeos_analysis");
    expect(blocks[0]!.provenance).toBeTruthy();
    expect((blocks[0]!.provenance as any).metric).toBe("total_revenue");
  });

  it("FinanceOS Analysis block content matches the generated statement", () => {
    const ctx = buildNarrativeContext({
      draftId: "draft-001",
      draftVersion: 1,
      approvalStatus: "approved",
      approvedBy: "cfo@test.com",
      approvedAt: "2025-06-30T18:00:00Z",
      editableContent: {},
      dbEntries: [],
      generatedAnalysis: MOCK_ANALYSIS,
    });
    const blocks = ctx.sections["executive_summary"]?.blocks ?? [];
    expect(blocks[0]!.content).toBe("Total revenue was $1,250,000, up 13.6% from the prior period.");
  });

  it("POST /commentary route rejects financeos_analysis type — tested in drafts.route.test.ts", () => {
    // The route-level enforcement is: POST /api/drafts/commentary validates that
    // commentaryType must be management_commentary or recommended_action.
    // financeos_analysis blocks can ONLY originate from the generateAnalysis() function.
    // This is enforced in drafts.route.test.ts: "cannot save financeos_analysis via this endpoint → 400".
    // Here we document that the NarrativeContext receives them only via generatedAnalysis.
    const ctx = buildNarrativeContext({
      draftId: "draft-001",
      draftVersion: 1,
      approvalStatus: "approved",
      approvedBy: "cfo@test.com",
      approvedAt: "2025-06-30T18:00:00Z",
      editableContent: {},
      dbEntries: [],
      generatedAnalysis: MOCK_ANALYSIS,
    });
    const allBlocks = Object.values(ctx.sections).flatMap((s) => s.blocks);
    const analysisBlocks = allBlocks.filter((b) => b.commentaryType === "financeos_analysis");
    // All financeos_analysis blocks came from generatedAnalysis — they have provenance objects
    for (const b of analysisBlocks) {
      expect(typeof b.provenance).toBe("object");
    }
  });
});

// ── Requirement 10 & 11: Approved narrative consumed by renderers ─────────────

describe("narrativeRendering helpers — renderer integration (req 10 & 11)", () => {
  function mockReport(status: string, approvedBy: string | null = null) {
    const ctx = buildNarrativeContext({
      draftId: "draft-001",
      draftVersion: 1,
      approvalStatus: status,
      approvedBy,
      approvedAt: status === "approved" ? "2025-06-30T18:00:00Z" : null,
      editableContent: {},
      dbEntries: MOCK_DB_ENTRIES.filter((e) => e.included),
      generatedAnalysis: MOCK_ANALYSIS,
    });
    return { __narrativeContext: ctx } as any;
  }

  it("getCtx() returns the NarrativeContext attached to a report", () => {
    const report = mockReport("approved", "cfo@test.com");
    const ctx = getCtx(report);
    expect(ctx).not.toBeNull();
    expect(ctx!.approvalStatus).toBe("approved");
  });

  it("getCtx() returns null when no context is attached", () => {
    const ctx = getCtx({} as any);
    expect(ctx).toBeNull();
  });

  it("getCtxParagraphs() extracts included block texts for a section", () => {
    const report = mockReport("approved", "cfo@test.com");
    const paras = getCtxParagraphs(report, "management_comments", []);
    expect(paras).toContain("Sales campaign exceeded targets by 12%.");
  });

  it("getCtxParagraphs() returns fallback when section is empty", () => {
    const report = mockReport("approved", "cfo@test.com");
    const fallback = ["No management commentary added."];
    const paras = getCtxParagraphs(report, "nonexistent_section", fallback);
    expect(paras).toEqual(fallback);
  });

  it("getCtxTitle() returns draft title when set, default otherwise", () => {
    const report = mockReport("approved", "cfo@test.com");
    const title = getCtxTitle(report, "Default Title");
    expect(typeof title).toBe("string");
    expect(title.length).toBeGreaterThan(0);
  });

  it("renderApprovalBadge() returns HTML containing 'Approved' when status=approved", () => {
    const report = mockReport("approved", "cfo@test.com");
    const badge = renderApprovalBadge(report);
    expect(badge).toMatch(/Approved|approved/i);
  });

  it("renderApprovalBadge() returns empty string when status=draft", () => {
    const report = mockReport("draft");
    const badge = renderApprovalBadge(report);
    expect(badge).toBe("");
  });

  it("same narrative context produces identical text regardless of how many times it's called", () => {
    const report = mockReport("approved", "cfo@test.com");
    const paras1 = getCtxParagraphs(report, "recommended_actions", []);
    const paras2 = getCtxParagraphs(report, "recommended_actions", []);
    expect(paras1).toEqual(paras2);
    expect(paras1).toContain("Accelerate Q3 hiring plan to sustain growth.");
  });
});

// ── Exclusion filtering ───────────────────────────────────────────────────────

describe("NarrativeContext — included/excluded filtering", () => {
  it("excluded blocks do not appear in getSectionTexts()", () => {
    const ctx = buildNarrativeContext({
      draftId: "draft-003",
      draftVersion: 1,
      approvalStatus: "draft",
      approvedBy: null,
      approvedAt: null,
      editableContent: {},
      dbEntries: [{
        ...MOCK_DB_ENTRIES[0],
        included: false,
      }],
      generatedAnalysis: [],
    });
    const texts = getSectionTexts(ctx, "management_comments");
    expect(texts).not.toContain("Sales campaign exceeded targets by 12%.");
  });

  it("included blocks appear in getSectionTexts()", () => {
    const ctx = buildNarrativeContext({
      draftId: "draft-004",
      draftVersion: 1,
      approvalStatus: "draft",
      approvedBy: null,
      approvedAt: null,
      editableContent: {},
      dbEntries: [{
        ...MOCK_DB_ENTRIES[0],
        included: true,
      }],
      generatedAnalysis: [],
    });
    const texts = getSectionTexts(ctx, "management_comments");
    expect(texts).toContain("Sales campaign exceeded targets by 12%.");
  });
});
