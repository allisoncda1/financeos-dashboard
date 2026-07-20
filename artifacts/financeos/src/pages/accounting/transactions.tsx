import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingTransactions } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

const fmt = formatCurrency;

export default function TransactionsPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: transactions, source } = useAccountingTransactions(activeSlug);

  if (source === "loading" || (source !== "unavailable" && !transactions)) {
    return (
      <AccountingLayout title="Bank Transactions" subtitle="Bank activity synced from QBO">
        <p className="text-sm text-gray-400">Loading transactions…</p>
      </AccountingLayout>
    );
  }

  if (!transactions) {
    return (
      <AccountingLayout title="Bank Transactions" subtitle="Bank activity synced from QBO">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Transaction data unavailable. Ensure the FinanceOS Core pipeline has run for this entity.
        </div>
      </AccountingLayout>
    );
  }

  const reconciled   = transactions.filter(t => t.isReconciled).length;
  const unreconciled = transactions.length - reconciled;

  return (
    <AccountingLayout title="Bank Transactions" subtitle="Bank activity synced from QBO">
      <div className="flex gap-4 text-sm text-gray-500 mb-2">
        <span><span className="font-semibold text-gray-900">{transactions.length}</span> transactions</span>
        <span><span className="font-semibold text-emerald-700">{reconciled}</span> reconciled</span>
        {unreconciled > 0 && (
          <span><span className="font-semibold text-amber-700">{unreconciled}</span> unreconciled</span>
        )}
      </div>

      <Card title="Transactions">
        <DataTable headers={[
          { label: "Date" }, { label: "Type" }, { label: "Memo" },
          { label: "Category" }, { label: "Reconciled" },
          { label: "Amount", className: "text-right" },
        ]}>
          {transactions.map(tx => (
            <tr key={tx.id} data-testid={`row-transaction-${tx.id}`} className="hover:bg-gray-50 transition-colors">
              <Td>{tx.transactionDate ?? "—"}</Td>
              <Td className="text-gray-500">{tx.transactionType ?? "—"}</Td>
              <Td className="max-w-[220px] truncate text-gray-700">{tx.memo ?? "—"}</Td>
              <Td>{tx.category
                ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-700">{tx.category}</span>
                : <span className="text-gray-300 text-[12px]">Uncategorized</span>}
              </Td>
              <Td>
                {tx.isReconciled
                  ? <Pill tone="emerald">Reconciled</Pill>
                  : <Pill tone="amber">Pending</Pill>}
              </Td>
              <Td className={`text-right font-semibold ${tx.amount < 0 ? "text-red-600" : "text-emerald-700"}`}>
                {fmt(tx.amount)}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
