import { useState } from "react";
import { BudgetLayout } from "@/components/budget/BudgetLayout";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Select defaultValue="all">
            <SelectTrigger className="w-[180px] bg-white h-9 text-sm" data-testid="filter-department">
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
            <SelectTrigger className="w-[180px] bg-white h-9 text-sm" data-testid="filter-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="opex">OpEx</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9 gap-2 bg-white" data-testid="button-apply-growth">
            <Filter className="w-4 h-4" /> Apply Growth %
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-9 gap-2 bg-white" data-testid="button-import-actuals">
            <Upload className="w-4 h-4" /> Import from Actuals
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 bg-white" data-testid="button-save-draft">
            <Save className="w-4 h-4" /> Save Draft
          </Button>
          <Button size="sm" className="h-9 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-submit-approval">
            <CheckCircle className="w-4 h-4" /> Submit for Approval
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-0">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-sm text-left whitespace-nowrap" data-testid="table-budget-builder">
                  <thead className="text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-medium sticky left-0 bg-slate-50 z-10 w-[200px] border-r border-slate-200">Account / Category</th>
                      <th className="px-4 py-3 font-medium text-right bg-emerald-50 text-emerald-800 border-r border-slate-200">FY Total</th>
                      {months.map(month => (
                        <th key={month} className="px-4 py-3 font-medium text-right min-w-[100px]">{month}</th>
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
                          className={`border-b border-slate-100 cursor-pointer transition-colors ${isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50'} ${row.isBold ? 'bg-slate-50/30' : ''}`}
                        >
                          <td className={`px-6 py-3 sticky left-0 z-10 border-r border-slate-200 ${isSelected ? 'bg-emerald-50/50' : 'bg-white group-hover:bg-slate-50'} ${row.isBold ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                            {row.category}
                          </td>
                          <td className={`px-4 py-3 text-right border-r border-slate-200 ${row.isBold ? 'font-semibold text-emerald-800' : 'font-medium text-emerald-700'}`}>
                            {formatCurrency(row.total)}
                          </td>
                          {months.map(month => (
                            <td key={month} className={`px-4 py-3 text-right ${row.isBold ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                              {formatCurrency(row.months[month as keyof typeof row.months])}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="xl:col-span-1 space-y-6">
          <Card className="shadow-sm border-slate-200 sticky top-28">
            <CardContent className="p-6">
              {selectedRow ? (
                <>
                  <div className="flex items-center gap-2 mb-4">
                    <Info className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-semibold text-slate-900">{selectedRow} Details</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Calculation Method</p>
                      <p className="text-sm font-medium text-slate-900">Historical Average + Growth</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Assumptions</p>
                      <ul className="text-sm text-slate-700 space-y-1 list-disc pl-4">
                        <li>12.5% YoY Growth applied</li>
                        <li>Q3 Seasonal adjustment</li>
                      </ul>
                    </div>
                    <div className="pt-4 border-t border-slate-100">
                      <Button variant="outline" className="w-full text-sm h-8" data-testid="button-edit-row">
                        Edit Row Configuration
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <Info className="w-8 h-8 mx-auto text-slate-300 mb-3" />
                  <p className="text-sm">Select a row in the table to view line details and assumptions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </BudgetLayout>
  );
}
