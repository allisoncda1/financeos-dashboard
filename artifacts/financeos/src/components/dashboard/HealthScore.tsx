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

// Data Integrity — the arc reflects the pipeline's real validation pass-rate
// (passed / total_checks) from GET /api/model → validation summary. There is
// no fabricated "financial health" score; when the pipeline reports no counts
// the gauge shows an explicit unavailable state.
type Props = {
  passed: number | null;
  totalChecks: number | null;
  allPassed: boolean | null;
};

export function HealthScore({ passed, totalChecks, allPassed }: Props) {
  const hasData = passed !== null && totalChecks !== null && totalChecks > 0;
  const score = hasData ? Math.round((passed! / totalChecks!) * 100) : null;

  const label = score === null ? "—" : score >= 100 ? "All checks passed" : score >= 80 ? "Mostly passing" : "Needs review";
  const color = score === null ? "#D1D5DB" : score >= 100 ? "#10B981" : score >= 80 ? "#F59E0B" : "#EF4444";
  const scoreDeg = ((score ?? 0) / 100) * TOTAL_DEG;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col">
      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-3">
        Data Integrity
      </p>

      <div className="flex-1 flex flex-col items-center">
        <svg viewBox="0 0 200 175" style={{ width: "100%", maxWidth: 180 }}>
          <path
            d={arcPath(START_DEG, TOTAL_DEG)}
            fill="none"
            stroke="#F3F4F6"
            strokeWidth="11"
            strokeLinecap="round"
          />
          {score !== null && (
            <path
              d={arcPath(START_DEG, scoreDeg)}
              fill="none"
              stroke={color}
              strokeWidth="11"
              strokeLinecap="round"
            />
          )}
          <text x={CX} y={CY - 8} textAnchor="middle" fontSize="34" fontWeight="700" fill="#111827">
            {score === null ? "—" : score}
          </text>
          {score !== null && (
            <text x={CX} y={CY + 15} textAnchor="middle" fontSize="13" fill="#9CA3AF">
              /100
            </text>
          )}
          <text x={CX} y={CY + 40} textAnchor="middle" fontSize="12" fontWeight="600" fill={color}>
            {label}
          </text>
        </svg>

        <p className="text-[11px] text-gray-400 text-center leading-relaxed mt-1 px-2">
          {hasData
            ? `${passed}/${totalChecks} validation checks passed${allPassed ? "." : " — some need review."}`
            : "Validation results not reported yet."}
        </p>
      </div>
    </div>
  );
}
