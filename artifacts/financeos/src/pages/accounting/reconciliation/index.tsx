import { Scale, CheckCircle2, AlertTriangle, Building2, XCircle } from "lucide-react";
import Link from "@/lib/next-compat";
import { usePathname } from "@/lib/next-compat";
import { ENTITY_CONFIG } from "@/lib/entities";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useEntityBanking } from "@/hooks/useApi";
import { EntityPicker } from "@/components/accounting/EntityPicker";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

const STATUS_CONFIG = {
  clean:        { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "All Reconciled",   sub: "All transactions matched." },
  pending:      { icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   label: "Pending Review",    sub: "Some transactions are pending reconciliation." },
  needs_review: { icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   label: "Needs Review",      sub: "Unreconciled transactions require attention." },
};

const SUB_NAV = [
  { label: "Overview",     href: "/accounting/reconciliation" },
  { label: "Accounts",     href: "/accounting/reconciliation/accounts" },
  { label: "Match Center", href: "/accounting/reconciliation/match-center" },
];

export default function ReconciliationPage() {
  const { activeSlug, setActiveSlug } = useAccountingEntity();
  const { data: bank, source } = useEntityBanking(activeSlug);
  const cfg = ENTITY_CONFIG[activeSlug];
  const pathname = usePathname();

  const reconciledTx   = bank?.transactions.filter((t) => t.reconciled).length ?? 0;
  const unreconciledTx = bank?.transactions.filter((t) => !t.reconciled).length ?? 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <Scale className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Reconciliation</h1>
              <p className="text-[11px] text-gray-400">
                {bank ? `${cfg.name} · ${cfg.basis} basis · As of ${bank.as_of}` : "Select an entity"}
              </p>
            </div>
          </div>
          <EntityPicker activeSlug={activeSlug} onChange={setActiveSlug} />
        </div>
        <div className="flex items-center gap-1">
          {SUB_NAV.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  isActive ? "bg-violet-50 text-violet-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {!bank ? (
        <div className="flex-1 flex items-center justify-center text-[13px] text-gray-400">
          {source === "loading" ? "Loading…" : "Data unavailable"}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Status banner */}
          {(() => {
            const sc = STATUS_CONFIG[bank.reconciliation_status];
            const StatusIcon = sc.icon;
            return (
              <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${sc.bg} ${sc.border}`}>
                <StatusIcon className={`w-6 h-6 flex-shrink-0 ${sc.color}`} />
                <div>
                  <p className={`text-[14px] font-bold ${sc.color}`}>{sc.label}</p>
                  <p className="text-[12px] text-gray-500">{sc.sub}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[11px] text-gray-500">Total Cash</p>
                  <p className="text-[18px] font-bold text-gray-900">{fmt(bank.total_cash)}</p>
                </div>
              </div>
            );
          })()}

          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Bank Accounts",       value: String(bank.accounts.length),   sub: "active",        color: "text-gray-900" },
              { label: "Total Transactions",  value: String(bank.transactions.length), sub: "loaded",      color: "text-gray-900" },
              { label: "Reconciled",          value: String(reconciledTx),   sub: "matched",               color: "text-emerald-600" },
              { label: "Unreconciled",        value: String(unreconciledTx), sub: bank.unreconciled_count !== unreconciledTx ? `${bank.unreconciled_count} per Neon` : "need review", color: unreconciledTx > 0 ? "text-amber-600" : "text-emerald-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-[22px] font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* Account reconciliation summary */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-gray-400" />
                <h3 className="text-[13px] font-semibold text-gray-900">Accounts</h3>
              </div>
              <Link href="/accounting/reconciliation/accounts" className="text-[10px] text-violet-600 hover:text-violet-700 font-medium">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {bank.accounts.map((acct) => (
                <div key={acct.id} className="px-4 py-3 flex items-center gap-3">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
                    style={{ background: cfg.color }}
                  >
                    {acct.institution.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 truncate">{acct.name}</p>
                    <p className="text-[10px] text-gray-400">{acct.account_type}</p>
                  </div>
                  <p className="text-[13px] font-semibold text-gray-900">{fmt(acct.balance)}</p>
                  {acct.reconciled
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  }
                </div>
              ))}
              {bank.accounts.length === 0 && (
                <p className="px-4 py-6 text-[12px] text-gray-400 text-center">No bank accounts loaded.</p>
              )}
            </div>
          </div>

          {/* Quick link to match center */}
          {unreconciledTx > 0 && (
            <div className="flex items-center justify-between px-5 py-4 bg-white rounded-xl border border-gray-200">
              <div>
                <p className="text-[13px] font-semibold text-gray-900">{unreconciledTx} unreconciled transaction{unreconciledTx !== 1 ? "s" : ""} need matching</p>
                <p className="text-[11px] text-gray-400">Review and match them in the Match Center.</p>
              </div>
              <Link
                href="/accounting/reconciliation/match-center"
                className="px-4 py-2 rounded-lg bg-violet-600 text-white text-[12px] font-semibold hover:bg-violet-700 transition-colors flex-shrink-0"
              >
                Open Match Center
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
