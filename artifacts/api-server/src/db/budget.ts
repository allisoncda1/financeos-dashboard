import { eq, and, gte, lte, inArray, sql } from "drizzle-orm";
import { opsDb as db } from "./connection";
import { budgets } from "@workspace/db";
import { parseNumeric } from "../services/numerics";

export type { Budget, InsertBudget } from "@workspace/db";

export type BudgetRow = {
  id: string;
  entityId: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  revenueTarget: number | null;
  cogsTarget: number | null;
  opexTarget: number | null;
  netIncomeTarget: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function toNumeric(row: typeof budgets.$inferSelect): BudgetRow {
  return {
    id: row.id,
    entityId: row.entityId,
    periodType: row.periodType,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    revenueTarget:   row.revenueTarget   != null ? parseNumeric(row.revenueTarget)   : null,
    cogsTarget:      row.cogsTarget      != null ? parseNumeric(row.cogsTarget)      : null,
    opexTarget:      row.opexTarget      != null ? parseNumeric(row.opexTarget)      : null,
    netIncomeTarget: row.netIncomeTarget != null ? parseNumeric(row.netIncomeTarget) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getMonthlyBudgets(entityId: string, year: number): Promise<BudgetRow[]> {
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;
  const rows = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.entityId, entityId),
        eq(budgets.periodType, "month"),
        gte(budgets.periodStart, start),
        lte(budgets.periodStart, end),
      ),
    )
    .orderBy(budgets.periodStart);
  return rows.map(toNumeric);
}

export async function getAnnualBudget(entityId: string, year: number): Promise<BudgetRow | null> {
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;
  const rows = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.entityId, entityId),
        eq(budgets.periodType, "annual"),
        gte(budgets.periodStart, start),
        lte(budgets.periodStart, end),
      ),
    )
    .limit(1);
  return rows[0] ? toNumeric(rows[0]) : null;
}

export type PortfolioBudgetAgg = {
  revenueTarget: number;
  cogsTarget: number;
  opexTarget: number;
  netIncomeTarget: number;
  monthsWithBudgets: number;
};

export async function getPortfolioMonthlyBudgetAgg(entityIds: string[], year: number): Promise<PortfolioBudgetAgg> {
  const start = `${year}-01-01`;
  const end   = `${year}-12-31`;

  if (entityIds.length === 0) {
    return { revenueTarget: 0, cogsTarget: 0, opexTarget: 0, netIncomeTarget: 0, monthsWithBudgets: 0 };
  }

  const rows = await db
    .select({
      revenueTarget:    sql<string>`COALESCE(SUM(${budgets.revenueTarget}), 0)`,
      cogsTarget:       sql<string>`COALESCE(SUM(${budgets.cogsTarget}), 0)`,
      opexTarget:       sql<string>`COALESCE(SUM(${budgets.opexTarget}), 0)`,
      netIncomeTarget:  sql<string>`COALESCE(SUM(${budgets.netIncomeTarget}), 0)`,
      monthsWithBudgets: sql<string>`COUNT(DISTINCT ${budgets.periodStart})`,
    })
    .from(budgets)
    .where(
      and(
        inArray(budgets.entityId, entityIds),
        eq(budgets.periodType, "month"),
        gte(budgets.periodStart, start),
        lte(budgets.periodStart, end),
      ),
    );

  const row = rows[0];
  return {
    revenueTarget:    parseNumeric(row?.revenueTarget),
    cogsTarget:       parseNumeric(row?.cogsTarget),
    opexTarget:       parseNumeric(row?.opexTarget),
    netIncomeTarget:  parseNumeric(row?.netIncomeTarget),
    monthsWithBudgets: Math.round(parseNumeric(row?.monthsWithBudgets)),
  };
}

export async function upsertBudgetPeriod(
  entityId: string,
  data: {
    periodType: string;
    periodStart: string;
    periodEnd: string;
    revenueTarget?: number | null;
    cogsTarget?: number | null;
    opexTarget?: number | null;
    netIncomeTarget?: number | null;
  },
): Promise<BudgetRow> {
  const rows = await db
    .insert(budgets)
    .values({
      entityId,
      periodType:      data.periodType,
      periodStart:     data.periodStart,
      periodEnd:       data.periodEnd,
      revenueTarget:   data.revenueTarget != null ? String(data.revenueTarget) : null,
      cogsTarget:      data.cogsTarget    != null ? String(data.cogsTarget)    : null,
      opexTarget:      data.opexTarget    != null ? String(data.opexTarget)    : null,
      netIncomeTarget: data.netIncomeTarget != null ? String(data.netIncomeTarget) : null,
    })
    .onConflictDoUpdate({
      target: [budgets.entityId, budgets.periodType, budgets.periodStart],
      set: {
        periodEnd:       data.periodEnd,
        revenueTarget:   data.revenueTarget != null ? String(data.revenueTarget) : null,
        cogsTarget:      data.cogsTarget    != null ? String(data.cogsTarget)    : null,
        opexTarget:      data.opexTarget    != null ? String(data.opexTarget)    : null,
        netIncomeTarget: data.netIncomeTarget != null ? String(data.netIncomeTarget) : null,
        updatedAt:       new Date(),
      },
    })
    .returning();
  return toNumeric(rows[0]!);
}
