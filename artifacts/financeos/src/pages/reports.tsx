
import { useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Download, Eye, Calendar, Building2,
  BarChart3, TrendingUp, Users, Landmark, Briefcase,
  Package, Clock, CheckCircle2, Lock, ChevronRight,
  FileSpreadsheet,
} from "lucide-react";
import { ENTITY_CONFIG, ENTITY_SLUGS, ENTITY_META } from "@/lib/entities";
import { EntityLogo } from "@/components/ui/EntityLogo";

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

// ── Recent generated reports (mock) ───────────────────────────────────────

type RecentReport = {
  id: string;
  template: TemplateId;
  name: string;
  generated: string;
  period: string;
  entities: string;
  format: "PDF" | "Excel";
  size: string;
  pages: number;
};

const RECENT_REPORTS: RecentReport[] = [
  { id: "r-009", template: "monthly-close",     name: "Monthly Close — Jun 2026",           generated: "2026-07-02 09:14 AM", period: "Jun 2026",    entities: "All 4",       format: "PDF",   size: "842 KB",  pages: 11 },
  { id: "r-008", template: "executive-package",  name: "Executive Package — Jun 2026",        generated: "2026-07-02 09:18 AM", period: "Jun 2026",    entities: "All 4",       format: "PDF",   size: "284 KB",  pages: 5  },
  { id: "r-007", template: "quarterly-close",    name: "Quarterly Close — Q1 2026",           generated: "2026-04-03 08:52 AM", period: "Q1 2026",     entities: "All 4",       format: "PDF",   size: "1.4 MB",  pages: 22 },
  { id: "r-006", template: "board-package",      name: "Board Package — Q1 2026",             generated: "2026-04-05 10:00 AM", period: "Q1 2026",     entities: "All 4",       format: "PDF",   size: "2.1 MB",  pages: 28 },
  { id: "r-005", template: "monthly-close",      name: "Monthly Close — May 2026",            generated: "2026-06-03 09:05 AM", period: "May 2026",    entities: "All 4",       format: "Excel", size: "318 KB",  pages: 10 },
  { id: "r-004", template: "bank-package",       name: "Bank Package — Q1 2026 (CarDealer)", generated: "2026-04-10 11:20 AM", period: "Q1 2026",     entities: "CarDealer.ai", format: "PDF",  size: "640 KB",  pages: 15 },
  { id: "r-003", template: "investor-update",    name: "Investor Update — FY 2025",           generated: "2026-02-14 09:00 AM", period: "FY 2025",     entities: "All 4",       format: "PDF",   size: "980 KB",  pages: 14 },
  { id: "r-002", template: "monthly-close",      name: "Monthly Close — Apr 2026",            generated: "2026-05-02 09:10 AM", period: "Apr 2026",    entities: "All 4",       format: "PDF",   size: "824 KB",  pages: 11 },
  { id: "r-001", template: "executive-package",  name: "Executive Package — May 2026",        generated: "2026-06-01 08:30 AM", period: "May 2026",    entities: "All 4",       format: "PDF",   size: "272 KB",  pages: 5  },
];

const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map((t) => [t.id, t])) as Record<TemplateId, Template>;

const PERIODS = [
  "Jun 2026 (Latest)", "May 2026", "Apr 2026", "Mar 2026", "Feb 2026", "Jan 2026",
  "Q2 2026 (YTD)", "Q1 2026", "FY 2025",
];

// ── Component ────────────────────────────────────────────────────────────────

export default function ReportCenterPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("monthly-close");
  const [period, setPeriod]             = useState("Jun 2026 (Latest)");
  const [selectedEntities, setSelectedEntities] = useState<string[]>([...ENTITY_SLUGS]);
  const [format, setFormat]             = useState<"PDF" | "Excel">("PDF");
  const [previewOpen, setPreviewOpen]   = useState(false);

  const template = TEMPLATE_MAP[selectedTemplate];

  const toggleEntity = (slug: string) =>
    setSelectedEntities((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );

  const recentForTemplate = RECENT_REPORTS.filter((r) => r.template === selectedTemplate);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
            <FileText className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-gray-900">Report Center</h1>
            <p className="text-[11px] text-gray-400">6 templates · mock data · export stubs only · Phase 2 for live generation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2.5 py-1 bg-violet-50 text-violet-700 rounded-full font-semibold">Phase 1</span>
          <span className="text-[10px] px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full font-semibold">{RECENT_REPORTS.length} generated</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">

        {/* ── Left: template gallery ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">

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

            {/* Recent reports for selected template */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-gray-900">Recent Reports</h3>
                  <p className="text-[11px] text-gray-400">{recentForTemplate.length > 0 ? `${recentForTemplate.length} for ${template.name}` : `No ${template.name} reports yet`}</p>
                </div>
                <button
                  onClick={() => {}}
                  className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                >
                  View all {RECENT_REPORTS.length} →
                </button>
              </div>

              {recentForTemplate.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <FileText className="w-6 h-6 text-gray-200 mx-auto mb-2" />
                  <p className="text-[12px] text-gray-400">No {template.name} reports generated yet.</p>
                  <p className="text-[11px] text-gray-300 mt-0.5">Configure and generate below.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentForTemplate.map((r) => (
                    <RecentReportRow key={r.id} report={r} />
                  ))}
                </div>
              )}
            </div>

            {/* All reports table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-[13px] font-semibold text-gray-900">All Generated Reports</h3>
                <p className="text-[11px] text-gray-400">Mock report history — {RECENT_REPORTS.length} total</p>
              </div>
              <div className="divide-y divide-gray-50">
                {RECENT_REPORTS.map((r) => (
                  <RecentReportRow key={r.id} report={r} showTemplate />
                ))}
              </div>
            </div>
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
                  {(["PDF", "Excel"] as const).filter((f) => template.formats.includes(f) || f === "PDF").map((f) => {
                    const available = template.formats.includes(f);
                    return (
                      <button
                        key={f}
                        onClick={() => available && setFormat(f)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                          format === f && available
                            ? "border-violet-400 bg-violet-50 text-violet-700"
                            : available
                            ? "border-gray-200 text-gray-500 hover:border-gray-300"
                            : "border-gray-100 text-gray-300 cursor-not-allowed"
                        }`}
                      >
                        {f === "PDF" ? <FileText className="w-3 h-3" /> : <FileSpreadsheet className="w-3 h-3" />}
                        {f}
                        {!available && <Lock className="w-2.5 h-2.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data source note */}
              <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  <span className="font-semibold">Mock data only.</span> Phase 2 will pull live figures from Google Drive.
                  Exported files will not contain real financial data until Drive integration is complete.
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

            {/* Export buttons (stubs) */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Generate</p>

              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-400 text-[12px] font-semibold rounded-xl cursor-not-allowed"
                title="Phase 2 — Drive integration required"
              >
                <Download className="w-3.5 h-3.5" />
                Generate {format}
                <Lock className="w-3 h-3 ml-auto" />
              </button>

              {template.formats.length > 1 && (
                <button
                  disabled
                  className="w-full flex items-center justify-center gap-2 py-2 border border-gray-200 text-gray-400 text-[11px] font-medium rounded-xl cursor-not-allowed"
                  title="Phase 2 — Drive integration required"
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  Generate Both Formats
                  <Lock className="w-3 h-3 ml-auto" />
                </button>
              )}

              <p className="text-[10px] text-gray-400 text-center leading-relaxed">
                Generation requires Drive integration.<br />Coming in Phase 2.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function RecentReportRow({ report, showTemplate }: { report: RecentReport; showTemplate?: boolean }) {
  const template = TEMPLATE_MAP[report.template];
  const Icon = template.icon;
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors group">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${template.color}1A` }}
      >
        <span style={{ color: template.color, display: "contents" }}><Icon className="w-4 h-4" /></span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold text-gray-800 truncate">{report.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {showTemplate && (
            <>
              <span className="text-[10px] text-gray-400">{template.name}</span>
              <span className="text-gray-200 text-[10px]">·</span>
            </>
          )}
          <span className="text-[10px] text-gray-400">{report.entities}</span>
          <span className="text-gray-200 text-[10px]">·</span>
          <span className="text-[10px] text-gray-400">{report.pages}p</span>
          <span className="text-gray-200 text-[10px]">·</span>
          <span className="text-[10px] text-gray-400">{report.size}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-right">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
            report.format === "PDF" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"
          }`}>{report.format}</span>
          <p className="text-[9px] text-gray-400 mt-0.5">{report.generated.split(" ")[0]}</p>
        </div>
        <button
          disabled
          className="p-1.5 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
          title="Download disabled — Phase 2"
        >
          <Download className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
