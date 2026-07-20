import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingTransactions } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

const fmt = formatCurrency;

/**
 * Determine whether a transaction is an outflow (money leaving the entity).
 * The `transactions` table stores amounts as unsigned magnitudes — direction is
 * encoded in `transactionType`. Payments received / deposits are inflows;
 * purchases / checks / expenses are outflows.
 *
 * Because QBO transaction type strings can vary, this is best-effort.
 * Any type not explicitly matched here is treated as neutral (no colouring).
 */
function isOutflow(transactionType: string | null): boolean | null {
  if (!transactionType) return null;
  const t = transactionType.toLowerCase();
  if (t.includes("payment") || t.includes("deposit") || t.includes("credit memo")) return false;
  if (t.includes("purchase") || t.includes("check") || t.includes("expense") ||
      t.includes("bill payment") || t.includes("charge") || t.includes("journal")) return true;
  return null;
}

function amountClass(transactionType: string | null): string {
  const out = isOutflow(transactionType);
  if (out === true)  return "text-red-600";
  if (out === false) return "text-emerald-700";
  return "text-gray-900";
}

export default function TransactionsPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: transactions, source } = useAccountingTransactions(activeSlug);

  if (source === "loading" || (source !== "unavailable" && !transactions)) {
    return (
      <AccountingLayout
        title="Bank Transactions"
        subtitle="QBO-synced bank and payment activity — not a complete general ledger"
      >
        <p className="text-sm text-gray-400">Loading transactions…</p>
      </AccountingLayout>
    );
  }

  if (!transactions) {
    return (
      <AccountingLayout
        title="Bank Transactions"
        subtitle="QBO-synced bank and payment activity — not a complete general ledger"
      >
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Transaction data unavailable. Ensure the FinanceOS Core pipeline has run for this entity.
        </div>
      </AccountingLayout>
    );
  }

  const reconciled   = transactions.filter(t => t.isReconciled).length;
  const unreconciled = transactions.length - reconciled;
  const nullAmounts  = transactions.filter(t => t.amount === null).length;

  return (
    <AccountingLayout
      title="Bank Transactions"
      subtitle="QBO-synced bank and payment activity — not a complete general ledger"
    >
      <div className="flex gap-4 text-sm text-gray-500 mb-2 flex-wrap">
        <span><span className="font-semibold text-gray-900">{transactions.length}</span> transactions</span>
        <span><span className="font-semibold text-emerald-700">{reconciled}</span> reconciled</span>
        {unreconciled > 0 && (
          <span><span className="font-semibold text-amber-700">{unreconciled}</span> unreconciled</span>
        )}
        {nullAmounts > 0 && (
          <span className="text-amber-600">
            <span className="font-semibold">{nullAmounts}</span> missing amounts
          </span>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-2.5 text-[12px] text-amber-800 mb-2">
        Amounts are unsigned magnitudes. Direction (inflow/outflow) is indicated by transaction type.
        This view covers bank and payment records from QBO — not a complete double-entry general ledger.
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
              <Td className={`text-right font-semibold ${amountClass(tx.transactionType)}`}>
                {tx.amount === null ? <span className="text-gray-300">—</span> : fmt(tx.amount)}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
