import {
  FileText, Building2, Users, Layers, Receipt, ScrollText, FileSpreadsheet, FileDown,
} from "lucide-react";
import type { ComponentType } from "react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { Button } from "@/components/ui/button";

type ReportCard = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  iconBg: string;
  period: string;
};

const REPORTS: ReportCard[] = [
  { id: "allocation-summary", title: "Allocation Summary", description: "Shared cost distribution across all entities and cost centers.", icon: Layers, iconBg: "#6366F1", period: "June 2026" },
  { id: "entity-pnl-loaded", title: "Entity P&L — Fully Loaded", description: "Book vs adjusted net income per legal entity after allocation.", icon: Building2, iconBg: "#10B981", period: "FY2026 YTD" },
  { id: "client-profitability", title: "Client Profitability", description: "Cost to serve and margin for each client after overhead.", icon: Users, iconBg: "#F59E0B", period: "June 2026" },
  { id: "cost-center-spend", title: "Cost Center Spend", description: "Direct and allocated spend by cost center and hierarchy.", icon: FileText, iconBg: "#8B5CF6", period: "June 2026" },
  { id: "shared-expense-register", title: "Shared Expense Register", description: "Every shared expense with allocation status and rule match.", icon: Receipt, iconBg: "#3B82F6", period: "June 2026" },
  { id: "audit-trail", title: "Audit Trail", description: "Allocation rule changes, approvals and posting history.", icon: ScrollText, iconBg: "#EF4444", period: "FY2026 YTD" },
];


export default function AnalyticsReportsPage() {
  return (
    <AnalyticsLayout
      title="Reports"
      subtitle="Downloadable management accounting reports."
      showScenario={false}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col"
              data-testid={`card-report-${r.id}`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: r.iconBg }}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900">{r.title}</h4>
                  <p className="text-[11px] text-gray-400">{r.period}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500 flex-1 mb-3">{r.description}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 flex-1 text-xs"
                  disabled
                  data-testid={`button-pdf-${r.id}`}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 flex-1 text-xs"
                  disabled
                  data-testid={`button-excel-${r.id}`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 flex-1 text-xs"
                  disabled
                  data-testid={`button-csv-${r.id}`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  CSV
                </Button>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center">Demo — export disabled</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid="analytics-report-activity">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Recent Report Activity</h3>
        </div>
        <div className="px-4 py-6 text-center">
          <p className="text-[12px] text-gray-400">
            Management accounting exports are not yet enabled. Generate reports in the{" "}
            <a href="/reports" className="text-indigo-600 hover:underline font-medium">Report Center</a>.
          </p>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
