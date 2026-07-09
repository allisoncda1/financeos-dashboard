import { Scale, XCircle, Info } from "lucide-react";
import Link from "@/lib/next-compat";
import { usePathname } from "@/lib/next-compat";
import { ENTITY_CONFIG } from "@/lib/entities";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useEntityBanking } from "@/hooks/useApi";
import { EntityPicker } from "@/components/accounting/EntityPicker";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(Math.abs(n) / 1_000).toFixed(1)}K`;
  return `$${Math.abs(n).toFixed(2)}`;
}

const SUB_NAV = [
  { label: "Overview",     href: "/accounting/reconciliation" },
  { label: "Accounts",     href: "/accounting/reconciliation/accounts" },
  { label: "Match Center", href: "/accounting/reconciliation/match-center" },
];

export default function MatchCenterPage() {
  const { activeSlug, setActiveSlug } = useAccountingEntity();
  const { data: bank, source } = useEntityBanking(activeSlug);
  const cfg = ENTITY_CONFIG[activeSlug];
  const pathname = usePathname();

  const unreconciled = bank?.transactions.filter((t) => !t.reconciled) ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <Scale className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Match Center</h1>
              <p className="text-[11px] text-gray-400">
                {bank ? `${cfg.name} · ${unreconciled.length} unreconciled · As of ${bank.as_of}` : "Select an entity"}
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
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Read-only notice */}
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-[12px] text-blue-700">
              <span className="font-semibold">Read-only view.</span> Transaction matching will be enabled in a future release. Reconcile directly in QuickBooks Online.
            </p>
          </div>

          {unreconciled.length === 0 ? (
            <div className="bg-white rounded-xl border border-emerald-200 px-6 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                <Scale className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-[14px] font-semibold text-emerald-700">All caught up</p>
              <p className="text-[12px] text-gray-400 mt-1">No unreconciled transactions for {cfg.name}.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-gray-900">Unreconciled Transactions</h3>
                <span className="text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                  {unreconciled.length} pending
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Description</th>
                      <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Category</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Amount</th>
                      <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unreconciled.map((tx) => (
                      <tr key={tx.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">{tx.date}</td>
                        <td className="px-4 py-2.5 text-[12px] text-gray-800 max-w-[220px] truncate">{tx.description || "—"}</td>
                        <td className="px-4 py-2.5">
                          {tx.category
                            ? <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">{tx.category}</span>
                            : <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-medium">Uncategorized</span>
                          }
                        </td>
                        <td className={`px-4 py-2.5 text-right text-[12px] font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                          {tx.amount >= 0 ? "+" : "-"}{fmt(tx.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <XCircle className="w-3.5 h-3.5 text-amber-500 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
