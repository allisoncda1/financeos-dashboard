import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { ForecastVsBudgetChart } from "@/components/forecast/ForecastVsBudgetChart";
import { Card, MiniKpi } from "@/components/accounting/AccountingUI";
import { REVENUE_FORECAST_BY_COMPANY } from "@/lib/forecastMockData";

const fmtM = (v: number) => `${v < 0 ? "-" : ""}$${(Math.abs(v) / 1000000).toFixed(1)}M`;

export default function RevenueForecastPage() {
  return (
    <ForecastLayout title="Revenue Forecast" subtitle="Projected revenue by company and month">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="FY2026 Forecast" value="$18.4M" sub="-8.2% vs budget" tone="red" />
        <MiniKpi label="FY2026 Budget" value="$20.0M" sub="Approved plan" tone="gray" />
        <MiniKpi label="Actual YTD (Jul-Dec)" value="$10.1M" sub="+2.3% vs budget" tone="emerald" />
      </div>

      <ForecastVsBudgetChart />

      <Card title="Revenue Forecast by Company">
        <div className="px-5 py-2 overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Budget</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Forecast</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Variance</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Variance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {REVENUE_FORECAST_BY_COMPANY.map(r => (
                <tr key={r.id} data-testid={`row-revenue-${r.id}`}>
                  <td className="py-2.5 text-[12px] font-medium text-gray-800">{r.company}</td>
                  <td className="py-2.5 text-right text-[12px] text-gray-500">{fmtM(r.budget)}</td>
                  <td className="py-2.5 text-right text-[12px] font-semibold text-gray-900">{fmtM(r.forecast)}</td>
                  <td className={`py-2.5 text-right text-[12px] font-semibold ${r.variance < 0 ? "text-red-600" : "text-gray-500"}`}>
                    {r.variance === 0 ? "—" : fmtM(r.variance)}
                  </td>
                  <td className={`py-2.5 text-right text-[12px] font-semibold ${r.variance < 0 ? "text-red-600" : "text-gray-500"}`}>{r.variancePct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </ForecastLayout>
  );
}
