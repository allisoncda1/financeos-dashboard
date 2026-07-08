import { ForecastLayout } from "@/components/forecast/ForecastLayout";
import { ForecastKpiCards } from "@/components/forecast/ForecastKpiCard";
import { ForecastVsBudgetChart } from "@/components/forecast/ForecastVsBudgetChart";
import { ForecastSummaryTable } from "@/components/forecast/ForecastSummaryTable";
import { ForecastDriversTable } from "@/components/forecast/ForecastDriversTable";
import { CashFlowForecastChart } from "@/components/forecast/CashFlowForecastChart";
import { ForecastAiInsightCard } from "@/components/forecast/ForecastAiInsightCard";

export default function ForecastOverviewPage() {
  return (
    <ForecastLayout title="Forecast Overview" subtitle="Project future performance and monitor key financial metrics">
      <ForecastKpiCards />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <ForecastVsBudgetChart />
        </div>
        <div className="xl:col-span-2">
          <ForecastSummaryTable />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ForecastDriversTable />
        <CashFlowForecastChart />
      </div>

      <ForecastAiInsightCard />
    </ForecastLayout>
  );
}
