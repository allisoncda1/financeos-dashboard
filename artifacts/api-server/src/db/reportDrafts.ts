/**
 * Report Drafts & Commentary — Database service.
 *
 * All writes go to opsDb (DATABASE_URL — writable operational DB).
 * Financial data in FinanceOS Core (CORE_DATABASE_URL) remains read-only.
 */

import { desc, eq, and, sql } from "drizzle-orm";
import { opsDb as db } from "./connection.js";
import {
  reportCommentary,
  reportDrafts,
  reportDraftVersions,
  reportHistory,
  type InsertReportCommentary,
  type InsertReportDraft,
  type InsertReportDraftVersion,
  type ReportCommentaryRow,
  type ReportDraftRow,
  type ReportDraftVersionRow,
} from "@workspace/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommentaryType = "financeos_analysis" | "management_commentary" | "recommended_action";
export type CommentaryStatus = "draft" | "approved" | "superseded" | "waived";
export type DraftStatus = "draft" | "ready_for_review" | "approved" | "superseded" | "generated";

export type CommentaryEntry = {
  id: string;
  entitySlug: string;
  reportingPeriod: string;
  templateId: string;
  sectionKey: string;
  commentaryType: CommentaryType;
  content: string;
  provenance: unknown;
  status: CommentaryStatus;
  version: number;
  included: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type DraftEntry = {
  id: string;
  templateId: string;
  reportingPeriod: string;
  entitySlugs: string[];
  status: DraftStatus;
  currentVersion: number;
  generatedAnalysis: unknown;
  editableContent: unknown;
  dataFingerprint: string | null;
  isStale: boolean;
  staleReason: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type DraftVersionEntry = {
  id: string;
  reportDraftId: string;
  versionNumber: number;
  contentSnapshot: unknown;
  changeSummary: string | null;
  createdBy: string | null;
  createdAt: string;
};

// ─── Row converters ───────────────────────────────────────────────────────────

function toCommentaryEntry(row: ReportCommentaryRow): CommentaryEntry {
  return {
    id:              row.id,
    entitySlug:      row.entitySlug,
    reportingPeriod: row.reportingPeriod,
    templateId:      row.templateId,
    sectionKey:      row.sectionKey,
    commentaryType:  row.commentaryType as CommentaryType,
    content:         row.content,
    provenance:      row.provenance,
    status:          row.status as CommentaryStatus,
    version:         row.version,
    included:        row.included,
    sortOrder:       row.sortOrder,
    createdBy:       row.createdBy ?? null,
    updatedBy:       row.updatedBy ?? null,
    approvedBy:      row.approvedBy ?? null,
    createdAt:       row.createdAt.toISOString(),
    updatedAt:       row.updatedAt.toISOString(),
    approvedAt:      row.approvedAt ? row.approvedAt.toISOString() : null,
  };
}

function toDraftEntry(row: ReportDraftRow): DraftEntry {
  return {
    id:               row.id,
    templateId:       row.templateId,
    reportingPeriod:  row.reportingPeriod,
    entitySlugs:      row.entitySlugs ?? [],
    status:           row.status as DraftStatus,
    currentVersion:   row.currentVersion,
    generatedAnalysis: row.generatedAnalysis,
    editableContent:  row.editableContent,
    dataFingerprint:  row.dataFingerprint ?? null,
    isStale:          row.isStale,
    staleReason:      row.staleReason ?? null,
    createdBy:        row.createdBy ?? null,
    updatedBy:        row.updatedBy ?? null,
    approvedBy:       row.approvedBy ?? null,
    createdAt:        row.createdAt.toISOString(),
    updatedAt:        row.updatedAt.toISOString(),
    approvedAt:       row.approvedAt ? row.approvedAt.toISOString() : null,
  };
}

function toDraftVersionEntry(row: ReportDraftVersionRow): DraftVersionEntry {
  return {
    id:              row.id,
    reportDraftId:   row.reportDraftId,
    versionNumber:   row.versionNumber,
    contentSnapshot: row.contentSnapshot,
    changeSummary:   row.changeSummary ?? null,
    createdBy:       row.createdBy ?? null,
    createdAt:       row.createdAt.toISOString(),
  };
}

// ─── Commentary service ───────────────────────────────────────────────────────

export const CommentaryService = {
  /** Upsert commentary entries in bulk (used when creating/refreshing a draft). */
  async bulkUpsertCommentary(entries: InsertReportCommentary[]): Promise<CommentaryEntry[]> {
    if (entries.length === 0) return [];
    const rows = await db.insert(reportCommentary).values(entries).returning();
    return rows.map(toCommentaryEntry);
  },

  /** Fetch all commentary for a (entity, period, template) scope. */
  async getCommentaryByScope(opts: {
    entitySlug: string;
    reportingPeriod: string;
    templateId: string;
  }): Promise<CommentaryEntry[]> {
    const rows = await db
      .select()
      .from(reportCommentary)
      .where(
        and(
          eq(reportCommentary.entitySlug, opts.entitySlug),
          eq(reportCommentary.reportingPeriod, opts.reportingPeriod),
          eq(reportCommentary.templateId, opts.templateId),
        ),
      )
      .orderBy(reportCommentary.sectionKey, reportCommentary.sortOrder);
    return rows.map(toCommentaryEntry);
  },

  /** Save a single management commentary or recommended action. */
  async saveCommentary(data: {
    entitySlug: string;
    reportingPeriod: string;
    templateId: string;
    sectionKey: string;
    commentaryType: CommentaryType;
    content: string;
    sortOrder?: number;
    userEmail: string;
    existingId?: string;
  }): Promise<CommentaryEntry> {
    if (data.existingId) {
      // Update existing: bump version, set updatedBy
      const existing = await db
        .select()
        .from(reportCommentary)
        .where(eq(reportCommentary.id, data.existingId))
        .limit(1);
      if (!existing[0]) throw new Error(`Commentary ${data.existingId} not found`);

      const rows = await db
        .update(reportCommentary)
        .set({
          content:    data.content,
          version:    existing[0].version + 1,
          updatedBy:  data.userEmail,
          updatedAt:  new Date(),
        })
        .where(eq(reportCommentary.id, data.existingId))
        .returning();
      return toCommentaryEntry(rows[0]!);
    }

    // Insert new
    const rows = await db
      .insert(reportCommentary)
      .values({
        entitySlug:      data.entitySlug,
        reportingPeriod: data.reportingPeriod,
        templateId:      data.templateId,
        sectionKey:      data.sectionKey,
        commentaryType:  data.commentaryType,
        content:         data.content,
        sortOrder:       data.sortOrder ?? 0,
        createdBy:       data.userEmail,
        updatedBy:       data.userEmail,
        status:          "draft",
        version:         1,
        included:        true,
      })
      .returning();
    return toCommentaryEntry(rows[0]!);
  },

  /** Toggle a commentary block's included state. */
  async toggleIncluded(id: string, included: boolean, userEmail: string): Promise<CommentaryEntry> {
    const rows = await db
      .update(reportCommentary)
      .set({ included, updatedBy: userEmail, updatedAt: new Date() })
      .where(eq(reportCommentary.id, id))
      .returning();
    if (!rows[0]) throw new Error(`Commentary ${id} not found`);
    return toCommentaryEntry(rows[0]);
  },

  /** Mark a commentary block as approved. Requires admin/cfo/controller role (enforced at route). */
  async approveCommentary(id: string, approverEmail: string): Promise<CommentaryEntry> {
    const rows = await db
      .update(reportCommentary)
      .set({ status: "approved", approvedBy: approverEmail, approvedAt: new Date() })
      .where(eq(reportCommentary.id, id))
      .returning();
    if (!rows[0]) throw new Error(`Commentary ${id} not found`);
    return toCommentaryEntry(rows[0]);
  },

  /** Delete a user-created commentary block (management_commentary or recommended_action). */
  async deleteCommentary(id: string): Promise<void> {
    const existing = await db
      .select({ commentaryType: reportCommentary.commentaryType })
      .from(reportCommentary)
      .where(eq(reportCommentary.id, id))
      .limit(1);
    if (!existing[0]) throw new Error(`Commentary ${id} not found`);
    if (existing[0].commentaryType === "financeos_analysis") {
      throw new Error("FinanceOS Analysis statements cannot be deleted. Use the 'included' toggle to hide them.");
    }
    await db.delete(reportCommentary).where(eq(reportCommentary.id, id));
  },

  /** Reorder recommended_action blocks within a section. */
  async reorderCommentary(
    ids: string[],
    userEmail: string,
  ): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(reportCommentary)
        .set({ sortOrder: i, updatedBy: userEmail, updatedAt: new Date() })
        .where(eq(reportCommentary.id, ids[i]!));
    }
  },
};

// ─── Draft service ────────────────────────────────────────────────────────────

export const DraftService = {
  /** Get a single draft by ID. */
  async getDraft(id: string): Promise<DraftEntry | null> {
    const rows = await db
      .select()
      .from(reportDrafts)
      .where(eq(reportDrafts.id, id))
      .limit(1);
    return rows[0] ? toDraftEntry(rows[0]) : null;
  },

  /** List non-superseded drafts for a (template, period). */
  async listDrafts(opts: {
    templateId: string;
    reportingPeriod: string;
  }): Promise<DraftEntry[]> {
    const rows = await db
      .select()
      .from(reportDrafts)
      .where(
        and(
          eq(reportDrafts.templateId, opts.templateId),
          eq(reportDrafts.reportingPeriod, opts.reportingPeriod),
          sql`${reportDrafts.status} != 'superseded'`,
        ),
      )
      .orderBy(desc(reportDrafts.createdAt));
    return rows.map(toDraftEntry);
  },

  /** Create a new draft. Supersedes any prior non-superseded draft for same (template, period). */
  async createDraft(data: {
    templateId: string;
    reportingPeriod: string;
    entitySlugs: string[];
    generatedAnalysis: unknown;
    editableContent?: unknown;
    dataFingerprint: string;
    userEmail: string;
  }): Promise<DraftEntry> {
    // Supersede any existing active draft for the same (template, period)
    await db
      .update(reportDrafts)
      .set({ status: "superseded", updatedBy: data.userEmail, updatedAt: new Date() })
      .where(
        and(
          eq(reportDrafts.templateId, data.templateId),
          eq(reportDrafts.reportingPeriod, data.reportingPeriod),
          sql`${reportDrafts.status} NOT IN ('superseded', 'generated')`,
        ),
      );

    const rows = await db
      .insert(reportDrafts)
      .values({
        templateId:        data.templateId,
        reportingPeriod:   data.reportingPeriod,
        entitySlugs:       data.entitySlugs,
        status:            "draft",
        currentVersion:    1,
        generatedAnalysis: data.generatedAnalysis as any,
        editableContent:   (data.editableContent ?? {}) as any,
        dataFingerprint:   data.dataFingerprint,
        createdBy:         data.userEmail,
        updatedBy:         data.userEmail,
      })
      .returning();

    const draft = rows[0]!;

    // Write initial version snapshot
    await db.insert(reportDraftVersions).values({
      reportDraftId:   draft.id,
      versionNumber:   1,
      contentSnapshot: { editableContent: data.editableContent ?? {}, changeSummary: "Draft created" } as any,
      changeSummary:   "Draft created",
      createdBy:       data.userEmail,
    });

    return toDraftEntry(draft);
  },

  /** Save editable content changes and bump version. */
  async saveDraftEdits(opts: {
    draftId: string;
    editableContent: unknown;
    changeSummary?: string;
    userEmail: string;
  }): Promise<DraftEntry> {
    const existing = await DraftService.getDraft(opts.draftId);
    if (!existing) throw new Error(`Draft ${opts.draftId} not found`);
    if (existing.status === "superseded" || existing.status === "generated") {
      throw new Error(`Draft ${opts.draftId} is ${existing.status} and cannot be edited.`);
    }
    if (existing.status === "approved") {
      throw new Error(`Draft ${opts.draftId} is approved. Withdraw approval before editing.`);
    }

    const newVersion = existing.currentVersion + 1;

    const rows = await db
      .update(reportDrafts)
      .set({
        editableContent: opts.editableContent as any,
        currentVersion:  newVersion,
        status:          "draft",
        updatedBy:       opts.userEmail,
        updatedAt:       new Date(),
      })
      .where(eq(reportDrafts.id, opts.draftId))
      .returning();

    // Append version snapshot
    await db.insert(reportDraftVersions).values({
      reportDraftId:   opts.draftId,
      versionNumber:   newVersion,
      contentSnapshot: { editableContent: opts.editableContent } as any,
      changeSummary:   opts.changeSummary ?? "Edits saved",
      createdBy:       opts.userEmail,
    });

    return toDraftEntry(rows[0]!);
  },

  /** Submit for approval (status: draft → ready_for_review). */
  async submitForReview(draftId: string, userEmail: string): Promise<DraftEntry> {
    const rows = await db
      .update(reportDrafts)
      .set({ status: "ready_for_review", updatedBy: userEmail, updatedAt: new Date() })
      .where(and(eq(reportDrafts.id, draftId), sql`${reportDrafts.status} = 'draft'`))
      .returning();
    if (!rows[0]) throw new Error(`Draft ${draftId} not found or not in 'draft' status`);
    return toDraftEntry(rows[0]);
  },

  /** Approve draft (status: ready_for_review → approved). Requires approved role at route level. */
  async approveDraft(draftId: string, approverEmail: string): Promise<DraftEntry> {
    const existing = await DraftService.getDraft(draftId);
    if (!existing) throw new Error(`Draft ${draftId} not found`);
    if (existing.isStale) {
      throw new Error(`Draft ${draftId} is stale (data changed since draft was created). Refresh and review before approving.`);
    }
    if (existing.status !== "ready_for_review") {
      throw new Error(`Draft ${draftId} must be in 'ready_for_review' status to approve. Current: ${existing.status}`);
    }

    const rows = await db
      .update(reportDrafts)
      .set({
        status:      "approved",
        approvedBy:  approverEmail,
        approvedAt:  new Date(),
        updatedBy:   approverEmail,
        updatedAt:   new Date(),
      })
      .where(eq(reportDrafts.id, draftId))
      .returning();
    return toDraftEntry(rows[0]!);
  },

  /** Mark draft stale if live data fingerprint changed. */
  async markStaleIfChanged(opts: {
    draftId: string;
    newFingerprint: string;
    staleReason: string;
  }): Promise<boolean> {
    const existing = await DraftService.getDraft(opts.draftId);
    if (!existing || existing.dataFingerprint === opts.newFingerprint) return false;
    if (existing.status === "superseded" || existing.status === "generated") return false;

    await db
      .update(reportDrafts)
      .set({ isStale: true, staleReason: opts.staleReason, updatedAt: new Date() })
      .where(eq(reportDrafts.id, opts.draftId));
    return true;
  },

  /** Mark a draft as generated after final report is produced. */
  async markGenerated(draftId: string, userEmail: string): Promise<DraftEntry> {
    const rows = await db
      .update(reportDrafts)
      .set({ status: "generated", updatedBy: userEmail, updatedAt: new Date() })
      .where(eq(reportDrafts.id, draftId))
      .returning();
    if (!rows[0]) throw new Error(`Draft ${draftId} not found`);
    return toDraftEntry(rows[0]);
  },

  /** Restore a prior version by copying its snapshot as a new save. */
  async restoreVersion(opts: {
    draftId: string;
    targetVersionNumber: number;
    userEmail: string;
  }): Promise<DraftEntry> {
    const versionRow = await db
      .select()
      .from(reportDraftVersions)
      .where(
        and(
          eq(reportDraftVersions.reportDraftId, opts.draftId),
          eq(reportDraftVersions.versionNumber, opts.targetVersionNumber),
        ),
      )
      .limit(1);

    if (!versionRow[0]) {
      throw new Error(`Version ${opts.targetVersionNumber} not found for draft ${opts.draftId}`);
    }

    const snapshot = versionRow[0].contentSnapshot as any;
    return DraftService.saveDraftEdits({
      draftId:       opts.draftId,
      editableContent: snapshot.editableContent ?? {},
      changeSummary:  `Restored from version ${opts.targetVersionNumber}`,
      userEmail:      opts.userEmail,
    });
  },

  /** List version history for a draft. */
  async listVersions(draftId: string): Promise<DraftVersionEntry[]> {
    const rows = await db
      .select()
      .from(reportDraftVersions)
      .where(eq(reportDraftVersions.reportDraftId, draftId))
      .orderBy(desc(reportDraftVersions.versionNumber));
    return rows.map(toDraftVersionEntry);
  },

  /** Update report_history row with draft metadata after final generation. */
  async linkHistoryToDraft(opts: {
    historyId: string;
    draftId: string;
    draftVersion: number;
    approvalStatus: "not_required" | "approved" | "auto_approved";
    approvedBy: string | null;
    approvedAt: Date | null;
    dataFingerprint: string;
    commentaryVersion: number;
  }): Promise<void> {
    await db
      .update(reportHistory)
      .set({
        draftId:           opts.draftId,
        draftVersion:      opts.draftVersion,
        approvalStatus:    opts.approvalStatus,
        approvedBy:        opts.approvedBy,
        approvedAt:        opts.approvedAt,
        dataFingerprint:   opts.dataFingerprint,
        commentaryVersion: opts.commentaryVersion,
      })
      .where(eq(reportHistory.id, opts.historyId));
  },
};
