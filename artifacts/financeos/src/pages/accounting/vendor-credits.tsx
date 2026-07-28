import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, MiniKpi } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingVendorCredits } from "@/hooks/useApi";
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

export default function VendorCreditsPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: credits, source } = useAccountingVendorCredits(activeSlug);

  if (source === "loading" || (source !== "unavailable" && !credits)) {
    return (
      <AccountingLayout title="Vendor Credits" subtitle="Vendor credits applied to AP">
        <p className="text-sm text-gray-400">Loading vendor credits…</p>
      </AccountingLayout>
    );
  }

  if (!credits) {
    return (
      <AccountingLayout title="Vendor Credits" subtitle="Vendor credits applied to AP">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Vendor credit data unavailable. Ensure the FinanceOS Core pipeline has run for this entity.
        </div>
      </AccountingLayout>
    );
  }

  const totalOriginal  = credits.reduce((s, r) => s + r.totalAmt, 0);
  const totalRemaining = credits.reduce((s, r) => s + r.remainingBalance, 0);
  const unappliedCount = credits.filter(r => r.applyStatus !== "fully_applied" && !r.isVoided).length;

  return (
    <AccountingLayout title="Vendor Credits" subtitle="Vendor credits applied to AP">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Total Original" value={formatCurrency(totalOriginal)} sub={`${credits.length} vendor credits`} tone="blue" />
        <MiniKpi label="Remaining Balance" value={formatCurrency(totalRemaining)} sub="Unapplied AP offset" tone="emerald" />
        <MiniKpi label="Open Credits" value={String(unappliedCount)} sub="Unapplied or partially applied" tone="amber" />
      </div>
      <Card title={`Vendor Credits — ${credits.length} records`}>
        <DataTable headers={[
          { label: "Date" },
          { label: "Vendor" },
          { label: "Credit #" },
          { label: "Original Amount", className: "text-right" },
          { label: "Remaining Balance", className: "text-right" },
          { label: "Status" },
          { label: "Currency" },
        ]}>
          {credits.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                No vendor credits found for this entity.
              </td>
            </tr>
          ) : credits.map(r => (
            <tr key={r.id} data-testid={`row-vendor-credit-${r.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="text-gray-500">{r.txnDate ?? "—"}</Td>
              <Td className="font-semibold text-gray-900 text-[13px]">{r.vendorName ?? "—"}</Td>
              <Td className="text-gray-500 font-mono text-[12px]">{r.docNumber ?? "—"}</Td>
              <Td className="text-right font-mono">{formatCurrency(r.totalAmt)}</Td>
              <Td className={`text-right font-semibold font-mono ${r.remainingBalance > 0 ? "text-emerald-700" : "text-gray-500"}`}>
                {formatCurrency(r.remainingBalance)}
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
