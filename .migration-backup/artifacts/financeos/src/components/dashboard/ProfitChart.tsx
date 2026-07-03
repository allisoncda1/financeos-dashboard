
import { useState } from "react";

const DATA = [
  { label: "Jan '25", revenue: 185, expenses: 198, profit: -13 },
  { label: "Mar '25", revenue: 162, expenses: 188, profit: -26 },
  { label: "May '25", revenue: 148, expenses: 180, profit: -32 },
  { label: "Jul '25", revenue: 172, expenses: 173, profit: -1  },
  { label: "Sep '25", revenue: 218, expenses: 169, profit:  49 },
  { label: "Nov '25", revenue: 292, expenses: 177, profit: 115 },
  { label: "Jan '26", revenue: 358, expenses: 209, profit: 149 },
  { label: "Mar '26", revenue: 391, expenses: 231, profit: 160 },
  { label: "May '26", revenue: 409, expenses: 239, profit: 170 },
];

const W = 560, H = 200;
const PAD = { l: 52, r: 16, t: 20, b: 40 };
const CW = W - PAD.l - PAD.r; // 492
const CH = H - PAD.t - PAD.b; // 140

const MINY = -100, MAXY = 450, RANGE = 550;
const scaleY = (v: number) => PAD.t + ((MAXY - v) / RANGE) * CH;
const scaleX = (i: number) => PAD.l + (i * CW) / (DATA.length - 1);

const GRID = [200, 100, 0, -100];

function pts(series: "revenue" | "expenses" | "profit") {
  return DATA.map((d, i) => `${scaleX(i).toFixed(1)},${scaleY(d[series]).toFixed(1)}`).join(" ");
}

function areaPath(series: "revenue" | "expenses" | "profit") {
  const points = DATA.map((d, i) => ({ x: scaleX(i), y: scaleY(d[series]) }));
  const bottom = scaleY(MINY);
  return (
    `M ${points[0].x.toFixed(1)} ${bottom.toFixed(1)} ` +
    points.map(p => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
    ` L ${points[DATA.length - 1].x.toFixed(1)} ${bottom.toFixed(1)} Z`
  );
}

export function ProfitChart() {
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Profit Over Time</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Revenue, Expenses &amp; Net Profit</p>
        </div>
        <div className="flex items-center gap-4">
          <Legend color="#10B981" label="Revenue" />
          <Legend color="#EF4444" label="Expenses" />
          <Legend color="#3B82F6" label="Net Profit" />
          <button className="text-[11px] text-gray-500 border border-gray-200 rounded-md px-2 py-1 flex items-center gap-1 hover:bg-gray-50">
            Last 12 Months
            <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", display: "block" }}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Grid lines */}
          {GRID.map(v => {
            const y = scaleY(v);
            return (
              <g key={v}>
                <line
                  x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                  stroke={v === 0 ? "#D1D5DB" : "#F3F4F6"}
                  strokeWidth={v === 0 ? 1 : 1}
                  strokeDasharray={v === 0 ? "0" : "3,3"}
                />
                <text
                  x={PAD.l - 6} y={y + 4}
                  textAnchor="end"
                  fontSize="9"
                  fill="#9CA3AF"
                >
                  {v === 0 ? "$0" : `$${v > 0 ? "" : "-"}${Math.abs(v)}K`}
                </text>
              </g>
            );
          })}

          {/* Area fills (subtle) */}
          <path d={areaPath("revenue")}  fill="rgba(16,185,129,0.05)"  />
          <path d={areaPath("expenses")} fill="rgba(239,68,68,0.05)"   />
          <path d={areaPath("profit")}   fill="rgba(59,130,246,0.07)"  />

          {/* Lines */}
          <polyline points={pts("revenue")}  fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts("expenses")} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts("profit")}   fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Hover dots & tooltip trigger areas */}
          {DATA.map((d, i) => {
            const x = scaleX(i);
            const active = hovered === i;
            return (
              <g key={i}>
                <rect
                  x={x - 16} y={PAD.t} width={32} height={CH}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                />
                {active && (
                  <>
                    <line x1={x} y1={PAD.t} x2={x} y2={H - PAD.b} stroke="#E5E7EB" strokeWidth="1" />
                    <circle cx={x} cy={scaleY(d.revenue)}  r="3.5" fill="#10B981" />
                    <circle cx={x} cy={scaleY(d.expenses)} r="3.5" fill="#EF4444" />
                    <circle cx={x} cy={scaleY(d.profit)}   r="3.5" fill="#3B82F6" />
                  </>
                )}
              </g>
            );
          })}

          {/* X axis labels */}
          {DATA.map((d, i) => (
            <text
              key={i}
              x={scaleX(i)}
              y={H - PAD.b + 14}
              textAnchor="middle"
              fontSize="9"
              fill="#9CA3AF"
            >
              {d.label}
            </text>
          ))}
        </svg>

        {/* Tooltip */}
        {hovered !== null && (
          <div
            className="absolute top-2 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 z-10 text-[11px] min-w-[120px]"
            style={{ left: `${(scaleX(hovered) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <p className="font-semibold text-gray-700 mb-1.5">{DATA[hovered].label}</p>
            <div className="space-y-1">
              <Row color="#10B981" label="Revenue"  val={DATA[hovered].revenue}  />
              <Row color="#EF4444" label="Expenses" val={DATA[hovered].expenses} />
              <Row color="#3B82F6" label="Net Profit" val={DATA[hovered].profit} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-0.5 rounded-full" style={{ background: color }} />
      <span className="text-[10px] text-gray-500">{label}</span>
    </div>
  );
}

function Row({ color, label, val }: { color: string; label: string; val: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-gray-500">{label}</span>
      </div>
      <span className={`font-semibold ${val < 0 ? "text-red-600" : "text-gray-800"}`}>
        {val < 0 ? `-$${Math.abs(val)}K` : `$${val}K`}
      </span>
    </div>
  );
}
