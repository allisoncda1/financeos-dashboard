/**
 * Shared period filter model for FinanceOS modules.
 *
 * Usage:
 *   import { resolvePeriod, PERIOD_PRESET_OPTIONS } from "@/lib/period";
 *   const period = resolvePeriod("ytd");
 *   // → { preset: "ytd", from: "2026-01-01", to: "2026-07-27", label: "YTD 2026" }
 *
 * Currently wired in: Accounting module.
 * Pending adoption: Budget, Forecast, Commission, Analytics, Reporting.
 */

export type PeriodPreset =
  | "ytd"
  | "last_year"
  | "last_12_months"
  | "last_6_months"
  | "last_3_months"
  | "this_month"
  | "custom"
  | "all_time";

export type PeriodFilter = {
  preset: PeriodPreset;
  /** ISO date YYYY-MM-DD, inclusive start. null = no lower bound (all_time / unset custom). */
  from: string | null;
  /** ISO date YYYY-MM-DD, inclusive end. null = no upper bound (all_time / unset custom). */
  to: string | null;
  /** Human-readable label for the selector trigger. */
  label: string;
};

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(d: Date, months: number): Date {
  const result = new Date(d);
  result.setMonth(result.getMonth() + months);
  return result;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Resolve a preset to a concrete PeriodFilter with from/to dates.
 * All dates are computed relative to the moment resolvePeriod() is called.
 * For "custom", pass the explicit from/to via the second argument.
 */
export function resolvePeriod(
  preset: PeriodPreset,
  custom?: { from: string | null; to: string | null },
): PeriodFilter {
  const today = new Date();
  const todayStr = toYMD(today);
  const year = today.getFullYear();

  switch (preset) {
    case "ytd":
      return {
        preset,
        from: `${year}-01-01`,
        to: todayStr,
        label: `YTD ${year}`,
      };

    case "last_year": {
      const ly = year - 1;
      return {
        preset,
        from: `${ly}-01-01`,
        to: `${ly}-12-31`,
        label: String(ly),
      };
    }

    case "last_12_months": {
      const from = toYMD(addDays(addMonths(today, -12), 1));
      return { preset, from, to: todayStr, label: "Last 12 months" };
    }

    case "last_6_months": {
      const from = toYMD(addDays(addMonths(today, -6), 1));
      return { preset, from, to: todayStr, label: "Last 6 months" };
    }

    case "last_3_months": {
      const from = toYMD(addDays(addMonths(today, -3), 1));
      return { preset, from, to: todayStr, label: "Last 3 months" };
    }

    case "this_month": {
      const m = String(today.getMonth() + 1).padStart(2, "0");
      return {
        preset,
        from: `${year}-${m}-01`,
        to: todayStr,
        label: "This month",
      };
    }

    case "custom":
      return {
        preset,
        from: custom?.from ?? null,
        to: custom?.to ?? null,
        label:
          custom?.from && custom?.to
            ? `${custom.from} – ${custom.to}`
            : "Custom range",
      };

    case "all_time":
      return { preset, from: null, to: null, label: "All time" };

    default:
      // Fallback to YTD — keeps the context in a valid state after a stale localStorage value
      return {
        preset: "ytd",
        from: `${year}-01-01`,
        to: todayStr,
        label: `YTD ${year}`,
      };
  }
}

/** Default period used on first load and context initialisation. */
export function defaultPeriod(): PeriodFilter {
  return resolvePeriod("ytd");
}

/** Preset options shown in the period selector dropdown (no custom — requires separate date picker UI). */
export const PERIOD_PRESET_OPTIONS: { value: PeriodPreset; label: string }[] = [
  { value: "ytd",            label: "This Year / YTD" },
  { value: "last_year",      label: "Last Year" },
  { value: "last_12_months", label: "Last 12 Months" },
  { value: "last_6_months",  label: "Last 6 Months" },
  { value: "last_3_months",  label: "Last 3 Months" },
  { value: "this_month",     label: "This Month" },
  { value: "all_time",       label: "All Time" },
];

/** Build a `?from=…&to=…` query-string fragment for API calls. Returns "" when both are null. */
export function periodQueryParams(from: string | null, to: string | null): string {
  const parts: string[] = [];
  if (from) parts.push(`from=${encodeURIComponent(from)}`);
  if (to)   parts.push(`to=${encodeURIComponent(to)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}
