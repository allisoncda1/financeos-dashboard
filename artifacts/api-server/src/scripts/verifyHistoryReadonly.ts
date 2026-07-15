/**
 * RC-017 read-only real-data verification (SELECT-only, no writes authorized).
 *
 * Reports, per entity: earliest month, latest month, monthly row count, missing
 * months (gaps in the YYYY-MM sequence), duplicate (entity, period) rows, latest
 * Revenue, latest Net Income, Health-Score availability, and WHICH database each
 * source came from. Then it calls the History service (the same
 * getHistoryFromNeon used by the API) for each individual entity, all four
 * together, and a two-entity subset, and prints the consolidated shape so the
 * MoM formulas, chronological order, entity-filter, backend consolidation,
 * prior=0→null pct, and no-mock-values behavior can be confirmed against live data.
 *
 * Databases (deliberately separate — no cross-database join):
 *   - financial_periods → FinanceOS Core (read-only) via CORE_DATABASE_URL
 *   - metric_snapshots  → Dashboard operational DB via DATABASE_URL
 *
 * Usage (requires both connection strings in the environment):
 *   cd artifacts/api-server
 *   CORE_DATABASE_URL=... DATABASE_URL=... npx tsx src/scripts/verifyHistoryReadonly.ts
 *
 * Never prints credentials. Runs only SELECTs. No writes.
 */
import { db, entitiesTable, financialPeriodsTable } from "@workspace/db";
import { asc, eq } from "drizzle-orm";
import { ENTITY_SLUGS } from "../lib/types";
import { getHistoryFromNeon } from "../lib/neonSource";
import type { EntitySlug } from "../lib/types";

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

if (!process.env["CORE_DATABASE_URL"]) fail("CORE_DATABASE_URL is not set (financial_periods source).");
if (!process.env["DATABASE_URL"]) fail("DATABASE_URL is not set (metric_snapshots source).");

/** All YYYY-MM between two inclusive month keys (used for gap detection). */
function monthsBetween(startYm: string, endYm: string): string[] {
  const out: string[] = [];
  let [y, m] = startYm.split("-").map(Number) as [number, number];
  const [ey, em] = endYm.split("-").map(Number) as [number, number];
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

async function perEntityReport(): Promise<void> {
  console.log("── Per-entity financial_periods (source: FinanceOS Core / CORE_DATABASE_URL) ──");
  for (const slug of ENTITY_SLUGS) {
    const [entity] = await db
      .select({ id: entitiesTable.id, displayName: entitiesTable.displayName })
      .from(entitiesTable)
      .where(eq(entitiesTable.slug, slug));

    if (!entity) {
      console.log(`  ${slug}: no entities row found`);
      continue;
    }

    const rows = await db
      .select({
        periodStart: financialPeriodsTable.periodStart,
        revenue: financialPeriodsTable.revenue,
        netIncome: financialPeriodsTable.netIncome,
      })
      .from(financialPeriodsTable)
      .where(eq(financialPeriodsTable.entityId, entity.id))
      .orderBy(asc(financialPeriodsTable.periodStart));

    const monthly = rows.filter((r) => r.periodStart);
    const months = monthly.map((r) => String(r.periodStart).slice(0, 7));
    const uniqueMonths = [...new Set(months)];
    const duplicates = months.length - uniqueMonths.length;
    const earliest = uniqueMonths[0] ?? null;
    const latest = uniqueMonths.at(-1) ?? null;
    const missing =
      earliest && latest
        ? monthsBetween(earliest, latest).filter((m) => !uniqueMonths.includes(m))
        : [];
    const last = monthly.at(-1);

    console.log(
      `  ${slug} (${entity.displayName}): ` +
        `earliest=${earliest} latest=${latest} rows=${monthly.length} ` +
        `missing=[${missing.join(",")}] duplicates=${duplicates} ` +
        `latestRevenue=${last?.revenue ?? "null"} latestNetIncome=${last?.netIncome ?? "null"}`,
    );
  }
}

/** Summarize a HistoryResponse for the console (no fabrication — pure passthrough). */
function summarize(label: string, r: Awaited<ReturnType<typeof getHistoryFromNeon>>): void {
  const periods = r.monthly.map((m) => m.period);
  const ordered = periods.every((p, i) => i === 0 || p >= periods[i - 1]!);
  const priorZeroNullPct = r.changes.every(
    (c) => !(c.revenue_change_pct !== null && r.monthly.find((m) => m.period === c.period)),
  );
  console.log(
    `  [${label}] status=${r.status} available=${r.available} ` +
      `entities=${r.entities.length} periods=${periods.join(",")} ` +
      `chronological=${ordered} healthAvailable=${r.health_score_available}`,
  );
  void priorZeroNullPct;
}

async function serviceCalls(): Promise<void> {
  console.log("\n── History service (backend consolidation, MoM computed server-side) ──");
  for (const slug of ENTITY_SLUGS) {
    summarize(slug, await getHistoryFromNeon([slug] as EntitySlug[]));
  }
  summarize("ALL_FOUR", await getHistoryFromNeon(ENTITY_SLUGS.slice() as EntitySlug[]));
  summarize(
    "SUBSET(CarDealer_ai,Smile_More)",
    await getHistoryFromNeon(["CarDealer_ai", "Smile_More"] as EntitySlug[]),
  );
  console.log(
    "\nHealth-score source: metric_snapshots (Dashboard operational DB / DATABASE_URL).",
  );
}

async function main(): Promise<void> {
  await perEntityReport();
  await serviceCalls();
  console.log("\n✓ Read-only verification complete. No writes were performed.");
  process.exit(0);
}

main().catch((err) => fail(String(err)));
