import { useParams } from "wouter";
import NotFound from "@/pages/not-found";
import { ENTITY_SLUGS, type EntitySlug } from "@/lib/entities";
import { useEntityBanking } from "@/hooks/useApi";
import { PageHeader } from "@/components/shared/PageHeader";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";


export function generateStaticParams() {
  return ENTITY_SLUGS.map((slug) => ({ slug }));
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export default function BankingPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug || !ENTITY_SLUGS.includes(slug as EntitySlug)) return <NotFound />;
  const eSlug = slug as EntitySlug;
  const bank = useEntityBanking(eSlug);

  const statusConfig = {
    clean:       { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "All Reconciled", sub: "No unreconciled items" },
    pending:     { icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   label: "Reconciliation Pending", sub: `${bank.unreconciled_count} items pending review` },
    needs_review:{ icon: AlertTriangle, color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200",   label: "Needs Review",  sub: `${bank.unreconciled_count} unreconciled item${bank.unreconciled_count !== 1 ? "s" : ""}` },
  };
  const sc = statusConfig[bank.reconciliation_status];
  const StatusIcon = sc.icon;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <PageHeader entitySlug={eSlug} pageTitle="Banking" asOf={bank.as_of} />

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Reconciliation banner */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${sc.bg} ${sc.border}`}>
          <StatusIcon className={`w-5 h-5 flex-shrink-0 ${sc.color}`} />
          <div>
            <p className={`text-[13px] font-semibold ${sc.color}`}>{sc.label}</p>
            <p className="text-[11px] text-gray-500">{sc.sub} · Last reconciled: {bank.accounts.find(a => a.reconciled)?.last_reconciled ?? "—"}</p>
          </div>
          <div className="ml-auto">
            <span className="text-[11px] font-semibold text-gray-600">Total Cash: <span className="text-gray-900">{fmt(bank.total_cash)}</span></span>
          </div>
        </div>

        {/* Account cards */}
        <div className="grid grid-cols-3 gap-4">
          {bank.accounts.map((acct) => (
            <div key={acct.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[13px] font-bold"
                  style={{ background: acct.color }}
                >
                  {acct.institution.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-gray-900 truncate">{acct.name}</p>
                  <p className="text-[10px] text-gray-400">{acct.account_type} ···{acct.last_four}</p>
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
                  {acct.reconciled
                    ? `Reconciled ${acct.last_reconciled}`
                    : `Last reconciled ${acct.last_reconciled} — needs review`}
                </p>
              </div>
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
                <p className="text-[10px] text-gray-400">{acct.institution}</p>
              </div>
            </div>
          ))}
        </div>

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
