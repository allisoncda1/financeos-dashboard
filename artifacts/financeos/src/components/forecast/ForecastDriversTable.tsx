import { AlertCircle } from "lucide-react";

export function ForecastDriversTable() {
  return (
    <div
      data-testid="forecast-drivers-unavailable"
      className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 h-full"
    >
      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-[12px] text-amber-900">
        <span className="font-semibold">Forecast drivers not yet available.</span>{" "}
        Driver-based assumptions require the forecast engine backend.
      </p>
    </div>
  );
}
