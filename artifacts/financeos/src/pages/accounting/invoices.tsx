import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton, MiniKpi } from "@/components/accounting/AccountingUI";
import { INVOICES, type InvoiceStatus } from "@/lib/accountingMockData";
import { Link } from "wouter";
import { Plus, MoreVertical } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const STATUS_TONE: Record<InvoiceStatus, string> = {
  Draft: "gray",
  Sent: "blue",
  Paid: "emerald",
  Overdue: "red",
  Recurring: "purple",
};

const FILTERS: { id: string; label: string; status?: InvoiceStatus }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Draft", status: "Draft" },
  { id: "sent", label: "Sent", status: "Sent" },
  { id: "paid", label: "Paid", status: "Paid" },
  { id: "recurring", label: "Recurring", status: "Recurring" },
];

export default function InvoicesPage({ filter = "all" }: { filter?: string }) {
  const active = FILTERS.find(f => f.id === filter) ?? FILTERS[0];
  const rows = active.status
    ? INVOICES.filter(i => i.status === active.status)
    : INVOICES;

  const outstanding = INVOICES.filter(i => i.status === "Sent" || i.status === "Overdue")
    .reduce((s, i) => s + i.amount, 0);
  const overdue = INVOICES.filter(i => i.status === "Overdue").reduce((s, i) => s + i.amount, 0);
  const paidThisMonth = INVOICES.filter(i => i.status === "Paid").reduce((s, i) => s + i.amount, 0);

  return (
    <AccountingLayout title="Invoices" subtitle="Create, send, and track customer invoices">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniKpi label="Outstanding" value={fmt(outstanding)} sub="Sent and overdue invoices" tone="blue" />
        <MiniKpi label="Overdue" value={fmt(overdue)} sub="1 invoice past due" tone="red" />
        <MiniKpi label="Paid this month" value={fmt(paidThisMonth)} sub="3 invoices collected" tone="emerald" />
      </div>

      <Card
        title="Invoices"
        action={<PrimaryButton testId="button-new-invoice"><Plus className="w-3.5 h-3.5" /> New Invoice</PrimaryButton>}
      >
        <div className="px-5 pt-3 border-b border-gray-100">
          <div className="flex gap-6">
            {FILTERS.map(f => (
              <Link
                key={f.id}
                href={f.id === "all" ? "/accounting/invoices" : `/accounting/invoices/${f.id}`}
                data-testid={`tab-invoices-${f.id}`}
                className={`pb-3 text-[12px] font-semibold transition-colors border-b-2 ${
                  active.id === f.id
                    ? "border-emerald-500 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
        <DataTable headers={[
          { label: "Invoice" }, { label: "Customer" }, { label: "Issued" }, { label: "Due" },
          { label: "Amount", className: "text-right" }, { label: "Status" }, { label: "" },
        ]}>
          {rows.map(inv => (
            <tr key={inv.id} data-testid={`row-invoice-${inv.number}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{inv.number}</Td>
              <Td>{inv.customer}</Td>
              <Td>{inv.issued}</Td>
              <Td>{inv.due}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(inv.amount)}</Td>
              <Td><Pill tone={STATUS_TONE[inv.status]}>{inv.status}</Pill></Td>
              <Td className="w-10">
                <button className="text-gray-400 hover:text-gray-600"><MoreVertical className="w-4 h-4" /></button>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
