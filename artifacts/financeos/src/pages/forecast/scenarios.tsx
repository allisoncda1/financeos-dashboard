import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { Card, DataTable, Td, Pill, PrimaryButton } from "@/components/accounting/AccountingUI";
import { FORECAST_SCENARIOS } from "@/lib/forecastMockData";
import { Plus } from "lucide-react";

const fmtM = (v: number) => `$${(v / 1000000).toFixed(1)}M`;

export default function ScenariosPage() {
  return (
    <ForecastLayout title="Scenarios" subtitle="Model alternative forecast outcomes">
      <Card
        title="Forecast Scenarios"
        action={<PrimaryButton testId="button-new-scenario"><Plus className="w-3.5 h-3.5" /> New Scenario</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Scenario" },
          { label: "Revenue", className: "text-right" },
          { label: "Net Income", className: "text-right" },
          { label: "Cash (EoY)", className: "text-right" },
          { label: "Status" },
        ]}>
          {FORECAST_SCENARIOS.map(s => (
            <tr key={s.id} data-testid={`row-scenario-${s.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{s.name}</Td>
              <Td className="text-right">{fmtM(s.revenue)}</Td>
              <Td className="text-right font-semibold text-gray-900">{fmtM(s.netIncome)}</Td>
              <Td className="text-right">{fmtM(s.cashEoy)}</Td>
              <Td>{s.status === "Active" ? <Pill tone="emerald">Active</Pill> : <Pill tone="gray">Draft</Pill>}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </ForecastLayout>
  );
}
