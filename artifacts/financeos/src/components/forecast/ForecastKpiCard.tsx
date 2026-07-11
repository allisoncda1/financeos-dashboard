import { FORECAST_KPIS } from "@/lib/forecastMockData";

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120, h = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const SUB_TONE: Record<string, string> = {
  up: "text-emerald-600",
  down: "text-red-600",
  neutral: "text-gray-400",
};

export function ForecastKpiCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {FORECAST_KPIS.map((kpi, i) => (
        <div
          key={i}
          data-testid={`kpi-${kpi.label.toLowerCase().replace(/[()\s]+/g, "-").replace(/-$/, "")}`}
          className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col"
        >
          <div className="flex items-start justify-between">
            <p className="text-[11px] text-gray-500 font-medium leading-snug pr-2">{kpi.label}</p>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.iconBg}1A`, color: kpi.iconBg }}>
              <kpi.icon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[20px] font-bold text-gray-900 leading-tight mt-2">{kpi.value}</p>
          <p className={`text-[11px] mt-1 ${SUB_TONE[kpi.subTone]}`}>{kpi.sub}</p>
          <Sparkline data={kpi.spark} color={kpi.sparkColor} />
        </div>
      ))}
    </div>
  );
}
