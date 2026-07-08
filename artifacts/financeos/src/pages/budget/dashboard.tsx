import { useState } from "react";
import { BudgetSidebar } from "@/components/budget/BudgetSidebar";
import { BudgetKpiCard } from "@/components/budget/BudgetKpiCard";
import { BudgetVsPriorYearChart } from "@/components/budget/BudgetVsPriorYearChart";
import { BudgetCategoryChart } from "@/components/budget/BudgetCategoryChart";
import { BudgetTable } from "@/components/budget/BudgetTable";
import { BudgetSummaryCard } from "@/components/budget/BudgetSummaryCard";
import { RecentActivityCard } from "@/components/budget/RecentActivityCard";
import { BUDGET_KPIS } from "@/lib/budgetMockData";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Plus } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { BudgetTabs } from "@/components/budget/BudgetTabs";

export default function BudgetDashboardPage() {
  const [activeTab, setActiveTab] = useState("summary");

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <BudgetSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <header className="bg-white border-b border-slate-200 px-8 py-5 shrink-0 sticky top-0 z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Budget Overview</h1>
              <p className="text-sm text-slate-500 mt-1">Plan, track and manage your budgets</p>
            </div>
            <div className="flex items-center gap-3">
              <Select defaultValue="all">
                <SelectTrigger className="w-[160px] h-9 text-sm font-medium bg-slate-50 border-slate-200">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  <SelectItem value="cardealer">CarDealer.ai</SelectItem>
                  <SelectItem value="t3">T3 Marketing</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="fy26">
                <SelectTrigger className="w-[200px] h-9 text-sm font-medium bg-slate-50 border-slate-200">
                  <SelectValue placeholder="FY2026" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fy26">FY2026 (Jul 26 - Jun 27)</SelectItem>
                  <SelectItem value="fy25">FY2025 (Jul 25 - Jun 26)</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" className="h-9 w-9">
                <MoreHorizontal className="h-4 w-4" />
              </Button>

              <Button className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium px-4">
                <Plus className="h-4 w-4" />
                New Budget
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <BudgetTabs />
          </div>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto w-full space-y-6">
          <TabsContent value="summary" className="m-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {BUDGET_KPIS.map((kpi, idx) => (
                <BudgetKpiCard key={idx} {...kpi} type={kpi.type as any} />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <BudgetVsPriorYearChart />
              </div>
              <div className="lg:col-span-1">
                <BudgetCategoryChart />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3">
                <BudgetTable />
              </div>
              <div className="lg:col-span-1 space-y-6">
                <BudgetSummaryCard />
                <RecentActivityCard />
              </div>
            </div>
          </TabsContent>

          {/* Placeholders for other tabs */}
          <TabsContent value="pl" className="m-0">
             <div className="p-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200 border-dashed">
                P&L Detail View Placeholder
             </div>
          </TabsContent>
          <TabsContent value="cashflow" className="m-0">
            <div className="p-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200 border-dashed">
                Cash Flow Detail View Placeholder
             </div>
          </TabsContent>
          <TabsContent value="balancesheet" className="m-0">
            <div className="p-12 text-center text-slate-500 bg-white rounded-lg border border-slate-200 border-dashed">
                Balance Sheet Detail View Placeholder
             </div>
          </TabsContent>
        </div>
        </Tabs>
      </main>
    </div>
  );
}
