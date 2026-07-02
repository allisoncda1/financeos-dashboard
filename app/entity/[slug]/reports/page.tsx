import { notFound } from "next/navigation";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/types";
import { getMockData } from "@/lib/mock";
import { ENTITY_CONFIG } from "@/lib/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { FileText, BarChart3, Users, ShoppingBag, Layers, Download } from "lucide-react";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}

type ReportType = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  available: boolean;
};

const REPORT_TYPES: ReportType[] = [
  { id: "pl",         title: "P&L Summary",     description: "Income statement with monthly breakdown and YTD totals", icon: BarChart3,  color: "#10B981", available: true },
  { id: "bs",         title: "Balance Sheet",    description: "Assets, liabilities, and equity snapshot as of period end", icon: Layers,    color: "#3B82F6", available: true },
  { id: "ar-aging",   title: "AR Aging Report",  description: "Accounts receivable aging by customer and bucket",         icon: Users,     color: "#F59E0B", available: true },
  { id: "ap-aging",   title: "AP Aging Report",  description: "Accounts payable aging by vendor and due date",            icon: ShoppingBag,color: "#8B5CF6", available: true },
  { id: "board",      title: "Board Package",    description: "Executive summary with KPIs, trends, and commentary",      icon: FileText,  color: "#EF4444", available: true },
];

const RECENT_REPORTS = [
  { name: "P&L Summary — May 2026",       generated: "2026-06-03 09:14 AM", format: "PDF",   size: "284 KB" },
  { name: "AR Aging — May 2026",          generated: "2026-06-03 09:18 AM", format: "Excel", size: "142 KB" },
  { name: "Balance Sheet — Q1 2026",      generated: "2026-04-02 08:52 AM", format: "PDF",   size: "198 KB" },
];

export default async function ReportsPage({ params }: Props) {
  const { slug } = await params;
  if (!ENTITY_SLUGS.includes(slug as EntitySlug)) notFound();
  const eSlug = slug as EntitySlug;
  const data = getMockData();
  const cfg = ENTITY_CONFIG[eSlug];
  const asOf = data.freshness.data_as_of;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <PageHeader entitySlug={eSlug} pageTitle="Reports" asOf={asOf} />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Report types */}
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Select Report Type</p>
          <div className="grid grid-cols-3 gap-3">
            {REPORT_TYPES.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${r.color}1A` }}
                  >
                    <span style={{ color: r.color, display: "contents" }}><r.icon className="w-4 h-4" /></span>
                  </div>
                  <h3 className="text-[13px] font-semibold text-gray-900 group-hover:text-gray-700">{r.title}</h3>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{r.description}</p>
                <div className="flex gap-2">
                  <button
                    disabled
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 text-[11px] font-medium rounded-lg cursor-not-allowed"
                    title="Drive integration coming in Phase 2"
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </button>
                  <button
                    disabled
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 text-[11px] font-medium rounded-lg cursor-not-allowed"
                    title="Drive integration coming in Phase 2"
                  >
                    <Download className="w-3 h-3" />
                    Excel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Date range + entity info */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Report Settings</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Entity: <span className="font-medium" style={{ color: cfg.color }}>{cfg.name}</span> ·
                Basis: {cfg.basis} · Period: Jan 2026 – Jun 2026 (YTD)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-500">
                Jan 2026 — Jun 2026
              </div>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-400 cursor-not-allowed">
                Change period (Phase 2)
              </div>
            </div>
          </div>
        </div>

        {/* Phase 2 note */}
        <div className="flex items-start gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-[9px] font-bold">i</span>
          </div>
          <p className="text-[11px] text-blue-700">
            <span className="font-semibold">Phase 2:</span> Report generation will pull live data from Google Shared Drive
            and produce downloadable PDF and Excel files. Drive integration coming next sprint.
          </p>
        </div>

        {/* Recent reports */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-[13px] font-semibold text-gray-900">Recent Reports</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {RECENT_REPORTS.map((r, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-gray-800 truncate">{r.name}</p>
                  <p className="text-[10px] text-gray-400">Generated {r.generated}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">{r.format}</span>
                  <span className="text-[10px] text-gray-400">{r.size}</span>
                  <button disabled className="p-1.5 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed">
                    <Download className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
