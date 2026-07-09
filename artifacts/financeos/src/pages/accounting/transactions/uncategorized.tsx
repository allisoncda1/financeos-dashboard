import { CreditCard } from "lucide-react";
import Link from "@/lib/next-compat";
import { usePathname } from "@/lib/next-compat";
import { ENTITY_CONFIG } from "@/lib/entities";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useEntityBanking } from "@/hooks/useApi";
import { EntityPicker } from "@/components/accounting/EntityPicker";
import { TransactionTable } from "@/components/accounting/TransactionTable";

export default function UncategorizedTransactionsPage() {
  const { activeSlug, setActiveSlug } = useAccountingEntity();
  const { data: bank, source } = useEntityBanking(activeSlug);
  const cfg = ENTITY_CONFIG[activeSlug];
  const pathname = usePathname();

  const uncategorized = bank?.transactions.filter((t) => !t.category) ?? [];
  const uncatCount    = uncategorized.length;
  const catCount      = (bank?.transactions.length ?? 0) - uncatCount;

  const SUB_NAV = [
    { label: "All",           href: "/accounting/transactions",              count: bank?.transactions.length ?? 0 },
    { label: "Uncategorized", href: "/accounting/transactions/uncategorized", count: uncatCount, warn: uncatCount > 0 },
    { label: "Categorized",   href: "/accounting/transactions/categorized",   count: catCount },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F4F5F7]">
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-gray-900 leading-tight">Uncategorized Transactions</h1>
              <p className="text-[11px] text-gray-400">
                {bank ? `${cfg.name} · ${uncatCount} need categorization · As of ${bank.as_of}` : "Select an entity"}
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {item.label}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-blue-100 text-blue-700" : item.warn ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
                  {item.count}
                </span>
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
          {uncatCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-amber-700">{uncatCount} transaction{uncatCount !== 1 ? "s" : ""} need categorization</p>
                <p className="text-[11px] text-amber-600">Categorizing transactions improves reporting accuracy.</p>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-gray-900">Uncategorized Transactions</h3>
              <span className="text-[10px] text-gray-400">{uncatCount} shown</span>
            </div>
            <TransactionTable
              transactions={uncategorized}
              emptyLabel="All transactions are categorized."
            />
          </div>
        </div>
      )}
    </div>
  );
}
