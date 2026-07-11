import { useState } from "react";
import { useParams } from "wouter";
import NotFound from "@/pages/not-found";
import { ENTITY_SLUGS, ENTITY_CONFIG, type EntitySlug } from "@/lib/entities";
import { useEntityBanking } from "@/hooks/useApi";
import { PageHeader } from "@/components/shared/PageHeader";
import type { BankAccount } from "@/lib/types";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronRight, Info, Archive } from "lucide-react";
import { formatCurrency } from "@/lib/format";


export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}

const fmt = (n: number) => formatCurrency(n);

const DAY_MS = 86_400_000;
const INACTIVE_DAYS = 180;
type Category = "active" | "inactive" | "dead";

function accountMeta(acct: BankAccount): string {
  const suffix = acct.last_four ? ` ···${acct.last_four}` : "";
  return `${acct.account_type}${suffix}`;
}

export default function BankingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [showAll, setShowAll] = useState(false);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  if (!slug || !ENTITY_SLUGS.includes(slug as EntitySlug)) return <NotFound />;
  const eSlug = slug as EntitySlug;
  const { data: bank, source } = useEntityBanking(eSlug);
  const entityColor = ENTITY_CONFIG[eSlug].color;
  if (!bank) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-gray-400">
        {source === "loading" ? "Loading…" : "Data unavailable"}
      </div>
    );
  }

  const statusConfig = {
    clean:       { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "All Reconciled", sub: "No unreconciled items" },
    pending:     { icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   label: "Reconciliation Pending", sub: `${bank.unreconciled_count} items pending review` },
    needs_review:{ icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   label: "Needs Review",  sub: `${bank.unreconciled_count} unreconciled item${bank.unreconciled_count !== 1 ? "s" : ""}` },
  };
  const sc = statusConfig[bank.reconciliation_status];
  const StatusIcon = sc.icon;

  // Reference point for the "recent activity" window. Uses the reported as-of
  // date so the view is stable regardless of when it's rendered.
  const refMs = (() => {
    const d = new Date(bank.as_of);
    return isNaN(d.getTime()) ? Date.now() : d.getTime();
  })();

  const categorize = (a: BankAccount): Category => {
    // Legacy / mock payloads carry no activity stats — show everything rather
    // than hide accounts we can't classify.
    if (a.transaction_count === undefined) return "active";
    // Seed-only / placeholder accounts: no transactions at all (regardless of
    // any placeholder balance).
    if (a.transaction_count === 0) return "dead";
    const last = a.last_transaction_date ? new Date(a.last_transaction_date) : null;
    if (!last || isNaN(last.getTime())) return "inactive";
    const in2026 = last.getFullYear() >= 2026;
    const withinWindow = refMs - last.getTime() <= INACTIVE_DAYS * DAY_MS;
    return in2026 && withinWindow ? "active" : "inactive";
  };

  const byBalance = (a: BankAccount, b: BankAccount) => b.balance - a.balance;
  const active = bank.accounts.filter((a) => categorize(a) === "active").sort(byBalance);
  const inactive = bank.accounts.filter((a) => categorize(a) === "inactive").sort(byBalance);
  const dead = bank.accounts.filter((a) => categorize(a) === "dead").sort(byBalance);

  const inactiveNet = inactive.reduce((sum, a) => sum + a.balance, 0);
  const showSmileNote = eSlug === "Smile_More" && inactive.length > 0 && inactiveNet < 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <PageHeader entitySlug={eSlug} pageTitle="Banking" asOf={bank.as_of} />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5">

        {/* Reconciliation banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${sc.bg} ${sc.border}`}>
          <StatusIcon className={`w-5 h-5 flex-shrink-0 ${sc.color}`} />
          <div>
            <p className={`text-[13px] font-semibold ${sc.color}`}>{sc.label}</p>
            <p className="text-[11px] text-gray-500">{sc.sub} · Last reconciled: {bank.accounts.find(a => a.reconciled)?.last_reconciled || "—"}</p>
          </div>
          <div className="ml-auto">
            <span className="text-[11px] font-semibold text-gray-600">Total Cash: <span className="text-gray-900">{fmt(bank.total_cash)}</span></span>
          </div>
        </div>

        {/* Smile More legacy-accounts explanation */}
        {showSmileNote && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-gray-200 bg-white">
            <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Legacy inactive accounts (closed Truist and Chase card balances) carry a
              combined balance of {fmt(inactiveNet)} and account for the negative cash and
              equity position. These accounts remain on the books for historical continuity
              but have had no recent activity — see “Inactive accounts” below.
            </p>
          </div>
        )}

        {/* Active account cards */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              Active Accounts{active.length > 0 ? ` (${active.length})` : ""}
            </h3>
            {dead.length > 0 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-[11px] font-medium text-gray-500 hover:text-gray-800 transition-colors"
              >
                {showAll ? "Hide dormant accounts" : `Show all accounts (${dead.length} hidden)`}
              </button>
            )}
          </div>
          {active.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-6 text-center text-[12px] text-gray-400">
              No active accounts.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {active.map((acct) => <AccountCard key={acct.id} acct={acct} />)}
            </div>
          )}
        </div>

        {/* Dormant / placeholder accounts (hidden by default) */}
        {showAll && dead.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <Archive className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Dormant / Placeholder Accounts ({dead.length})
              </h3>
            </div>
            <p className="text-[11px] text-gray-400 mb-2.5">
              No transaction history. Hidden from the active view — kept on file, not deleted.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dead.map((acct) => <AccountCard key={acct.id} acct={acct} muted />)}
            </div>
          </div>
        )}

        {/* Inactive accounts (collapsed) */}
        {inactive.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              onClick={() => setInactiveOpen((v) => !v)}
              className="w-full px-4 py-3 flex items-center gap-2 hover:bg-gray-50 transition-colors"
            >
              {inactiveOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <div className="text-left">
                <p className="text-[13px] font-semibold text-gray-900">Inactive accounts ({inactive.length})</p>
                <p className="text-[10px] text-gray-400">No activity in 2026 or in the last {INACTIVE_DAYS} days — hidden from the active view.</p>
              </div>
              <span className="ml-auto text-[11px] font-semibold text-gray-600">
                {fmt(inactiveNet)}
              </span>
            </button>
            {inactiveOpen && (
              <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactive.map((acct) => <AccountCard key={acct.id} acct={acct} muted />)}
              </div>
            )}
          </div>
        )}

        {/* Transactions */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold text-gray-900">Recent Transactions</h3>
            <span className="text-[10px] text-gray-400">{bank.transactions.length} shown</span>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Reconciled</th>
              </tr>
            </thead>
            <tbody>
              {bank.transactions.map((tx) => (
                <tr key={tx.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">{tx.date}</td>
                  <td className="px-4 py-2.5 text-[12px] text-gray-800 max-w-[280px] truncate">{tx.description}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{tx.category}</span>
                  </td>
                  <td className={`px-4 py-2.5 text-right text-[12px] font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                    {tx.amount >= 0 ? "+" : ""}{fmt(tx.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {tx.reconciled ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-amber-500 ml-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AccountCard({ acct, muted = false }: { acct: BankAccount; muted?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 overflow-hidden ${muted ? "opacity-70" : ""}`}>
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[13px] font-bold"
          style={{ background: acct.color || "#94A3B8" }}
        >
          {acct.institution.charAt(0)}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-gray-900 truncate">{acct.name}</p>
          <p className="text-[10px] text-gray-400">{accountMeta(acct)}</p>
        </div>
        {acct.reconciled ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 ml-auto" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 ml-auto" />
        )}
      </div>
      <div className="px-4 pb-4">
        <p className="text-[22px] font-bold text-gray-900">{fmt(acct.balance)}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {acct.last_transaction_date
            ? `Last activity ${acct.last_transaction_date}`
            : "No transaction history"}
        </p>
      </div>
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
        <p className="text-[10px] text-gray-400">{acct.institution}</p>
      </div>
    </div>
  );
}
