import type { Anomaly } from "@/lib/types";

const SEVERITY_ICON: Record<string, { symbol: string; bg: string; color: string }> = {
  error:   { symbol: "!", bg: "#FEF2F2", color: "#EF4444" },
  warning: { symbol: "⚠", bg: "#FFFBEB", color: "#F59E0B" },
  info:    { symbol: "i", bg: "#EFF6FF", color: "#3B82F6" },
};

type Props = { anomalies: Anomaly[] };

export function RecentAlerts({ anomalies }: Props) {
  const displayAnomalies = anomalies.slice(0, 3);

  const fallback = [
    { rule: "AR-001",  severity: "warning" as const, description: "Overdue invoice — Mazda of Columbia · #1043", amount: 16250,  period: "2 days overdue" },
    { rule: "BNK-002", severity: "info"    as const, description: "Bank reconciliation needed — Chase *1234", amount: 0, period: "May 31 · Unreconciled" },
    { rule: "EXP-003", severity: "warning" as const, description: "Large expense — Digital Ads spend spike",   amount: 2450, period: "Needs review" },
  ];

  const items = displayAnomalies.length > 0 ? displayAnomalies : fallback;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Recent Alerts</p>
          <span className="bg-red-100 text-red-600 text-[9px] font-bold rounded-full px-1.5 py-0.5">
            {items.length}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((a, i) => {
          const s = SEVERITY_ICON[a.severity] ?? SEVERITY_ICON.warning;
          return (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: s.bg }}
              >
                <span className="text-[12px] font-bold" style={{ color: s.color }}>
                  {s.symbol}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-800 leading-snug">{a.description}</p>
                <div className="flex items-center justify-between mt-0.5 gap-2">
                  <p className="text-[10px] text-gray-400">{a.period}</p>
                  {a.amount > 0 && (
                    <p className="text-[11px] font-semibold text-gray-700 flex-shrink-0">
                      ${a.amount.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 text-left mt-1">
        View All Alerts →
      </button>
    </div>
  );
}
