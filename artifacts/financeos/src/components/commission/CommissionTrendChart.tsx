import { COMMISSION_TREND } from "@/lib/commissionMockData";
import { Card } from "@/components/accounting/AccountingUI";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const fmtK = (v: number) => `$${Math.round(v / 1000)}K`;
const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function CommissionTrendChart() {
  return (
    <Card
      title="Commission Trend"
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
          <Select defaultValue="12m">
            <SelectTrigger className="w-[130px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12m">Last 12 Months</SelectItem>
              <SelectItem value="6m">Last 6 Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="px-4 py-4" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={COMMISSION_TREND} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtK} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              formatter={(value: number, name: string) => [fmt(value), name.charAt(0).toUpperCase() + name.slice(1)]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(16,24,40,0.08)" }}
            />
            <Legend
              formatter={(v: string) => <span style={{ fontSize: 11, color: "#64748B" }}>{v.charAt(0).toUpperCase() + v.slice(1)}</span>}
              iconType="circle"
              iconSize={7}
            />
            <Bar dataKey="earned" fill="#10B981" radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Bar dataKey="paid" fill="#A78BFA" radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Line dataKey="forecast" stroke="#94A3B8" strokeDasharray="5 4" strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
