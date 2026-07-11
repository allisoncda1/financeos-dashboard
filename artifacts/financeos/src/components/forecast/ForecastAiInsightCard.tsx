import { FORECAST_AI_INSIGHT } from "@/lib/forecastMockData";
import { Sparkles, ArrowRight } from "lucide-react";

export function ForecastAiInsightCard() {
  return (
    <div
      data-testid="card-ai-insight"
      className="bg-emerald-50/60 border border-emerald-100 rounded-xl shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-emerald-700 flex items-center gap-1.5">AI Insight</p>
          <p className="text-[12px] text-gray-600 mt-0.5 leading-relaxed">{FORECAST_AI_INSIGHT}</p>
        </div>
      </div>
      <button
        data-testid="button-view-full-analysis"
        className="flex items-center gap-1.5 h-8 px-4 rounded-lg border border-emerald-200 bg-white text-[12px] font-semibold text-emerald-700 shadow-sm hover:bg-emerald-50 transition-colors flex-shrink-0 self-start sm:self-center"
      >
        View Full Analysis <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
