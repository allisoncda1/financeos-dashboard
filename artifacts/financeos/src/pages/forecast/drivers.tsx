import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { Card, DataTable, Td, PrimaryButton } from "@/components/accounting/AccountingUI";
import { ForecastDriversTable } from "@/components/forecast/ForecastDriversTable";
import { FORECAST_ASSUMPTIONS } from "@/lib/forecastMockData";
import { Plus } from "lucide-react";

export default function DriversPage() {
  return (
    <ForecastLayout title="Drivers & Assumptions" subtitle="Key inputs powering the forecast model">
      <ForecastDriversTable />

      <Card
        title="Model Assumptions"
        action={<PrimaryButton testId="button-new-assumption"><Plus className="w-3.5 h-3.5" /> New Assumption</PrimaryButton>}
      >
        <DataTable headers={[
          { label: "Driver" }, { label: "Value" }, { label: "Basis" }, { label: "Last Updated" },
        ]}>
          {FORECAST_ASSUMPTIONS.map(a => (
            <tr key={a.id} data-testid={`row-assumption-${a.id}`} className="hover:bg-gray-50 transition-colors">
              <Td className="font-semibold text-gray-900 text-[13px]">{a.driver}</Td>
              <Td className="font-semibold text-gray-900">{a.value}</Td>
              <Td className="text-gray-500">{a.basis}</Td>
              <Td>{a.updated}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </ForecastLayout>
  );
}
