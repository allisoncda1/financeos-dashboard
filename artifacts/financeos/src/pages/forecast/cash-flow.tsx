import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { CashFlowForecastChart } from "@/components/forecast/CashFlowForecastChart";
import { Card, MiniKpi } from "@/components/accounting/AccountingUI";
import { CASH_FLOW_FORECAST } from "@/lib/forecastMockData";

const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function CashFlowForecastPage() {
  return (
    <ForecastLayout title="Cash Flow Forecast" subtitle="Projected operating, investing and financing cash flows">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Free Cash Flow (FY2026)" value="$1.6M" sub="+5.4% vs budget" tone="emerald" />
        <MiniKpi label="Ending Cash (EoY)" value="$4.8M" sub="Runway: 5.2 months" tone="gray" />
        <MiniKpi label="Lowest Cash Month" value="Jul 2025 — $3.9M" sub="Above $2.0M minimum" tone="emerald" />
      </div>

      <CashFlowForecastChart />

      <Card title="Monthly Cash Flow Detail">
        <div className="px-5 py-2 overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Operating</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Investing</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Financing</th>
                <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Ending Balance</th>
                <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider pl-4">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {CASH_FLOW_FORECAST.map(m => (
                <tr key={m.month} data-testid={`row-cashflow-${m.month.toLowerCase()}`}>
                  <td className="py-2.5 text-[12px] font-medium text-gray-800">{m.month}</td>
                  <td className="py-2.5 text-right text-[12px] text-emerald-600 font-medium">{fmt(m.operating)}</td>
                  <td className="py-2.5 text-right text-[12px] text-red-600 font-medium">{fmt(m.investing)}</td>
                  <td className="py-2.5 text-right text-[12px] text-red-600 font-medium">{fmt(m.financing)}</td>
                  <td className="py-2.5 text-right text-[12px] font-semibold text-gray-900">{fmt(m.endingBalance)}</td>
                  <td className="py-2.5 text-[11px] text-gray-400 pl-4">{m.isActual ? "Actual" : "Forecast"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </ForecastLayout>
  );
}
