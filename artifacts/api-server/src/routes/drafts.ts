/**
 * Report Drafts & Commentary API routes.
 *
 * All endpoints require authentication. Editing and approval require
 * elevated roles (admin, cfo, controller). Read-only preview is available
 * to any role with the "reports" permission.
 *
 * Bookkeepers do not receive report or commentary permissions by default.
 * Read-only ("readonly" role) users may view approved reports but cannot
 * edit or approve.
 */

import { Router, type IRouter } from "express";
import { REPORT_TEMPLATES } from "../reports/templates.js";
import { buildReport } from "../reports/builder.js";
import { HtmlRenderer } from "../reports/renderers/html.js";
import { generateAnalysis, buildDataFingerprint } from "../reports/analysis.js";
import { buildNarrativeContext } from "../reports/narrativeContext.js";
import { CommentaryService, DraftService } from "../db/reportDrafts.js";
import { requirePermission } from "../auth/permissions.js";
import type { Role } from "../auth/types.js";
import type { CommentaryType } from "../db/reportDrafts.js";

const router: IRouter = Router();

/** Coerce Express 5 params (string | string[]) to a plain string. */
function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

// Roles that can edit and submit drafts
const EDITOR_ROLES: Role[] = ["admin", "cfo", "controller"];
// Roles that can approve drafts
const APPROVER_ROLES: Role[] = ["admin", "cfo"];

function requireRole(roles: Role[]) {
  return requirePermission("reports") as ReturnType<typeof requirePermission>;
}

function userCanEdit(role: Role): boolean {
  return EDITOR_ROLES.includes(role);
}

function userCanApprove(role: Role): boolean {
  return APPROVER_ROLES.includes(role);
}

// ─── POST /api/drafts — Create or refresh a draft ────────────────────────────
router.post("/drafts", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot create drafts.", ts: new Date().toISOString() });
    return;
  }

  const body = req.body as {
    template?: unknown;
    entities?: unknown;
    period?: unknown;
  };

  if (typeof body.template !== "string") {
    res.status(400).json({ ok: false, error: "`template` is required", ts: new Date().toISOString() });
    return;
  }
  if (typeof body.period !== "string") {
    res.status(400).json({ ok: false, error: "`period` is required", ts: new Date().toISOString() });
    return;
  }
  const entities =
    body.entities === "all"
      ? "all"
      : Array.isArray(body.entities) && body.entities.every((e) => typeof e === "string")
        ? (body.entities as string[])
        : null;
  if (!entities) {
    res.status(400).json({ ok: false, error: '`entities` must be "all" or string[]', ts: new Date().toISOString() });
    return;
  }

  try {
    // Build live report data
    const report = await buildReport({
      template: body.template,
      entities: entities === "all" ? "all" : (entities as any),
      period: body.period,
      format: "json",
    });

    // Generate deterministic analysis
    const analysis = generateAnalysis(report);

    // Build data fingerprint for stale detection
    const fingerprint = buildDataFingerprint(report);

    // Resolve entity slugs
    const entitySlugsArray: string[] =
      entities === "all"
        ? (report.branding.entities.map((e) => e.slug))
        : entities;

    // Create draft (supersedes any prior active draft for same template+period)
    const draft = await DraftService.createDraft({
      templateId:        body.template,
      reportingPeriod:   body.period,
      entitySlugs:       entitySlugsArray,
      generatedAnalysis: analysis,
      editableContent:   { reportTitle: null, sectionOverrides: {}, includedSections: [] },
      dataFingerprint:   fingerprint,
      userEmail:         user.email,
    });

    // Persist generated analysis as commentary rows
    const now = new Date();
    await CommentaryService.bulkUpsertCommentary(
      analysis.map((stmt) => ({
        entitySlug:      entitySlugsArray[0] ?? "portfolio",
        reportingPeriod: body.period as string,
        templateId:      body.template as string,
        sectionKey:      stmt.sectionKey,
        commentaryType:  "financeos_analysis" as CommentaryType,
        content:         stmt.content,
        provenance:      stmt.provenance as any,
        sortOrder:       stmt.sortOrder,
        createdBy:       user.email,
        updatedBy:       user.email,
        createdAt:       now,
        updatedAt:       now,
      })),
    );

    res.status(201).json({ ok: true, data: draft, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create draft",
      ts: new Date().toISOString(),
    });
  }
});

// ─── Commentary endpoints ─────────────────────────────────────────────────────

// GET /api/drafts/commentary?entity=&period=&template=
router.get("/drafts/commentary", requirePermission("reports"), async (req, res) => {
  const entitySlug      = typeof req.query["entity"]   === "string" ? req.query["entity"]   : null;
  const reportingPeriod = typeof req.query["period"]   === "string" ? req.query["period"]   : null;
  const templateId      = typeof req.query["template"] === "string" ? req.query["template"] : null;

  if (!entitySlug || !reportingPeriod || !templateId) {
    res.status(400).json({
      ok: false,
      error: "`entity`, `period`, and `template` query params are required",
      ts: new Date().toISOString(),
    });
    return;
  }

  try {
    const data = await CommentaryService.getCommentaryByScope({ entitySlug, reportingPeriod, templateId });
    res.json({ ok: true, data, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// POST /api/drafts/commentary — save a management commentary or recommended action
router.post("/drafts/commentary", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot add commentary.", ts: new Date().toISOString() });
    return;
  }

  const body = req.body as {
    entitySlug?: unknown;
    reportingPeriod?: unknown;
    templateId?: unknown;
    sectionKey?: unknown;
    commentaryType?: unknown;
    content?: unknown;
    sortOrder?: unknown;
    existingId?: unknown;
  };

  if (
    typeof body.entitySlug !== "string" ||
    typeof body.reportingPeriod !== "string" ||
    typeof body.templateId !== "string" ||
    typeof body.sectionKey !== "string" ||
    typeof body.content !== "string" ||
    (body.commentaryType !== "management_commentary" && body.commentaryType !== "recommended_action")
  ) {
    res.status(400).json({
      ok: false,
      error: "entitySlug, reportingPeriod, templateId, sectionKey, content, and commentaryType (management_commentary|recommended_action) are required",
      ts: new Date().toISOString(),
    });
    return;
  }

  try {
    const entry = await CommentaryService.saveCommentary({
      entitySlug:      body.entitySlug,
      reportingPeriod: body.reportingPeriod,
      templateId:      body.templateId,
      sectionKey:      body.sectionKey,
      commentaryType:  body.commentaryType as CommentaryType,
      content:         body.content,
      sortOrder:       typeof body.sortOrder === "number" ? body.sortOrder : 0,
      userEmail:       user.email,
      existingId:      typeof body.existingId === "string" ? body.existingId : undefined,
    });
    res.status(201).json({ ok: true, data: entry, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// PATCH /api/drafts/commentary/:id/toggle — include/exclude a commentary block
router.patch("/drafts/commentary/:id/toggle", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot toggle commentary blocks.", ts: new Date().toISOString() });
    return;
  }

  const { included } = req.body as { included?: unknown };
  if (typeof included !== "boolean") {
    res.status(400).json({ ok: false, error: "`included` (boolean) is required", ts: new Date().toISOString() });
    return;
  }

  try {
    const entry = await CommentaryService.toggleIncluded(paramStr(req.params["id"]), included, user.email);
    res.json({ ok: true, data: entry, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// DELETE /api/drafts/commentary/:id — delete a user-created commentary block
router.delete("/drafts/commentary/:id", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot delete commentary blocks.", ts: new Date().toISOString() });
    return;
  }

  try {
    await CommentaryService.deleteCommentary(paramStr(req.params["id"]));
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// POST /api/drafts/commentary/reorder — reorder recommended_action blocks
router.post("/drafts/commentary/reorder", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot reorder commentary.", ts: new Date().toISOString() });
    return;
  }

  const { ids } = req.body as { ids?: unknown };
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    res.status(400).json({ ok: false, error: "`ids` must be a string array", ts: new Date().toISOString() });
    return;
  }

  try {
    await CommentaryService.reorderCommentary(ids, user.email);
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// POST /api/drafts/commentary/:id/approve — approve a commentary block
router.post("/drafts/commentary/:id/approve", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanApprove(user.role)) {
    res.status(403).json({ ok: false, error: "Only admin and cfo roles can approve commentary.", ts: new Date().toISOString() });
    return;
  }

  try {
    const entry = await CommentaryService.approveCommentary(paramStr(req.params["id"]), user.email);
    res.json({ ok: true, data: entry, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── GET /api/drafts/:id — Get a single draft ─────────────────────────────────
router.get("/drafts/:id", requirePermission("reports"), async (req, res) => {
  try {
    const draft = await DraftService.getDraft(paramStr(req.params["id"]));
    if (!draft) {
      res.status(404).json({ ok: false, error: "Draft not found", ts: new Date().toISOString() });
      return;
    }
    res.json({ ok: true, data: draft, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── GET /api/drafts — List drafts for a template+period ─────────────────────
router.get("/drafts", requirePermission("reports"), async (req, res) => {
  const templateId      = typeof req.query["template"] === "string" ? req.query["template"] : null;
  const reportingPeriod = typeof req.query["period"] === "string"   ? req.query["period"]   : null;
  if (!templateId || !reportingPeriod) {
    res.status(400).json({ ok: false, error: "`template` and `period` query params are required", ts: new Date().toISOString() });
    return;
  }
  try {
    const drafts = await DraftService.listDrafts({ templateId, reportingPeriod });
    res.json({ ok: true, data: drafts, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── PATCH /api/drafts/:id/edits — Save narrative edits ──────────────────────
router.patch("/drafts/:id/edits", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot edit drafts.", ts: new Date().toISOString() });
    return;
  }

  const { editableContent, changeSummary } = req.body as {
    editableContent?: unknown;
    changeSummary?: string;
  };

  if (!editableContent || typeof editableContent !== "object") {
    res.status(400).json({ ok: false, error: "`editableContent` is required", ts: new Date().toISOString() });
    return;
  }

  try {
    const draft = await DraftService.saveDraftEdits({
      draftId:         paramStr(req.params["id"]),
      editableContent,
      changeSummary,
      userEmail:       user.email,
    });
    res.json({ ok: true, data: draft, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── GET /api/drafts/:id/versions — Version history ──────────────────────────
router.get("/drafts/:id/versions", requirePermission("reports"), async (req, res) => {
  try {
    const versions = await DraftService.listVersions(paramStr(req.params["id"]));
    res.json({ ok: true, data: versions, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── POST /api/drafts/:id/restore — Restore a prior version ──────────────────
router.post("/drafts/:id/restore", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot restore versions.", ts: new Date().toISOString() });
    return;
  }

  const { versionNumber } = req.body as { versionNumber?: unknown };
  if (typeof versionNumber !== "number") {
    res.status(400).json({ ok: false, error: "`versionNumber` must be a number", ts: new Date().toISOString() });
    return;
  }

  try {
    const draft = await DraftService.restoreVersion({
      draftId:             paramStr(req.params["id"]),
      targetVersionNumber: versionNumber,
      userEmail:           user.email,
    });
    res.json({ ok: true, data: draft, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── POST /api/drafts/:id/submit — Submit for approval ───────────────────────
router.post("/drafts/:id/submit", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot submit drafts.", ts: new Date().toISOString() });
    return;
  }

  try {
    const draft = await DraftService.submitForReview(paramStr(req.params["id"]), user.email);
    res.json({ ok: true, data: draft, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── POST /api/drafts/:id/approve — Approve a draft ──────────────────────────
router.post("/drafts/:id/approve", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanApprove(user.role)) {
    res.status(403).json({ ok: false, error: "Only admin or cfo roles can approve drafts.", ts: new Date().toISOString() });
    return;
  }

  const draftId = paramStr(req.params["id"]);
  const existing = await DraftService.getDraft(draftId);
  if (!existing) {
    res.status(404).json({ ok: false, error: "Draft not found", ts: new Date().toISOString() });
    return;
  }
  if (existing.isStale) {
    res.status(400).json({ ok: false, error: "Draft is stale — underlying financial data has changed. Recreate the draft before approving.", ts: new Date().toISOString() });
    return;
  }

  try {
    const draft = await DraftService.approveDraft(draftId, user.email);
    res.json({ ok: true, data: draft, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── GET /api/drafts/:id/preview — HTML preview of draft ─────────────────────
// Returns self-contained HTML using the same renderer as the final report,
// but with the draft's approved narrative overlaid.
router.get("/drafts/:id/preview", requirePermission("reports"), async (req, res) => {
  try {
    const draft = await DraftService.getDraft(paramStr(req.params["id"]));
    if (!draft) {
      res.status(404).json({ ok: false, error: "Draft not found", ts: new Date().toISOString() });
      return;
    }

    // Build live report (same data as draft creation)
    const report = await buildReport({
      template: draft.templateId,
      entities: draft.entitySlugs as any,
      period:   draft.reportingPeriod,
      format:   "html",
    });

    // Load DB commentary for this draft scope
    const entitySlug = draft.entitySlugs[0] ?? "portfolio";
    const dbCommentary = await CommentaryService.getCommentaryByScope({
      entitySlug,
      reportingPeriod: draft.reportingPeriod,
      templateId:      draft.templateId,
    });

    // Build narrative context with approved edits overlaid
    const narrativeCtx = buildNarrativeContext({
      draftId:          draft.id,
      draftVersion:     draft.currentVersion,
      approvalStatus:   draft.status,
      approvedBy:       draft.approvedBy,
      approvedAt:       draft.approvedAt,
      editableContent:  draft.editableContent,
      dbEntries:        dbCommentary,
      generatedAnalysis: (draft.generatedAnalysis ?? []) as any,
    });

    // Attach narrative context to the report for the renderer
    (report as any).__narrativeContext = narrativeCtx;

    const html = HtmlRenderer.render(report) as string;

    if (req.query["format"] === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
      return;
    }

    // Default: return JSON with html string and draft metadata
    res.json({
      ok: true,
      data: {
        html,
        draft,
        narrativeSectionKeys: Object.keys(narrativeCtx.sections),
        isStale:     draft.isStale,
        staleReason: draft.staleReason,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

export default router;
