import { FORECAST_DRIVERS } from "@/lib/forecastMockData";
import { Card } from "@/components/accounting/AccountingUI";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";

const fmtImpact = (v: number) =>
  `${v < 0 ? "-" : "+"}$${Math.abs(v).toLocaleString("en-US")}`;

function TrendLine({ data, color }: { data: number[]; color: string }) {
  const w = 60, h = 18;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ForecastDriversTable() {
  return (
    <Card title="Key Forecast Drivers">
      <div className="px-5 py-2 overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Driver</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Impact on Net Income</th>
              <th className="py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">vs Budget</th>
              <th className="py-2 text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Trend</th>
              <th className="py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider pl-4">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {FORECAST_DRIVERS.map(d => (
              <tr key={d.id} data-testid={`row-driver-${d.id}`}>
                <td className="py-2.5 text-[12px] font-medium text-gray-800">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    {d.driver}
                  </span>
                </td>
                <td className={`py-2.5 text-right text-[12px] font-semibold ${d.impact < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {fmtImpact(d.impact)}
                </td>
                <td className={`py-2.5 text-right text-[12px] font-medium ${d.trendColor === "#EF4444" ? "text-red-600" : "text-emerald-600"}`}>
                  {d.vsBudget}
                </td>
                <td className="py-2.5">
                  <div className="flex justify-center"><TrendLine data={d.trend} color={d.trendColor} /></div>
                </td>
                <td className="py-2.5 text-[12px] text-gray-500 pl-4">{d.comment}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Link
          href="/forecast/drivers"
          data-testid="link-view-all-drivers"
          className="flex items-center gap-1.5 py-3 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
        >
          View all drivers <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Card>
  );
}
