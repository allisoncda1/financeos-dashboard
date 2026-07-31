/**
 * banking-utils.ts — Pure utilities for banking overview and account-detail.
 * No React, no fetch — safe to unit-test without DOM.
 */

const COLOR_PALETTE = [
  { bg: "#0A1628", text: "#FFFFFF" },
  { bg: "#1C5FAD", text: "#FFFFFF" },
  { bg: "#0F6E3C", text: "#FFFFFF" },
  { bg: "#6B21A8", text: "#FFFFFF" },
  { bg: "#B45309", text: "#FFFFFF" },
  { bg: "#1D4ED8", text: "#FFFFFF" },
];

/**
 * Deterministic color for an institution name — used as a local initial-letter
 * avatar fallback. NOT a Plaid institution logo. (plaid_items stores only
 * institution_id and institution_name; institutionsGet is not called during
 * token exchange so no logo URL is available.)
 */
export function institutionColor(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  }
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}

/** Human-readable relative time from an ISO-8601 timestamp. */
export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

/**
 * Sum of available cash across depository and investment accounts.
 * Credit availableBalance is remaining credit limit — not spendable cash —
 * and is intentionally excluded.
 */
export function totalAvailableCash(
  accounts: {
    type: string | null;
    availableBalance: number | null;
    currentBalance: number | null;
  }[],
): number {
  return accounts
    .filter((a) => a.type === "depository" || a.type === "investment")
    .reduce((sum, a) => sum + (a.availableBalance ?? a.currentBalance ?? 0), 0);
}
