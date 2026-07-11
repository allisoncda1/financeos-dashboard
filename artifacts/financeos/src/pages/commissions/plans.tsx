import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { COMMISSION_PLANS } from "@/lib/commissionMockData";
import { Plus } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function CommissionPlansPage() {
  return (
    <CommissionLayout title="Commission Plans" subtitle="Define how commissions are calculated">
      <Card
        title="Plans"
        action={<PrimaryButton testId="button-new-plan"><Plus className="w-3.5 h-3.5" /> New Plan</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Plan Name" }, { label: "Basis" }, { label: "Rate" },
          { label: "Sales Reps", className: "text-right" },
          { label: "YTD Earned", className: "text-right" }, { label: "Status" },
        ]}>
          {COMMISSION_PLANS.map(p => (
            <tr key={p.id} data-testid={`row-plan-${p.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{p.name}</Td>
              <Td className="text-gray-500">{p.basis}</Td>
              <Td className="font-semibold text-gray-900">{p.rate}</Td>
              <Td className="text-right">{p.reps}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(p.earnedYtd)}</Td>
              <Td>{p.status === "Active" ? <Pill tone="emerald">Active</Pill> : <Pill tone="gray">Archived</Pill>}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </CommissionLayout>
  );
}
