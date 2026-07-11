import type { CompanyHealth, HealthCategoryState } from "@/lib/healthScore";
import type { EntityMetrics } from "@/lib/types";

const CX = 100, CY = 108, R = 68;
const START_DEG = 150; // 8 o'clock in SVG space
const TOTAL_DEG = 240;

function polar(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

function arcPath(startDeg: number, sweepDeg: number): string {
  const start = polar(startDeg);
  const end = polar(startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

const STATE_META: Record<HealthCategoryState, { symbol: string; color: string }> = {
  strong: { symbol: "✓", color: "#10B981" },
  fair: { symbol: "⚠", color: "#F59E0B" },
  weak: { symbol: "✗", color: "#EF4444" },
};

// Company Health Score — the overall financial health of the entity. The
// headline (arc, big number, rating) is the single-source, server-computed
// score passed via `score`/`label`; it is never recomputed here. The category
// breakdown below is the local, detail-only decomposition (lib/healthScore.ts),
// reflecting only categories with available data.
type Props = {
  health: CompanyHealth;
  score: number;
  label: EntityMetrics["health_label"];
};

export function CompanyHealth({ health, score, label }: Props) {
  const { categories, excluded } = health;
  const color = score >= 85 ? "#10B981" : score >= 70 ? "#F59E0B" : "#EF4444";
  const scoreDeg = (score / 100) * TOTAL_DEG;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">
        Company Health
      </p>

      <div className="flex flex-col items-center">
        <svg viewBox="0 0 200 150" style={{ width: "100%", maxWidth: 168 }}>
          <path d={arcPath(START_DEG, TOTAL_DEG)} fill="none" stroke="#F3F4F6" strokeWidth="11" strokeLinecap="round" />
          <path d={arcPath(START_DEG, scoreDeg)} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round" />
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize="34" fontWeight="700" fill="#111827">
            {score}
          </text>
          <text x={CX} y={CY + 14} textAnchor="middle" fontSize="13" fill="#9CA3AF">
            /100
          </text>
          <text x={CX} y={CY + 38} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
            {label}
          </text>
        </svg>
      </div>

      {/* Category breakdown — what's helping (✓) or hurting (⚠ / ✗) the score */}
      {categories.length > 0 ? (
        <div className="mt-1 space-y-1.5">
          {categories.map((c) => {
            const meta = STATE_META[c.state];
            return (
              <div key={c.key} className="flex items-center gap-1.5" title={c.detail}>
                <span className="text-[11px] font-bold w-3 flex-shrink-0 text-center" style={{ color: meta.color }}>
                  {meta.symbol}
                </span>
                <span className="text-[11px] text-gray-700 flex-1 min-w-0 truncate">{c.label}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">{Math.round(c.score)}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 text-center py-2">Not enough data to score.</p>
      )}

      {excluded.length > 0 && (
        <p className="text-[10px] text-gray-400 mt-2 leading-snug">
          Excluded (no data): {excluded.map((e) => e.label).join(", ")}
        </p>
      )}
    </div>
  );
}
