/**
 * Report Draft Editor — the editable preview workflow.
 *
 * Three-panel layout:
 *   Left:   Section nav + completion status
 *   Center: Live report preview with editable narrative blocks
 *   Right:  Selected block settings + provenance panel
 *
 * Financial values are locked and read-only. Only narrative prose,
 * titles, and section overrides can be edited.
 *
 * Accessed via: /reports/draft/:draftId
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  FileText, Save, Eye, CheckCircle2, XCircle, Clock,
  ChevronLeft, Info, Loader2, AlertTriangle, Pencil,
  Shield, Sparkles, MessageSquare, Zap, Plus, Trash2,
  RotateCcw, Send, Check, EyeOff, GripVertical,
  RefreshCw, History as HistoryIcon, Download,
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

type ActiveBlock = {
  id: string;
  sectionKey: string;
  commentaryType: string;
  content: string;
  provenance: unknown;
  approved: boolean;
  included: boolean;
};

// ── Constants ────────────────────────────────────────────────────────────────

const SOURCE_COLORS: Record<string, string> = {
  financeos_analysis:    "#0ea5e9",
  management_commentary: "#8b5cf6",
  recommended_action:    "#f59e0b",
};

const SOURCE_LABELS: Record<string, string> = {
  financeos_analysis:    "FinanceOS Analysis",
  management_commentary: "Management Commentary",
  recommended_action:    "Recommended Action",
};

const STATUS_CONFIG: Record<DraftStatus, { label: string; color: string; icon: React.ComponentType<{className?: string}> }> = {
  draft:             { label: "Draft",            color: "#94a3b8", icon: Clock },
  ready_for_review:  { label: "Ready for Review", color: "#f59e0b", icon: Eye },
  approved:          { label: "Approved",         color: "#10b981", icon: CheckCircle2 },
  superseded:        { label: "Superseded",       color: "#ef4444", icon: XCircle },
  generated:         { label: "Generated",        color: "#6366f1", icon: FileText },
};

// ── Section Nav ──────────────────────────────────────────────────────────────

const SECTION_META: Record<string, { label: string; required: boolean }> = {
  portfolio_summary:   { label: "Portfolio Summary",    required: true },
  entity_performance:  { label: "Entity Performance",   required: true },
  financial_performance: { label: "Financial Performance", required: false },
  cash_and_liquidity:  { label: "Cash & Liquidity",     required: false },
  alerts_summary:      { label: "Alerts & Exceptions",  required: false },
  close_status:        { label: "Close Status",         required: false },
  general:             { label: "General",              required: false },
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
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [activeBlock, setActiveBlock] = useState<ActiveBlock | null>(null);
  const [addingCommentary, setAddingCommentary] = useState(false);
  const [newCommentaryText, setNewCommentaryText] = useState("");
  const [newCommentaryType, setNewCommentaryType] = useState<"management_commentary" | "recommended_action">("management_commentary");
  const [showVersions, setShowVersions] = useState(false);
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

  // ── Commentary actions ────────────────────────────────────────────────────

  async function handleAddCommentary() {
    if (!draft || !newCommentaryText.trim() || !activeSection) return;
    const entitySlug = draft.entitySlugs[0] ?? "portfolio";
    try {
      const entry = await api.saveCommentary({
        entitySlug,
        reportingPeriod: draft.reportingPeriod,
        templateId:      draft.templateId,
        sectionKey:      activeSection,
        commentaryType:  newCommentaryType,
        content:         newCommentaryText.trim(),
        sortOrder:       commentary.filter((c) => c.sectionKey === activeSection).length,
      });
      setCommentary((prev) => [...prev, entry]);
      setNewCommentaryText("");
      setAddingCommentary(false);
      await refreshPreview();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add commentary");
    }
  }

  async function handleToggleBlock(id: string, included: boolean) {
    try {
      const updated = await api.toggleCommentary(id, included);
      setCommentary((prev) => prev.map((c) => c.id === id ? updated : c));
      if (activeBlock?.id === id) setActiveBlock((ab) => ab ? { ...ab, included } : null);
      await refreshPreview();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to toggle block");
    }
  }

  async function handleDeleteBlock(id: string) {
    try {
      await api.deleteCommentary(id);
      setCommentary((prev) => prev.filter((c) => c.id !== id));
      if (activeBlock?.id === id) setActiveBlock(null);
      await refreshPreview();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to delete block");
    }
  }

  async function handleRestoreVersion(versionNumber: number) {
    if (!draftId) return;
    setActionLoading("restore");
    try {
      const updated = await api.restoreDraftVersion(draftId, versionNumber);
      setDraft(updated);
      const r2 = (updated.editableContent as Partial<EditableContent>) ?? {};
      setEditableContent({ sectionOverrides: r2.sectionOverrides ?? {}, includedSections: r2.includedSections ?? [], reportTitle: r2.reportTitle });
      setShowVersions(false);
      setUnsavedChanges(false);
      await refreshPreview();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setActionLoading(null);
    }
  }

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
  const canGenerate = draft?.status === "approved" && !draft?.isStale;
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

          {/* Versions */}
          <button
            onClick={() => setShowVersions((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 hover:border-gray-300 transition-colors bg-white text-gray-700"
          >
            <HistoryIcon className="w-3.5 h-3.5" />
            Versions ({versions.length})
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

      {/* ── Three-panel body ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── Left: Section nav ────────────────────────────────────────── */}
        <aside className="w-[200px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-3 py-2.5 border-b border-gray-100">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Report Sections</p>
          </div>

          {/* Report title override */}
          <div className="px-3 py-2.5 border-b border-gray-100">
            <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
              Report Title
            </label>
            <input
              type="text"
              value={editableContent.reportTitle ?? ""}
              placeholder="(use default)"
              onChange={(e) => updateReportTitle(e.target.value)}
              disabled={!canEdit}
              className="w-full text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:border-violet-400 disabled:opacity-50"
            />
          </div>

          <div className="flex-1 overflow-y-auto py-1.5">
            {sectionKeys.map((sectionKey) => {
              const meta = SECTION_META[sectionKey] ?? { label: sectionKey, required: false };
              const blocks = sectionsByKey[sectionKey] ?? [];
              const hasManagement = blocks.some((b) => b.commentaryType === "management_commentary");
              const isActive = activeSection === sectionKey;
              return (
                <button
                  key={sectionKey}
                  onClick={() => setActiveSection(isActive ? null : sectionKey)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    isActive ? "bg-violet-50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-medium ${isActive ? "text-violet-700" : "text-gray-700"}`}>
                      {meta.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {hasManagement && (
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400" title="Has management commentary" />
                      )}
                      {meta.required && !hasManagement && (
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-200" title="No commentary yet" />
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-gray-400 mt-0.5">
                    {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex-shrink-0 px-3 py-2.5 border-t border-gray-100 space-y-1.5">
            {Object.entries(SOURCE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-[9px] text-gray-500">{SOURCE_LABELS[type]}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Center: Preview ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Section commentary overlay (when section is selected) */}
          {activeSection && (
            <div className="flex-shrink-0 bg-violet-50 border-b border-violet-200 px-4 py-3 space-y-2 max-h-64 overflow-y-auto">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-violet-900">
                  {SECTION_META[activeSection]?.label ?? activeSection} — Commentary
                </p>
                {canEdit && (
                  <button
                    onClick={() => setAddingCommentary((v) => !v)}
                    className="flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-800"
                  >
                    <Plus className="w-3 h-3" /> Add commentary
                  </button>
                )}
              </div>

              {/* Add commentary form */}
              {addingCommentary && canEdit && (
                <div className="bg-white rounded-lg border border-violet-200 p-2.5 space-y-2">
                  <div className="flex gap-2">
                    {(["management_commentary", "recommended_action"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setNewCommentaryType(type)}
                        className={`flex-1 text-[10px] font-semibold py-1 rounded border transition-colors ${
                          newCommentaryType === type
                            ? "border-violet-400 bg-violet-50 text-violet-700"
                            : "border-gray-200 text-gray-500"
                        }`}
                      >
                        {SOURCE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={newCommentaryText}
                    onChange={(e) => setNewCommentaryText(e.target.value)}
                    placeholder="Enter narrative text… (financial values cannot be added here)"
                    rows={3}
                    className="w-full text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-1.5 outline-none focus:border-violet-400 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddCommentary}
                      disabled={!newCommentaryText.trim()}
                      className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold bg-violet-600 text-white rounded disabled:opacity-50 hover:bg-violet-700"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                    <button
                      onClick={() => { setAddingCommentary(false); setNewCommentaryText(""); }}
                      className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Commentary blocks for this section */}
              {(sectionsByKey[activeSection] ?? []).map((block) => (
                <div
                  key={block.id}
                  onClick={() => setActiveBlock({
                    id:             block.id,
                    sectionKey:     block.sectionKey,
                    commentaryType: block.commentaryType,
                    content:        block.content,
                    provenance:     block.provenance,
                    approved:       block.status === "approved",
                    included:       block.included,
                  })}
                  className={`bg-white rounded-lg border p-2.5 cursor-pointer transition-colors ${
                    activeBlock?.id === block.id ? "border-violet-400" : "border-gray-200 hover:border-gray-300"
                  } ${!block.included ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{
                          background: `${SOURCE_COLORS[block.commentaryType] ?? "#94a3b8"}1A`,
                          color: SOURCE_COLORS[block.commentaryType] ?? "#94a3b8",
                        }}
                      >
                        {SOURCE_LABELS[block.commentaryType]}
                      </span>
                      {block.status === "approved" && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleBlock(block.id, !block.included); }}
                          className="text-gray-300 hover:text-gray-600 transition-colors"
                          title={block.included ? "Exclude from report" : "Include in report"}
                        >
                          {block.included ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                      )}
                      {canEdit && block.commentaryType !== "financeos_analysis" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBlock(block.id); }}
                          className="text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-700 mt-1.5 leading-relaxed line-clamp-2">{block.content}</p>
                </div>
              ))}

              {(sectionsByKey[activeSection] ?? []).length === 0 && (
                <p className="text-[11px] text-violet-500 italic">No commentary for this section yet.</p>
              )}

              {/* Section overrides */}
              {canEdit && (
                <div className="border-t border-violet-200 pt-2 space-y-1.5">
                  <p className="text-[9px] font-semibold text-violet-700 uppercase tracking-widest">Section Overrides</p>
                  {["heading", "intro", "conclusion", "notes"].map((field) => (
                    <div key={field}>
                      <label className="text-[9px] text-violet-600 capitalize">{field}</label>
                      <input
                        type="text"
                        value={editableContent.sectionOverrides[activeSection]?.[field as keyof typeof editableContent.sectionOverrides[string]] ?? ""}
                        placeholder={`Custom ${field}…`}
                        onChange={(e) => updateSectionOverride(activeSection, field, e.target.value)}
                        className="w-full text-[11px] bg-white border border-violet-200 rounded px-2 py-1 outline-none focus:border-violet-400"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Report preview iframe */}
          <div className="flex-1 overflow-hidden relative bg-gray-100">
            {previewHtml ? (
              <iframe
                ref={previewRef}
                srcDoc={previewHtml}
                title="Report Preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
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

        {/* ── Right: Block settings / info panel ───────────────────────── */}
        <aside className="w-[260px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">
              {activeBlock ? "Block Details" : "Draft Details"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

            {/* Version history panel */}
            {showVersions && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-gray-600">Version History</p>
                {versions.map((v) => (
                  <div key={v.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-gray-700">v{v.versionNumber}</span>
                      {canEdit && v.versionNumber < (draft?.currentVersion ?? 0) && (
                        <button
                          onClick={() => handleRestoreVersion(v.versionNumber)}
                          disabled={actionLoading === "restore"}
                          className="flex items-center gap-1 text-[9px] text-violet-600 hover:underline disabled:opacity-50"
                        >
                          <RotateCcw className="w-2.5 h-2.5" /> Restore
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] text-gray-500">{v.changeSummary ?? "—"}</p>
                    <p className="text-[9px] text-gray-400">{new Date(v.createdAt).toLocaleString()}</p>
                    <p className="text-[9px] text-gray-400">{v.createdBy ?? "Unknown"}</p>
                  </div>
                ))}
                {versions.length === 0 && <p className="text-[10px] text-gray-400">No versions saved.</p>}
              </div>
            )}

            {/* Active block details */}
            {activeBlock && !showVersions && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Source</label>
                  <div
                    className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg"
                    style={{
                      background: `${SOURCE_COLORS[activeBlock.commentaryType] ?? "#94a3b8"}1A`,
                      color: SOURCE_COLORS[activeBlock.commentaryType] ?? "#94a3b8",
                    }}
                  >
                    {activeBlock.commentaryType === "financeos_analysis" ? (
                      <Sparkles className="w-3.5 h-3.5" />
                    ) : activeBlock.commentaryType === "management_commentary" ? (
                      <MessageSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    {SOURCE_LABELS[activeBlock.commentaryType]}
                  </div>
                </div>

                <div>
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest block mb-1">Content</label>
                  <p className="text-[11px] text-gray-700 leading-relaxed bg-gray-50 rounded p-2.5 border border-gray-200">
                    {activeBlock.content}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Status</span>
                  {activeBlock.included ? (
                    <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Included</span>
                  ) : (
                    <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Excluded</span>
                  )}
                  {activeBlock.approved && (
                    <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" /> Approved
                    </span>
                  )}
                </div>

                {/* Lock notice for financial analysis */}
                {activeBlock.commentaryType === "financeos_analysis" ? (
                  <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-blue-700">FinanceOS Analysis</p>
                        <p className="text-[10px] text-blue-600 leading-relaxed">
                          This statement is deterministically generated from authoritative financial data.
                          Financial values cannot be edited. You can hide this block or add management commentary
                          in the same section.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Provenance */}
                {activeBlock.commentaryType === "financeos_analysis" && activeBlock.provenance ? (
                  <div className="space-y-2">
                    <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">
                      Why am I seeing this?
                    </label>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 space-y-1.5 text-[10px] text-gray-600">
                      {Object.entries(activeBlock.provenance as Record<string, unknown>)
                        .filter(([k]) => k !== "generatedAt")
                        .map(([key, val]) => (
                          <div key={key} className="flex gap-2">
                            <span className="text-gray-400 flex-shrink-0 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}:</span>
                            <span className="font-mono">{String(val ?? "N/A")}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : null}

                {/* Data issue report link */}
                {activeBlock.commentaryType === "financeos_analysis" ? (
                  <button className="w-full text-[10px] text-gray-400 border border-gray-200 rounded-lg py-1.5 hover:bg-gray-50 transition-colors">
                    Report a data issue
                  </button>
                ) : null}
              </div>
            )}

            {/* Draft metadata (when no block selected) */}
            {!activeBlock && !showVersions && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Template</label>
                  <p className="text-[11px] text-gray-700">
                    {draft.templateId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Period</label>
                  <p className="text-[11px] text-gray-700">{draft.reportingPeriod}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Entities</label>
                  <div className="flex flex-wrap gap-1">
                    {draft.entitySlugs.map((slug) => (
                      <span key={slug} className="text-[9px] font-medium px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                        {slug}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Version</label>
                  <p className="text-[11px] text-gray-700">v{draft.currentVersion}</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Created by</label>
                  <p className="text-[11px] text-gray-700">{draft.createdBy ?? "—"}</p>
                </div>

                {draft.approvedBy && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Approved by</label>
                    <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {draft.approvedBy}
                    </p>
                    {draft.approvedAt && (
                      <p className="text-[9px] text-gray-400">{new Date(draft.approvedAt).toLocaleString()}</p>
                    )}
                  </div>
                )}

                {draft.isStale && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-semibold text-red-700">Data Changed</p>
                        <p className="text-[10px] text-red-600 leading-relaxed mt-0.5">
                          {draft.staleReason ?? "Financial data changed after this draft was created. Re-create the draft and re-approve."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 space-y-2">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Data Integrity</p>
                  <div className="flex items-start gap-1.5 p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                    <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                      Financial values are locked and read-only. Only narrative text, titles, and section overrides can be edited in this draft.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
