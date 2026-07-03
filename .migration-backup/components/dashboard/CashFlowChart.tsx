const MONTHS = ["Jan", "Mar", "May", "Jul", "Sep", "Nov", "Mar", "May"];
const CASH_IN  = [318, 292, 336, 378, 415, 452, 411, 445];
const CASH_OUT = [282, 264, 302, 335, 375, 396, 366, 396];

const W = 240, H = 110;
const PAD = { l: 8, r: 8, t: 8, b: 24 };
const CW = W - PAD.l - PAD.r;
const CH = H - PAD.t - PAD.b;
const MAX = 480;
const N = MONTHS.length;
const GROUP_W = CW / N;
const BAR_W = GROUP_W * 0.36;

function barX(i: number, offset: 0 | 1): number {
  const groupStart = PAD.l + i * GROUP_W;
  const gap = GROUP_W * 0.04;
  return groupStart + gap + offset * (BAR_W + gap);
}

function barH(val: number): number {
  return (val / MAX) * CH;
}

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

type Props = {
  cashIn: number;
  cashOut: number;
  netCash: number;
};

export function CashFlowChart({ cashIn, cashOut, netCash }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold flex items-center gap-1">
          Cash Flow Summary
          <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" />
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" />
          </svg>
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <CashKpi label="Cash In"       value={cashIn}  color="#10B981" />
        <CashKpi label="Cash Out"      value={cashOut} color="#EF4444" />
        <CashKpi label="Net Cash"      value={netCash} color={netCash >= 0 ? "#111827" : "#EF4444"} />
      </div>

      {/* Bar chart */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        {/* Zero line */}
        <line
          x1={PAD.l} y1={H - PAD.b}
          x2={W - PAD.r} y2={H - PAD.b}
          stroke="#E5E7EB" strokeWidth="1"
        />

        {MONTHS.map((mo, i) => {
          const inH  = barH(CASH_IN[i]);
          const outH = barH(CASH_OUT[i]);
          const bottom = H - PAD.b;
          return (
            <g key={i}>
              {/* Cash In (green) */}
              <rect
                x={barX(i, 0)} y={bottom - inH}
                width={BAR_W} height={inH}
                rx="2" fill="#10B981" fillOpacity="0.85"
              />
              {/* Cash Out (red) */}
              <rect
                x={barX(i, 1)} y={bottom - outH}
                width={BAR_W} height={outH}
                rx="2" fill="#EF4444" fillOpacity="0.80"
              />
              {/* X label */}
              <text
                x={barX(i, 0) + BAR_W}
                y={H - PAD.b + 12}
                textAnchor="middle"
                fontSize="8"
                fill="#9CA3AF"
              >
                {mo}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center">
        <LegendItem color="#10B981" label="Cash In" />
        <LegendItem color="#EF4444" label="Cash Out" />
      </div>
    </div>
  );
}

function CashKpi({ label, value, color }: { label: string; value: number; color: string }) {
  const display = value >= 1000 ? `$${(value / 1000).toFixed(0)}K` : `$${value}`;
  return (
    <div className="text-center">
      <p className="text-[9px] text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-[13px] font-bold mt-0.5" style={{ color }}>{display}</p>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color, opacity: 0.85 }} />
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}
