import { AlertCircle } from "lucide-react";
import { ForecastLayout } from "@/components/forecast/ForecastLayout";

export default function ForecastDriversPage() {
  return (
    <ForecastLayout title="Forecast Drivers" subtitle="Driver assumptions — not yet implemented">
      <div
        data-testid="forecast-drivers-page-unavailable"
        className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3"
      >
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[12px] text-amber-900">
          <span className="font-semibold">Forecast driver assumptions are not yet available.</span>{" "}
          The forecast engine is planned for a future release.
        </p>
      </div>
    </ForecastLayout>
  );
}
