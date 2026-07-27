import { AlertTriangle } from "lucide-react";
import type { PriorPeriodMeta } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { PeriodPreset } from "@/lib/period";

type PriorPeriodBannerProps = {
  priorPeriod: PriorPeriodMeta;
  itemLabel: string;
  onViewAllTime?: () => void;
};

function fmtDate(d: string | null): string {
  if (!d) return "unknown";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[Number(m) - 1]} ${Number(day)}, ${y}`;
}

/**
 * Amber notice shown when period filtering excludes open items that predate
 * the selected period start. These items are real data — they are not deleted
 * or hidden; they are excluded from current operating totals and surfaced here
 * for legacy cleanup.
 */
export function PriorPeriodBanner({ priorPeriod, itemLabel, onViewAllTime }: PriorPeriodBannerProps) {
  const { count, totalBalance, earliestDate, latestDate } = priorPeriod;

  return (
    <div
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start"
      data-testid="prior-period-banner"
      role="status"
      aria-label="Prior-period open items excluded from current totals"
    >
      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold">
          Prior-period open {itemLabel} excluded from current operational totals
        </p>
        <p className="text-amber-800 mt-1 text-xs">
          {count} open {itemLabel}{count !== 1 ? "s" : ""}
          {totalBalance !== undefined && totalBalance > 0
            ? ` totalling ${formatCurrency(totalBalance)}`
            : ""}
          {" "}dated before the selected period
          {earliestDate && latestDate
            ? ` (${fmtDate(earliestDate)} – ${fmtDate(latestDate)})`
            : ""}
          . These records are preserved in full — switch to{" "}
          {onViewAllTime ? (
            <button
              type="button"
              className="underline font-semibold hover:text-amber-900 focus:outline-none"
              onClick={onViewAllTime}
            >
              All Time
            </button>
          ) : (
            <span className="font-semibold">All Time</span>
          )}{" "}
          to view and action prior-period cleanup items.
        </p>
      </div>
    </div>
  );
}

/** Convenience: only renders when priorPeriod is truthy and has count > 0. */
export function PriorPeriodBannerGuard({
  priorPeriod,
  itemLabel,
  onViewAllTime,
}: {
  priorPeriod?: PriorPeriodMeta | null;
  itemLabel: string;
  onViewAllTime?: () => void;
}) {
  if (!priorPeriod || priorPeriod.count === 0) return null;
  return (
    <PriorPeriodBanner
      priorPeriod={priorPeriod}
      itemLabel={itemLabel}
      onViewAllTime={onViewAllTime}
    />
  );
}
