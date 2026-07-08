import type { ReactNode } from "react";
import { BudgetSidebar } from "@/components/budget/BudgetSidebar";
import { BudgetTabs } from "@/components/budget/BudgetTabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Plus } from "lucide-react";

type BudgetLayoutProps = {
  title: string;
  subtitle: string;
  showTabs?: boolean;
  children: ReactNode;
};

export function BudgetLayout({ title, subtitle, showTabs = false, children }: BudgetLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      <BudgetSidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-8 py-5 shrink-0 sticky top-0 z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
              <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
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

          {showTabs && (
            <div className="mt-6">
              <BudgetTabs />
            </div>
          )}
        </header>

        <div className="p-8 max-w-[1600px] mx-auto w-full space-y-6">{children}</div>
      </main>
    </div>
  );
}
