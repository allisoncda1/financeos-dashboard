import { AlertCircle } from "lucide-react";

export function ForecastKpiCards() {
  return (
    <div
      data-testid="forecast-kpi-unavailable"
      className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3"
    >
      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-[12px] text-amber-900">
        <span className="font-semibold">Forecast KPIs are not yet available.</span>{" "}
        The forecast engine (driver-based projections, actuals integration, scenario modeling)
        is planned for a future release.
      </p>
    </div>
  );
}
