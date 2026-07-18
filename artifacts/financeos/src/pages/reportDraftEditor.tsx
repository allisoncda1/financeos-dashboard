/**
 * Report Draft Editor — inline editing on the live report preview.
 *
 * Opens the report as a full-width document preview. Management narrative
 * sections (Management Commentary, Recommended Actions) support inline
 * click-to-edit. Financial values, tables, and FinanceOS Analysis are locked.
 *
 * Accessed via: /reports/draft/:draftId
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  FileText, Save, Eye, Clock, XCircle, CheckCircle2,
  ChevronLeft, Loader2, AlertTriangle,
  Send, Check, RefreshCw, Download,
} from "lucide-react";
import { api, type ReportDraft, type CommentaryEntry, type ReportDraftVersion } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────────────

type DraftStatus = ReportDraft["status"];

type EditableContent = {
  reportTitle?: string;
  sectionOverrides: Record<string, {
    heading?: string;
    intro?: string;
    conclusion?: string;
    notes?: string;
  }>;
  includedSections: string[];
};

const STATUS_CONFIG: Record<DraftStatus, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  draft:             { label: "Draft",            color: "#94a3b8", icon: Clock },
  ready_for_review:  { label: "Ready for Review", color: "#f59e0b", icon: Eye },
  approved:          { label: "Approved",         color: "#10b981", icon: CheckCircle2 },
  superseded:        { label: "Superseded",       color: "#ef4444", icon: XCircle },
  generated:         { label: "Generated",        color: "#6366f1", icon: FileText },
};

// ── Main Component ───────────────────────────────────────────────────────────

export default function ReportDraftEditor() {
  const params = useParams<{ draftId: string }>();
  const [, navigate] = useLocation();
  const draftId = params.draftId;

  // Draft state
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Commentary state
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([]);
  const [versions, setVersions] = useState<ReportDraftVersion[]>([]);

  // Preview state
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Editor state
  const [editableContent, setEditableContent] = useState<EditableContent>({
    reportTitle: undefined,
    sectionOverrides: {},
    includedSections: [],
  });
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // UI state
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const previewRef = useRef<HTMLIFrameElement>(null);

  // ── Load draft ────────────────────────────────────────────────────────────

  const loadDraft = useCallback(async () => {
    if (!draftId) return;
    try {
      setLoading(true);
      const [d, preview] = await Promise.all([
        api.getDraft(draftId),
        api.getDraftPreview(draftId).catch(() => null),
      ]);
      setDraft(d);
      const raw = (d.editableContent as Partial<EditableContent>) ?? {};
      const ec: EditableContent = {
        sectionOverrides: raw.sectionOverrides ?? {},
        includedSections: raw.includedSections ?? [],
        reportTitle: raw.reportTitle,
      };
      setEditableContent(ec);
      if (preview) setPreviewHtml(preview.html);

      // Load commentary
      const entitySlug = d.entitySlugs[0] ?? "portfolio";
      const comm = await api.getCommentary(entitySlug, d.reportingPeriod, d.templateId).catch(() => []);
      setCommentary(comm);

      // Load versions
      const vers = await api.getDraftVersions(draftId).catch(() => []);
      setVersions(vers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load draft");
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => { loadDraft(); }, [loadDraft]);

  // ── Refresh preview ───────────────────────────────────────────────────────

  const refreshPreview = useCallback(async () => {
    if (!draftId) return;
    setPreviewLoading(true);
    try {
      const preview = await api.getDraftPreview(draftId);
      setPreviewHtml(preview.html);
    } catch {
      /* non-blocking */
    } finally {
      setPreviewLoading(false);
    }
  }, [draftId]);

  // ── Save edits ────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!draftId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await api.saveDraftEdits(draftId, editableContent, "Edits saved");
      setDraft(updated);
      setUnsavedChanges(false);
      await refreshPreview();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draftId, editableContent, refreshPreview]);

  // Auto-save on unsaved changes with debounce
  useEffect(() => {
    if (!unsavedChanges) return;
    const timer = setTimeout(handleSave, 3000);
    return () => clearTimeout(timer);
  }, [unsavedChanges, handleSave]);

  // Warn on unload
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [unsavedChanges]);

  // ── Editable content helpers ──────────────────────────────────────────────

  function updateReportTitle(value: string) {
    setEditableContent((prev) => ({ ...prev, reportTitle: value || undefined }));
    setUnsavedChanges(true);
  }

  function updateSectionOverride(sectionKey: string, field: string, value: string) {
    setEditableContent((prev) => ({
      ...prev,
      sectionOverrides: {
        ...prev.sectionOverrides,
        [sectionKey]: {
          ...prev.sectionOverrides[sectionKey],
          [field]: value || undefined,
        },
      },
    }));
    setUnsavedChanges(true);
  }

  // ── Draft actions ─────────────────────────────────────────────────────────

  async function handleAction(action: "submit" | "approve", label: string) {
    if (!draftId) return;
    setActionLoading(action);
    setActionError(null);
    try {
      if (unsavedChanges) await handleSave();
      const fn = action === "submit" ? api.submitDraftForReview : api.approveDraft;
      const updated = await fn(draftId);
      setDraft(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : `${label} failed`);
    } finally {
      setActionLoading(null);
    }
  }

  // ── Inline-edit postMessage handler ────────────────────────────────────────
  //
  // The preview iframe posts {type:"fo-edit-save", blockId, text} when the user
  // saves an inline edit. We call the commentary update API and refresh the preview.
  // The iframe also posts {type:"fo-edit-cancel"} which we can ignore (iframe already
  // restored the original text visually).

  useEffect(() => {
    async function handleMessage(evt: MessageEvent) {
      if (!evt.data || typeof evt.data !== "object") return;
      const { type, blockId, text } = evt.data as { type?: string; blockId?: string; text?: string };
      if (type !== "fo-edit-save" || !blockId) return;
      if (typeof text !== "string") return;
      try {
        await api.updateCommentaryContent(blockId, text);
        // Refresh the preview so the new text is shown on next render
        await refreshPreview();
      } catch {
        /* non-blocking — iframe already shows updated text */
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [refreshPreview]);

  async function handleGenerate(format: "pdf" | "html") {
    if (!draftId) return;
    setActionLoading("generate");
    setActionError(null);
    try {
      const { blob, filename } = await api.downloadDraft(draftId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      // Reload draft so UI reflects "generated" status
      const updated = await api.getDraft(draftId);
      setDraft(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const sectionKeys = [
    ...new Set(commentary.map((c) => c.sectionKey)),
    "portfolio_summary", "entity_performance",
  ].filter((v, i, arr) => arr.indexOf(v) === i);

  const sectionsByKey = sectionKeys.reduce((acc, key) => {
    acc[key] = commentary.filter((c) => c.sectionKey === key);
    return acc;
  }, {} as Record<string, CommentaryEntry[]>);

  const canEdit = draft?.status === "draft" || draft?.status === "ready_for_review";
  const canSubmit = draft?.status === "draft";
  const canApprove = draft?.status === "ready_for_review";
  // Generation is idempotent — allow repeated downloads from any approved-or-already-generated draft.
  const canGenerate = (draft?.status === "approved" || draft?.status === "generated") && !draft?.isStale;
  const statusCfg = draft ? STATUS_CONFIG[draft.status] : null;

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F4F5F7]">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-[13px]">Loading draft editor…</span>
        </div>
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F4F5F7]">
        <div className="text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-[13px] text-gray-600">{error ?? "Draft not found"}</p>
          <button onClick={() => navigate("/reports")} className="text-[12px] text-violet-600 hover:underline">
            ← Back to Report Center
          </button>
        </div>
      </div>
    );
  }

  const StatusIcon = statusCfg?.icon ?? Clock;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">

      {/* ── Top action bar ──────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate("/reports")}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Report Center
          </button>

          <div className="w-px h-4 bg-gray-200" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 bg-violet-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-gray-900 truncate">
                {editableContent.reportTitle ?? draft.templateId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
              <p className="text-[10px] text-gray-400 truncate">{draft.reportingPeriod} · v{draft.currentVersion}</p>
            </div>
          </div>

          {/* Status badge */}
          {statusCfg && (
            <span
              className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${statusCfg.color}1A`, color: statusCfg.color }}
            >
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </span>
          )}

          {/* Stale warning */}
          {draft.isStale && (
            <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="w-3 h-3" /> Data Changed — Re-approval Required
            </span>
          )}

          {/* Unsaved indicator */}
          {unsavedChanges && (
            <span className="flex-shrink-0 text-[10px] text-amber-600 font-medium">● Unsaved</span>
          )}

          {/* Inline edit hint */}
          {canEdit && (
            <span className="flex-shrink-0 text-[9px] text-violet-500 border border-violet-200 rounded-full px-2 py-0.5 bg-violet-50">
              Click narrative text to edit inline
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !canEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 hover:border-gray-300 disabled:opacity-50 transition-colors bg-white text-gray-700"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Draft
          </button>

          {/* Preview refresh */}
          <button
            onClick={refreshPreview}
            disabled={previewLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 hover:border-gray-300 disabled:opacity-50 transition-colors bg-white text-gray-700"
          >
            {previewLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>

          {/* Submit for review */}
          {canSubmit && (
            <button
              onClick={() => handleAction("submit", "Submit")}
              disabled={actionLoading === "submit"}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors"
            >
              {actionLoading === "submit" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Submit for Review
            </button>
          )}

          {/* Approve */}
          {canApprove && (
            <button
              onClick={() => handleAction("approve", "Approve")}
              disabled={actionLoading === "approve" || draft.isStale}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
            >
              {actionLoading === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Approve
            </button>
          )}

          {/* Generate Final Report — only when approved and not stale */}
          {canGenerate && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleGenerate("pdf")}
                disabled={actionLoading === "generate"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
                title="Download final PDF using the approved narrative"
              >
                {actionLoading === "generate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Generate PDF
              </button>
              <button
                onClick={() => handleGenerate("html")}
                disabled={actionLoading === "generate"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-indigo-300 hover:border-indigo-400 text-indigo-700 bg-white disabled:opacity-50 transition-colors"
                title="Download final HTML using the approved narrative"
              >
                HTML
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {(actionError || saveError) && (
        <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-red-700">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {actionError ?? saveError}
          </div>
          <button onClick={() => { setActionError(null); setSaveError(null); }} className="text-[10px] text-red-400 hover:text-red-600">
            Dismiss
          </button>
        </div>
      )}

      {/* ── Report preview — full width, inline editing ───────────────── */}
      <div className="flex-1 overflow-hidden relative bg-gray-100">
        {previewHtml ? (
          <iframe
            ref={previewRef}
            srcDoc={previewHtml}
            title="Report Preview"
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-[12px]">
            {previewLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading preview…
              </div>
            ) : (
              <div className="text-center space-y-2">
                <Eye className="w-8 h-8 mx-auto text-gray-300" />
                <p>Preview unavailable.</p>
                <button onClick={refreshPreview} className="text-[11px] text-violet-500 hover:underline">
                  Load preview
                </button>
              </div>
            )}
          </div>
        )}
        {previewLoading && previewHtml && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] bg-white rounded-full px-2.5 py-1 shadow-sm text-gray-400 border border-gray-200">
            <Loader2 className="w-3 h-3 animate-spin" /> Refreshing…
          </div>
        )}
      </div>
    </div>
  );
}
