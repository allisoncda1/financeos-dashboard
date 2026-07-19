
import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  FileText, Download, Eye, Calendar, Building2,
  BarChart3, TrendingUp, Users, Landmark, Briefcase,
  Package, Clock, CheckCircle2, ChevronRight,
  FileSpreadsheet, Sparkles, AlertTriangle, Loader2,
  XCircle, History, Pencil, Archive, RotateCcw, BookOpen,
} from "lucide-react";
import { ENTITY_CONFIG, ENTITY_SLUGS, ENTITY_META } from "@/lib/entities";
import { EntityLogo } from "@/components/ui/EntityLogo";
import { useReportTemplates, useReportGenerator, useReportDownload, useReportHistory } from "@/hooks/useApi";
import { api, type ReportDraft } from "@/lib/api";
import type { EntitySlug } from "@/lib/types";
import type { ReportHistoryEntry } from "@/lib/reportTypes";

type ReportCenterTab = "templates" | "drafts" | "library";

// ── Template definitions ───────────────────────────────────────────────────

type OutputFormat = "PDF" | "Excel" | "Both";
type TemplateId = "monthly-close" | "quarterly-close" | "board-package" | "investor-update" | "bank-package" | "executive-package";

type Template = {
  id: TemplateId;
  name: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  sections: string[];
  pages: string;
  formats: OutputFormat[];
  audience: string;
  frequency: string;
  premium: boolean;
};

const TEMPLATES: Template[] = [
  {
    id: "monthly-close",
    name: "Monthly Close",
    tagline: "Standard month-end package",
    description: "P&L statement, balance sheet, AR/AP aging, cash position, and rule validation summary. One page per entity plus portfolio rollup.",
    icon: Calendar,
    color: "#10B981",
    sections: ["P&L Statement", "Balance Sheet", "AR Aging", "AP Aging", "Cash Position", "Validation Summary"],
    pages: "8–12 pages",
    formats: ["PDF", "Excel"],
    audience: "Controller / CFO",
    frequency: "Monthly",
    premium: false,
  },
  {
    id: "quarterly-close",
    name: "Quarterly Close",
    tagline: "Deep-dive quarterly review",
    description: "Full quarterly P&L with YTD comparison, trend analysis, entity health scores, anomaly log, and executive commentary section.",
    icon: BarChart3,
    color: "#3B82F6",
    sections: ["Quarterly P&L", "YTD Comparison", "Trend Analysis", "Health Score Matrix", "Anomaly Log", "Executive Commentary"],
    pages: "16–24 pages",
    formats: ["PDF", "Excel"],
    audience: "CFO / Board",
    frequency: "Quarterly",
    premium: false,
  },
  {
    id: "board-package",
    name: "Board Package",
    tagline: "Board-ready presentation deck",
    description: "Executive summary, KPI dashboard, revenue trends, margin analysis, entity spotlights, and forward-looking commentary. Designed for board distribution.",
    icon: Briefcase,
    color: "#8B5CF6",
    sections: ["Executive Summary", "KPI Dashboard", "Revenue Trends", "Margin Analysis", "Entity Spotlights", "Outlook"],
    pages: "20–30 pages",
    formats: ["PDF"],
    audience: "Board of Directors",
    frequency: "Quarterly",
    premium: true,
  },
  {
    id: "investor-update",
    name: "Investor Update",
    tagline: "LP / investor distribution",
    description: "Condensed portfolio performance, net income waterfall, portfolio composition, cash return analysis, and entity narrative updates.",
    icon: TrendingUp,
    color: "#F59E0B",
    sections: ["Portfolio Performance", "Net Income Waterfall", "Portfolio Composition", "Cash Return Analysis", "Entity Narratives"],
    pages: "10–16 pages",
    formats: ["PDF"],
    audience: "Investors / LPs",
    frequency: "Quarterly / Annually",
    premium: true,
  },
  {
    id: "bank-package",
    name: "Bank Package",
    tagline: "Lender covenant reporting",
    description: "Balance sheets, debt service coverage, cash flow statements, AR aging certification, and covenant compliance checklist per entity.",
    icon: Landmark,
    color: "#06B6D4",
    sections: ["Balance Sheets", "DSCR Analysis", "Cash Flow Statements", "AR Aging Certification", "Covenant Compliance"],
    pages: "12–18 pages",
    formats: ["PDF", "Excel"],
    audience: "Lenders / Banks",
    frequency: "Monthly / Quarterly",
    premium: true,
  },
  {
    id: "executive-package",
    name: "Executive Package",
    tagline: "CEO / operator one-pager",
    description: "Single-page portfolio snapshot per entity: revenue, net income, cash, key flags, and action items. Designed for weekly leadership review.",
    icon: Package,
    color: "#EF4444",
    sections: ["Portfolio Snapshot", "Entity One-Pagers", "Key Flags", "Action Items"],
    pages: "4–6 pages",
    formats: ["PDF"],
    audience: "CEO / Operators",
    frequency: "Weekly / Monthly",
    premium: false,
  },
];

const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<TemplateId, Template>;

const PERIODS = [
  "Jun 2026 (Latest)", "May 2026", "Apr 2026", "Mar 2026", "Feb 2026", "Jan 2026",
  "Q2 2026 (YTD)", "Q1 2026", "FY 2025",
];

// ── Library accordion ─────────────────────────────────────────────────────────

function LibraryMonthAccordion({ month, entries }: { month: string; entries: ReportHistoryEntry[] }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-[12px] font-semibold text-gray-700">{month}</span>
          <span className="text-[10px] text-gray-400">({entries.length} report{entries.length !== 1 ? "s" : ""})</span>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <table className="w-full text-[11px] border-t border-gray-100">
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                data-testid={`library-row-${entry.id}`}
              >
                <td className="px-4 py-2.5 font-medium text-gray-800">{entry.title}</td>
                <td className="px-4 py-2.5 text-gray-500">{entry.period}</td>
                <td className="px-4 py-2.5">
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 uppercase">
                    {entry.format}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {entry.status === "completed" ? (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" /> Done
                    </span>
                  ) : entry.status === "failed" ? (
                    <span className="flex items-center gap-1 text-red-500">
                      <XCircle className="w-3 h-3" /> Failed
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-500">
                      <Clock className="w-3 h-3" /> {entry.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap text-[10px]">
                  {new Date(entry.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-2.5 text-[10px] text-gray-300">Metadata only</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ReportCenterPage() {
  const [activeTab, setActiveTab] = useState<ReportCenterTab>("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("monthly-close");
  const [period, setPeriod]             = useState("Jun 2026 (Latest)");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([...ENTITY_SLUGS]);
  const [format, setFormat]             = useState<"json" | "pdf" | "excel" | "html">("json");
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [resultOpen, setResultOpen]     = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  // Draft Library state
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const loadDrafts = useCallback(async (archived: boolean) => {
    setDraftsLoading(true);
    setDraftsError(null);
    try {
      const result = await api.listDrafts({ archived: archived || undefined });
      setDrafts(result);
    } catch (e) {
      setDraftsError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setDraftsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "drafts") loadDrafts(showArchived);
  }, [activeTab, showArchived, loadDrafts]);

  const handleArchiveDraft = useCallback(async (id: string, isArchived: boolean) => {
    setArchivingId(id);
    try {
      if (isArchived) {
        await api.unarchiveDraft(id);
      } else {
        await api.archiveDraft(id);
      }
      await loadDrafts(showArchived);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed");
    } finally {
      setArchivingId(null);
    }
  }, [showArchived, loadDrafts]);

  const { data: liveTemplatesData, source: templatesSource } = useReportTemplates();
  const liveTemplates = liveTemplatesData ?? [];
  const templatesLoading = templatesSource === "loading";
  const { report, generating, error: generateError, generate, reset: resetReport } = useReportGenerator();
  const { downloadingFormat, error: downloadError, download } = useReportDownload();
  const { data: historyData, source: historySource } = useReportHistory(undefined, historyRefreshKey);

  const template = TEMPLATE_MAP[selectedTemplate];

  const liveTemplate = useMemo(
    () => liveTemplates.find((t) => t.id === selectedTemplate),
    [liveTemplates, selectedTemplate]
  );

  const toggleEntity = (slug: string) =>
    setSelectedEntities((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );

  const handleGenerate = useCallback(async () => {
    setResultOpen(true);
    try {
      await generate({
        template: selectedTemplate,
        entities: selectedEntities.length === ENTITY_SLUGS.length ? "all" : (selectedEntities as EntitySlug[]),
        period,
        format: "json",
      });
    } catch {
      // error state surfaced via generateError
    } finally {
      // Refresh history regardless of success/failure — the server always writes a row.
      setHistoryRefreshKey((k) => k + 1);
    }
  }, [generate, selectedTemplate, selectedEntities, period]);

  const handleCreateDraft = useCallback(async () => {
    setCreatingDraft(true);
    setDraftError(null);
    try {
      const draft = await api.createDraft({
        template: selectedTemplate,
        entities: selectedEntities.length === ENTITY_SLUGS.length ? "all" : (selectedEntities as EntitySlug[]),
        period,
      });
      navigate(`/reports/draft/${draft.id}`);
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Failed to create draft");
    } finally {
      setCreatingDraft(false);
    }
  }, [selectedTemplate, selectedEntities, period, navigate]);

  const handleDownload = async (downloadFormat: "pdf" | "excel" | "html") => {
    try {
      await download({
        template: selectedTemplate,
        entities: selectedEntities.length === ENTITY_SLUGS.length ? "all" : (selectedEntities as EntitySlug[]),
        period,
        format: downloadFormat,
      });
    } catch {
      // error state surfaced via downloadError
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
            <FileText className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Report Center</h1>
            <p className="text-[11px] text-gray-400">
              {templatesLoading
                ? "Loading templates from Report Engine…"
                : `${liveTemplates.length || TEMPLATES.length} templates · JSON, PDF, Excel & HTML generation`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {liveTemplate?.enabled && (
            <span className="text-[10px] px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
            </span>
          )}
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 sm:px-6 flex items-center gap-1">
        {([
          { id: "templates" as const, label: "Templates", icon: FileText },
          { id: "drafts"    as const, label: "Drafts",    icon: Pencil },
          { id: "library"   as const, label: "Report Library", icon: BookOpen },
        ] satisfies { id: ReportCenterTab; label: string; icon: React.ComponentType<{className?:string}> }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold border-b-2 transition-colors ${
              activeTab === id
                ? "border-violet-500 text-violet-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex">

        {/* ── Left: template gallery / tab content ────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

            {/* ── Drafts tab ──────────────────────────────────────────── */}
            {activeTab === "drafts" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Draft Library</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-gray-500 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                      className="w-3 h-3"
                    />
                    Show archived
                  </label>
                </div>

                {draftsLoading && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 py-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading drafts…
                  </div>
                )}
                {draftsError && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {draftsError}
                  </div>
                )}
                {!draftsLoading && !draftsError && drafts.length === 0 && (
                  <p className="text-[11px] text-gray-400 py-3" data-testid="draft-library-empty">
                    {showArchived ? "No archived drafts." : "No active drafts. Create a draft from the Templates tab."}
                  </p>
                )}
                {!draftsLoading && drafts.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="draft-library-table">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                          <th className="text-left px-4 py-2.5">Template</th>
                          <th className="text-left px-4 py-2.5">Period</th>
                          <th className="text-left px-4 py-2.5">Status</th>
                          <th className="text-left px-4 py-2.5">Version</th>
                          <th className="text-left px-4 py-2.5">Updated</th>
                          <th className="text-left px-4 py-2.5">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drafts.map((draft) => {
                          const isArchived = !!draft.archivedAt;
                          const isWorking = archivingId === draft.id;
                          const statusColors: Record<string, string> = {
                            draft: "bg-gray-100 text-gray-600",
                            ready_for_review: "bg-amber-50 text-amber-700",
                            approved: "bg-emerald-50 text-emerald-700",
                            superseded: "bg-gray-50 text-gray-400",
                            generated: "bg-violet-50 text-violet-700",
                          };
                          return (
                            <tr
                              key={draft.id}
                              className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                              data-testid={`draft-row-${draft.id}`}
                            >
                              <td className="px-4 py-3 font-medium text-gray-900">{draft.templateId}</td>
                              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{draft.reportingPeriod}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusColors[draft.status] ?? "bg-gray-100 text-gray-500"}`}>
                                  {isArchived ? "archived" : draft.status}
                                </span>
                                {draft.isStale && (
                                  <span className="ml-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600">stale</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-gray-400">v{draft.currentVersion}</td>
                              <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                                {new Date(draft.updatedAt).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  {!isArchived && (
                                    <button
                                      onClick={() => navigate(`/reports/draft/${draft.id}`)}
                                      className="text-[10px] text-violet-600 hover:text-violet-800 font-medium flex items-center gap-1"
                                    >
                                      <Pencil className="w-3 h-3" /> Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleArchiveDraft(draft.id, isArchived)}
                                    disabled={isWorking}
                                    className="text-[10px] text-gray-400 hover:text-gray-600 font-medium flex items-center gap-1 disabled:opacity-50"
                                    title={isArchived ? "Restore draft" : "Archive draft"}
                                  >
                                    {isWorking ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : isArchived ? (
                                      <RotateCcw className="w-3 h-3" />
                                    ) : (
                                      <Archive className="w-3 h-3" />
                                    )}
                                    {isArchived ? "Restore" : "Archive"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Report Library tab ──────────────────────────────────── */}
            {activeTab === "library" && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Report Library</p>
                </div>
                {historySource === "loading" && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                  </div>
                )}
                {historySource !== "loading" && historyData !== null && historyData!.length === 0 && (
                  <p className="text-[11px] text-gray-400 py-2">No reports generated yet.</p>
                )}
                {historySource !== "loading" && historyData !== null && historyData!.length > 0 && (() => {
                  const byMonth: Record<string, typeof historyData> = {};
                  for (const entry of historyData!) {
                    const month = new Date(entry.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" });
                    (byMonth[month] ??= []).push(entry);
                  }
                  return (
                    <div className="space-y-3" data-testid="report-library-accordion">
                      {Object.entries(byMonth).map(([month, entries]) => (
                        <LibraryMonthAccordion key={month} month={month} entries={entries!} />
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ── Templates tab (default) ────────────────────────────── */}
            {activeTab === "templates" && <div>

            {/* Template gallery */}
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Template Gallery</p>
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              >
                {TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = selectedTemplate === t.id;
                  return (
                    <motion.button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`text-left p-4 rounded-xl border-2 transition-colors group ${
                        isSelected
                          ? "border-violet-400 bg-violet-50/60 shadow-sm"
                          : "border-gray-200 bg-white"
                      }`}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
                      }}
                      whileHover={{ y: -2, boxShadow: "0 4px 16px rgba(0,0,0,0.07)" }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${t.color}1A` }}
                        >
                          <span style={{ color: t.color, display: "contents" }}><Icon className="w-4 h-4" /></span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {t.premium && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full uppercase tracking-wide">
                              Premium
                            </span>
                          )}
                          {isSelected && (
                            <span className="w-2 h-2 rounded-full bg-violet-500" />
                          )}
                        </div>
                      </div>
                      <p className="text-[13px] font-bold text-gray-900 mb-0.5">{t.name}</p>
                      <p className="text-[10px] text-gray-400 mb-2">{t.tagline}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.pages}</span>
                        <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t.frequency}</span>
                        {t.formats.map((f) => (
                          <span key={f} className="text-[9px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{f}</span>
                        ))}
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>

            {/* ── Report History ─────────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <History className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">Report History</p>
              </div>

              {historySource === "loading" && (
                <div className="flex items-center gap-2 text-[11px] text-gray-400 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading history…
                </div>
              )}

              {historySource === "unavailable" && (
                <p className="text-[11px] text-gray-400 py-2">History unavailable.</p>
              )}

              {historySource !== "loading" && historyData !== null && (
                historyData!.length === 0 ? (
                  <p className="text-[11px] text-gray-400 py-2" data-testid="report-history-empty">
                    No reports generated yet. Generate your first report above.
                  </p>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid="report-history-table">
                    <table className="w-full text-[11px]">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                          <th className="text-left px-4 py-2.5">Report</th>
                          <th className="text-left px-4 py-2.5">Period</th>
                          <th className="text-left px-4 py-2.5">Format</th>
                          <th className="text-left px-4 py-2.5">Status</th>
                          <th className="text-left px-4 py-2.5">Generated</th>
                          <th className="text-left px-4 py-2.5">File</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData!.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                            data-testid={`report-history-row-${entry.id}`}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900">{entry.title}</td>
                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{entry.period}</td>
                            <td className="px-4 py-3">
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-700 uppercase">
                                {entry.format}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {entry.status === "completed" ? (
                                <span className="flex items-center gap-1 text-emerald-600">
                                  <CheckCircle2 className="w-3 h-3" /> Done
                                </span>
                              ) : entry.status === "failed" ? (
                                <span className="flex items-center gap-1 text-red-500">
                                  <XCircle className="w-3 h-3" /> Failed
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-amber-500">
                                  <Clock className="w-3 h-3" /> {entry.status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-[10px] text-gray-300 whitespace-nowrap">
                              Metadata only
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            </div>} {/* end activeTab === "templates" */}

          </div>
        </div>

        {/* ── Right: config + preview panel ───────────────────────────── */}
        <aside className="w-[300px] flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">

          {/* Panel header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${template.color}1A` }}>
                <span style={{ color: template.color, display: "contents" }}><template.icon className="w-3.5 h-3.5" /></span>
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-gray-900 truncate">{template.name}</p>
                <p className="text-[10px] text-gray-400">{template.audience}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">

            {/* Template details */}
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <p className="text-[11px] text-gray-600 leading-relaxed">{template.description}</p>
              <div className="space-y-1.5">
                {template.sections.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-gray-300 flex-shrink-0" />
                    <span className="text-[11px] text-gray-500">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Configuration */}
            <div className="px-4 py-3 space-y-4 border-b border-gray-100">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Configuration</p>

              {/* Period */}
              <div>
                <label className="text-[10px] font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <Calendar className="w-3 h-3" /> Period
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-full text-[12px] text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-violet-400 transition-colors"
                >
                  {PERIODS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Entities */}
              <div>
                <label className="text-[10px] font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <Building2 className="w-3 h-3" /> Entities Included
                </label>
                <div className="space-y-1.5">
                  {ENTITY_SLUGS.map((slug) => {
                    const cfg = ENTITY_CONFIG[slug];
                    const checked = selectedEntities.includes(slug);
                    return (
                      <label key={slug} className="flex items-center gap-2 cursor-pointer group">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                            checked ? "border-transparent" : "border-gray-300 bg-white"
                          }`}
                          style={checked ? { background: cfg.color } : {}}
                          onClick={() => toggleEntity(slug)}
                        >
                          {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-[11px] text-gray-700 group-hover:text-gray-900 transition-colors">{cfg.name}</span>
                        <span className="ml-auto flex-shrink-0"><EntityLogo entity={ENTITY_META[slug]} size={16} rounded="sm" /></span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Output format */}
              <div>
                <label className="text-[10px] font-semibold text-gray-500 flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3 h-3" /> Output Format
                </label>
                <div className="flex gap-2">
                  {([
                    { id: "json" as const, label: "JSON", icon: FileText },
                    { id: "pdf" as const, label: "PDF", icon: FileText },
                    { id: "excel" as const, label: "Excel", icon: FileSpreadsheet },
                    { id: "html" as const, label: "HTML", icon: FileText },
                  ]).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setFormat(id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                        format === id
                          ? "border-violet-400 bg-violet-50 text-violet-700"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Data source note */}
              <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-emerald-700 leading-relaxed">
                  <span className="font-semibold">Live data.</span> Reports are generated from the live Report Engine
                  with figures and branding pulled from the Entity Registry. JSON, PDF, Excel, and HTML are all live.
                </p>
              </div>
            </div>

            {/* Preview panel */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Preview</p>
              <button
                onClick={() => setPreviewOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
                  <span className="text-[12px] font-medium text-gray-700">Preview layout</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${previewOpen ? "rotate-90" : ""}`} />
              </button>

              {previewOpen && (
                <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                  {/* Miniature page mockup */}
                  <div className="p-3 space-y-2">
                    <div className="bg-white rounded-lg p-2 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-2 w-20 bg-gray-800 rounded" />
                        <div className="h-1.5 w-10 bg-gray-300 rounded" />
                      </div>
                      <div className="h-1 w-full bg-gray-100 rounded mb-1" />
                      <div className="h-1 w-3/4 bg-gray-100 rounded mb-2" />
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        {[template.color, "#E5E7EB", "#E5E7EB"].map((c, i) => (
                          <div key={i} className="h-5 rounded" style={{ background: i === 0 ? `${c}33` : c }} />
                        ))}
                      </div>
                      <div className="h-8 bg-gray-50 rounded border border-gray-100 flex items-end px-1 gap-0.5 overflow-hidden">
                        {[0.4, 0.6, 0.5, 0.8, 0.7, 0.9].map((h, i) => (
                          <div key={i} className="flex-1 rounded-sm" style={{ height: `${h * 100}%`, background: i === 5 ? template.color : "#E5E7EB" }} />
                        ))}
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-400 text-center">
                      {template.name} · {template.pages} · {period}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Generate */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Generate</p>

              {format === "json" ? (
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-[12px] font-semibold rounded-xl transition-colors"
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {generating ? "Generating…" : "Generate Report (JSON)"}
                </button>
              ) : (
                <button
                  onClick={() => handleDownload(format)}
                  disabled={downloadingFormat === format}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white text-[12px] font-semibold rounded-xl transition-colors"
                >
                  {downloadingFormat === format ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  {downloadingFormat === format ? "Rendering…" : `Download ${format.toUpperCase()}`}
                </button>
              )}

              {downloadError && (
                <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-700 leading-relaxed">{downloadError}</p>
                </div>
              )}

              {/* Draft / Preview & Edit */}
              <div className="border-t border-gray-100 pt-2 mt-1">
                <button
                  onClick={handleCreateDraft}
                  disabled={creatingDraft}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 text-[12px] font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {creatingDraft ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Pencil className="w-3.5 h-3.5" />
                  )}
                  {creatingDraft ? "Creating Draft…" : "Preview & Edit Draft"}
                </button>
                {draftError && (
                  <div className="mt-2 flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-700">{draftError}</p>
                  </div>
                )}
                <p className="mt-1.5 text-[9px] text-gray-400 text-center">
                  Review, edit narrative, and approve before generating the final report.
                </p>
              </div>

              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                Powered by the Report Engine · JSON, PDF, Excel &amp; HTML output.
              </p>
            </div>

            {/* Generated report result */}
            {resultOpen && (
              <div className="px-4 py-3 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Generated Report</p>
                  <button
                    onClick={() => { setResultOpen(false); resetReport(); }}
                    className="text-[10px] text-gray-400 hover:text-gray-600"
                  >
                    Dismiss
                  </button>
                </div>

                {generating && (
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 py-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Assembling report from live data…
                  </div>
                )}

                {generateError && !generating && (
                  <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] text-red-700 leading-relaxed">{generateError}</p>
                  </div>
                )}

                {report && !generating && (
                  <div className="space-y-3">
                    {/* Branding */}
                    <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Branding</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {report.branding.mode === "single" && report.branding.primaryEntity ? (
                          <span
                            className="text-[10px] font-semibold px-2 py-1 rounded-full"
                            style={{ background: `${report.branding.primaryEntity.primaryColor}1A`, color: report.branding.primaryEntity.primaryColor }}
                          >
                            {report.branding.primaryEntity.name}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-violet-50 text-violet-700">
                            FinanceOS Consolidated
                          </span>
                        )}
                        {report.branding.entities.map((e) => (
                          <span key={e.slug} className="text-[9px] text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
                            {e.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Executive summary */}
                    {Boolean((report.sections as Record<string, { executiveSummary?: string[] }>)["executive_summary"]) && (
                      <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Executive Summary</p>
                        <ul className="space-y-1">
                          {(report.sections as Record<string, { executiveSummary?: string[] }>)["executive_summary"]?.executiveSummary?.map((line, i) => (
                            <li key={i} className="text-[10px] text-gray-600 leading-relaxed flex gap-1.5">
                              <span className="text-gray-300">•</span>{line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Portfolio KPIs */}
                    {Boolean((report.sections as Record<string, unknown>)["portfolio_kpis"]) && (
                      <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Portfolio KPIs</p>
                        <pre className="text-[9px] text-gray-500 whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto">
                          {JSON.stringify((report.sections as Record<string, unknown>)["portfolio_kpis"], null, 2)}
                        </pre>
                      </div>
                    )}

                    <p className="text-[9px] text-gray-400 text-center">
                      {report.reportId} · confidence {report.metadata.confidenceScore}% · {report.metadata.entityCount} {report.metadata.entityCount === 1 ? "entity" : "entities"}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

