/**
 * Shared KPI computation utilities.
 *
 * Portfolio-level functions return NaN when inputs are missing or revenue
 * is zero. The frontend fmt() treats non-finite numbers as "N/A" rather
 * than "$0", which correctly signals absent data. Entity-level callers that
 * need 0 instead of NaN guard with: `revenue > 0 ? computeX(...) : 0`.
 *
 * cash_runway_months returns null (not NaN) because it is an optional field
 * — the UI renders null as "—", not "N/A".
 */

export function computeNetMarginPct(netIncome: number, revenue: number): number {
  if (!Number.isFinite(revenue) || revenue === 0) return NaN;
  return (netIncome / revenue) * 100;
}

export function computeGrossMarginPct(grossProfit: number, revenue: number): number {
  if (!Number.isFinite(revenue) || revenue === 0) return NaN;
  return (grossProfit / revenue) * 100;
}

/**
 * Months of cash remaining at the current YTD burn rate.
 * opex is annualised by dividing by months elapsed so the estimate is
 * correct mid-year (otherwise January would always show 12× runway).
 */
export function computeVariance(actual: number, target: number): number {
  return actual - target;
}

export function computeVariancePct(actual: number, target: number): number {
  if (!Number.isFinite(target) || target === 0) return NaN;
  return ((actual - target) / Math.abs(target)) * 100;
}

export function computeAttainmentPct(actual: number, target: number): number {
  if (!Number.isFinite(target) || target === 0) return NaN;
  return (actual / target) * 100;
}

export function budgetHealthStatus(attainmentPct: number): "on-track" | "at-risk" | "behind" {
  if (!Number.isFinite(attainmentPct)) return "behind";
  if (attainmentPct >= 95) return "on-track";
  if (attainmentPct >= 80) return "at-risk";
  return "behind";
}

/**
 * Standard DSO (Days Sales Outstanding) = (openAr / revenue) * periodDays.
 *
 * Source contract:
 *   openAr    — Summary-sourced open AR from financial_periods.open_ar or
 *               entity_snapshots.arap.open_ar (the same YTD snapshot value).
 *   revenue   — YTD revenue from financial_periods.revenue for the same period.
 *   periodDays— Calendar days in the YTD period (periodEnd - periodStart + 1),
 *               typically 181 days for H1, 365 for a full year.
 *
 * The pipeline also publishes a weighted-days-overdue figure per customer
 * (entity_snapshots.arap.dso_days). That is a DIFFERENT metric — it weights
 * each customer's outstanding balance by how many days past due their invoices
 * are — and should be labelled "Weighted AR Days Overdue" wherever it appears.
 * This function computes the standard (turnover-based) DSO only.
 *
 * Returns null when revenue ≤ 0, either input is not finite, or periodDays ≤ 0.
 */
export function computeStandardDso(
  openAr: number,
  revenue: number,
  periodDays: number,
): number | null {
  if (!Number.isFinite(openAr) || !Number.isFinite(revenue) || revenue <= 0) return null;
  if (!Number.isFinite(periodDays) || periodDays <= 0) return null;
  return (openAr / revenue) * periodDays;
}

export function computeCashRunwayMonths(cashOnHand: number, opex: number): number | null {
  if (!Number.isFinite(cashOnHand) || cashOnHand <= 0) return null;
  if (!Number.isFinite(opex) || opex <= 0) return null;
  const monthsElapsed = new Date().getMonth() + 1;
  const monthlyOpex = opex / monthsElapsed;
  if (!Number.isFinite(monthlyOpex) || monthlyOpex <= 0) return null;
  return cashOnHand / monthlyOpex;
}
