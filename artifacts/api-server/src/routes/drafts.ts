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
import { getRenderer } from "../reports/renderer.js";
import { HtmlRenderer } from "../reports/renderers/html.js";
import { generateAnalysis, buildDataFingerprint } from "../reports/analysis.js";
import { buildNarrativeContext } from "../reports/narrativeContext.js";
import { CommentaryService, DraftService } from "../db/reportDrafts.js";
import { ReportHistoryService } from "../db/index.js";
import { sanitizeErrorMessage } from "./reports.js";
import { requirePermission } from "../auth/permissions.js";
import { storeArtifact, retrieveArtifact } from "../services/reportStorage.js";
import type { Role } from "../auth/types.js";
import type { CommentaryType } from "../db/reportDrafts.js";
import type { ReportOutputFormat } from "../reports/templates.js";

const router: IRouter = Router();

// ── Placeholder management commentary seeded on every new draft ──────────────
// Maps each template ID to the management-authored narrative sections
// that should have an editable placeholder created on draft creation.
// Without these rows the preview has zero data-editable elements.
const TEMPLATE_MANAGEMENT_PLACEHOLDERS: Record<string, Array<{ sectionKey: string; commentaryType: CommentaryType; content: string }>> = {
  "monthly-close": [
    { sectionKey: "management_comments", commentaryType: "management_commentary", content: "Add management commentary for this period." },
    { sectionKey: "recommended_actions", commentaryType: "recommended_action",   content: "Add recommended actions for leadership review." },
  ],
  "quarterly-close": [
    { sectionKey: "management_comments", commentaryType: "management_commentary", content: "Add management commentary for this quarter." },
    { sectionKey: "recommended_actions", commentaryType: "recommended_action",   content: "Add recommended actions for this quarter." },
  ],
  "board-package": [
    { sectionKey: "management_comments", commentaryType: "management_commentary", content: "Add management commentary for board review." },
    { sectionKey: "recommended_actions", commentaryType: "recommended_action",   content: "Add recommended actions for the board." },
  ],
  "investor-update": [
    { sectionKey: "management_comments", commentaryType: "management_commentary", content: "Add investor narrative for this period." },
    { sectionKey: "recommended_actions", commentaryType: "recommended_action",   content: "Add strategic priorities for investors." },
  ],
  "bank-package": [
    { sectionKey: "management_comments", commentaryType: "management_commentary", content: "Add management commentary for the bank package." },
    { sectionKey: "recommended_actions", commentaryType: "recommended_action",   content: "Add recommended actions for this report." },
  ],
  "executive-package": [
    { sectionKey: "management_comments", commentaryType: "management_commentary", content: "Add executive management commentary." },
    { sectionKey: "recommended_actions", commentaryType: "recommended_action",   content: "Add recommended executive actions." },
  ],
};

/**
 * Inject a small inline-editing script into preview HTML.
 * When canEdit=false (approved/generated drafts) the script is omitted —
 * the data attributes remain in the HTML but clicks produce no UI.
 * The script is sandboxed inside the iframe and posts messages to the
 * parent React component for save/cancel operations.
 */
function injectPreviewScript(html: string, canEdit: boolean): string {
  const script = canEdit ? `
<script>
(function() {
  var EDITABLE_SELECTOR = '[data-editable="true"]';
  document.querySelectorAll(EDITABLE_SELECTOR).forEach(function(el) {
    el.style.cursor = 'text';
    el.setAttribute('title', 'Click to edit');
    el.addEventListener('mouseenter', function() {
      if (!el.classList.contains('fo-editing')) {
        el.style.outline = '2px dashed rgba(109,40,217,0.35)';
        el.style.borderRadius = '3px';
      }
    });
    el.addEventListener('mouseleave', function() {
      if (!el.classList.contains('fo-editing')) el.style.outline = '';
    });
    el.addEventListener('click', function(e) {
      if (el.classList.contains('fo-editing')) return;
      e.preventDefault();
      startEdit(el);
    });
  });

  function startEdit(el) {
    el.classList.add('fo-editing');
    el.style.outline = '2px solid rgba(109,40,217,0.6)';
    el.style.borderRadius = '3px';
    var blockId = el.getAttribute('data-block-id');
    var orig = el.querySelector('p') ? el.querySelector('p').textContent : el.textContent;
    el.innerHTML = '';

    var ta = document.createElement('textarea');
    ta.value = orig;
    ta.style.cssText = 'width:100%;min-height:4em;font-size:inherit;font-family:inherit;line-height:1.6;border:1px solid rgba(109,40,217,0.3);border-radius:4px;padding:6px 8px;background:#faf9ff;resize:vertical;box-sizing:border-box;outline:none;';
    ta.setAttribute('data-fo-editor', 'true');

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;margin-top:6px;';

    var saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = 'padding:3px 14px;font-size:11px;font-family:system-ui,Arial,sans-serif;background:#5b21b6;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;';

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'padding:3px 14px;font-size:11px;font-family:system-ui,Arial,sans-serif;background:#e5e7eb;color:#374151;border:none;border-radius:4px;cursor:pointer;';

    row.appendChild(saveBtn);
    row.appendChild(cancelBtn);
    el.appendChild(ta);
    el.appendChild(row);
    ta.focus();

    saveBtn.onclick = function() {
      var text = ta.value.trim();
      window.parent.postMessage({type:'fo-edit-save', blockId: blockId, text: text}, '*');
      el.innerHTML = '<p>' + text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>';
      el.classList.remove('fo-editing');
      el.style.outline = '';
    };
    cancelBtn.onclick = function() {
      window.parent.postMessage({type:'fo-edit-cancel', blockId: blockId}, '*');
      el.innerHTML = '<p>' + orig.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</p>';
      el.classList.remove('fo-editing');
      el.style.outline = '';
    };
  }
})();
</script>` : "";

  return html.replace("</body>", `${script}\n</body>`);
}

/** Coerce Express 5 params (string | string[]) to a plain string. */
function paramStr(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

// Roles that can edit and submit drafts
const EDITOR_ROLES: Role[] = ["admin", "cfo", "controller"];
// Roles that can approve drafts
const APPROVER_ROLES: Role[] = ["admin", "cfo"];

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
    const entitySlugForCommentary = entitySlugsArray[0] ?? "portfolio";
    await CommentaryService.bulkUpsertCommentary(
      analysis.map((stmt) => ({
        entitySlug:      entitySlugForCommentary,
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

    // Seed editable placeholder management commentary so the preview immediately
    // has data-editable elements. Without these rows a new draft has zero editable
    // content and the "Click narrative text to edit inline" hint is misleading.
    const placeholders = TEMPLATE_MANAGEMENT_PLACEHOLDERS[body.template as string] ?? [];
    if (placeholders.length > 0) {
      await CommentaryService.seedPlaceholderCommentary(
        placeholders.map((p, i) => ({
          entitySlug:      entitySlugForCommentary,
          reportingPeriod: body.period as string,
          templateId:      body.template as string,
          sectionKey:      p.sectionKey,
          commentaryType:  p.commentaryType,
          content:         p.content,
          sortOrder:       i,
          createdBy:       user.email,
          updatedBy:       user.email,
          createdAt:       now,
          updatedAt:       now,
        })),
      );
    }

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
    res.status(403).json({ ok: false, error: "Only admin or cfo roles can approve commentary.", ts: new Date().toISOString() });
    return;
  }

  try {
    const entry = await CommentaryService.approveCommentary(paramStr(req.params["id"]), user.email);
    res.json({ ok: true, data: entry, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// PATCH /api/drafts/commentary/:id/content — inline-edit a management block
router.patch("/drafts/commentary/:id/content", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Only admin, cfo, or controller roles can edit commentary.", ts: new Date().toISOString() });
    return;
  }
  const { content } = req.body as { content?: string };
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ ok: false, error: "content must be a non-empty string.", ts: new Date().toISOString() });
    return;
  }
  try {
    const entry = await CommentaryService.updateContent(paramStr(req.params["id"]), content.trim(), user.email);
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
  const templateId      = typeof req.query["template"]  === "string" ? req.query["template"]  : undefined;
  const reportingPeriod = typeof req.query["period"]    === "string" ? req.query["period"]    : undefined;
  const archivedParam   = typeof req.query["archived"]  === "string" ? req.query["archived"]  : undefined;

  const archived: boolean | "all" =
    archivedParam === "true"  ? true  :
    archivedParam === "all"   ? "all" : false;

  try {
    const drafts = await DraftService.listDrafts({ templateId, reportingPeriod, archived });
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

// ─── POST /api/drafts/:id/archive — Soft-archive a draft ─────────────────────
router.post("/drafts/:id/archive", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot archive drafts.", ts: new Date().toISOString() });
    return;
  }
  const { reason } = req.body as { reason?: unknown };
  try {
    const draft = await DraftService.archiveDraft({
      draftId:   paramStr(req.params["id"]),
      userEmail: user.email,
      reason:    typeof reason === "string" ? reason : undefined,
    });
    res.json({ ok: true, data: draft, ts: new Date().toISOString() });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err), ts: new Date().toISOString() });
  }
});

// ─── POST /api/drafts/:id/unarchive — Restore a soft-archived draft ──────────
router.post("/drafts/:id/unarchive", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot restore drafts.", ts: new Date().toISOString() });
    return;
  }
  try {
    const draft = await DraftService.restoreDraft({
      draftId:   paramStr(req.params["id"]),
      userEmail: user.email,
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

    // Build narrative context with approved edits overlaid.
    // isPreview=true enables inline-edit data attributes on management blocks.
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
    narrativeCtx.isPreview = true;

    // Attach narrative context to the report for the renderer
    (report as any).__narrativeContext = narrativeCtx;

    const rawHtml = HtmlRenderer.render(report) as string;
    // Inject inline-editing script before </body>
    const canEdit = draft.status === "draft" || draft.status === "ready_for_review";
    const html = injectPreviewScript(rawHtml, canEdit);

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

// ─── POST /api/drafts/:id/generate — Final generation from approved draft ──────
//
// This is the ONLY path that should be used to generate a final report from an
// approved draft. It enforces all server-side invariants and never accepts
// approval metadata, financial values, or narrative source labels from the client.
//
// Preconditions (all enforced server-side):
//   1. Draft exists and is owned by a known template.
//   2. status === "approved"
//   3. isStale === false
//   4. approvedBy and approvedAt are non-null (set by the server at approval time).
//   5. Live data fingerprint matches the stored fingerprint (data didn't change
//      between approval and generation).
//
// On success:
//   - Renders the report with the approved narrative context (same path as preview).
//   - Persists a Report History row with full draft linkage metadata.
//   - Transitions draft status to "generated".
//   - Returns the rendered file as an attachment (pdf/html) or JSON envelope.
router.post("/drafts/:id/generate", requirePermission("reports"), async (req, res) => {
  const user = req.session.user!;
  if (!userCanEdit(user.role)) {
    res.status(403).json({ ok: false, error: "Your role cannot generate final reports.", ts: new Date().toISOString() });
    return;
  }

  const draftId = paramStr(req.params["id"]);

  const body = req.body as { format?: unknown };
  const format = body.format;
  if (format !== "json" && format !== "pdf" && format !== "html") {
    res.status(400).json({
      ok: false,
      error: '`format` must be one of "json", "pdf", "html"',
      ts: new Date().toISOString(),
    });
    return;
  }

  try {
    // ── 1. Load draft ────────────────────────────────────────────────────────
    const draft = await DraftService.getDraft(draftId);
    if (!draft) {
      res.status(404).json({ ok: false, error: "Draft not found", ts: new Date().toISOString() });
      return;
    }

    // ── 2. Require approved (or already-generated) status ───────────────────
    // Generation is idempotent — each call creates its own Report History row.
    // "generated" is accepted so that a draft that was previously downloaded
    // can be re-downloaded in a different format without error.
    if (draft.status !== "approved" && draft.status !== "generated") {
      res.status(400).json({
        ok: false,
        error: `Draft must be approved before generating. Current status: ${draft.status}`,
        ts: new Date().toISOString(),
      });
      return;
    }

    // ── 3. Reject stale drafts ────────────────────────────────────────────────
    if (draft.isStale) {
      res.status(400).json({
        ok: false,
        error: "Draft is stale — underlying financial data changed after approval. Recreate and re-approve before generating.",
        ts: new Date().toISOString(),
      });
      return;
    }

    // ── 4. Require approval metadata (server-set at approval time) ───────────
    if (!draft.approvedBy || !draft.approvedAt) {
      res.status(400).json({
        ok: false,
        error: "Draft is missing approval metadata. It may not have completed the approval workflow.",
        ts: new Date().toISOString(),
      });
      return;
    }

    // ── 5. Verify template is still known ─────────────────────────────────────
    const tmpl = REPORT_TEMPLATES.find((t) => t.id === draft.templateId);
    if (!tmpl) {
      res.status(400).json({
        ok: false,
        error: `Draft references unknown template "${draft.templateId}"`,
        ts: new Date().toISOString(),
      });
      return;
    }

    // ── 6. Rebuild authoritative financial data from Core ─────────────────────
    const report = await buildReport({
      template: draft.templateId,
      entities: draft.entitySlugs as any,
      period:   draft.reportingPeriod,
      format:   format as ReportOutputFormat,
    });

    // ── 7. Recompute fingerprint and reject if data changed since approval ────
    const liveFingerprint = buildDataFingerprint(report);
    if (draft.dataFingerprint && liveFingerprint !== draft.dataFingerprint) {
      // Mark stale so the UI shows the warning on next load
      await DraftService.markStaleIfChanged({
        draftId,
        newFingerprint: liveFingerprint,
        staleReason:    "Financial data changed between approval and generation.",
      });
      res.status(400).json({
        ok: false,
        error: "Financial data changed between approval and generation. The draft has been marked stale. Recreate and re-approve before generating.",
        ts: new Date().toISOString(),
      });
      return;
    }

    // ── 8. Load commentary and build narrative context (identical to preview) ─
    const entitySlug = draft.entitySlugs[0] ?? "portfolio";
    const dbCommentary = await CommentaryService.getCommentaryByScope({
      entitySlug,
      reportingPeriod: draft.reportingPeriod,
      templateId:      draft.templateId,
    });

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

    // ── 9. Attach narrative context to report (same side-channel as preview) ──
    (report as any).__narrativeContext = narrativeCtx;

    // ── 10. Render the selected format ─────────────────────────────────────────
    const renderer = getRenderer(format as ReportOutputFormat);
    const output = await renderer.render(report);

    // ── 11. Persist Report History with full draft linkage ────────────────────
    // Commentary version = max version among included commentary rows
    const includedCommentary = dbCommentary.filter((c) => c.included);
    const commentaryVersion = includedCommentary.length > 0
      ? Math.max(...includedCommentary.map((c) => c.version))
      : 0;

    const historyRow = await ReportHistoryService.insertReportHistory({
      template:          report.template.id,
      title:             report.template.name,
      period:            report.period,
      format,
      entitySlugs:       draft.entitySlugs,
      status:            "completed",
      source:            report.source,
      dataFreshness:     report.metadata.dataFreshness,
      entityCount:       report.metadata.entityCount,
      confidenceScore:   report.metadata.confidenceScore,
      requestedBy:       user.email,
      completedAt:       new Date(),
      draftId:           draft.id,
      draftVersion:      draft.currentVersion,
      approvalStatus:    "approved",
      approvedBy:        draft.approvedBy,
      approvedAt:        new Date(draft.approvedAt),
      dataFingerprint:   draft.dataFingerprint ?? liveFingerprint,
      commentaryVersion,
    });

    // ── 11b. Store artifact when format is html or pdf ───────────────────────
    // Non-blocking: storage failure never prevents the download response.
    // The history row metadata is updated only when storage succeeds.
    if (format === "html" || format === "pdf") {
      const titleSlugForStorage = (report.template.name ?? report.template.id)
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "report";
      const fileNameForStorage = `financeos-${titleSlugForStorage}-${draft.reportingPeriod.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase()}.${format}`;

      storeArtifact({
        historyId:  historyRow.id,
        templateId: report.template.id,
        period:     draft.reportingPeriod,
        format,
        fileName:   fileNameForStorage,
        data:       Buffer.isBuffer(output) ? output : Buffer.from(output as string, "utf-8"),
      }).then((result) => {
        if (result.stored) {
          // Best-effort metadata update — not awaited so it never blocks the response
          ReportHistoryService.updateStorageMetadata(historyRow.id, {
            storageProvider: result.provider,
            storageKey:      result.storageKey,
            fileName:        result.fileName,
            contentType:     result.contentType,
            fileSize:        result.fileSize,
            checksum:        result.checksum,
            storedAt:        result.storedAt,
          }).catch((e) => {
            req.log?.warn({ err: e }, "Failed to update history storage metadata");
          });
        } else {
          req.log?.info({ reason: result.reason }, "Report artifact not stored (storage unavailable)");
        }
      }).catch((e) => {
        req.log?.warn({ err: e }, "Report artifact storage threw unexpectedly");
      });
    }

    // ── 12. Return file or JSON ────────────────────────────────────────────────
    // NOTE: Draft status is intentionally NOT transitioned to "generated" here.
    // Generation is idempotent — the approved draft remains approved so the
    // same draft can be downloaded in any format any number of times, each
    // producing its own Report History row with full linkage metadata.

    // approvedBy and approvedAt are non-null here — validated at step 4 above.
    // Explicit extraction prevents Express silently dropping null header values.
    const approvedBy = draft.approvedBy!;

    if (format === "json") {
      res.json({
        ok: true,
        data: {
          reportId:     report.id,
          template:     report.template,
          generatedAt:  report.generatedAt,
          branding:     report.branding,
          sections:     report.sections,
          metadata:     report.metadata,
          historyId:    historyRow.id,
          draftId:      draft.id,
          draftVersion: draft.currentVersion,
          approvedBy,
          approvedAt:   draft.approvedAt,
        },
        source: report.source,
        ts: new Date().toISOString(),
      });
      return;
    }

    const titleSlug = (report.template.name ?? report.template.id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "report";
    const filename = `financeos-${titleSlug}-${draft.reportingPeriod.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase()}`;

    const contentType: Record<string, string> = {
      html: "text/html; charset=utf-8",
      pdf:  "application/pdf",
    };
    res.setHeader("Content-Type",        contentType[format] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.${format}"`);
    res.setHeader("X-Report-Source",     report.source ?? "live");
    // All four required linkage headers — set with null-safe values.
    res.setHeader("X-Draft-Id",          draft.id);
    res.setHeader("X-Draft-Version",     String(draft.currentVersion));
    res.setHeader("X-Approved-By",       approvedBy);
    res.setHeader("X-History-Id",        historyRow.id);
    res.send(output);
  } catch (err) {
    const errorMessage = sanitizeErrorMessage(err);
    req.log?.error({ err }, "Draft final generation failed");
    res.status(500).json({ ok: false, error: errorMessage, ts: new Date().toISOString() });
  }
});

export default router;
