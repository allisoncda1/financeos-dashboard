import type { Anomaly } from "@/lib/types";

type Props = { anomalies: Anomaly[] };

const SEVERITY_STYLES = {
  warning: {
    container: "bg-amber-50 border-amber-200",
    header: "text-amber-800",
    icon: "⚠",
    iconColor: "text-amber-500",
    rule: "text-amber-500",
    text: "text-amber-800",
    period: "text-amber-600",
  },
  error: {
    container: "bg-red-50 border-red-200",
    header: "text-red-800",
    icon: "✕",
    iconColor: "text-red-500",
    rule: "text-red-500",
    text: "text-red-800",
    period: "text-red-600",
  },
  info: {
    container: "bg-blue-50 border-blue-200",
    header: "text-blue-800",
    icon: "ℹ",
    iconColor: "text-blue-500",
    rule: "text-blue-500",
    text: "text-blue-800",
    period: "text-blue-600",
  },
} as const;

export function AnomalyList({ anomalies }: Props) {
  if (anomalies.length === 0) return null;

  const primary = anomalies[0].severity in SEVERITY_STYLES
    ? anomalies[0].severity
    : "warning";
  const s = SEVERITY_STYLES[primary];

  return (
    <div className={`rounded-xl border p-4 ${s.container}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-sm ${s.iconColor}`}>{s.icon}</span>
        <h3 className={`text-sm font-semibold ${s.header}`}>
          {anomalies.length} anomal{anomalies.length !== 1 ? "ies" : "y"} detected
        </h3>
      </div>

      <div className="space-y-2.5">
        {anomalies.map((a, i) => {
          const style = a.severity in SEVERITY_STYLES
            ? SEVERITY_STYLES[a.severity as keyof typeof SEVERITY_STYLES]
            : s;
          return (
            <div key={i} className="flex items-start gap-3 text-sm">
              <span className={`text-xs font-mono mt-0.5 flex-shrink-0 font-semibold ${style.rule}`}>
                Rule {a.rule}
              </span>
              <div className="min-w-0">
                <p className={style.text}>{a.description}</p>
                <p className={`text-xs mt-0.5 ${style.period}`}>{a.period}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
