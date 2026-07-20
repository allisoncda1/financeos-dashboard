import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingAccounts, useAccountingTransactions } from "@/hooks/useApi";
import { AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

const fmt = formatCurrency;

export default function ReconciliationPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: accounts }    = useAccountingAccounts(activeSlug);
  const { data: transactions } = useAccountingTransactions(activeSlug);

  const bankAccounts   = (accounts ?? []).filter(a => a.accountType === "Bank" && a.isActive);
  const unreconciled   = (transactions ?? []).filter(t => !t.isReconciled).length;
  const reconciledCount = (transactions ?? []).filter(t => t.isReconciled).length;

  return (
    <AccountingLayout title="Reconciliation" subtitle="Match bank activity against your ledger">

      {/* Live status from Neon data */}
      {transactions && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[22px] font-bold text-gray-900">{transactions.length}</p>
            <p className="text-[12px] text-gray-500 mt-1">Total transactions (synced from QBO)</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-[22px] font-bold text-emerald-700">{reconciledCount}</p>
            <p className="text-[12px] text-gray-500 mt-1">Reconciled in QBO</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className={`text-[22px] font-bold ${unreconciled > 0 ? "text-amber-700" : "text-gray-900"}`}>
              {unreconciled}
            </p>
            <p className="text-[12px] text-gray-500 mt-1">Unreconciled (pending)</p>
          </div>
        </div>
      )}

      {/* Bank account balances from live data */}
      {bankAccounts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-[14px] font-semibold text-gray-900">Bank Account Balances</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">From QBO sync — current book balances</p>
          </div>
          <div className="divide-y divide-gray-100">
            {bankAccounts.map(acc => (
              <div key={acc.id} className="px-5 py-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-gray-900">{acc.name}</span>
                <span className={`text-[13px] font-bold ${acc.currentBalance < 0 ? "text-red-600" : "text-gray-900"}`}>
                  {fmt(acc.currentBalance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Engine gap notice */}
      <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-6 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[14px] font-semibold text-gray-900">Full reconciliation workflow not available</p>
          <p className="text-[13px] text-gray-500 mt-2 max-w-xl">
            Matching bank statement lines against ledger entries, computing differences, and recording
            reconciliation history requires a reconciliation engine. The QBO-synced reconciliation
            status (<code className="bg-gray-100 px-1 rounded text-[11px]">isReconciled</code>) is shown above
            as a read-only indicator. The interactive match/approve workflow is planned for a future release.
          </p>
        </div>
      </div>
    </AccountingLayout>
  );
}
