import { useState } from "react";
import type { MonthlyPL } from "@/lib/types";

const W = 560, H = 200;
const PAD = { l: 52, r: 16, t: 20, b: 40 };
const CW = W - PAD.l - PAD.r;
const CH = H - PAD.t - PAD.b;

type Point = { label: string; revenue: number; expenses: number; profit: number };

function monthLabel(month: string): string {
  // month is "YYYY-MM"; render as "Jan '26"
  const [y, m] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Number(m) - 1;
  const name = names[idx] ?? month;
  const yy = y ? `'${y.slice(2)}` : "";
  return `${name} ${yy}`.trim();
}

function fmtAxis(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

function fmtTip(v: number): string {
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

function niceStep(range: number): number {
  const rough = range / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  const candidates = [1, 2, 2.5, 5, 10].map(c => c * pow);
  return candidates.find(c => c >= rough) ?? candidates[candidates.length - 1];
}

export function ProfitChart({ data }: { data: MonthlyPL[] | null }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const points: Point[] = (data ?? []).map(d => ({
    label: monthLabel(d.month),
    revenue: d.revenue,
    expenses: d.cogs + d.opex,
    profit: d.net_income,
  }));

  const header = (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Profit Over Time</p>
        <p className="text-[11px] text-gray-500 mt-0.5">Revenue, Expenses &amp; Net Profit</p>
      </div>
      <div className="flex items-center gap-4">
        <Legend color="#10B981" label="Revenue" />
        <Legend color="#EF4444" label="Expenses" />
        <Legend color="#3B82F6" label="Net Profit" />
      </div>
    </div>
  );

  if (points.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
        {header}
        <div className="h-[200px] flex items-center justify-center text-[12px] text-gray-400">
          Not available yet
        </div>
      </div>
    );
  }

  // Dynamic scale from real values
  const allVals = points.flatMap(p => [p.revenue, p.expenses, p.profit]);
  let minV = Math.min(0, ...allVals);
  let maxV = Math.max(0, ...allVals);
  const step = niceStep(maxV - minV || 1);
  minV = Math.floor(minV / step) * step;
  maxV = Math.ceil(maxV / step) * step;
  const range = maxV - minV || 1;

  const scaleY = (v: number) => PAD.t + ((maxV - v) / range) * CH;
  const scaleX = (i: number) => points.length === 1
    ? PAD.l + CW / 2
    : PAD.l + (i * CW) / (points.length - 1);

  const grid: number[] = [];
  for (let v = minV; v <= maxV + 1e-6; v += step) grid.push(Math.round(v));

  const pts = (series: keyof Omit<Point, "label">) =>
    points.map((d, i) => `${scaleX(i).toFixed(1)},${scaleY(d[series]).toFixed(1)}`).join(" ");

  const areaPath = (series: keyof Omit<Point, "label">) => {
    const bottom = scaleY(minV);
    return (
      `M ${scaleX(0).toFixed(1)} ${bottom.toFixed(1)} ` +
      points.map((d, i) => `L ${scaleX(i).toFixed(1)} ${scaleY(d[series]).toFixed(1)}`).join(" ") +
      ` L ${scaleX(points.length - 1).toFixed(1)} ${bottom.toFixed(1)} Z`
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      {header}

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", display: "block" }}
          onMouseLeave={() => setHovered(null)}
        >
          {grid.map(v => {
            const y = scaleY(v);
            return (
              <g key={v}>
                <line
                  x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
                  stroke={v === 0 ? "#D1D5DB" : "#F3F4F6"}
                  strokeWidth={1}
                  strokeDasharray={v === 0 ? "0" : "3,3"}
                />
                <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">
                  {fmtAxis(v)}
                </text>
              </g>
            );
          })}

          <path d={areaPath("revenue")}  fill="rgba(16,185,129,0.05)"  />
          <path d={areaPath("expenses")} fill="rgba(239,68,68,0.05)"   />
          <path d={areaPath("profit")}   fill="rgba(59,130,246,0.07)"  />

          <polyline points={pts("revenue")}  fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts("expenses")} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points={pts("profit")}   fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {points.map((d, i) => {
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

          {points.map((d, i) => (
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

        {hovered !== null && points[hovered] && (
          <div
            className="absolute top-2 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-lg p-2.5 z-10 text-[11px] min-w-[120px]"
            style={{ left: `${(scaleX(hovered) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <p className="font-semibold text-gray-700 mb-1.5">{points[hovered].label}</p>
            <div className="space-y-1">
              <Row color="#10B981" label="Revenue"    val={points[hovered].revenue}  />
              <Row color="#EF4444" label="Expenses"   val={points[hovered].expenses} />
              <Row color="#3B82F6" label="Net Profit" val={points[hovered].profit}   />
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
        {fmtTip(val)}
      </span>
    </div>
  );
}
