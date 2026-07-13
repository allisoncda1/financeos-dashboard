import type { ReactNode } from "react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AnalyticsSidebar } from "@/components/analytics/AnalyticsSidebar";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CompanySelectItems } from "@/components/shared/CompanySelectItems";
import { MoreHorizontal, Plus } from "lucide-react";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import { ALLOCATION_SCENARIOS, ANALYTICS_DATA_LABEL } from "@/lib/analyticsDemoData";
import type {
  AccountingBasis,
  AllocationScenarioId,
  AnalyticsEntityFilter,
} from "@/lib/analyticsTypes";

type AnalyticsLayoutProps = {
  title: string;
  subtitle: string;
  /** Hide the scenario / basis selectors on pages where they are irrelevant */
  showScenario?: boolean;
  showBasis?: boolean;
  actions?: ReactNode;
  children: ReactNode;
};

export function AnalyticsLayout({
  title,
  subtitle,
  showScenario = true,
  showBasis = true,
  actions,
  children,
}: AnalyticsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { entity, setEntity, period, setPeriod, basis, setBasis, scenario, setScenario } =
    useAnalyticsFilters();

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
        <AnalyticsSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50">
        <GlobalHeader onMenuToggle={() => setSidebarOpen(v => !v)} />

        <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 rounded-full flex-shrink-0 bg-indigo-500" />
              <div>
                <h1 className="text-[18px] font-bold text-gray-900 leading-tight">{title}</h1>
                <p className="text-[11px] text-gray-400">{subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Select value={entity} onValueChange={(v) => setEntity(v as AnalyticsEntityFilter)}>
                <SelectTrigger
                  className="w-[160px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  data-testid="select-analytics-entity"
                >
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consolidated">Consolidated</SelectItem>
                  <CompanySelectItems includeAll={false} />
                </SelectContent>
              </Select>

              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger
                  className="w-[168px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  data-testid="select-analytics-period"
                >
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fy26">FY2026 (Jul 26 - Jun 27)</SelectItem>
                  <SelectItem value="fy25">FY2025 (Jul 25 - Jun 26)</SelectItem>
                  <SelectItem value="q4-fy25">Q4 FY2025</SelectItem>
                  <SelectItem value="jun-26">June 2026</SelectItem>
                </SelectContent>
              </Select>

              {showBasis && (
                <Select value={basis} onValueChange={(v) => setBasis(v as AccountingBasis)}>
                  <SelectTrigger
                    className="w-[110px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    data-testid="select-analytics-basis"
                  >
                    <SelectValue placeholder="Basis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accrual">Accrual</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              )}

              {showScenario && (
                <Select value={scenario} onValueChange={(v) => setScenario(v as AllocationScenarioId)}>
                  <SelectTrigger
                    className="w-[180px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    data-testid="select-analytics-scenario"
                  >
                    <SelectValue placeholder="Scenario" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOCATION_SCENARIOS.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button variant="outline" size="icon" className="h-8 w-8 border-gray-200" data-testid="button-analytics-more">
                <MoreHorizontal className="h-4 w-4 text-gray-500" />
              </Button>

              {actions ?? (
                <Button
                  className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-medium px-3 text-xs shadow-sm"
                  data-testid="button-new-allocation"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Allocation
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 pt-3">
          <p className="text-[10px] text-gray-400 font-medium inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-full px-2.5 py-1">
            {ANALYTICS_DATA_LABEL}
          </p>
        </div>

        <div className="p-4 sm:p-6 w-full space-y-6">{children}</div>
      </main>
    </div>
  );
}
