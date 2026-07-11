import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { Card, MiniKpi } from "@/components/accounting/AccountingUI";
import { BALANCE_SHEET_FORECAST } from "@/lib/forecastMockData";

const fmtM = (v: number) => `$${(v / 1000000).toFixed(1)}M`;
const BOLD = new Set(["Total Assets", "Total Liabilities", "Total Equity"]);

export default function BalanceSheetForecastPage() {
  return (
    <ForecastLayout title="Balance Sheet Forecast" subtitle="Projected end-of-year balance sheet position">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Cash (EoY)" value="$4.8M" sub="From $5.3M current" tone="gray" />
        <MiniKpi label="Total Assets (EoY)" value="$11.5M" sub="+2.2% vs current" tone="emerald" />
        <MiniKpi label="Total Equity (EoY)" value="$8.2M" sub="+5.1% vs current" tone="emerald" />
      </div>

      <Card title="Balance Sheet Forecast (FY2026)">
        <div className="px-5 py-2 overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Line Item</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Current (Dec 2025)</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Forecast (Jun 2026)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {BALANCE_SHEET_FORECAST.map(l => (
                <tr key={l.id} data-testid={`row-bs-${l.id}`} className={BOLD.has(l.line) ? "bg-gray-50/60" : ""}>
                  <td className={`py-2.5 text-[12px] ${BOLD.has(l.line) ? "font-bold text-gray-900" : "font-medium text-gray-800"}`}>{l.line}</td>
                  <td className="py-2.5 text-right text-[12px] text-gray-500">{fmtM(l.current)}</td>
                  <td className={`py-2.5 text-right text-[12px] ${BOLD.has(l.line) ? "font-bold" : "font-semibold"} text-gray-900`}>{fmtM(l.eoy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </ForecastLayout>
  );
}
