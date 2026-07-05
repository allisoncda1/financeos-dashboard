import { useParams, Link } from "wouter";
import NotFound from "@/pages/not-found";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { useDashboardData } from "@/hooks/useApi";
import { ENTITY_CONFIG } from "@/lib/entities";
import { PageHeader } from "@/components/shared/PageHeader";
import { FileText, BarChart3, Users, ShoppingBag, Layers, ArrowRight } from "lucide-react";


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

export default function ReportsPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug || !ENTITY_SLUGS.includes(slug as EntitySlug)) return <NotFound />;
  const eSlug = slug as EntitySlug;
  const { data, source } = useDashboardData();
  const cfg = ENTITY_CONFIG[eSlug];
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }
  const asOf = data.freshness.data_as_of;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <PageHeader entitySlug={eSlug} pageTitle="Reports" asOf={asOf} />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Report types */}
        <div>
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Available Reports</p>
          <div className="grid grid-cols-3 gap-3">
            {REPORT_TYPES.map((r) => (
              <Link
                key={r.id}
                href="/reports"
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer group block"
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
                <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: r.color }}>
                  Generate in Report Center
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Report settings / context */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Report Settings</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Entity: <span className="font-medium" style={{ color: cfg.color }}>{cfg.name}</span> ·
                Basis: {cfg.basis} · Period: Jan 2026 – Jun 2026 (YTD)
              </p>
            </div>
            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-500">
              Jan 2026 — Jun 2026
            </div>
          </div>
        </div>

        {/* Report Center pointer */}
        <Link
          href="/reports"
          className="flex items-center gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 transition-colors group"
        >
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-violet-800">Open the Report Center</p>
            <p className="text-[11px] text-violet-600">Generate and download live PDF, Excel, and HTML reports for {cfg.name} and the full portfolio.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-violet-500 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
