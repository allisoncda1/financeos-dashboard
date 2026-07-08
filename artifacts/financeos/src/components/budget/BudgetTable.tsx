import { Card, CardContent } from "@/components/ui/card";
import { BUDGET_TABLE_DATA } from "@/lib/budgetMockData";
import { Download, Filter, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const formatCurrency = (val: number) => {
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(absVal);
  return isNegative ? `(${formatted})` : formatted;
};

export function BudgetTable() {
  const months = Object.keys(BUDGET_TABLE_DATA[0].months);

  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Budget Details</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
              <Filter className="h-3.5 w-3.5" />
              Filter
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs">
              <Maximize2 className="h-3.5 w-3.5" />
              Expand
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium sticky left-0 bg-slate-50 z-10 w-[200px] border-r border-slate-200">Category</th>
                <th className="px-4 py-3 font-medium text-right bg-emerald-50 text-emerald-800 border-r border-slate-200">FY2026 Total</th>
                <th className="px-4 py-3 font-medium text-right border-r border-slate-200">YTD</th>
                {months.map(month => (
                  <th key={month} className="px-4 py-3 font-medium text-right min-w-[100px]">{month}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BUDGET_TABLE_DATA.map((row, i) => (
                <tr key={row.category} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${row.isBold ? 'bg-slate-50/50' : ''}`}>
                  <td className={`px-6 py-3 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 ${row.isBold ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                    {row.category}
                  </td>
                  <td className={`px-4 py-3 text-right border-r border-slate-200 bg-emerald-50/30 ${row.isBold ? 'font-semibold text-emerald-800' : 'font-medium text-emerald-700'}`}>
                    {formatCurrency(row.total)}
                  </td>
                  <td className={`px-4 py-3 text-right border-r border-slate-200 ${row.isBold ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                    {formatCurrency(row.ytd)}
                  </td>
                  {months.map(month => (
                    <td key={month} className={`px-4 py-3 text-right ${row.isBold ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                      {formatCurrency(row.months[month as keyof typeof row.months])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
