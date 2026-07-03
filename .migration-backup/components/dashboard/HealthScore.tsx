const CX = 100, CY = 108, R = 68;
const START_DEG = 150; // 8 o'clock in SVG space
const TOTAL_DEG = 240;

function polar(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
}

function arcPath(startDeg: number, sweepDeg: number): string {
  const start = polar(startDeg);
  const end   = polar(startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

type Props = { score: number; validation40: boolean };

export function HealthScore({ score, validation40 }: Props) {
  const label = score >= 90 ? "Excellent" : score >= 75 ? "Good" : "Needs Attention";
  const color = score >= 90 ? "#10B981" : score >= 75 ? "#F59E0B" : "#EF4444";
  const scoreDeg = (score / 100) * TOTAL_DEG;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
        Financial Health
      </p>

      <div className="flex-1 flex flex-col items-center">
        <svg viewBox="0 0 200 175" style={{ width: "100%", maxWidth: 180 }}>
          {/* Track */}
          <path
            d={arcPath(START_DEG, TOTAL_DEG)}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="11"
            strokeLinecap="round"
          />
          {/* Score arc */}
          <path
            d={arcPath(START_DEG, scoreDeg)}
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeLinecap="round"
          />
          {/* Score text */}
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize="38" fontWeight="700" fill="#111827">
            {score}
          </text>
          <text x={CX} y={CY + 15} textAnchor="middle" fontSize="13" fill="#9CA3AF">
            /100
          </text>
          {/* Label */}
          <text x={CX} y={CY + 40} textAnchor="middle" fontSize="12" fontWeight="600" fill={color}>
            {label}
          </text>
        </svg>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed mt-1 px-2">
          {validation40
            ? "40/40 validation checks passed. Strong data integrity."
            : "Some validation checks need review."}
        </p>

        <button className="mt-3 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700">
          View Details →
        </button>
      </div>
    </div>
  );
}
