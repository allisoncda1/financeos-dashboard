import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { CommissionStatusTable } from "@/components/commission/CommissionStatusTable";
import { MiniKpi } from "@/components/accounting/AccountingUI";
import { COMMISSION_INVOICES } from "@/lib/commissionMockData";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function CommissionInvoicesPage() {
  const totalInvoiced = COMMISSION_INVOICES.reduce((s, i) => s + i.invoiceAmount, 0);
  const totalCommission = COMMISSION_INVOICES.reduce((s, i) => s + i.commissionAmount, 0);
  const pending = COMMISSION_INVOICES.filter(i => i.status === "Pending").reduce((s, i) => s + i.commissionAmount, 0);

  return (
    <CommissionLayout title="Invoices" subtitle="Commissionable invoices and their status">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Invoiced (Jun 2026)" value={fmt(totalInvoiced)} sub={`${COMMISSION_INVOICES.length} recent invoices shown`} tone="gray" />
        <MiniKpi label="Commission generated" value={fmt(totalCommission)} sub="From listed invoices" tone="emerald" />
        <MiniKpi label="Pending commission" value={fmt(pending)} sub="Awaiting approval" tone="amber" />
      </div>
      <CommissionStatusTable />
    </CommissionLayout>
  );
}
