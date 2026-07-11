import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { COMMISSION_CLIENTS } from "@/lib/commissionMockData";
import { Plus } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function CommissionClientsPage() {
  return (
    <CommissionLayout title="Clients" subtitle="Clients assigned to sales reps for commission tracking">
      <Card
        title="Clients"
        action={<PrimaryButton testId="button-new-client"><Plus className="w-3.5 h-3.5" /> New Client</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Client" }, { label: "Sales Rep" },
          { label: "MRR", className: "text-right" }, { label: "Lifetime Value", className: "text-right" },
          { label: "Client Since" }, { label: "Status" },
        ]}>
          {COMMISSION_CLIENTS.map(c => (
            <tr key={c.id} data-testid={`row-client-${c.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{c.name}</Td>
              <Td>{c.rep}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(c.mrr)}</Td>
              <Td className="text-right">{fmt(c.ltv)}</Td>
              <Td>{c.since}</Td>
              <Td>{c.status === "Active" ? <Pill tone="emerald">Active</Pill> : <Pill tone="blue">Trial</Pill>}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </CommissionLayout>
  );
}
