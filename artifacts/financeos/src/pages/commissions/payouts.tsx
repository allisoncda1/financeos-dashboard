import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { UpcomingPayoutCard } from "@/components/commission/UpcomingPayoutCard";
import { PAYOUTS } from "@/lib/commissionMockData";
import { Banknote } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function PayoutsPage() {
  return (
    <CommissionLayout title="Payouts" subtitle="Schedule and track commission payouts">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Card
            title="Payout History"
            action={<PrimaryButton testId="button-schedule-payout"><Banknote className="w-3.5 h-3.5" /> Schedule Payout</PrimaryButton>}
          >
            <DataTable headers={[
              { label: "Period" }, { label: "Reps", className: "text-right" },
              { label: "Amount", className: "text-right" }, { label: "Payout Date" },
              { label: "Method" }, { label: "Status" },
            ]}>
              {PAYOUTS.map(p => (
                <tr key={p.id} data-testid={`row-payout-${p.id}`} className="hover:bg-gray-50 transition-colors">
                  <Td className="font-semibold text-gray-900 text-[13px]">{p.period}</Td>
                  <Td className="text-right">{p.reps}</Td>
                  <Td className="text-right font-semibold text-gray-900">{fmt(p.amount)}</Td>
                  <Td>{p.date}</Td>
                  <Td className="text-gray-500">{p.method}</Td>
                  <Td>{p.status === "Completed" ? <Pill tone="emerald">Completed</Pill> : <Pill tone="amber">Scheduled</Pill>}</Td>
                </tr>
              ))}
            </DataTable>
          </Card>
        </div>
        <div>
          <UpcomingPayoutCard />
        </div>
      </div>
    </CommissionLayout>
  );
}
