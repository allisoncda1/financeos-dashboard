import { FORECAST_VS_BUDGET, ACTUAL_MONTHS_COUNT } from "@/lib/forecastMockData";
import { Card } from "@/components/accounting/AccountingUI";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

const fmtM = (v: number) => `$${(v / 1000000).toFixed(1)}M`;
const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const dividerMonth = FORECAST_VS_BUDGET[ACTUAL_MONTHS_COUNT - 1].month;

export function ForecastVsBudgetChart() {
  return (
    <Card
      title="Forecast vs Budget (Revenue)"
      action={
        <div className="flex items-center gap-2">
          <Select defaultValue="monthly">
            <SelectTrigger className="w-[110px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="fy26">
            <SelectTrigger className="w-[100px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fy26">FY2026</SelectItem>
              <SelectItem value="fy25">FY2025</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="px-4 pt-2 flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        <span>Actual</span>
        <span>Forecast</span>
      </div>
      <div className="px-4 pb-4" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={FORECAST_VS_BUDGET} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtM} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={52} />
            <Tooltip
              formatter={(value: number, name: string) => [fmt(value), name.charAt(0).toUpperCase() + name.slice(1)]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(16,24,40,0.08)" }}
            />
            <Legend
              formatter={(v: string) => <span style={{ fontSize: 11, color: "#64748B" }}>{v.charAt(0).toUpperCase() + v.slice(1)}</span>}
              iconType="circle"
              iconSize={7}
            />
            <ReferenceLine x={dividerMonth} stroke="#CBD5E1" strokeDasharray="4 4" />
            <Bar dataKey="budget" fill="#E2E8F0" radius={[3, 3, 0, 0]} maxBarSize={16} />
            <Line dataKey="actual" stroke="#10B981" strokeWidth={2} dot={{ r: 3, fill: "#10B981", strokeWidth: 0 }} connectNulls={false} />
            <Line dataKey="forecast" stroke="#10B981" strokeDasharray="5 4" strokeWidth={1.5} dot={{ r: 2.5, fill: "#FFFFFF", stroke: "#10B981", strokeWidth: 1.5 }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
