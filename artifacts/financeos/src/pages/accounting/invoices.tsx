import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, MiniKpi } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingInvoices } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";
import type { AccountingInvoice } from "@/lib/api";

const fmt = formatCurrency;

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

function ReconBanner({ status, authoritativeTotal, detailTotal, difference, asOf }: {
  status: string;
  authoritativeTotal: number | null;
  detailTotal: number | null;
  difference: number | null;
  asOf: string | null;
}) {
  if (status === "reconciled" || status === "no_snapshot") return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
      <span className="text-amber-500 mt-0.5">⚠</span>
      <div>
        <p className="font-semibold">Invoice detail may not match QBO-authoritative AR</p>
        <p className="text-amber-800 mt-0.5">
          QBO reports <strong>{fmt(authoritativeTotal ?? 0)}</strong> open AR
          {asOf ? ` as of ${asOf.slice(0, 10)}` : ""}
          {" "}— normalized invoices total <strong>{fmt(detailTotal ?? 0)}</strong>
          {" "}(gap: <strong>{fmt(difference ?? 0)}</strong>).
          Credit memos or payments may not yet be synced.
        </p>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
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
      {reconciliation && (
        <ReconBanner
          status={reconciliation.reconciliationStatus}
          authoritativeTotal={reconciliation.authoritativeTotal}
          detailTotal={reconciliation.detailTotal}
          difference={reconciliation.difference}
          asOf={reconciliation.asOf}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Total Invoiced" value={fmt(totalAmount)} sub={`${invoices.length} invoices`} tone="blue" />
        <MiniKpi label="Outstanding AR" value={fmt(outstanding)} sub="Open balance" tone="blue" />
        <MiniKpi label="Overdue" value={fmt(overdue)} sub="Past due date" tone="red" />
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
              <Td className="text-right text-gray-700">{fmt(inv.amount)}</Td>
              <Td className={`text-right font-semibold ${inv.balance > 0 ? "text-gray-900" : "text-gray-400"}`}>
                {fmt(inv.balance)}
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
