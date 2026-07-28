import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, MiniKpi } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingCreditMemos } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

function applyStatusTone(status: string, isVoided: boolean): string {
  if (isVoided) return "gray";
  if (status === "fully_applied") return "emerald";
  if (status === "partially_applied") return "amber";
  return "blue";
}

function applyStatusLabel(status: string, isVoided: boolean): string {
  if (isVoided) return "Voided";
  if (status === "fully_applied") return "Fully Applied";
  if (status === "partially_applied") return "Partially Applied";
  if (status === "unapplied") return "Unapplied";
  return status;
}

export default function CreditMemosPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: credits, source } = useAccountingCreditMemos(activeSlug);

  if (source === "loading" || (source !== "unavailable" && !credits)) {
    return (
      <AccountingLayout title="Customer Credits" subtitle="Credit memos issued to customers">
        <p className="text-sm text-gray-400">Loading customer credits…</p>
      </AccountingLayout>
    );
  }

  if (!credits) {
    return (
      <AccountingLayout title="Customer Credits" subtitle="Credit memos issued to customers">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Credit memo data unavailable. Ensure the FinanceOS Core pipeline has run for this entity.
        </div>
      </AccountingLayout>
    );
  }

  const totalOriginal  = credits.reduce((s, r) => s + r.totalAmt, 0);
  const totalRemaining = credits.reduce((s, r) => s + r.remainingCredit, 0);
  const unappliedCount = credits.filter(r => r.applyStatus !== "fully_applied" && !r.isVoided).length;

  return (
    <AccountingLayout title="Customer Credits" subtitle="Credit memos issued to customers">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Total Original" value={formatCurrency(totalOriginal)} sub={`${credits.length} credit memos`} tone="blue" />
        <MiniKpi label="Remaining Credit" value={formatCurrency(totalRemaining)} sub="Unapplied AR offset" tone="emerald" />
        <MiniKpi label="Open Credits" value={String(unappliedCount)} sub="Unapplied or partially applied" tone="amber" />
      </div>
      <Card title={`Customer Credits — ${credits.length} records`}>
        <DataTable headers={[
          { label: "Date" },
          { label: "Customer" },
          { label: "Credit Memo #" },
          { label: "Original Amount", className: "text-right" },
          { label: "Remaining Credit", className: "text-right" },
          { label: "Status" },
          { label: "Currency" },
        ]}>
          {credits.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                No credit memos found for this entity.
              </td>
            </tr>
          ) : credits.map(r => (
            <tr key={r.id} data-testid={`row-credit-memo-${r.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="text-gray-500">{r.txnDate ?? "—"}</Td>
              <Td className="font-semibold text-gray-900 text-[13px]">{r.customerName ?? "—"}</Td>
              <Td className="text-gray-500 font-mono text-[12px]">{r.docNumber ?? "—"}</Td>
              <Td className="text-right font-mono">{formatCurrency(r.totalAmt)}</Td>
              <Td className={`text-right font-semibold font-mono ${r.remainingCredit > 0 ? "text-emerald-700" : "text-gray-500"}`}>
                {formatCurrency(r.remainingCredit)}
              </Td>
              <Td>
                <Pill tone={applyStatusTone(r.applyStatus, r.isVoided)}>
                  {applyStatusLabel(r.applyStatus, r.isVoided)}
                </Pill>
              </Td>
              <Td className="text-gray-400 text-[11px]">{r.currency}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
