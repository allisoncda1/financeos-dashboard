import { BookOpen, CheckCircle2, AlertTriangle, Building2, CreditCard } from "lucide-react";
import Link from "@/lib/next-compat";
import { ENTITY_CONFIG } from "@/lib/entities";
import { useEntityBanking } from "@/hooks/useApi";
import { EntityPicker } from "@/components/accounting/EntityPicker";
import { TransactionTable } from "@/components/accounting/TransactionTable";
import { useAccountingEntity } from "@/lib/accounting-context";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const STATUS_CONFIG = {
  clean:        { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "All Reconciled" },
  pending:      { icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   label: "Pending" },
  needs_review: { icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   label: "Needs Review" },
};

export default function AccountingOverviewPage() {
  const { activeSlug, setActiveSlug } = useAccountingEntity();
  const { data: bank, source } = useEntityBanking(activeSlug);
  const cfg = ENTITY_CONFIG[activeSlug];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Accounting</h1>
              <p className="text-[11px] text-gray-400">
                {bank ? `${cfg.name} · ${cfg.basis} basis · As of ${bank.as_of}` : "Select an entity"}
              </p>
            </div>
          </div>
          <EntityPicker activeSlug={activeSlug} onChange={setActiveSlug} />
        </div>
      </div>

      {!bank ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-gray-400">
          {source === "loading" ? "Loading…" : "Data unavailable"}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Cash", value: fmt(bank.total_cash), sub: `${bank.accounts.length} bank accounts`, color: "text-gray-900" },
              { label: "Bank Accounts", value: String(bank.accounts.length), sub: "active accounts", color: "text-gray-900" },
              { label: "Transactions", value: String(bank.transactions.length), sub: "loaded", color: "text-gray-900" },
              {
                label: "Unreconciled",
                value: String(bank.unreconciled_count),
                sub: bank.reconciliation_status === "clean" ? "all clear" : "need review",
                color: bank.unreconciled_count > 0 ? "text-amber-600" : "text-emerald-600",
              },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-[22px] font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Reconciliation status */}
          {(() => {
            const sc = STATUS_CONFIG[bank.reconciliation_status];
            const StatusIcon = sc.icon;
            return (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${sc.bg} ${sc.border}`}>
                <StatusIcon className={`w-5 h-5 flex-shrink-0 ${sc.color}`} />
                <div>
                  <p className={`text-[13px] font-semibold ${sc.color}`}>{sc.label}</p>
                  <p className="text-[11px] text-gray-500">
                    {bank.unreconciled_count === 0
                      ? "All transactions reconciled"
                      : `${bank.unreconciled_count} unreconciled transaction${bank.unreconciled_count !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <Link href="/accounting/transactions" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                    View transactions →
                  </Link>
                  <Link href="/accounting/reconciliation" className="text-[11px] font-semibold text-blue-600 hover:text-blue-700">
                    Reconciliation →
                  </Link>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-5">
            {/* Bank accounts */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  <h3 className="text-[13px] font-semibold text-gray-900">Bank Accounts</h3>
                </div>
                <Link href="/accounting/reconciliation/accounts" className="text-[10px] text-blue-600 hover:text-blue-700 font-medium">
                  View all
                </Link>
              </div>
              <div className="divide-y divide-gray-50">
                {bank.accounts.slice(0, 5).map((acct) => (
                  <div key={acct.id} className="px-4 py-3 flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                      style={{ background: cfg.color }}
                    >
                      {acct.institution.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-800 truncate">{acct.name}</p>
                      <p className="text-[10px] text-gray-400">{acct.account_type}{acct.last_four ? ` ···${acct.last_four}` : ""}</p>
                    </div>
                    <p className="text-[13px] font-semibold text-gray-900 flex-shrink-0">{fmt(acct.balance)}</p>
                  </div>
                ))}
                {bank.accounts.length === 0 && (
                  <p className="px-4 py-6 text-[12px] text-gray-400 text-center">No bank accounts loaded.</p>
                )}
              </div>
            </div>

            {/* Recent transactions */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                  <h3 className="text-[13px] font-semibold text-gray-900">Recent Transactions</h3>
                </div>
                <Link href="/accounting/transactions" className="text-[10px] text-blue-600 hover:text-blue-700 font-medium">
                  View all
                </Link>
              </div>
              <TransactionTable transactions={bank.transactions.slice(0, 8)} emptyLabel="No transactions loaded." />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
