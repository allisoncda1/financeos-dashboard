import { CheckCircle2, XCircle } from "lucide-react";
import type { BankTransaction } from "@/lib/types";

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(Math.abs(n) / 1_000).toFixed(1)}K`;
  return `$${Math.abs(n).toFixed(2)}`;
}

type Props = {
  transactions: BankTransaction[];
  emptyLabel?: string;
};

export function TransactionTable({ transactions, emptyLabel = "No transactions found." }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-[12px] text-gray-400">{emptyLabel}</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px]">
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
          {transactions.map((tx) => (
            <tr key={tx.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-2.5 text-[11px] text-gray-500 whitespace-nowrap">{tx.date}</td>
              <td className="px-4 py-2.5 text-[12px] text-gray-800 max-w-[240px] truncate">{tx.description || "—"}</td>
              <td className="px-4 py-2.5">
                {tx.category ? (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
                    {tx.category}
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-medium">
                    Uncategorized
                  </span>
                )}
              </td>
              <td className={`px-4 py-2.5 text-right text-[12px] font-semibold ${tx.amount >= 0 ? "text-emerald-600" : "text-gray-800"}`}>
                {tx.amount >= 0 ? "+" : "-"}{fmt(tx.amount)}
              </td>
              <td className="px-4 py-2.5 text-right">
                {tx.reconciled
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                  : <XCircle className="w-3.5 h-3.5 text-amber-500 ml-auto" />
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
