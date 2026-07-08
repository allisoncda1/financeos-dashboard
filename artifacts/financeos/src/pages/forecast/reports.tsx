import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { Card } from "@/components/accounting/AccountingUI";
import { FORECAST_REPORTS } from "@/lib/forecastMockData";
import { BarChart3, ArrowRight } from "lucide-react";

export default function ForecastReportsPage() {
  return (
    <ForecastLayout title="Reports" subtitle="Forecast reports and analyses">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {FORECAST_REPORTS.map(r => (
          <Card key={r.id}>
            <div className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-semibold text-gray-900">{r.name}</h3>
                <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">{r.description}</p>
                <p className="text-[11px] text-gray-400 mt-2">Last run {r.lastRun}</p>
              </div>
              <button
                data-testid={`button-run-${r.id}`}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 bg-white text-[12px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors flex-shrink-0"
              >
                Run <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </ForecastLayout>
  );
}
