import { driveLoadJson } from "./driveLoader";
import { loadMockData, loadEntityFile, loadValidationSummary, type EntityDataFile } from "./mockData";
import { transformFinancials } from "../transformers/financials";
import { transformCustomers } from "../transformers/customers";
import { transformVendors } from "../transformers/vendors";
import { transformBanking } from "../transformers/banking";
import { trackSource, reportSource, type DataSourceKind } from "./sourceTracker";
import type {
  PortfolioSummary,
  ValidationSummary,
  DataFreshness,
  EntityMetrics,
  Anomaly,
  EntitySlug,
  FinancialsData,
  CustomersData,
  VendorsData,
  BankingData,
} from "./types";
import { ENTITY_SLUGS } from "./types";

export type { DataSourceKind };

export const USE_DRIVE = Boolean(
  process.env["GOOGLE_CLIENT_ID"] &&
    process.env["GOOGLE_CLIENT_SECRET"] &&
    process.env["GOOGLE_REFRESH_TOKEN"] &&
    process.env["GOOGLE_SHARED_DRIVE_ID"] &&
    process.env["FINANCEOS_DATA_MODEL_FOLDER_ID"],
);

export async function getPortfolioSummary(): Promise<{ data: PortfolioSummary; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        // The live portfolio/summary.json only carries a subset of totals
        // (portfolio_totals: revenue_ytd, open_ar, ar_90plus, open_ap, ap_90plus)
        // and none of net_income_ytd / cash_on_hand / opex_ytd / cogs_ytd /
        // gross_profit_ytd / net_margin_pct. Those live per-entity in each
        // entity's metrics.json, so we aggregate across entities to build a
        // flat PortfolioSummary matching the documented type.
        const portfolioJson = await driveLoadJson<{
          generated_at?: string;
          entities?: string[];
          entity_count?: number;
          portfolio_totals?: { revenue_ytd?: number; open_ar?: number; open_ap?: number };
        }>("portfolio/summary.json");

        const entityMetricsResults = await Promise.all(
          ENTITY_SLUGS.map(async (slug) => {
            try {
              return await driveLoadJson<EntityMetrics>(`entities/${slug}/metrics.json`);
            } catch (err) {
              console.warn(
                `[portfolio] failed to load metrics.json for ${slug}, skipping from aggregation:`,
                err,
              );
              return null;
            }
          }),
        );
        const entityMetrics = entityMetricsResults.filter(
          (m): m is EntityMetrics => m !== null,
        );

        // Returns NaN (not 0) when zero entities report a finite value for
        // `key`, so genuinely-missing data (e.g. cash_on_hand isn't present in
        // any live entity metrics.json) renders as "N/A" downstream instead of
        // a misleading "$0" — PortfolioKpiStrip's fmt() already treats
        // non-finite numbers as "N/A", so no frontend change is required.
        // Note: JSON.stringify() serializes NaN as `null`, so this sentinel
        // also produces a correct `null` in the actual HTTP response body.
        const sum = (key: keyof EntityMetrics): number => {
          const values = entityMetrics
            .map((m) => m[key])
            .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
          if (values.length === 0) return NaN;
          return values.reduce((total, v) => total + v, 0);
        };

        const revenueYtd = sum("revenue_ytd");
        const openAr = sum("open_ar");
        const openAp = sum("open_ap");

        // net_income_ytd / opex_ytd / cogs_ytd / gross_profit_ytd / cash_on_hand
        // are not present in any live entity metrics.json, but they ARE already
        // computed correctly per-entity by transformFinancials() from the real
        // pnl_current.csv / balance_sheet_current.csv on Drive. Aggregate those
        // instead of relying on metrics.json for these fields.
        const asOfIso = portfolioJson.generated_at ?? new Date().toISOString();
        const financialsResults = await Promise.all(
          ENTITY_SLUGS.map(async (slug) => {
            try {
              const { data } = await getEntityFinancials(slug, asOfIso);
              return data;
            } catch (err) {
              console.warn(
                `[portfolio] failed to load financials for ${slug}, skipping from KPI aggregation:`,
                err,
              );
              return null;
            }
          }),
        );
        const entityFinancials = financialsResults.filter(
          (f): f is FinancialsData => f !== null,
        );

        const sumFinancials = (
          pick: (f: FinancialsData) => number | undefined | null,
        ): number => {
          if (entityFinancials.length === 0) return NaN;
          return entityFinancials.reduce((total, f) => {
            const raw = pick(f);
            const value = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
            return total + value;
          }, 0);
        };

        const netIncomeYtd = sumFinancials((f) => f.ytd_summary?.net_income);
        const opexYtd = sumFinancials((f) => f.ytd_summary?.opex);
        const cogsYtd = sumFinancials((f) => f.ytd_summary?.cogs);
        const grossProfitYtd = sumFinancials((f) => f.ytd_summary?.gross_profit);
        const cashOnHand = sumFinancials((f) => f.balance_sheet?.assets?.cash);

        const netMarginPct =
          Number.isFinite(netIncomeYtd) && Number.isFinite(revenueYtd) && revenueYtd !== 0
            ? (netIncomeYtd / revenueYtd) * 100
            : NaN;

        const cashRunwayMonths = (() => {
          if (!Number.isFinite(cashOnHand) || cashOnHand <= 0) return null;
          if (!Number.isFinite(opexYtd) || opexYtd <= 0) return null;
          const monthsElapsed = new Date().getMonth() + 1;
          const monthlyOpex = opexYtd / monthsElapsed;
          if (!Number.isFinite(monthlyOpex) || monthlyOpex <= 0) return null;
          return cashOnHand / monthlyOpex;
        })();

        return {
          as_of: portfolioJson.generated_at ?? new Date().toISOString().split("T")[0]!,
          pipeline_run: portfolioJson.generated_at ?? new Date().toISOString(),
          entities: portfolioJson.entities ?? [],
          entity_count: portfolioJson.entity_count ?? entityMetrics.length,
          portfolio_revenue_ytd: revenueYtd,
          portfolio_cogs_ytd: cogsYtd,
          portfolio_gross_profit_ytd: grossProfitYtd,
          portfolio_opex_ytd: opexYtd,
          portfolio_net_income_ytd: netIncomeYtd,
          portfolio_net_margin_pct: netMarginPct,
          portfolio_open_ar: openAr,
          portfolio_open_ap: openAp,
          portfolio_cash_on_hand: cashOnHand,
          cash_runway_months: cashRunwayMonths,
        };
      } catch {
        // fall through to mock
      }
    }
    reportSource("mock");
    return { ...loadMockData().portfolio, cash_runway_months: null };
  });
}

export async function getValidationSummary(): Promise<{ data: ValidationSummary; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        return await driveLoadJson<ValidationSummary>("validation/validation_summary.json");
      } catch {
        // fall through to mock
      }
    }
    reportSource("mock");
    return loadValidationSummary() as ValidationSummary;
  });
}

export async function getDataFreshness(): Promise<{ data: DataFreshness; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        return await driveLoadJson<DataFreshness>("audit/data_freshness.json");
      } catch {
        // fall through to mock
      }
    }
    reportSource("mock");
    return loadMockData().freshness;
  });
}

/**
 * Drive metrics.json only carries AR/AP-side fields (open_ar, dso_days,
 * ar_90plus, …). The income-statement and balance-sheet fields the frontend
 * renders (net_income_ytd, cash_on_hand, margins, …) are NOT in that file —
 * they are derived from the real financials CSVs, exactly like the portfolio
 * summary does. This merges both sources into a complete EntityMetrics.
 */
type RawDriveMetrics = Partial<EntityMetrics> & { ar_90plus?: number; ap_90plus?: number };

async function enrichMetricsFromFinancials(slug: EntitySlug, raw: RawDriveMetrics): Promise<EntityMetrics> {
  let fin: FinancialsData | null = null;
  try {
    const result = await getEntityFinancials(slug, raw.as_of ?? new Date().toISOString());
    fin = result.data;
  } catch (err) {
    console.warn(`[dataSource] failed to derive P&L metrics for ${slug} from financials:`, err);
  }

  const ytd = fin?.ytd_summary;
  const bs = fin?.balance_sheet;

  const revenueYtd = raw.revenue_ytd ?? ytd?.revenue ?? 0;
  const cogsYtd = raw.cogs_ytd ?? ytd?.cogs ?? 0;
  const grossProfitYtd = raw.gross_profit_ytd ?? ytd?.gross_profit ?? 0;
  const opexYtd = raw.opex_ytd ?? ytd?.opex ?? 0;
  const netIncomeYtd = raw.net_income_ytd ?? ytd?.net_income ?? 0;
  const openAr = raw.open_ar ?? 0;
  const openAp = raw.open_ap ?? 0;

  return {
    entity: raw.entity ?? slug,
    slug,
    basis: raw.basis ?? "Accrual",
    as_of: raw.as_of ?? fin?.as_of ?? new Date().toISOString().slice(0, 10),
    pipeline_run: raw.pipeline_run ?? raw.as_of ?? new Date().toISOString(),
    revenue_ytd: revenueYtd,
    cogs_ytd: cogsYtd,
    gross_profit_ytd: grossProfitYtd,
    gross_margin_pct: raw.gross_margin_pct ?? (revenueYtd > 0 ? Number(((grossProfitYtd / revenueYtd) * 100).toFixed(1)) : 0),
    opex_ytd: opexYtd,
    net_income_ytd: netIncomeYtd,
    net_margin_pct: raw.net_margin_pct ?? (revenueYtd > 0 ? Number(((netIncomeYtd / revenueYtd) * 100).toFixed(1)) : 0),
    total_assets: raw.total_assets ?? bs?.assets.total ?? 0,
    total_liabilities: raw.total_liabilities ?? bs?.liabilities.total ?? 0,
    total_equity: raw.total_equity ?? bs?.equity.total ?? 0,
    open_ar: openAr,
    open_ap: openAp,
    dso_days: raw.dso_days ?? 0,
    dpo_days: raw.dpo_days ?? 0,
    cash_on_hand: raw.cash_on_hand ?? bs?.assets.cash ?? 0,
    // metrics.json exposes 90+ day buckets, not a full overdue split — use
    // them as the overdue share when the precomputed pct is absent.
    ar_overdue_pct: raw.ar_overdue_pct ?? (openAr > 0 ? Number((((raw.ar_90plus ?? 0) / openAr) * 100).toFixed(1)) : 0),
    ap_overdue_pct: raw.ap_overdue_pct ?? (openAp > 0 ? Number((((raw.ap_90plus ?? 0) / openAp) * 100).toFixed(1)) : 0),
  };
}

export async function getEntityMetrics(slug: EntitySlug): Promise<{ data: EntityMetrics; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        const raw = await driveLoadJson<RawDriveMetrics>(`entities/${slug}/metrics.json`);
        return await enrichMetricsFromFinancials(slug, raw);
      } catch {
        // fall through to mock
      }
    }
    reportSource("mock");
    return loadMockData().metrics[slug];
  });
}

export async function getEntityAnomalies(slug: EntitySlug): Promise<{ data: Anomaly[]; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        const raw = await driveLoadJson<unknown>(`entities/${slug}/anomalies.json`);
        // Some Drive-backed anomaly files wrap the list in an envelope object
        // (e.g. `{ entity, as_of, count, anomalies: [...] }`) instead of
        // exposing a bare array. Normalize to the documented Anomaly[] shape.
        if (Array.isArray(raw)) return raw as Anomaly[];
        if (raw && typeof raw === "object" && Array.isArray((raw as { anomalies?: unknown }).anomalies)) {
          return (raw as { anomalies: Anomaly[] }).anomalies;
        }
        return [];
      } catch {
        // fall through to mock
      }
    }
    reportSource("mock");
    return loadMockData().anomalies[slug] ?? [];
  });
}

export async function getEntityFinancials(
  slug: EntitySlug,
  asOf: string,
): Promise<{ data: FinancialsData; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        return await transformFinancials(slug, asOf);
      } catch (err) {
        console.warn(`[dataSource] failed to transform financials for ${slug}, falling back to mock:`, err);
      }
    }
    reportSource("mock");
    const mock = loadEntityFile<FinancialsData>(slug, "financials");
    // Mock financials.json files predate the cash_flow field — normalize so
    // the frontend can rely on `cash_flow` being present (null = unavailable).
    return { ...mock, cash_flow: mock.cash_flow ?? null };
  });
}

export async function getEntityCustomers(
  slug: EntitySlug,
  asOf: string,
): Promise<{ data: CustomersData; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        return await transformCustomers(slug, asOf);
      } catch (err) {
        console.warn(`[dataSource] failed to transform customers for ${slug}, falling back to mock:`, err);
      }
    }
    reportSource("mock");
    return loadEntityFile<CustomersData>(slug, "customers");
  });
}

export async function getEntityVendors(
  slug: EntitySlug,
  asOf: string,
): Promise<{ data: VendorsData; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        return await transformVendors(slug, asOf);
      } catch (err) {
        console.warn(`[dataSource] failed to transform vendors for ${slug}, falling back to mock:`, err);
      }
    }
    reportSource("mock");
    return loadEntityFile<VendorsData>(slug, "vendors");
  });
}

export async function getEntityBanking(
  slug: EntitySlug,
  asOf: string,
): Promise<{ data: BankingData; source: DataSourceKind }> {
  return trackSource(async () => {
    if (USE_DRIVE) {
      try {
        return await transformBanking(slug, asOf);
      } catch (err) {
        console.warn(`[dataSource] failed to transform banking for ${slug}, falling back to mock:`, err);
      }
    }
    reportSource("mock");
    return loadEntityFile<BankingData>(slug, "banking");
  });
}

export async function getEntityFile<T>(
  slug: EntitySlug,
  file: EntityDataFile,
): Promise<{ data: T; source: DataSourceKind }> {
  return trackSource(async () => {
    const asOf = new Date().toISOString();
    switch (file) {
      case "financials":
        return ((await getEntityFinancials(slug, asOf)).data) as unknown as T;
      case "customers":
        return ((await getEntityCustomers(slug, asOf)).data) as unknown as T;
      case "vendors":
        return ((await getEntityVendors(slug, asOf)).data) as unknown as T;
      case "banking":
        return ((await getEntityBanking(slug, asOf)).data) as unknown as T;
      default:
        reportSource("mock");
        return loadEntityFile<T>(slug, file);
    }
  });
}
