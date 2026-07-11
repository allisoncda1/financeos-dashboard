import { AccountingLayout } from "@/components/accounting/AccountingLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { VENDORS } from "@/lib/accountingMockData";
import { Plus } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function VendorsPage() {
  return (
    <AccountingLayout title="Vendors" subtitle="Track vendor spend and payment history">
      <Card
        title="Vendors"
        action={<PrimaryButton testId="button-new-vendor"><Plus className="w-3.5 h-3.5" /> New Vendor</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Vendor" }, { label: "Category" },
          { label: "YTD Spend", className: "text-right" },
          { label: "Last Payment" }, { label: "Status" },
        ]}>
          {VENDORS.map(v => (
            <tr key={v.id} data-testid={`row-vendor-${v.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{v.name}</Td>
              <Td className="text-gray-500">{v.category}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(v.ytdSpend)}</Td>
              <Td>{v.lastPayment}</Td>
              <Td><Pill tone="emerald">{v.status}</Pill></Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </AccountingLayout>
  );
}
