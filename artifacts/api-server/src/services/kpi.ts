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
export function computeCashRunwayMonths(cashOnHand: number, opex: number): number | null {
  if (!Number.isFinite(cashOnHand) || cashOnHand <= 0) return null;
  if (!Number.isFinite(opex) || opex <= 0) return null;
  const monthsElapsed = new Date().getMonth() + 1;
  const monthlyOpex = opex / monthsElapsed;
  if (!Number.isFinite(monthlyOpex) || monthlyOpex <= 0) return null;
  return cashOnHand / monthlyOpex;
}
