import { CommissionLayout } from "@/components/commission/CommissionLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { CALCULATION_RUNS } from "@/lib/commissionMockData";
import { Zap } from "lucide-react";

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const STATUS_TONE: Record<string, string> = {
  "Pending Review": "amber",
  Locked: "indigo",
  Paid: "purple",
};

export default function CalculationsPage() {
  return (
    <CommissionLayout title="Calculations" subtitle="Commission calculation runs by period">
      <Card
        title="Calculation Runs"
        action={<PrimaryButton testId="button-run-calculation"><Zap className="w-3.5 h-3.5" /> Run Calculation</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Period" }, { label: "Ran At" },
          { label: "Invoices", className: "text-right" },
          { label: "Total Commission", className: "text-right" }, { label: "Status" },
        ]}>
          {CALCULATION_RUNS.map(run => (
            <tr key={run.id} data-testid={`row-calcrun-${run.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{run.period}</Td>
              <Td className="text-gray-500">{run.ranAt}</Td>
              <Td className="text-right">{run.invoices}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmt(run.total)}</Td>
              <Td><Pill tone={STATUS_TONE[run.status] ?? "gray"}>{run.status}</Pill></Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </CommissionLayout>
  );
}
