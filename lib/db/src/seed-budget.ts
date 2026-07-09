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

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, gte, lte } from "drizzle-orm";
import { entities, financialPeriods, budgets } from "./schema/index.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set before running seed.");
}

const DRY_RUN = !process.argv.includes("--confirm");
const YEAR = 2026;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

function parseN(v: unknown): number {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  console.log(`\n=== Budget Seed — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE WRITE"} ===`);
  console.log(`Year: ${YEAR}\n`);

  const allEntities = await db.select().from(entities);
  if (allEntities.length === 0) {
    console.error("No entities found. Aborting.");
    await pool.end();
    process.exit(1);
  }

  for (const entity of allEntities) {
    console.log(`\n── ${entity.slug} (${entity.displayName})`);

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

    const ytdRevenue   = actuals.reduce((s, r) => s + parseN(r.revenue),   0);
    const ytdCogs      = actuals.reduce((s, r) => s + parseN(r.cogs),      0);
    const ytdOpex      = actuals.reduce((s, r) => s + parseN(r.opex),      0);
    const ytdNetIncome = actuals.reduce((s, r) => s + parseN(r.netIncome), 0);
    const nMonths      = actuals.length;

    const avgRevenue   = ytdRevenue   / nMonths;
    const avgCogs      = ytdCogs      / nMonths;
    const avgOpex      = ytdOpex      / nMonths;
    const avgNetIncome = ytdNetIncome / nMonths;

    console.log(`  Actuals: ${nMonths} months`);
    console.log(`  Avg/month → rev: $${avgRevenue.toFixed(0)}, cogs: $${avgCogs.toFixed(0)}, opex: $${avgOpex.toFixed(0)}, net: $${avgNetIncome.toFixed(0)}`);

    const actualsMap = new Map(actuals.map((r) => [r.periodStart, r]));
    const rows: Array<typeof budgets.$inferInsert> = [];

    for (let month = 1; month <= 12; month++) {
      const periodStart = `${YEAR}-${String(month).padStart(2, "0")}-01`;
      const periodEnd   = lastDayOfMonth(YEAR, month);
      const actual      = actualsMap.get(periodStart);

      let revT: number, cogsT: number, opexT: number, niT: number, src: string;

      if (actual) {
        revT  = parseN(actual.revenue);
        cogsT = parseN(actual.cogs);
        opexT = parseN(actual.opex);
        niT   = parseN(actual.netIncome);
        src   = "actual";
      } else {
        revT  = Math.round(avgRevenue);
        cogsT = Math.round(avgCogs);
        opexT = Math.round(avgOpex);
        niT   = Math.round(avgNetIncome);
        src   = "run-rate";
      }

      console.log(
        `    ${periodStart}  [${src.padEnd(9)}]  rev: $${revT.toLocaleString().padStart(10)}  cogs: $${cogsT.toLocaleString().padStart(9)}  opex: $${opexT.toLocaleString().padStart(9)}  net: $${niT.toLocaleString().padStart(10)}`,
      );

      rows.push({
        entityId:        entity.id,
        periodType:      "month",
        periodStart,
        periodEnd,
        revenueTarget:   String(revT),
        cogsTarget:      String(cogsT),
        opexTarget:      String(opexT),
        netIncomeTarget: String(niT),
      });
    }

    if (!DRY_RUN) {
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
    console.log(`\n=== DRY RUN complete. Nothing was written. ===`);
    console.log(`To write: pnpm --filter @workspace/db run seed-budget -- --confirm\n`);
  } else {
    console.log(`\n=== Seed complete. ===\n`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await pool.end();
  process.exit(1);
});
