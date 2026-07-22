import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill } from "@/components/accounting/AccountingUI";
import { useAccountingEntity } from "@/lib/accounting-context";
import { useAccountingVendors } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/format";

const fmt = formatCurrency;

export default function VendorsPage() {
  const { activeSlug } = useAccountingEntity();
  const { data: vendors, source } = useAccountingVendors(activeSlug);

  if (source === "loading" || (source !== "unavailable" && !vendors)) {
    return (
      <AccountingLayout title="Vendors" subtitle="Track vendor spend and open AP balances">
        <p className="text-sm text-gray-400">Loading vendors…</p>
      </AccountingLayout>
    );
  }

  if (!vendors) {
    return (
      <AccountingLayout title="Vendors" subtitle="Track vendor spend and open AP balances">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center text-gray-500">
          Vendor data unavailable. Ensure the FinanceOS Core pipeline has run for this entity.
        </div>
      </AccountingLayout>
    );
  }

  return (
    <AccountingLayout title="Vendors" subtitle="Track vendor spend and open AP balances">
      <Card title={`Vendors — ${vendors.length} active`}>
        <DataTable headers={[
          { label: "Vendor" }, { label: "Email" },
          { label: "AP Balance", className: "text-right" },
          { label: "Status" },
        ]}>
          {vendors.map(v => (
            <tr key={v.id} data-testid={`row-vendor-${v.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{v.displayName ?? "—"}</Td>
              <Td className="text-gray-500">{v.email ?? <span className="text-gray-300">—</span>}</Td>
              <Td className={`text-right font-semibold ${v.balance < 0 ? "text-red-600" : "text-gray-900"}`}>
                {fmt(v.balance)}
              </Td>
              <Td>
                {v.isActive
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
