import { useState, useMemo, Fragment } from "react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { AnalyticsKpiCard } from "@/components/analytics/AnalyticsKpiCard";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Layers, PieChart, AlertTriangle, CheckCircle2, ChevronRight, ChevronDown, Search } from "lucide-react";
import { useAnalyticsFilters } from "@/lib/analytics-context";
import {
  SHARED_EXPENSES,
  sharedExpenseTotals,
  getRule,
  fmtMoney,
  fmtMoneyFull,
  fmtPct,
} from "@/lib/analyticsDemoData";
import { ENTITY_CONFIG } from "@/lib/entities";
import type { AllocationStatus, CostCategory } from "@/lib/analyticsTypes";

const STATUS_STYLE: Record<AllocationStatus, string> = {
  "Unreviewed": "bg-red-50 text-red-600",
  "Rule Suggested": "bg-amber-50 text-amber-700",
  "Draft": "bg-blue-50 text-blue-700",
  "Approved": "bg-emerald-50 text-emerald-700",
  "Partially Allocated": "bg-orange-50 text-orange-700",
  "Fully Allocated": "bg-emerald-50 text-emerald-700",
  "Excluded": "bg-gray-100 text-gray-500",
};

const STATUSES: AllocationStatus[] = [
  "Unreviewed", "Rule Suggested", "Draft", "Approved", "Partially Allocated", "Fully Allocated", "Excluded",
];

const CATEGORIES: CostCategory[] = [
  "Finance", "Executive", "Technology", "Software", "Human Resources",
  "Marketing", "Operations", "Insurance", "Professional Services", "General Administration",
];

export default function SharedExpensesPage() {
  const { entity } = useAnalyticsFilters();
  const totals = sharedExpenseTotals(entity);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return SHARED_EXPENSES.filter((e) => {
      if (entity !== "consolidated" && e.payingEntity !== entity) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (categoryFilter !== "all" && e.costCategory !== categoryFilter) return false;
      if (q && !(
        e.vendorOrEmployee.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.originalAccount.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [entity, statusFilter, categoryFilter, search]);

  return (
    <AnalyticsLayout
      title="Shared Expenses"
      subtitle="Expenses paid by one entity but consumed by several."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AnalyticsKpiCard title="Total Shared Costs" value={fmtMoney(totals.total)} icon={Layers} iconBg="#6366F1" vs={`${totals.countTotal} expenses`} />
        <AnalyticsKpiCard title="Allocated" value={fmtMoney(totals.allocated)} icon={CheckCircle2} iconBg="#10B981" vs={`${totals.countFullyAllocated} fully allocated`} />
        <AnalyticsKpiCard title="Unallocated" value={fmtMoney(totals.unallocated)} icon={AlertTriangle} iconBg="#F59E0B" vs={`${totals.countUnallocated} need review`} />
        <AnalyticsKpiCard title="Coverage" value={fmtPct(totals.coveragePct)} icon={PieChart} iconBg="#8b5cf6" vs="of allocable costs" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendor, description, account…"
            className="h-8 pl-8 text-xs"
            data-testid="input-search-expenses"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[190px] h-8 text-xs" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[190px] h-8 text-xs" data-testid="select-category-filter">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Shared Expense Register</h3>
          <span className="text-[11px] text-gray-400">{rows.length} of {SHARED_EXPENSES.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap" data-testid="table-shared-expenses">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                <th className="px-4 py-2.5 w-6" />
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-left px-4 py-2.5">Vendor / Employee</th>
                <th className="text-left px-4 py-2.5">Description</th>
                <th className="text-left px-4 py-2.5">Paying Entity</th>
                <th className="text-left px-4 py-2.5">Account</th>
                <th className="text-right px-4 py-2.5">Amount</th>
                <th className="text-left px-4 py-2.5">Category</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-right px-4 py-2.5">Allocated</th>
                <th className="text-left px-4 py-2.5">Rule</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-6 text-center text-gray-400 text-sm">No expenses match your filters.</td></tr>
              )}
              {rows.map((e) => {
                const cfg = ENTITY_CONFIG[e.payingEntity];
                const rule = getRule(e.ruleId);
                const isOpen = expanded === e.id;
                return (
                  <Fragment key={e.id}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : e.id)}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                      data-testid={`row-expense-${e.id}`}
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{e.date}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{e.vendorOrEmployee}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[260px] truncate">{e.description}</td>
                      <td className="px-4 py-3 font-medium" style={{ color: cfg?.color }}>{cfg?.name ?? e.payingEntity}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{e.originalAccount}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtMoney(e.amount)}</td>
                      <td className="px-4 py-3 text-gray-600">{e.costCategory}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtMoney(e.allocatedAmount)}</td>
                      <td className="px-4 py-3 text-gray-600">{rule?.name ?? <span className="text-gray-300">—</span>}</td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <td />
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                            <div>
                              <p className="text-gray-400 uppercase tracking-wide font-semibold text-[10px] mb-1">Source System</p>
                              <p className="text-gray-700">{e.sourceSystem}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 uppercase tracking-wide font-semibold text-[10px] mb-1">Remaining</p>
                              <p className="text-gray-700">{fmtMoneyFull(e.amount - e.allocatedAmount)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 uppercase tracking-wide font-semibold text-[10px] mb-1">Matched Rule</p>
                              <p className="text-gray-700">{rule?.name ?? "None"}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 uppercase tracking-wide font-semibold text-[10px] mb-1">Allocated Amount</p>
                              <p className="text-gray-700">{fmtMoneyFull(e.allocatedAmount)}</p>
                            </div>
                            <div className="sm:col-span-2 lg:col-span-4">
                              <p className="text-gray-400 uppercase tracking-wide font-semibold text-[10px] mb-1">Notes</p>
                              <p className="text-gray-700">{e.notes || <span className="text-gray-400">No notes.</span>}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AnalyticsLayout>
  );
}
