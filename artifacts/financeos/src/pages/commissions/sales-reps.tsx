import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { SALES_REPS } from "@/lib/commissionMockData";
import { Plus } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function SalesRepsPage() {
  return (
    <CommissionLayout title="Sales Reps" subtitle="Manage your sales team and their commission plans">
      <Card
        title="Sales Reps"
        action={<PrimaryButton testId="button-new-rep"><Plus className="w-3.5 h-3.5" /> New Sales Rep</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Sales Rep" }, { label: "Email" }, { label: "Commission Plan" },
          { label: "YTD Earned", className: "text-right" },
          { label: "Clients", className: "text-right" }, { label: "Status" },
        ]}>
          {SALES_REPS.map(r => (
            <tr key={r.id} data-testid={`row-salesrep-${r.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{r.name}</Td>
              <Td className="text-gray-500">{r.email}</Td>
              <Td>{r.plan}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(r.ytdEarned)}</Td>
              <Td className="text-right">{r.clients}</Td>
              <Td>{r.status === "Active" ? <Pill tone="emerald">Active</Pill> : <Pill tone="blue">Onboarding</Pill>}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </CommissionLayout>
  );
}
