import { Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUDGET_DETAIL_QUARTERS, type BudgetDetailRow } from "@/lib/budgetMockData";

const formatCurrency = (val: number) => {
  const isNegative = val < 0;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(val));
  return isNegative ? `(${formatted})` : formatted;
};

export function BudgetDetailTable({
  title,
  rows,
  totalLabel = "FY2026 Total",
}: {
  title: string;
  rows: BudgetDetailRow[];
  totalLabel?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" data-testid={`table-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-gray-600">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs text-gray-600">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide min-w-[220px]">Line Item</th>
              {BUDGET_DETAIL_QUARTERS.map((q) => (
                <th key={q} className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right min-w-[110px]">{q}</th>
              ))}
              <th className="px-4 py-2.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide text-right bg-emerald-50/50 border-l border-gray-100">{totalLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) =>
              row.section ? (
                <tr key={row.label} className="border-b border-gray-50 bg-gray-50/70">
                  <td
                    colSpan={BUDGET_DETAIL_QUARTERS.length + 2}
                    className="px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {row.label}
                  </td>
                </tr>
              ) : (
                <tr key={row.label} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${row.bold ? "bg-gray-50/50" : ""}`}>
                  <td className={`px-4 py-2.5 ${row.bold ? "text-[12px] font-semibold text-gray-900" : "text-[12px] text-gray-700"}`}>
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td key={i} className={`px-4 py-2.5 text-right ${row.bold ? "text-[12px] font-semibold text-gray-900" : "text-[12px] text-gray-700"}`}>
                      {formatCurrency(v)}
                    </td>
                  ))}
                  <td className={`px-4 py-2.5 text-right border-l border-gray-100 bg-emerald-50/20 ${row.bold ? "text-[12px] font-semibold text-emerald-800" : "text-[12px] text-emerald-700"}`}>
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
