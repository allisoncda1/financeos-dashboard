import { Card, CardContent } from "@/components/ui/card";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { BUDGET_CATEGORIES } from "@/lib/budgetMockData";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BudgetCategoryChart() {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  // Donut shows the allocation of total budgeted revenue (COGS + opex + other expenses + net income = $17.4M)
  const donutData = BUDGET_CATEGORIES.filter((c) => c.inDonut);

  return (
    <Card className="shadow-sm border-slate-200 h-full">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-semibold text-slate-900">Budget by Category (P&L)</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center flex-1">
          <div className="relative h-[200px] w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-sm text-slate-500 font-medium">Total Budget</span>
              <span className="text-2xl font-bold text-slate-900">$17.4M</span>
            </div>
          </div>

          <div className="w-full space-y-3">
            {BUDGET_CATEGORIES.map((category) => (
              <div key={category.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: category.color }} />
                  <span
                    className={
                      category.name === "Net Income" || category.name === "Gross Profit"
                        ? "text-slate-900 font-medium"
                        : "text-slate-600"
                    }
                  >
                    {category.name}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium text-slate-900">{formatCurrency(category.value)}</span>
                  <span className="text-slate-400 w-12 text-right">{category.percentage.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
