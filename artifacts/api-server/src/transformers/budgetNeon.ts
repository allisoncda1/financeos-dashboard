import { BudgetService, FinancialPeriodsService } from "../db";
import { getCachedEntityId } from "../services/entityCache";
import { computeVariance, computeVariancePct, computeAttainmentPct } from "../services/kpi";
import { ENTITY_SLUGS } from "../lib/types";
import type {
  EntitySlug,
  EntityBudget,
  EntityBudgetMonth,
  BvsAData,
  BvsAMonth,
  BudgetTargets,
  BudgetActuals,
  BudgetVariance,
  BudgetVariancePct,
  PortfolioBudget,
  PortfolioEntityBudget,
} from "../lib/types";

// ── helpers ───────────────────────────────────────────────────────────────────

function nullableVariance(actual: number, target: number | null): number | null {
  if (target === null) return null;
  return computeVariance(actual, target);
}

function nullableVariancePct(actual: number, target: number | null): number | null {
  if (target === null) return null;
  const v = computeVariancePct(actual, target);
  return Number.isFinite(v) ? v : null;
}

function currentYtdCutoff(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  return `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
}

// ── transformEntityBudget ─────────────────────────────────────────────────────

export async function transformEntityBudget(slug: EntitySlug, year: number): Promise<EntityBudget> {
  const entityId = await getCachedEntityId(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const [monthlyRows, annualRow] = await Promise.all([
    BudgetService.getMonthlyBudgets(entityId, year),
    BudgetService.getAnnualBudget(entityId, year),
  ]);

  const months: EntityBudgetMonth[] = monthlyRows.map((r) => ({
    period_start:     r.periodStart,
    period_end:       r.periodEnd,
    revenue_target:   r.revenueTarget,
    cogs_target:      r.cogsTarget,
    opex_target:      r.opexTarget,
    net_income_target: r.netIncomeTarget,
  }));

  const annual = annualRow
    ? {
        revenue_target:   annualRow.revenueTarget,
        cogs_target:      annualRow.cogsTarget,
        opex_target:      annualRow.opexTarget,
        net_income_target: annualRow.netIncomeTarget,
      }
    : null;

  return {
    entity_slug: slug,
    year,
    months,
    annual,
    months_with_budgets: monthlyRows.length,
  };
}

// ── transformBudgetVsActual ───────────────────────────────────────────────────

export async function transformBudgetVsActual(slug: EntitySlug, year: number): Promise<BvsAData> {
  const entityId = await getCachedEntityId(slug);
  if (!entityId) throw new Error(`Entity not found in Neon: ${slug}`);

  const [monthlyBudgets, monthlyActuals] = await Promise.all([
    BudgetService.getMonthlyBudgets(entityId, year),
    FinancialPeriodsService.getMonthlyPeriods(entityId, year),
  ]);

  // Index actuals by period_start for O(1) lookup
  const actualsMap = new Map(monthlyActuals.map((a) => [a.periodStart, a]));
  const budgetMap  = new Map(monthlyBudgets.map((b) => [b.periodStart, b]));

  // Union of all months present in either source
  const allStarts = Array.from(
    new Set([...monthlyBudgets.map((b) => b.periodStart), ...monthlyActuals.map((a) => a.periodStart)]),
  ).sort();

  const ytdCutoff = currentYtdCutoff();

  const months: BvsAMonth[] = allStarts.map((periodStart) => {
    const b = budgetMap.get(periodStart);
    const a = actualsMap.get(periodStart);

    const budget: BudgetTargets = {
      revenue:   b?.revenueTarget   ?? null,
      cogs:      b?.cogsTarget      ?? null,
      opex:      b?.opexTarget      ?? null,
      net_income: b?.netIncomeTarget ?? null,
    };

    const actual: BudgetActuals | null = a
      ? { revenue: a.revenue, cogs: a.cogs, opex: a.opex, net_income: a.netIncome }
      : null;

    const variance: BudgetVariance = {
      revenue:    actual ? nullableVariance(actual.revenue,    budget.revenue)    : null,
      cogs:       actual ? nullableVariance(actual.cogs,       budget.cogs)       : null,
      opex:       actual ? nullableVariance(actual.opex,       budget.opex)       : null,
      net_income: actual ? nullableVariance(actual.net_income, budget.net_income) : null,
    };

    const variance_pct: BudgetVariancePct = {
      revenue:    actual ? nullableVariancePct(actual.revenue,    budget.revenue)    : null,
      cogs:       actual ? nullableVariancePct(actual.cogs,       budget.cogs)       : null,
      opex:       actual ? nullableVariancePct(actual.opex,       budget.opex)       : null,
      net_income: actual ? nullableVariancePct(actual.net_income, budget.net_income) : null,
    };

    // period_end: use actual's periodEnd if available, else budget's
    const periodEnd = a?.periodEnd ?? b?.periodEnd ?? periodStart;

    return {
      month: periodStart.slice(0, 7),
      period_start: periodStart,
      period_end: periodEnd,
      budget,
      actual,
      variance,
      variance_pct,
      has_budget: !!b,
      has_actual: !!a,
    };
  });

  // YTD: sum months up through current month
  const ytdMonths = months.filter((m) => m.period_start <= ytdCutoff);

  const anyBudget = ytdMonths.some((m) => m.has_budget);
  const ytdBudget: BudgetTargets = anyBudget
    ? {
        revenue:    ytdMonths.reduce((s, m) => s + (m.budget.revenue    ?? 0), 0),
        cogs:       ytdMonths.reduce((s, m) => s + (m.budget.cogs       ?? 0), 0),
        opex:       ytdMonths.reduce((s, m) => s + (m.budget.opex       ?? 0), 0),
        net_income: ytdMonths.reduce((s, m) => s + (m.budget.net_income ?? 0), 0),
      }
    : { revenue: null, cogs: null, opex: null, net_income: null };

  const ytdActual: BudgetActuals = {
    revenue:    ytdMonths.reduce((s, m) => s + (m.actual?.revenue    ?? 0), 0),
    cogs:       ytdMonths.reduce((s, m) => s + (m.actual?.cogs       ?? 0), 0),
    opex:       ytdMonths.reduce((s, m) => s + (m.actual?.opex       ?? 0), 0),
    net_income: ytdMonths.reduce((s, m) => s + (m.actual?.net_income ?? 0), 0),
  };

  const ytdVariance: BudgetVariance = {
    revenue:    nullableVariance(ytdActual.revenue,    ytdBudget.revenue),
    cogs:       nullableVariance(ytdActual.cogs,       ytdBudget.cogs),
    opex:       nullableVariance(ytdActual.opex,       ytdBudget.opex),
    net_income: nullableVariance(ytdActual.net_income, ytdBudget.net_income),
  };

  const ytdVariancePct: BudgetVariancePct = {
    revenue:    nullableVariancePct(ytdActual.revenue,    ytdBudget.revenue),
    cogs:       nullableVariancePct(ytdActual.cogs,       ytdBudget.cogs),
    opex:       nullableVariancePct(ytdActual.opex,       ytdBudget.opex),
    net_income: nullableVariancePct(ytdActual.net_income, ytdBudget.net_income),
  };

  return {
    entity_slug: slug,
    year,
    months,
    ytd: {
      budget:       ytdBudget,
      actual:       ytdActual,
      variance:     ytdVariance,
      variance_pct: ytdVariancePct,
    },
  };
}

// ── transformPortfolioBudget ──────────────────────────────────────────────────

export async function transformPortfolioBudget(year: number): Promise<PortfolioBudget> {
  const pairs = await Promise.all(
    ENTITY_SLUGS.map(async (slug) => ({ slug, id: await getCachedEntityId(slug) })),
  );
  const valid = pairs.filter((p): p is { slug: EntitySlug; id: string } => p.id !== null);
  if (valid.length === 0) throw new Error("No entities found in Neon for portfolio budget");

  const entityIds = valid.map((p) => p.id);

  const [budgetAgg, ...actualYtds] = await Promise.all([
    BudgetService.getPortfolioMonthlyBudgetAgg(entityIds, year),
    ...valid.map(async ({ slug, id }) => {
      const ytd = await FinancialPeriodsService.getYtdPeriod(id, year);
      return { slug, revenue: ytd?.revenue ?? 0, netIncome: ytd?.netIncome ?? 0 };
    }),
  ]);

  const perEntity: PortfolioEntityBudget[] = await Promise.all(
    valid.map(async ({ slug, id }) => {
      const [budgetRows, ytd] = await Promise.all([
        BudgetService.getMonthlyBudgets(id, year),
        FinancialPeriodsService.getYtdPeriod(id, year),
      ]);
      const budgetRevenue    = budgetRows.reduce((s, r) => s + (r.revenueTarget    ?? 0), 0);
      const budgetNetIncome  = budgetRows.reduce((s, r) => s + (r.netIncomeTarget  ?? 0), 0);
      const actualRevenue    = ytd?.revenue   ?? 0;
      const actualNetIncome  = ytd?.netIncome ?? 0;
      const attainmentRaw    = budgetRevenue > 0
        ? computeAttainmentPct(actualRevenue, budgetRevenue)
        : null;
      const attainment_pct   = attainmentRaw !== null && Number.isFinite(attainmentRaw)
        ? attainmentRaw
        : null;
      return {
        slug,
        budget_revenue:    budgetRevenue,
        actual_revenue:    actualRevenue,
        budget_net_income: budgetNetIncome,
        actual_net_income: actualNetIncome,
        attainment_pct,
      };
    }),
  );

  const portfolioBudgetRevenue = perEntity.reduce((s, e) => s + e.budget_revenue,    0);
  const portfolioActualRevenue = perEntity.reduce((s, e) => s + e.actual_revenue,     0);
  const portfolioBudgetNI      = perEntity.reduce((s, e) => s + e.budget_net_income,  0);
  const portfolioActualNI      = perEntity.reduce((s, e) => s + e.actual_net_income,  0);

  const portfolioVarianceRevenue = computeVariance(portfolioActualRevenue, portfolioBudgetRevenue);
  const attainmentRaw = portfolioBudgetRevenue > 0
    ? computeAttainmentPct(portfolioActualRevenue, portfolioBudgetRevenue)
    : null;
  const portfolioAttainmentPct = attainmentRaw !== null && Number.isFinite(attainmentRaw)
    ? attainmentRaw
    : null;

  return {
    year,
    entity_slugs: valid.map((p) => p.slug),
    portfolio_budget_revenue:   portfolioBudgetRevenue,
    portfolio_actual_revenue:   portfolioActualRevenue,
    portfolio_variance_revenue: portfolioVarianceRevenue,
    portfolio_attainment_pct:   portfolioAttainmentPct,
    portfolio_budget_net_income:  portfolioBudgetNI,
    portfolio_actual_net_income:  portfolioActualNI,
    entity_budgets: perEntity,
    months_with_budgets:    budgetAgg.monthsWithBudgets,
    months_without_budgets: 12 - budgetAgg.monthsWithBudgets,
  };
}
