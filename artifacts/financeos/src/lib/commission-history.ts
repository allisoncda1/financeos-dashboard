/** Operational commission tracking began on this date. */
export const COMMISSION_LIVE_START_DATE = "2026-07-01";

const MONTH_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

/**
 * True when invoiceDate precedes operational commission tracking.
 * Historical invoices are shown as "Historical — Settled" and excluded
 * from Needs Config / Needs Review / pending payout totals.
 */
export function isHistoricalInvoice(invoiceDate: string | null | undefined): boolean {
  if (!invoiceDate) return false;
  return invoiceDate.slice(0, 10) < COMMISSION_LIVE_START_DATE;
}

/**
 * True when a YYYY-MM period is entirely before commission tracking began.
 * null (all-time) is NOT treated as a historical-only period.
 */
export function isHistoricalPeriod(period: string | null): boolean {
  if (!period) return false;
  return period < "2026-07";
}

/**
 * Computes next-payout display from a given Date (defaults to now).
 * Always uses the current calendar month — independent of any UI filter.
 *
 * July 2026  → earningMonth="July 2026",  dueMonth="August 2026",    dueYear=2026
 * December 2026 → earningMonth="December 2026", dueMonth="January 2027", dueYear=2027
 */
export function getNextPayoutInfo(now: Date = new Date()): {
  earningMonth: string;
  dueMonth: string;
  dueMonthShort: string;
  dueYear: number;
  dueDay: number;
} {
  const SHORT = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const cur  = now.getMonth();
  const year = now.getFullYear();
  const nxt  = cur === 11 ? 0 : cur + 1;
  const nxtY = cur === 11 ? year + 1 : year;
  return {
    earningMonth:  `${MONTH_FULL[cur]} ${year}`,
    dueMonth:      `${MONTH_FULL[nxt]} ${nxtY}`,
    dueMonthShort: SHORT[nxt],
    dueYear:       nxtY,
    dueDay:        5,
  };
}
