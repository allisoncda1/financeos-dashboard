import type { ReactNode } from "react";
import { ForecastSidebar } from "@/components/forecast/ForecastSidebar";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanySelectItems } from "@/components/shared/CompanySelectItems";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Clock } from "lucide-react";

type ForecastLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function ForecastLayout({ title, subtitle, children }: ForecastLayoutProps) {
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
        <ForecastSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50">
        <GlobalHeader onMenuToggle={() => setSidebarOpen(v => !v)} />

        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 rounded-full flex-shrink-0 bg-emerald-500" />
              <div>
                <h1 className="text-[18px] font-bold text-gray-900 leading-tight">{title}</h1>
                <p className="text-[11px] text-gray-400">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Select defaultValue="all">
                <SelectTrigger className="w-[150px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <CompanySelectItems />
                </SelectContent>
              </Select>

              <Select defaultValue="fy26">
                <SelectTrigger className="w-[190px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue placeholder="FY2026 (Jul 25 - Jun 26)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fy26">FY2026 (Jul 25 - Jun 26)</SelectItem>
                  <SelectItem value="fy25">FY2025 (Jul 24 - Jun 25)</SelectItem>
                </SelectContent>
              </Select>

              <button
                data-testid="button-update-forecast"
                className="flex items-center gap-2 px-4 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors text-[12px] font-semibold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Update Forecast
              </button>

              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <Clock className="w-3 h-3" />
                <span>
                  Last updated
                  <br />
                  <span className="font-medium text-gray-500">Today at 9:02 AM</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 w-full space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
