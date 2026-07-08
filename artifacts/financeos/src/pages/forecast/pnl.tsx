import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { Card, MiniKpi } from "@/components/accounting/AccountingUI";
import { PNL_FORECAST_LINES } from "@/lib/forecastMockData";

const fmtM = (v: number) => `${v < 0 ? "-" : ""}$${(Math.abs(v) / 1000000).toFixed(1)}M`;
const BOLD_LINES = new Set(["Gross Profit", "Operating Income", "Net Income"]);

export default function PnlForecastPage() {
  return (
    <ForecastLayout title="P&L Forecast" subtitle="Full-year profit and loss projection vs budget">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Forecasted Net Income" value="$2.2M" sub="-26.7% vs budget" tone="red" />
        <MiniKpi label="Operating Income" value="$1.9M" sub="-47.2% vs budget" tone="red" />
        <MiniKpi label="Gross Margin" value="61.2%" sub="-2.1 pts vs budget" tone="red" />
      </div>

      <Card title="P&L Forecast (FY2026)">
        <div className="px-5 py-2 overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Line Item</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Budget</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Forecast</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {PNL_FORECAST_LINES.map(l => (
                <tr key={l.id} data-testid={`row-pnl-${l.id}`} className={BOLD_LINES.has(l.line) ? "bg-gray-50/60" : ""}>
                  <td className={`py-2.5 text-[12px] ${BOLD_LINES.has(l.line) ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>{l.line}</td>
                  <td className="py-2.5 text-right text-[12px] text-gray-500">{fmtM(l.budget)}</td>
                  <td className={`py-2.5 text-right text-[12px] ${BOLD_LINES.has(l.line) ? "font-bold" : "font-semibold"} text-gray-900`}>{fmtM(l.forecast)}</td>
                  <td className={`py-2.5 text-right text-[12px] font-semibold ${l.tone === "negative" ? "text-red-600" : "text-emerald-600"}`}>
                    {l.variance > 0 ? "+" : ""}{fmtM(l.variance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </ForecastLayout>
  );
}
