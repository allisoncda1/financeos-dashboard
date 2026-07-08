import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { BUDGET_VS_PRIOR_YEAR_DATA } from "@/lib/budgetMockData";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";

const formatYAxis = (tickItem: number) => {
  if (tickItem === 0) return "0";
  return `$${(tickItem / 1000000).toFixed(1)}M`;
};

export function BudgetVsPriorYearChart() {
  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Budget vs Prior Year (P&L)</h3>
            <p className="text-sm text-slate-500">FY2026 Budget vs FY2025 Budget</p>
          </div>
          <div className="flex items-center gap-2">
            <Select defaultValue="monthly">
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue placeholder="Monthly" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex bg-slate-100 p-0.5 rounded-md">
              <button className="px-3 py-1 text-xs font-medium bg-white shadow-sm rounded-sm text-slate-900">P&L</button>
              <button className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-900">Cash</button>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={BUDGET_VS_PRIOR_YEAR_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={formatYAxis} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `${val}%`} />
              <Tooltip
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number, name: string) => {
                  if (name === "variance") return [`${value}%`, "Variance"];
                  return [new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value), name === "fy26" ? "FY2026 Budget" : "FY2025 Budget"];
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} iconType="circle" />
              <Bar yAxisId="left" dataKey="fy25" name="FY2025 Budget" fill="#CBD5E1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar yAxisId="left" dataKey="fy26" name="FY2026 Budget" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line yAxisId="right" type="monotone" dataKey="variance" name="Variance %" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4, fill: "#8B5CF6", strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
