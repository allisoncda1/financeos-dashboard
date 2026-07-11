import type { Alert, AlertSeverity } from "@/lib/types";

const SEVERITY_ICON: Record<AlertSeverity, { symbol: string; bg: string; color: string }> = {
  critical: { symbol: "!", bg: "#FEF2F2", color: "#DC2626" },
  high:     { symbol: "!", bg: "#FEF2F2", color: "#EF4444" },
  medium:   { symbol: "⚠", bg: "#FFFBEB", color: "#F59E0B" },
  low:      { symbol: "i", bg: "#EFF6FF", color: "#3B82F6" },
  info:     { symbol: "i", bg: "#EFF6FF", color: "#3B82F6" },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

type Props = {
  /** Real, entity-filtered alerts from GET /api/alerts (Core `alerts` table). */
  alerts: Alert[] | null;
};

export function RecentAlerts({ alerts }: Props) {
  const loading = alerts === null;
  const items = (alerts ?? []).slice(0, 3);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Recent Alerts</p>
          {!loading && (
            <span className="bg-red-100 text-red-600 text-[9px] font-bold rounded-full px-1.5 py-0.5">
              {(alerts ?? []).length}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-[11px] text-gray-400 py-4 text-center">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-gray-400 py-4 text-center">No open alerts for this entity.</p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const s = SEVERITY_ICON[a.severity] ?? SEVERITY_ICON.medium;
            return (
              <div key={a.id} className="flex items-start gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: s.bg }}
                >
                  <span className="text-[12px] font-bold" style={{ color: s.color }}>
                    {s.symbol}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-gray-800 leading-snug">{a.title}</p>
                  <p className="text-[10px] text-gray-500 leading-snug mt-0.5 line-clamp-2">{a.description}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 text-left mt-1">
        View All Alerts →
      </button>
    </div>
  );
}
