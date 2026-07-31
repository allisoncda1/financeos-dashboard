import type { ReactNode } from "react";
import { CommissionSidebar } from "@/components/commission/CommissionSidebar";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanySelectItems } from "@/components/shared/CompanySelectItems";
import { useCommissionEntity } from "@/lib/commission-context";
import type { EntitySlug } from "@/lib/entities";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

type CommissionLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function CommissionLayout({ title, subtitle, children }: CommissionLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeSlug, setActiveSlug } = useCommissionEntity();

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
        <CommissionSidebar onClose={() => setSidebarOpen(false)} />
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
              <Select
                value={activeSlug}
                onValueChange={(v) => setActiveSlug(v as EntitySlug)}
                data-testid="commission-entity-select"
              >
                <SelectTrigger className="w-[150px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <CompanySelectItems includeAll={false} />
                </SelectContent>
              </Select>

              <Select disabled>
                <SelectTrigger
                  className="w-[130px] h-8 text-xs font-medium bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                  title="Period selection not yet implemented"
                >
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
              </Select>

              <button
                data-testid="button-calculate-commissions"
                disabled
                title="Use Import Invoices and Rule Builder to calculate commissions."
                className="flex items-center gap-2 px-4 h-8 bg-gray-300 text-gray-500 rounded-lg shadow-sm text-[12px] font-semibold cursor-not-allowed"
              >
                <Zap className="w-3.5 h-3.5" />
                Calculate Commissions
              </button>
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
