/**
 * Budget seed — plain ES module, no TypeScript compilation needed.
 * Run: node seed-budget.mjs            (dry run)
 *      node seed-budget.mjs --confirm  (write to DB)
 */

import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}

const DRY_RUN = !process.argv.includes("--confirm");
const YEAR = 2026;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function parseN(v) {
  const n = parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function lastDayOfMonth(year, month) {
  const d = new Date(year, month, 0);
  return `${year}-${String(month).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  console.log(`\n=== Budget Seed — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE WRITE"} ===`);
  console.log(`Year: ${YEAR}\n`);

  const { rows: allEntities } = await pool.query(
    `SELECT id, slug, display_name FROM entities ORDER BY slug`
  );

  if (allEntities.length === 0) {
    console.error("No entities found. Aborting.");
    await pool.end();
    process.exit(1);
  }

  for (const entity of allEntities) {
    console.log(`\n── ${entity.slug} (${entity.display_name})`);

    const { rows: actuals } = await pool.query(
      `SELECT period_start, period_end, revenue, cogs, opex, net_income
       FROM financial_periods
       WHERE entity_id = $1
         AND period_type = 'monthly'
         AND period_start >= $2
         AND period_start <= $3
       ORDER BY period_start`,
      [entity.id, `${YEAR}-01-01`, `${YEAR}-12-31`]
    );

    if (actuals.length === 0) {
      console.log(`  No monthly actuals found — skipping.`);
      continue;
    }

    const n          = actuals.length;
    const ytdRev     = actuals.reduce((s, r) => s + parseN(r.revenue),    0);
    const ytdCogs    = actuals.reduce((s, r) => s + parseN(r.cogs),       0);
    const ytdOpex    = actuals.reduce((s, r) => s + parseN(r.opex),       0);
    const ytdNI      = actuals.reduce((s, r) => s + parseN(r.net_income), 0);

    const avgRev     = ytdRev  / n;
    const avgCogs    = ytdCogs / n;
    const avgOpex    = ytdOpex / n;
    const avgNI      = ytdNI   / n;

    console.log(`  Actuals: ${n} months`);
    console.log(`  Avg/month → rev: $${avgRev.toFixed(0)}, cogs: $${avgCogs.toFixed(0)}, opex: $${avgOpex.toFixed(0)}, net: $${avgNI.toFixed(0)}`);

    const actualsMap = new Map(actuals.map(r => [r.period_start.toISOString().slice(0,10), r]));

    let insertedTotal = 0;
    let skippedTotal  = 0;

    for (let month = 1; month <= 12; month++) {
      const periodStart = `${YEAR}-${String(month).padStart(2, "0")}-01`;
      const periodEnd   = lastDayOfMonth(YEAR, month);
      const actual      = actualsMap.get(periodStart);

      let revT, cogsT, opexT, niT, src;

      if (actual) {
        revT  = parseN(actual.revenue);
        cogsT = parseN(actual.cogs);
        opexT = parseN(actual.opex);
        niT   = parseN(actual.net_income);
        src   = "actual   ";
      } else {
        revT  = Math.round(avgRev);
        cogsT = Math.round(avgCogs);
        opexT = Math.round(avgOpex);
        niT   = Math.round(avgNI);
        src   = "run-rate ";
      }

      console.log(
        `    ${periodStart}  [${src}]  rev: $${String(revT.toLocaleString()).padStart(10)}  cogs: $${String(cogsT.toLocaleString()).padStart(9)}  opex: $${String(opexT.toLocaleString()).padStart(9)}  net: $${String(niT.toLocaleString()).padStart(10)}`
      );

      if (!DRY_RUN) {
        const result = await pool.query(
          `INSERT INTO budgets
             (entity_id, period_type, period_start, period_end,
              revenue_target, cogs_target, opex_target, net_income_target)
           VALUES ($1, 'month', $2, $3, $4, $5, $6, $7)
           ON CONFLICT (entity_id, period_type, period_start) DO NOTHING
           RETURNING id`,
          [entity.id, periodStart, periodEnd, revT, cogsT, opexT, niT]
        );
        if (result.rows.length > 0) insertedTotal++;
        else skippedTotal++;
      }
    }

    if (!DRY_RUN) {
      console.log(`  ✓ Inserted ${insertedTotal} rows, ${skippedTotal} skipped (already existed)`);
    } else {
      console.log(`  [DRY RUN] Would insert 12 rows`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n=== DRY RUN complete. Nothing was written. ===`);
    console.log(`To write: node seed-budget.mjs --confirm\n`);
  } else {
    console.log(`\n=== Seed complete. ===\n`);
  }

  await pool.end();
}

main().catch(async err => {
  console.error("Seed failed:", err);
  await pool.end();
  process.exit(1);
});
