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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900">Budget Details</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-gray-600">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-gray-600">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-gray-600">
            <Maximize2 className="h-3.5 w-3.5" />
            Expand
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 border-r border-gray-100 min-w-[200px]">Category</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide text-right bg-emerald-50/50 border-r border-gray-100">FY2026 Total</th>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right border-r border-gray-100">YTD</th>
              {months.map(month => (
                <th key={month} className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right min-w-[100px]">{month}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUDGET_TABLE_DATA.map((row, i) => (
              <tr key={row.category} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${row.isBold ? 'bg-gray-50/50' : ''}`}>
                <td className={`px-4 py-2.5 sticky left-0 z-10 border-r border-gray-100 ${row.isBold ? 'font-semibold text-gray-900 bg-gray-50' : 'text-[12px] text-gray-700 bg-white group-hover:bg-gray-50'}`}>
                  {row.category}
                </td>
                <td className={`px-4 py-2.5 text-right border-r border-gray-100 bg-emerald-50/20 ${row.isBold ? 'font-semibold text-emerald-800' : 'text-[12px] text-emerald-700'}`}>
                  {formatCurrency(row.total)}
                </td>
                <td className={`px-4 py-2.5 text-right border-r border-gray-100 ${row.isBold ? 'font-semibold text-gray-900' : 'text-[12px] text-gray-700'}`}>
                  {formatCurrency(row.ytd)}
                </td>
                {months.map(month => (
                  <td key={month} className={`px-4 py-2.5 text-right ${row.isBold ? 'font-semibold text-gray-900' : 'text-[12px] text-gray-700'}`}>
                    {formatCurrency(row.months[month as keyof typeof row.months])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
