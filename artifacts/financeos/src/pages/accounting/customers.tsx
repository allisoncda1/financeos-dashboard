import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingCustomers } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

const fmt = formatCurrency;

export default function CustomersPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: customers, source } = useAccountingCustomers(activeSlug);

  if (source === "loading" || (source !== "unavailable" && !customers)) {
    return (
      <AccountingLayout title="Customers" subtitle="Manage customer records and balances">
        <p className="text-sm text-gray-400">Loading customers…</p>
      </AccountingLayout>
    );
  }

  if (!customers) {
    return (
      <AccountingLayout title="Customers" subtitle="Manage customer records and balances">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Customer data unavailable. Ensure the FinanceOS Core pipeline has run for this entity.
        </div>
      </AccountingLayout>
    );
  }

  return (
    <AccountingLayout title="Customers" subtitle="Manage customer records and balances">
      <Card title={`Customers — ${customers.length} active`}>
        <DataTable headers={[
          { label: "Customer" }, { label: "Email" },
          { label: "Open Balance", className: "text-right" },
          { label: "Status" },
        ]}>
          {customers.map(c => (
            <tr key={c.id} data-testid={`row-customer-${c.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{c.displayName ?? "—"}</Td>
              <Td className="text-gray-500">{c.email ?? <span className="text-gray-300">—</span>}</Td>
              <Td className={`text-right font-semibold ${c.balance < 0 ? "text-red-600" : "text-gray-900"}`}>
                {fmt(c.balance)}
              </Td>
              <Td>
                {c.isActive
                  ? <Pill tone="emerald">Active</Pill>
                  : <Pill tone="gray">Inactive</Pill>}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
