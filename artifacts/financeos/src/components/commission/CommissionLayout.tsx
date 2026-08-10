import type { ReactNode } from "react";
import { CommissionSidebar } from "@/components/commission/CommissionSidebar";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanySelectItems } from "@/components/shared/CompanySelectItems";
import { useCommissionEntity } from "@/lib/commission-context";
import type { EntitySlug } from "@/lib/entities";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

// Build last 12 months as options
function buildMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    const value = `${year}-${String(month).padStart(2, "0")}`;
    options.push({ value, label });
  }
  return options;
}
const MONTH_OPTIONS = buildMonthOptions();

type CommissionLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function CommissionLayout({ title, subtitle, children }: CommissionLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { activeSlug, setActiveSlug } = useCommissionEntity();
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0].value);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const toDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      const res = await api.ingestCommissions(activeSlug, { fromDate, toDate }) as { data: { processed: number; created: number; updated: number } };
      const d = res.data;
      setSyncResult(`Done — ${d.processed} processed, ${d.created} created, ${d.updated} updated`);
      window.location.reload();
    } catch {
      setSyncResult("Sync failed — check console");
    } finally {
      setSyncing(false);
    }
  }

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

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px] h-8 text-xs font-medium bg-white border-gray-200 shadow-sm focus:ring-emerald-500 focus:border-emerald-500">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                data-testid="button-sync-invoices"
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-2 px-4 h-8 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg shadow-sm text-[12px] font-semibold transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync Invoices"}
              </button>

              {syncResult && (
                <span className="text-[11px] text-emerald-700 font-medium">{syncResult}</span>
              )}
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
