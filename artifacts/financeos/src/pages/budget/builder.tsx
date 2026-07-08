import { useState } from "react";
import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUDGET_TABLE_DATA } from "@/lib/budgetMockData";
import { Upload, Filter, Save, CheckCircle, Info } from "lucide-react";

export default function BudgetBuilderPage() {
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  const months = Object.keys(BUDGET_TABLE_DATA[0].months);

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

  return (
    <BudgetLayout title="Budget Builder" subtitle="Build and edit budgets line by line">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px] bg-white h-8 text-xs border-gray-200" data-testid="filter-department">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="sales">Sales & Marketing</SelectItem>
              <SelectItem value="ga">G&A</SelectItem>
              <SelectItem value="tech">Product / Tech</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all">
            <SelectTrigger className="w-[160px] bg-white h-8 text-xs border-gray-200" data-testid="filter-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="opex">OpEx</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white text-xs text-gray-600" data-testid="button-apply-growth">
            <Filter className="w-3.5 h-3.5" /> Apply Growth %
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white text-xs text-gray-600" data-testid="button-import-actuals">
            <Upload className="w-3.5 h-3.5" /> Import from Actuals
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white text-xs text-gray-600" data-testid="button-save-draft">
            <Save className="w-3.5 h-3.5" /> Save Draft
          </Button>
          <Button size="sm" className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 shadow-sm" data-testid="button-submit-approval">
            <CheckCircle className="w-3.5 h-3.5" /> Submit for Approval
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6">
        <div className="xl:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left whitespace-nowrap" data-testid="table-budget-builder">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 border-r border-gray-100 min-w-[200px]">Account / Category</th>
                    <th className="px-4 py-2.5 text-[10px] font-semibold text-emerald-700 uppercase tracking-wide text-right bg-emerald-50/50 border-r border-gray-100">FY Total</th>
                    {months.map(month => (
                      <th key={month} className="px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right min-w-[100px]">{month}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BUDGET_TABLE_DATA.map((row) => {
                    const isSelected = selectedRow === row.category;
                    return (
                      <tr 
                        key={row.category} 
                        onClick={() => setSelectedRow(row.category)}
                        className={`border-b border-gray-50 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/30' : 'hover:bg-gray-50'} ${row.isBold && !isSelected ? 'bg-gray-50/50' : ''}`}
                      >
                        <td className={`px-4 py-2.5 sticky left-0 z-10 border-r border-gray-100 ${isSelected ? 'bg-emerald-50/80' : 'bg-white group-hover:bg-gray-50'} ${row.isBold ? 'font-semibold text-gray-900' : 'text-[12px] text-gray-700'}`}>
                          {row.category}
                        </td>
                        <td className={`px-4 py-2.5 text-right border-r border-gray-100 ${row.isBold ? 'font-semibold text-emerald-800 bg-emerald-50/30' : 'text-[12px] text-emerald-700 bg-emerald-50/10'}`}>
                          {formatCurrency(row.total)}
                        </td>
                        {months.map(month => (
                          <td key={month} className={`px-4 py-2.5 text-right ${row.isBold ? 'font-semibold text-gray-900' : 'text-[12px] text-gray-700'}`}>
                            {formatCurrency(row.months[month as keyof typeof row.months])}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm sticky top-[100px]">
            <div className="p-5">
              {selectedRow ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-[13px] font-semibold text-gray-900">{selectedRow} Details</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Calculation Method</p>
                      <p className="text-[12px] font-medium text-gray-900">Historical Average + Growth</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1">Assumptions</p>
                      <ul className="text-[12px] text-gray-700 space-y-1 list-disc pl-4 marker:text-gray-300">
                        <li>12.5% YoY Growth applied</li>
                        <li>Q3 Seasonal adjustment</li>
                      </ul>
                    </div>
                    <div className="pt-4 border-t border-gray-100 mt-4">
                      <Button variant="outline" className="w-full text-xs h-8 text-gray-700" data-testid="button-edit-row">
                        Edit Row Configuration
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Info className="w-6 h-6 mx-auto text-gray-300 mb-2" />
                  <p className="text-[12px]">Select a row in the table to view line details and assumptions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </BudgetLayout>
  );
}
