import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { CUSTOMERS } from "@/lib/accountingMockData";
import { Plus } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function CustomersPage() {
  return (
    <AccountingLayout title="Customers" subtitle="Manage customer records and balances">
      <Card
        title="Customers"
        action={<PrimaryButton testId="button-new-customer"><Plus className="w-3.5 h-3.5" /> New Customer</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Customer" }, { label: "Email" },
          { label: "Open Balance", className: "text-right" },
          { label: "Invoices", className: "text-right" }, { label: "Status" },
        ]}>
          {CUSTOMERS.map(c => (
            <tr key={c.id} data-testid={`row-customer-${c.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{c.name}</Td>
              <Td className="text-gray-500">{c.email || <span className="text-gray-300">—</span>}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(c.openBalance)}</Td>
              <Td className="text-right">{c.invoices}</Td>
              <Td>
                {c.missingInfo
                  ? <Pill tone="amber">Missing info</Pill>
                  : <Pill tone="emerald">{c.status}</Pill>}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
