/**
 * Budget seed script — 2026 run-rate targets from YTD actuals.
 *
 * Generates monthly budget targets for each entity:
 *   - Past months (Jan–Jun 2026):  target = actual for that month
 *   - Future months (Jul–Dec 2026): target = average monthly actual (YTD / months elapsed)
 *
 * Behavior:
 *   - Dry-run mode by default: prints targets but writes NOTHING.
 *   - Pass --confirm to write to the database.
 *   - Uses INSERT ... ON CONFLICT DO NOTHING — never overwrites existing user-entered budgets.
 *   - Skips months where no actual data exists in financial_periods.
 *
 * Usage:
 *   npx tsx scripts/seed-budget.ts                  # dry run
 *   npx tsx scripts/seed-budget.ts --confirm        # write to DB
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { entities, financialPeriods, budgets } from "../lib/db/src/schema";

const DRY_RUN = !process.argv.includes("--confirm");
const YEAR = 2026;

const sql = neon(process.env["DATABASE_URL"]!);
const db = drizzle(sql);

function parseN(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  console.log(`\n=== Budget Seed Script — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE WRITE"} ===`);
  console.log(`Year: ${YEAR}\n`);

  // Load all entities
  const allEntities = await db.select().from(entities);
  if (allEntities.length === 0) {
    console.error("No entities found in database. Aborting.");
    process.exit(1);
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const monthsElapsed = Math.min(currentMonth, 12);

  for (const entity of allEntities) {
    console.log(`\n── ${entity.slug} (${entity.id})`);

    // Load all monthly actuals for this year
    const actuals = await db
      .select()
      .from(financialPeriods)
      .where(
        and(
          eq(financialPeriods.entityId, entity.id),
          eq(financialPeriods.periodType, "month"),
          gte(financialPeriods.periodStart, `${YEAR}-01-01`),
          lte(financialPeriods.periodStart, `${YEAR}-12-31`),
        ),
      )
      .orderBy(financialPeriods.periodStart);

    if (actuals.length === 0) {
      console.log(`  No monthly actuals found — skipping.`);
      continue;
    }

    // Compute average monthly actual from available months
    const ytdRevenue    = actuals.reduce((s, r) => s + parseN(r.revenue),   0);
    const ytdCogs       = actuals.reduce((s, r) => s + parseN(r.cogs),      0);
    const ytdOpex       = actuals.reduce((s, r) => s + parseN(r.opex),      0);
    const ytdNetIncome  = actuals.reduce((s, r) => s + parseN(r.netIncome), 0);
    const nMonths       = actuals.length;

    const avgRevenue   = ytdRevenue   / nMonths;
    const avgCogs      = ytdCogs      / nMonths;
    const avgOpex      = ytdOpex      / nMonths;
    const avgNetIncome = ytdNetIncome / nMonths;

    console.log(`  Actuals found: ${nMonths} months`);
    console.log(`  YTD avg/month → revenue: $${avgRevenue.toFixed(0)}, cogs: $${avgCogs.toFixed(0)}, opex: $${avgOpex.toFixed(0)}, net: $${avgNetIncome.toFixed(0)}`);

    const actualsMap = new Map(actuals.map((r) => [r.periodStart, r]));
    const rows: Array<typeof budgets.$inferInsert> = [];

    for (let month = 1; month <= 12; month++) {
      const periodStart = `${YEAR}-${String(month).padStart(2, "0")}-01`;
      const periodEnd   = lastDayOfMonth(YEAR, month);
      const actual      = actualsMap.get(periodStart);

      let revenueTarget: number;
      let cogsTarget: number;
      let opexTarget: number;
      let netIncomeTarget: number;
      let source: string;

      if (actual) {
        // Past month: use actual
        revenueTarget    = parseN(actual.revenue);
        cogsTarget       = parseN(actual.cogs);
        opexTarget       = parseN(actual.opex);
        netIncomeTarget  = parseN(actual.netIncome);
        source = "actual";
      } else {
        // Future month: use run-rate average
        revenueTarget    = Math.round(avgRevenue);
        cogsTarget       = Math.round(avgCogs);
        opexTarget       = Math.round(avgOpex);
        netIncomeTarget  = Math.round(avgNetIncome);
        source = "run-rate avg";
      }

      console.log(`    ${periodStart}  [${source}]  rev: $${revenueTarget.toFixed(0)}  cogs: $${cogsTarget.toFixed(0)}  opex: $${opexTarget.toFixed(0)}  net: $${netIncomeTarget.toFixed(0)}`);

      rows.push({
        entityId:        entity.id,
        periodType:      "month",
        periodStart,
        periodEnd,
        revenueTarget:   String(revenueTarget),
        cogsTarget:      String(cogsTarget),
        opexTarget:      String(opexTarget),
        netIncomeTarget: String(netIncomeTarget),
      });
    }

    if (!DRY_RUN) {
      // ON CONFLICT DO NOTHING — never overwrites user-entered budgets
      const result = await db
        .insert(budgets)
        .values(rows)
        .onConflictDoNothing()
        .returning({ id: budgets.id });
      console.log(`  ✓ Inserted ${result.length} rows (${rows.length - result.length} skipped — already existed)`);
    } else {
      console.log(`  [DRY RUN] Would insert ${rows.length} rows`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n=== DRY RUN complete. No data was written. ===`);
    console.log(`To write, run:  npx tsx scripts/seed-budget.ts --confirm\n`);
  } else {
    console.log(`\n=== Seed complete. ===\n`);
  }
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
