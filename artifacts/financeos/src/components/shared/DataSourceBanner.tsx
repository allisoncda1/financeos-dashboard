import { useSyncExternalStore } from "react";
import { DatabaseZap, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDataSourceSnapshot, subscribeDataSource, DEV_MODE } from "@/lib/dataState";

/**
 * DataSourceBanner — subscribes to every currently-mounted data hook via the
 * shared registry (see lib/dataState.ts) and shows the worst-case source
 * across them. Renders nothing when data is trustworthy, so it never adds
 * visual noise on the happy path — it only appears when data is not what a
 * user would expect (mock or unavailable).
 *
 * "cache" is intentionally treated as healthy and renders nothing: it only
 * means the api-server served the Drive fallback from its short-lived (5 min)
 * in-memory cache, which is at most minutes old — not stale financial data.
 * Actual data freshness is surfaced separately via the pipeline "Data as of"
 * indicator (getDataFreshness / pipeline status), not by this banner.
 */
export function DataSourceBanner() {
  const snapshot = useSyncExternalStore(subscribeDataSource, getDataSourceSnapshot);
  const { source, lastSuccessfulFetch } = snapshot;

  if (source === "db" || source === "live" || source === "cache" || source === "loading") return null;

  const config = {
    mock: {
      icon: DatabaseZap,
      label: DEV_MODE ? "Sample data (dev mode)" : "Showing sample data",
      tone: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900",
    },
    unavailable: {
      icon: WifiOff,
      label: "Live data unavailable",
      tone: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    },
  }[source];

  const Icon = config.icon;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2 border-b px-4 py-1.5 text-xs font-medium",
        config.tone,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{config.label}</span>
      {lastSuccessfulFetch && (
        <span className="text-[11px] opacity-70">
          · last live update {new Date(lastSuccessfulFetch).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

/** Tiny inline badge variant for use alongside a specific widget/panel. */
export function DataSourceBadge({ source }: { source: "live" | "cache" | "mock" | "loading" | "unavailable" }) {
  if (source === "live" || source === "loading") return null;

  const label = { mock: "Sample data", cache: "Cached", unavailable: "Unavailable" }[source];
  const tone = {
    mock: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    cache: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
    unavailable: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  }[source];

  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", tone)}>
      {label}
    </span>
  );
}

export function LoadingIndicator() {
  return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
}
