// FinanceOS — shared display formatting
//
// One place for number / currency / percentage / ratio / date formatting so
// every page, card, table and chart renders values identically. Empty-state
// conventions are centralized here too:
//   • a real zero        → "$0" / "0.0%"        (a genuine measured value)
//   • missing/unavailable → DASH ("—")           (no data to show)
//   • not applicable      → NA ("N/A")            (the metric doesn't apply)
//
// Formatters return the appropriate empty-state string when the input is not a
// finite number, so callers never render "NaN", "$undefined" or "$-0".

export const DASH = "—";
export const NA = "N/A";

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** "12.30" → "12.3", "850.0" → "850", "12.00" → "12", "12.34" → "12.34". */
function trimZeros(s: string): string {
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

export type CurrencyOptions = {
  /** Abbreviate large numbers as $1.2K / $3.4M (default true). */
  abbreviate?: boolean;
  /** String shown when the value is missing / not finite (default "—"). */
  fallback?: string;
};

/**
 * Currency with a consistent, decimal-clean abbreviation:
 *   ≥ 1,000,000 → "$1.23M" (≤2 decimals, trailing zeros trimmed)
 *   ≥ 1,000     → "$12.3K" (≤1 decimal,  trailing zeros trimmed)
 *   otherwise   → "$0" / "$850" (whole dollars, grouped)
 * Negatives use a leading minus ("-$1.2K"). Missing → fallback ("—").
 */
export function formatCurrency(n: number | null | undefined, opts: CurrencyOptions = {}): string {
  const { abbreviate = true, fallback = DASH } = opts;
  if (!isFiniteNumber(n)) return fallback;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abbreviate) {
    if (abs >= 1_000_000) return `${sign}$${trimZeros((abs / 1_000_000).toFixed(2))}M`;
    if (abs >= 1_000) return `${sign}$${trimZeros((abs / 1_000).toFixed(1))}K`;
  }
  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}

export type PercentOptions = {
  /** Prefix non-negative values with "+" (default false). */
  signed?: boolean;
  /** Decimal places (default 1). */
  decimals?: number;
  /** String shown when the value is missing / not finite (default "—"). */
  fallback?: string;
};

/** Percentage: "12.4%" (or "+12.4%" when signed). Missing → fallback ("—"). */
export function formatPercent(n: number | null | undefined, opts: PercentOptions = {}): string {
  const { signed = false, decimals = 1, fallback = DASH } = opts;
  if (!isFiniteNumber(n)) return fallback;
  const sign = signed && n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export type RatioOptions = {
  /** Decimal places (default 2). */
  decimals?: number;
  /** Unit suffix (default "×"). */
  suffix?: string;
  /** String shown when the value is missing / not finite (default "—"). */
  fallback?: string;
};

/** Ratio / multiple: "1.5×". Missing → fallback ("—"). */
export function formatRatio(n: number | null | undefined, opts: RatioOptions = {}): string {
  const { decimals = 2, suffix = "×", fallback = DASH } = opts;
  if (!isFiniteNumber(n)) return fallback;
  return `${n.toFixed(decimals)}${suffix}`;
}

/**
 * Day counts (DSO / DPO): "45d". Defaults to NA ("N/A") when missing because a
 * day-count with no underlying balance is "not applicable", not "no data".
 */
export function formatDays(n: number | null | undefined, opts: { fallback?: string } = {}): string {
  const { fallback = NA } = opts;
  if (!isFiniteNumber(n)) return fallback;
  return `${Math.round(n)}d`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-01" → "Jan". Falls back to the raw string if unparseable. */
export function formatMonthShort(month: string): string {
  const idx = Number(month.slice(5, 7)) - 1;
  return MONTH_NAMES[idx] ?? month;
}

/** Short label + short year, e.g. "2026-01" → "Jan 2026". */
export function formatMonthYear(month: string): string {
  const year = month.slice(0, 4);
  return `${formatMonthShort(month)} ${year}`;
}

/** Short label + apostrophe two-digit year for chart ticks, e.g. "2026-01" → "Jan '26". */
export function formatMonthTick(month: string): string {
  const year = month.slice(0, 4);
  const yy = year ? `'${year.slice(2)}` : "";
  return `${formatMonthShort(month)} ${yy}`.trim();
}

export const PARTIAL_MONTH_NOTE =
  "Partial month — the latest month is still in progress and reflects month-to-date figures.";

/**
 * True when the given "YYYY-MM" month is the current, still-in-progress
 * calendar month (so monthly trends can flag it as partial without altering
 * any figures or annualizing).
 */
export function isPartialMonth(month: string, now: Date = new Date()): boolean {
  const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return month === cur;
}
