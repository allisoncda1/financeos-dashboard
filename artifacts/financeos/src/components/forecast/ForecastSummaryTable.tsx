import { FORECAST_SUMMARY } from "@/lib/forecastMockData";
import { Card } from "@/components/accounting/AccountingUI";

const TONE_CLASS: Record<string, string> = {
  positive: "text-emerald-600",
  negative: "text-red-600",
  neutral: "text-gray-500",
};

export function ForecastSummaryTable() {
  return (
    <Card title="Forecast Summary (FY2026)">
      <div className="px-5 py-2 overflow-x-auto">
        <table className="w-full min-w-[420px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Metric</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Budget</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Forecast</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Variance</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Variance %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {FORECAST_SUMMARY.map(row => (
              <tr key={row.metric} data-testid={`row-summary-${row.metric.toLowerCase().replace(/\s+/g, "-")}`}>
                <td className="py-2.5 text-[12px] font-medium text-gray-800">{row.metric}</td>
                <td className="py-2.5 text-right text-[12px] text-gray-500">{row.budget}</td>
                <td className="py-2.5 text-right text-[12px] font-semibold text-gray-900">{row.forecast}</td>
                <td className={`py-2.5 text-right text-[12px] font-semibold ${TONE_CLASS[row.tone]}`}>{row.variance}</td>
                <td className={`py-2.5 text-right text-[12px] font-semibold ${TONE_CLASS[row.tone]}`}>{row.variancePct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
