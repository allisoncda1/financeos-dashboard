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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold text-gray-900">Budget vs Prior Year (P&L)</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">FY2026 Budget vs FY2025 Budget</p>
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
          <div className="flex bg-gray-100 p-0.5 rounded-md">
            <button className="px-3 py-1 text-[11px] font-medium bg-white shadow-sm rounded-sm text-gray-900">P&L</button>
            <button className="px-3 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-900">Cash</button>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 ml-1 text-gray-500 hover:text-gray-900">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={BUDGET_VS_PRIOR_YEAR_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={formatYAxis} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={(val) => `${val}%`} />
              <Tooltip
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                formatter={(value: number, name: string) => {
                  if (name === "variance") return [`${value}%`, "Variance"];
                  return [new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value), name === "fy26" ? "FY2026 Budget" : "FY2025 Budget"];
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px', color: '#6b7280' }} iconType="circle" />
              <Bar yAxisId="left" dataKey="fy25" name="FY2025 Budget" fill="#e5e7eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar yAxisId="left" dataKey="fy26" name="FY2026 Budget" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Line yAxisId="right" type="monotone" dataKey="variance" name="Variance %" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1", strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
