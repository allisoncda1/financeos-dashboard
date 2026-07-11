import { CASH_FLOW_FORECAST } from "@/lib/forecastMockData";
import { Card } from "@/components/accounting/AccountingUI";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";

const fmtM = (v: number) => `$${(v / 1000000).toFixed(1)}M`;
const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const NAME_LABEL: Record<string, string> = {
  operating: "Operating Cash Flow",
  investing: "Investing Cash Flow",
  financing: "Financing Cash Flow",
  endingBalance: "Ending Cash Balance",
};

const lastActual = [...CASH_FLOW_FORECAST].reverse().find(d => d.isActual)?.month;

export function CashFlowForecastChart() {
  return (
    <Card
      title="Cash Flow Forecast"
      action={
        <Select defaultValue="monthly">
          <SelectTrigger className="w-[110px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="px-4 py-4" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={CASH_FLOW_FORECAST} stackOffset="sign" barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="flow" tickFormatter={fmtM} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={52} />
            <YAxis yAxisId="balance" orientation="right" tickFormatter={fmtM} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={52} />
            <Tooltip
              formatter={(value: number, name: string) => [fmt(value), NAME_LABEL[name] ?? name]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(16,24,40,0.08)" }}
            />
            <Legend
              formatter={(v: string) => <span style={{ fontSize: 11, color: "#64748B" }}>{NAME_LABEL[v] ?? v}</span>}
              iconType="circle"
              iconSize={7}
            />
            {lastActual && <ReferenceLine x={lastActual} yAxisId="flow" stroke="#CBD5E1" strokeDasharray="4 4" />}
            <Bar yAxisId="flow" dataKey="operating" stackId="cf" fill="#10B981" maxBarSize={14} />
            <Bar yAxisId="flow" dataKey="investing" stackId="cf" fill="#8B5CF6" maxBarSize={14} />
            <Bar yAxisId="flow" dataKey="financing" stackId="cf" fill="#93C5FD" maxBarSize={14} />
            <Line yAxisId="balance" dataKey="endingBalance" stroke="#0D9488" strokeWidth={2} dot={{ r: 2.5, fill: "#0D9488", strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="px-4 pb-3 -mt-1 flex items-center justify-center gap-6 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
        <span>Actual</span>
        <span className="text-gray-200">|</span>
        <span>Forecast</span>
      </div>
    </Card>
  );
}
