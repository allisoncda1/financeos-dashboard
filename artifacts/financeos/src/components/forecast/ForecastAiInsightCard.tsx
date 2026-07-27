import { AlertCircle } from "lucide-react";

export function ForecastAiInsightCard() {
  return (
    <div
      data-testid="forecast-ai-insight-unavailable"
      className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3"
    >
      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
      <p className="text-[12px] text-amber-900">
        <span className="font-semibold">AI forecast insights not yet available.</span>{" "}
        Requires forecast engine and connected actuals.
      </p>
    </div>
  );
}
