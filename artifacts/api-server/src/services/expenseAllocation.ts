/**
 * Expense Allocation Engine — splits a source expense (a vendor invoice line,
 * or a payroll pool) across one or more commission_run_lines.
 *
 * All arithmetic is BigInt cents — no floating point anywhere. Reuses the
 * same scaled-decimal primitives as commissionEngine.ts (parseToScaled /
 * centsToString) so there is exactly one monetary arithmetic implementation
 * in the commission module, not two.
 *
 * Methods:
 *   fixed_amount          — a specific dollar amount, as entered.
 *   percentage_of_expense  — a percentage of the source expense's total.
 *   full_expense           — the entire source expense amount.
 *   prorata_revenue        — split across N invoices by their share of
 *                            eligible revenue, using the largest-remainder
 *                            method so the parts always sum to the pool
 *                            exactly and rounding is deterministic/auditable.
 */
import { parseToScaled } from "./commissionEngine";

const CENTS_DIVISOR = 1_000_000n; // 10^8 / 10^2

/** Convert a validated 2dp monetary string to whole cents (BigInt). */
function toCents(amount: string): bigint {
  const scaled = parseToScaled(amount);
  if (scaled % CENTS_DIVISOR !== 0n) {
    throw new Error(`Amount must have at most 2 decimal places: "${amount}"`);
  }
  return scaled / CENTS_DIVISOR;
}

/** Format a whole-cents BigInt as a 2dp dollar string, e.g. 291248n -> "2912.48". */
function centsToDollarString(cents: bigint): string {
  const sign = cents < 0n ? -1n : 1n;
  const abs = cents < 0n ? -cents : cents;
  const dollars = abs / 100n;
  const rem = abs % 100n;
  return `${sign < 0n ? "-" : ""}${dollars}.${String(rem).padStart(2, "0")}`;
}

export interface ProrataInput {
  /** Stable identifier used only for deterministic tie-breaking (e.g. commission_run_line id). */
  id: string;
  /** Eligible revenue for this invoice, as a 2dp monetary string. */
  revenue: string;
}

export interface ProrataShare {
  id: string;
  /** Allocated amount for this invoice, as a 2dp monetary string. */
  amount: string;
}

/**
 * allocateProrata — splits `pool` across `inputs` proportional to each
 * input's revenue share, using the largest-remainder method:
 *   1. Compute each exact share in cents (floor division).
 *   2. The pool total minus the sum of floored shares is the leftover
 *      (always a small non-negative number of whole cents).
 *   3. Distribute the leftover one cent at a time to the entries with the
 *      largest fractional remainder, breaking ties by `id` ascending — a
 *      stable, deterministic, auditable rule.
 *
 * Throws if `inputs` is empty or total revenue is zero (nothing to prorate
 * against — caller must not silently skip this and drop the pool).
 */
export function allocateProrata(pool: string, inputs: ProrataInput[]): ProrataShare[] {
  if (inputs.length === 0) {
    throw new Error("allocateProrata requires at least one input invoice");
  }
  const poolCents = toCents(pool);
  const revenueCents = inputs.map((i) => toCents(i.revenue));
  const totalRevenueCents = revenueCents.reduce((a, b) => a + b, 0n);
  if (totalRevenueCents <= 0n) {
    throw new Error("allocateProrata requires positive total eligible revenue across all inputs");
  }

  const floored: bigint[] = [];
  const remainders: bigint[] = [];
  for (const rc of revenueCents) {
    const numerator = poolCents * rc;
    const share = numerator / totalRevenueCents;      // floor (BigInt division truncates toward zero; numerator/denominator both non-negative here)
    const remainder = numerator % totalRevenueCents;
    floored.push(share);
    remainders.push(remainder);
  }

  const sumFloored = floored.reduce((a, b) => a + b, 0n);
  let leftover = poolCents - sumFloored;
  if (leftover < 0n) {
    // Should be unreachable given floor division, but never silently
    // absorb a negative leftover — surface it instead of miscomputing.
    throw new Error("allocateProrata: negative leftover — internal invariant violated");
  }

  // Rank indices by remainder descending, tie-broken by id ascending (stable, deterministic).
  const order = inputs.map((_, idx) => idx).sort((a, b) => {
    if (remainders[b] !== remainders[a]) return remainders[b] > remainders[a] ? 1 : -1;
    return inputs[a].id < inputs[b].id ? -1 : inputs[a].id > inputs[b].id ? 1 : 0;
  });

  const finalCents = [...floored];
  for (const idx of order) {
    if (leftover <= 0n) break;
    finalCents[idx] += 1n;
    leftover -= 1n;
  }

  return inputs.map((input, idx) => ({ id: input.id, amount: centsToDollarString(finalCents[idx]) }));
}

/** fixed_amount — the amount is exactly what was entered; validated, not recomputed. */
export function allocateFixedAmount(amount: string): string {
  return centsToDollarString(toCents(amount));
}

/**
 * percentage_of_expense — a percentage of the source expense's total amount.
 * `percentage` is a human-entered number meaning percent, e.g. "7.5" for
 * 7.5% (NOT a 0-1 rate) — matches how a reviewer would type it from an
 * invoice ("MCA charges 7.5% of ad budget").
 *
 * result_cents = expenseTotal(scaled 10^8) * percentage(scaled 10^8) / 10^16,
 * with an extra /100 for the percent→fraction conversion, i.e. divide the
 * raw 10^16-scaled product by 10^16*100/100 = 10^16 overall... expressed
 * directly: divisor = 10^14 * 100 = 10^16, rounded half-away-from-zero.
 * Verified against the confirmed example: 1000.00 @ 7.5% = 75.00 exactly.
 */
export function allocatePercentageOfExpense(expenseTotal: string, percentage: string): string {
  const totalScaled = parseToScaled(expenseTotal);
  const pctScaled = parseToScaled(percentage);
  const product = totalScaled * pctScaled; // scaled by 10^16
  const DIVISOR = 100_000_000_000_000n * 100n; // 10^16
  const HALF = DIVISOR / 2n;
  const sign = product < 0n ? -1n : 1n;
  const absP = product < 0n ? -product : product;
  const cents = (absP + HALF) / DIVISOR;
  return centsToDollarString(sign * cents);
}

/** full_expense — the entire source expense amount is allocated to a single invoice. */
export function allocateFullExpense(expenseTotal: string): string {
  return centsToDollarString(toCents(expenseTotal));
}

/** Sum a list of 2dp monetary strings using exact BigInt cents arithmetic. */
export function sumAmounts(amounts: string[]): string {
  const total = amounts.reduce((acc, a) => acc + toCents(a), 0n);
  return centsToDollarString(total);
}

/** gross_profit = eligible_revenue - confirmed_allocated_expenses (BigInt cents, never approximated). */
export function computeGrossProfit(eligibleRevenue: string, confirmedAllocatedExpenses: string): string {
  const rev = toCents(eligibleRevenue);
  const exp = toCents(confirmedAllocatedExpenses);
  return centsToDollarString(rev - exp);
}

export { toCents, centsToDollarString };
