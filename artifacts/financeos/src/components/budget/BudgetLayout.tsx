import type { ReactNode } from "react";
import { BudgetSidebar } from "@/components/budget/BudgetSidebar";
import { BudgetTabs } from "@/components/budget/BudgetTabs";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type BudgetLayoutProps = {
  title: string;
  subtitle: string;
  showTabs?: boolean;
  children: ReactNode;
};

export function BudgetLayout({ title, subtitle, showTabs = false, children }: BudgetLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden font-sans">
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <div
        className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto transition-transform duration-200 ease-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <BudgetSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50">
        <GlobalHeader onMenuToggle={() => setSidebarOpen(v => !v)} />

        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-1 h-7 rounded-full flex-shrink-0 bg-emerald-500"
              />
              <div>
                <h1 className="text-[18px] font-bold text-gray-900 leading-tight">{title}</h1>
                <p className="text-[11px] text-gray-400">{subtitle}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-[140px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  <SelectItem value="cardealer">CarDealer.ai</SelectItem>
                  <SelectItem value="t3">T3 Marketing</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="fy26">
                <SelectTrigger className="w-[180px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue placeholder="FY2026" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fy26">FY2026 (Jul 26 - Jun 27)</SelectItem>
                  <SelectItem value="fy25">FY2025 (Jul 25 - Jun 26)</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" className="h-8 w-8 border-gray-200">
                <MoreHorizontal className="h-4 w-4 text-gray-500" />
              </Button>

              <Button className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium px-3 text-xs shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                New Budget
              </Button>
            </div>
          </div>
        </div>

        {showTabs && (
          <div className="bg-white border-b border-gray-200 px-4 sm:px-6">
            <BudgetTabs />
          </div>
        )}

        <div className="p-4 sm:p-6 w-full space-y-6">{children}</div>
      </main>
    </div>
  );
}
