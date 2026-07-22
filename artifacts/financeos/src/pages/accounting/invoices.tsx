import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, MiniKpi } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingInvoices } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import type { AccountingInvoice, ArApReconciliation } from "@/lib/api";

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined ? "N/A" : formatCurrency(v);

function statusTone(status: string | null, daysOverdue: number | null): string {
  const s = (status ?? "").toLowerCase();
  if (daysOverdue && daysOverdue > 0) return "red";
  if (s === "paid") return "emerald";
  if (s === "draft") return "gray";
  return "blue";
}

function statusLabel(status: string | null, daysOverdue: number | null): string {
  if (daysOverdue && daysOverdue > 0) return "Overdue";
  return status ?? "Unknown";
}

function ReconBanner({ recon }: { recon: ArApReconciliation }) {
  const { reconciliationStatus: status, explanation } = recon;

  if (status === "reconciled" || status === "no_official_snapshot") return null;

  if (status === "normalized_data_incomplete") {
    return (
      <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex gap-3 items-start">
        <span className="text-blue-500 mt-0.5">ℹ</span>
        <div>
          <p className="font-semibold">Credit memo data not yet synced</p>
          <p className="text-blue-800 mt-0.5">{explanation}</p>
          <p className="text-blue-700 mt-1 text-xs">
            Official AR: {fmt(recon.officialTotal)}
            {recon.officialAsOf ? ` as of ${recon.officialAsOf.slice(0, 10)}` : ""}
            {" | "}Gross invoices: {fmt(recon.normalizedGrossTotal)}
          </p>
        </div>
      </div>
    );
  }

  if (status === "source_date_mismatch") {
    return (
      <div className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900 flex gap-3 items-start">
        <span className="text-orange-500 mt-0.5">⚠</span>
        <div>
          <p className="font-semibold">AR data date mismatch</p>
          <p className="text-orange-800 mt-0.5">{explanation}</p>
        </div>
      </div>
    );
  }

  // unreconciled
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
      <span className="text-amber-500 mt-0.5">⚠</span>
      <div>
        <p className="font-semibold">Invoice detail does not match QBO-authoritative AR</p>
        <div className="text-amber-800 mt-1 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
          <span>Official AR (QBO):</span>
          <span className="font-mono">{fmt(recon.officialTotal)}{recon.officialAsOf ? ` as of ${recon.officialAsOf.slice(0, 10)}` : ""}</span>
          <span>Gross open invoices:</span>
          <span className="font-mono">{fmt(recon.normalizedGrossTotal)}</span>
          <span>Unapplied customer credits:</span>
          <span className="font-mono">{recon.unappliedCredits !== null ? fmt(recon.unappliedCredits) : "N/A"}</span>
          <span>Net normalized AR:</span>
          <span className="font-mono">{recon.normalizedNetTotal !== null ? fmt(recon.normalizedNetTotal) : "N/A"}</span>
          <span>Gap:</span>
          <span className="font-mono font-semibold">{recon.absoluteDifference !== null ? fmt(recon.absoluteDifference) : "N/A"}</span>
        </div>
      </div>
    </div>
  );
}

export default function InvoicesPage(_props: { filter?: string } = {}) {
  const { activeSlug } = useAccountingEntity();
  const { data: invoices, source, reconciliation } = useAccountingInvoices(activeSlug);

  if (source === "loading" || (source !== "unavailable" && !invoices)) {
    return (
      <AccountingLayout title="Invoices" subtitle="View and track customer invoices from QBO">
        <p className="text-sm text-gray-400">Loading invoices…</p>
      </AccountingLayout>
    );
  }

  if (!invoices) {
    return (
      <AccountingLayout title="Invoices" subtitle="View and track customer invoices from QBO">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Invoice data unavailable. Ensure the FinanceOS Core pipeline has run for this entity.
        </div>
      </AccountingLayout>
    );
  }

  const outstanding = invoices.filter(i => i.balance > 0).reduce((s, i) => s + i.balance, 0);
  const overdue     = invoices.filter(i => (i.daysOverdue ?? 0) > 0).reduce((s, i) => s + i.balance, 0);
  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);

  return (
    <AccountingLayout title="Invoices" subtitle="View and track customer invoices from QBO">
      {reconciliation && <ReconBanner recon={reconciliation} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Total Invoiced" value={formatCurrency(totalAmount)} sub={`${invoices.length} invoices`} tone="blue" />
        <MiniKpi label="Outstanding AR" value={formatCurrency(outstanding)} sub="Open balance" tone="blue" />
        <MiniKpi label="Overdue" value={formatCurrency(overdue)} sub="Past due date" tone="red" />
      </div>

      <Card title={`Invoices — ${invoices.length}`}>
        <DataTable headers={[
          { label: "Customer" }, { label: "Issued" }, { label: "Due" },
          { label: "Amount", className: "text-right" },
          { label: "Balance", className: "text-right" },
          { label: "Status" },
        ]}>
          {invoices.map(inv => (
            <tr key={inv.id} data-testid={`row-invoice-${inv.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{inv.customerName ?? "—"}</Td>
              <Td>{inv.invoiceDate ?? "—"}</Td>
              <Td>{inv.dueDate ?? "—"}</Td>
              <Td className="text-right text-gray-700">{formatCurrency(inv.amount)}</Td>
              <Td className={`text-right font-semibold ${inv.balance > 0 ? "text-gray-900" : "text-gray-400"}`}>
                {formatCurrency(inv.balance)}
              </Td>
              <Td>
                <Pill tone={statusTone(inv.status, inv.daysOverdue)}>
                  {statusLabel(inv.status, inv.daysOverdue)}
                </Pill>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
