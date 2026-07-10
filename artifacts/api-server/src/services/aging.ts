/**
 * Shared aging bucket utilities for AR and AP.
 *
 * Used by the Neon DB layer (invoices.ts, bills.ts). Drive transformers
 * use the pre-labeled bucket string from the CSV file directly and do
 * not use these helpers.
 */
import type { AgingBucket } from "../lib/types";

export const AGING_BUCKET_ORDER = ["Current", "1-30", "31-60", "61-90", "90+"] as const;

export function getAgingBucketLabel(daysOverdue: number | null | undefined): string {
  const d = daysOverdue ?? 0;
  if (d <= 0)  return "Current";
  if (d <= 30) return "1-30";
  if (d <= 60) return "31-60";
  if (d <= 90) return "61-90";
  return "90+";
}

export function buildAgingBuckets(
  items: ReadonlyArray<{ balance: number; daysOverdue: number | null | undefined }>,
): AgingBucket[] {
  const map = new Map<string, { amount: number; count: number }>();
  for (const item of items) {
    const label = getAgingBucketLabel(item.daysOverdue);
    const existing = map.get(label) ?? { amount: 0, count: 0 };
    existing.amount += item.balance;
    existing.count  += 1;
    map.set(label, existing);
  }
  return AGING_BUCKET_ORDER
    .filter((label) => map.has(label))
    .map((label) => ({
      label,
      days:   label,
      amount: map.get(label)!.amount,
      count:  map.get(label)!.count,
    }));
}
