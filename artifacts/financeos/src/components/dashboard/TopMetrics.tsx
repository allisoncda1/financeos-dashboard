import { formatCurrency, formatPercent, DASH } from "@/lib/format";

type Metric = {
  label: string;
  value: string;
  barPct: number;
  barColor: string;
};

type Props = {
  grossMarginPct: number;
  netMarginPct: number;
  openAR: number;
  openAP: number;
  /** null when it can't be derived from real data (no monthly P&L) → shows "—". */
  monthlyBurn: number | null;
};

export function TopMetrics({ grossMarginPct, netMarginPct, openAR, openAP, monthlyBurn }: Props) {
  const maxDollar = Math.max(openAR, openAP, monthlyBurn ?? 0) || 1;

  const metrics: Metric[] = [
    {
      label: "Gross Margin",
      value: formatPercent(grossMarginPct),
      barPct: Math.min(grossMarginPct, 100),
      barColor: "#10B981",
    },
    {
      label: "Net Margin",
      value: formatPercent(netMarginPct),
      barPct: Math.min(netMarginPct, 100),
      barColor: "#10B981",
    },
    {
      label: "Accounts Receivable",
      value: formatCurrency(openAR),
      barPct: (openAR / maxDollar) * 100,
      barColor: "#F97316",
    },
    {
      label: "Accounts Payable",
      value: formatCurrency(openAP),
      barPct: (openAP / maxDollar) * 100,
      barColor: "#EF4444",
    },
    {
      label: "Monthly Burn Rate",
      value: monthlyBurn === null ? DASH : formatCurrency(monthlyBurn),
      barPct: monthlyBurn === null ? 0 : (monthlyBurn / maxDollar) * 100,
      barColor: "#3B82F6",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Top Metrics</p>
      </div>

      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.barColor }} />
                <span className="text-[11px] text-gray-600 truncate">{m.label}</span>
              </div>
              <span className="text-[11px] font-semibold text-gray-800 ml-2 flex-shrink-0">{m.value}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${m.barPct.toFixed(1)}%`, background: m.barColor }}
              />
            </div>
          </div>
        ))}
      </div>

      <button className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 text-left mt-1">
        View All Metrics →
      </button>
    </div>
  );
}
