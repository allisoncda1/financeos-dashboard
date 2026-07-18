/**
 * Budget seed script — 2026 run-rate targets from YTD actuals.
 *
 * Past months (where actuals exist): target = actual for that month.
 * Future months: target = average monthly actual (YTD / months with data).
 *
 * Dry-run by default — prints all proposed targets, writes nothing.
 * Pass --confirm to write to the database.
 * Uses ON CONFLICT DO NOTHING — never overwrites user-entered budgets.
 *
 * Run:
 *   pnpm --filter @workspace/db run seed-budget            # dry run
 *   pnpm --filter @workspace/db run seed-budget -- --confirm  # write
 */
export {};
//# sourceMappingURL=seed-budget.d.ts.map