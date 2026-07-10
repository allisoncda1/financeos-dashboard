import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db } from "./connection";
import { financialPeriods } from "@workspace/db";
import { parseNumeric } from "../services/numerics";
import { computeGrossMarginPct, computeNetMarginPct } from "../services/kpi";

export type { FinancialPeriod } from "@workspace/db";

/**
 * All monthly P&L rows for one entity in a given year, ordered by period_start.
 * Returns empty array when none exist — callers may fall back to Drive/mock.
 */
export async function getMonthlyPeriods(entityId: string, year: number) {
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;

  const rows = await db
    .select()
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.entityId, entityId),
        eq(financialPeriods.periodType, "monthly"),
        gte(financialPeriods.periodStart, start),
        lte(financialPeriods.periodStart, end),
      ),
    )
    .orderBy(financialPeriods.periodStart);

  return rows.map(toNumeric);
}

/**
 * YTD row for one entity.  If a dedicated ytd row exists, returns it.
 * Otherwise aggregates the monthly rows for the current year as a fallback.
 * Returns null when no data exists at all.
 */
export async function getYtdPeriod(entityId: string, year: number) {
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;

  const ytdRows = await db
    .select()
    .from(financialPeriods)
    .where(
      and(
        eq(financialPeriods.entityId, entityId),
        eq(financialPeriods.periodType, "ytd"),
        gte(financialPeriods.periodStart, start),
        lte(financialPeriods.periodStart, end),
      ),
    )
    .limit(1);

  if (ytdRows[0]) return toNumeric(ytdRows[0]);

  // Fallback: aggregate monthly rows
  const months = await getMonthlyPeriods(entityId, year);
  if (months.length === 0) return null;

  const agg = months.reduce(
    (acc, m) => ({
      revenue:           acc.revenue           + m.revenue,
      cogs:              acc.cogs              + m.cogs,
      grossProfit:       acc.grossProfit       + m.grossProfit,
      opex:              acc.opex              + m.opex,
      netIncome:         acc.netIncome         + m.netIncome,
      // Balance sheet: use last month's snapshot (point-in-time, not cumulative)
      totalAssets:       m.totalAssets,
      totalLiabilities:  m.totalLiabilities,
      totalEquity:       m.totalEquity,
      cashOnHand:        m.cashOnHand,
      accountsReceivable: m.accountsReceivable,
      accountsPayable:   m.accountsPayable,
      openAr:            m.openAr,
      openAp:            m.openAp,
      dsoDays:           m.dsoDays,
      dpoDays:           m.dpoDays,
      arOverduePct:      m.arOverduePct,
      apOverduePct:      m.apOverduePct,
    }),
    {
      revenue: 0, cogs: 0, grossProfit: 0, opex: 0, netIncome: 0,
      totalAssets: 0, totalLiabilities: 0, totalEquity: 0, cashOnHand: 0,
      accountsReceivable: 0, accountsPayable: 0,
      openAr: 0, openAp: 0, dsoDays: 0, dpoDays: 0,
      arOverduePct: 0, apOverduePct: 0,
    },
  );

  const last = months[months.length - 1]!;
  const grossMarginPct = agg.revenue > 0 ? computeGrossMarginPct(agg.grossProfit, agg.revenue) : 0;
  const netMarginPct   = agg.revenue > 0 ? computeNetMarginPct(agg.netIncome,    agg.revenue) : 0;

  return {
    ...last,
    periodType:    "ytd" as const,
    periodStart:   `${year}-01-01`,
    periodEnd:     last.periodEnd,
    ...agg,
    grossMarginPct,
    netMarginPct,
  };
}

/**
 * Most recent period of any type — used to derive the `as_of` date for a module.
 */
export async function getLatestPeriod(entityId: string) {
  const rows = await db
    .select()
    .from(financialPeriods)
    .where(eq(financialPeriods.entityId, entityId))
    .orderBy(desc(financialPeriods.periodStart))
    .limit(1);

  return rows[0] ? toNumeric(rows[0]) : null;
}

/**
 * Portfolio-level aggregation: sum YTD KPIs across all given entityIds.
 * Balance sheet fields (assets, liabilities, equity, cash) are summed,
 * not averaged, because each entity is independent.
 */
export async function getPortfolioYtd(entityIds: string[], year: number) {
  if (entityIds.length === 0) return null;

  const rows = await Promise.all(entityIds.map((id) => getYtdPeriod(id, year)));
  const valid = rows.filter((r): r is NonNullable<typeof r> => r !== null);
  if (valid.length === 0) return null;

  return valid.reduce(
    (acc, r) => ({
      revenue:            acc.revenue            + r.revenue,
      cogs:               acc.cogs               + r.cogs,
      grossProfit:        acc.grossProfit        + r.grossProfit,
      opex:               acc.opex               + r.opex,
      netIncome:          acc.netIncome          + r.netIncome,
      totalAssets:        acc.totalAssets        + r.totalAssets,
      totalLiabilities:   acc.totalLiabilities   + r.totalLiabilities,
      totalEquity:        acc.totalEquity        + r.totalEquity,
      cashOnHand:         acc.cashOnHand         + r.cashOnHand,
      openAr:             acc.openAr             + r.openAr,
      openAp:             acc.openAp             + r.openAp,
      entityCount:        acc.entityCount        + 1,
    }),
    {
      revenue: 0, cogs: 0, grossProfit: 0, opex: 0, netIncome: 0,
      totalAssets: 0, totalLiabilities: 0, totalEquity: 0, cashOnHand: 0,
      openAr: 0, openAp: 0, entityCount: 0,
    },
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type RawPeriod = typeof financialPeriods.$inferSelect;

function toNumeric(row: RawPeriod) {
  return {
    ...row,
    revenue:            parseNumeric(row.revenue),
    cogs:               parseNumeric(row.cogs),
    grossProfit:        parseNumeric(row.grossProfit),
    opex:               parseNumeric(row.opex),
    netIncome:          parseNumeric(row.netIncome),
    grossMarginPct:     parseNumeric(row.grossMarginPct),
    netMarginPct:       parseNumeric(row.netMarginPct),
    totalAssets:        parseNumeric(row.totalAssets),
    totalLiabilities:   parseNumeric(row.totalLiabilities),
    totalEquity:        parseNumeric(row.totalEquity),
    cashOnHand:         parseNumeric(row.cashOnHand),
    accountsReceivable: parseNumeric(row.accountsReceivable),
    accountsPayable:    parseNumeric(row.accountsPayable),
    openAr:             parseNumeric(row.openAr),
    openAp:             parseNumeric(row.openAp),
    dsoDays:            parseNumeric(row.dsoDays),
    dpoDays:            parseNumeric(row.dpoDays),
    arOverduePct:       parseNumeric(row.arOverduePct),
    apOverduePct:       parseNumeric(row.apOverduePct),
  };
}

export type NumericPeriod = ReturnType<typeof toNumeric>;
