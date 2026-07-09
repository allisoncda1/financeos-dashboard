import { Scale, CheckCircle2, XCircle } from "lucide-react";
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

const SUB_NAV = [
  { label: "Overview",     href: "/accounting/reconciliation" },
  { label: "Accounts",     href: "/accounting/reconciliation/accounts" },
  { label: "Match Center", href: "/accounting/reconciliation/match-center" },
];

export default function ReconciliationAccountsPage() {
  const { activeSlug, setActiveSlug } = useAccountingEntity();
  const { data: bank, source } = useEntityBanking(activeSlug);
  const cfg = ENTITY_CONFIG[activeSlug];
  const pathname = usePathname();

  const totalBalance = bank?.accounts.reduce((s, a) => s + a.balance, 0) ?? 0;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
              <Scale className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Reconciliation — Accounts</h1>
              <p className="text-[11px] text-gray-400">
                {bank ? `${cfg.name} · ${bank.accounts.length} accounts · Total ${fmt(totalBalance)}` : "Select an entity"}
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

          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Total Cash</p>
              <p className="text-[22px] font-bold text-gray-900 mt-1">{fmt(totalBalance)}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">across {bank.accounts.length} accounts</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Status</p>
              <p className={`text-[14px] font-bold mt-1 ${bank.reconciliation_status === "clean" ? "text-emerald-600" : "text-amber-600"}`}>
                {bank.reconciliation_status === "clean" ? "All Reconciled" : bank.reconciliation_status === "pending" ? "Pending" : "Needs Review"}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">{bank.unreconciled_count} unreconciled</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Last Reconciled</p>
              {/* Placeholder — no per-account reconciliation date in Neon yet */}
              <p className="text-[14px] font-bold text-gray-400 mt-1">—</p>
              <p className="text-[10px] text-gray-400 mt-0.5">per-account date pending</p>
            </div>
          </div>

          {/* Account cards */}
          <div className="grid grid-cols-2 gap-4">
            {bank.accounts.map((acct) => (
              <div key={acct.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[14px] font-bold"
                    style={{ background: cfg.color }}
                  >
                    {acct.institution.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{acct.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {acct.account_type}
                      {acct.last_four ? ` ···${acct.last_four}` : ""}
                    </p>
                  </div>
                  {acct.reconciled
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    : <XCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  }
                </div>
                <div className="px-4 pb-4">
                  <p className="text-[24px] font-bold text-gray-900">{fmt(acct.balance)}</p>
                </div>
                <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-[10px] text-gray-500">{acct.institution}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${acct.reconciled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {acct.reconciled ? "Reconciled" : "Needs Review"}
                  </span>
                </div>
                {/* last_reconciled placeholder */}
                {acct.last_reconciled ? (
                  <div className="px-4 py-1.5 text-[10px] text-gray-400 border-t border-gray-50">
                    Last reconciled {acct.last_reconciled}
                  </div>
                ) : null}
              </div>
            ))}
            {bank.accounts.length === 0 && (
              <div className="col-span-2 py-12 text-center text-[13px] text-gray-400">
                No bank accounts loaded from Neon.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
