import { driveLoadJson } from "./driveLoader";
import { loadMockData, loadEntityFile, loadValidationSummary, type EntityDataFile } from "./mockData";
import { transformFinancials } from "../transformers/financials";
import { transformCustomers } from "../transformers/customers";
import { transformVendors } from "../transformers/vendors";
import { transformBanking } from "../transformers/banking";
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

export const USE_DRIVE = Boolean(
  process.env["GOOGLE_CLIENT_ID"] &&
    process.env["GOOGLE_CLIENT_SECRET"] &&
    process.env["GOOGLE_REFRESH_TOKEN"] &&
    process.env["GOOGLE_SHARED_DRIVE_ID"] &&
    process.env["FINANCEOS_DATA_MODEL_FOLDER_ID"],
);

export async function getPortfolioSummary(): Promise<PortfolioSummary> {
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

      const sum = (key: keyof EntityMetrics): number =>
        entityMetrics.reduce(
          (total, m) => total + (typeof m[key] === "number" ? (m[key] as number) : 0),
          0,
        );

      const revenueYtd = sum("revenue_ytd");
      const cogsYtd = sum("cogs_ytd");
      const grossProfitYtd = sum("gross_profit_ytd");
      const opexYtd = sum("opex_ytd");
      const netIncomeYtd = sum("net_income_ytd");
      const cashOnHand = sum("cash_on_hand");
      const openAr = sum("open_ar");
      const openAp = sum("open_ap");
      const netMarginPct = revenueYtd !== 0 ? (netIncomeYtd / revenueYtd) * 100 : 0;

      console.log(
        "[portfolio] revenue_ytd — portfolio_totals had:",
        portfolioJson.portfolio_totals?.revenue_ytd,
        "| aggregated from entity metrics (authoritative):",
        revenueYtd,
      );
      console.log(
        "[portfolio] open_ar — portfolio_totals had:",
        portfolioJson.portfolio_totals?.open_ar,
        "| aggregated from entity metrics (authoritative):",
        openAr,
      );
      console.log(
        "[portfolio] open_ap — portfolio_totals had:",
        portfolioJson.portfolio_totals?.open_ap,
        "| aggregated from entity metrics (authoritative):",
        openAp,
      );
      console.log("[portfolio] cogs_ytd aggregated from entity metrics (not in portfolio_totals):", cogsYtd);
      console.log(
        "[portfolio] gross_profit_ytd aggregated from entity metrics (not in portfolio_totals):",
        grossProfitYtd,
      );
      console.log("[portfolio] opex_ytd aggregated from entity metrics (not in portfolio_totals):", opexYtd);
      console.log(
        "[portfolio] net_income_ytd aggregated from entity metrics (not in portfolio_totals):",
        netIncomeYtd,
      );
      console.log(
        "[portfolio] cash_on_hand aggregated from entity metrics (not in portfolio_totals):",
        cashOnHand,
      );
      console.log(
        "[portfolio] net_margin_pct computed as net_income_ytd / revenue_ytd * 100:",
        netMarginPct,
      );

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
      };
    } catch {
      // fall through to mock
    }
  }
  return loadMockData().portfolio;
}

export async function getValidationSummary(): Promise<ValidationSummary> {
  if (USE_DRIVE) {
    try {
      return await driveLoadJson<ValidationSummary>("validation/validation_summary.json");
    } catch {
      // fall through to mock
    }
  }
  return loadValidationSummary() as ValidationSummary;
}

export async function getDataFreshness(): Promise<DataFreshness> {
  if (USE_DRIVE) {
    try {
      return await driveLoadJson<DataFreshness>("audit/data_freshness.json");
    } catch {
      // fall through to mock
    }
  }
  return loadMockData().freshness;
}

export async function getEntityMetrics(slug: EntitySlug): Promise<EntityMetrics> {
  if (USE_DRIVE) {
    try {
      return await driveLoadJson<EntityMetrics>(`entities/${slug}/metrics.json`);
    } catch {
      // fall through to mock
    }
  }
  return loadMockData().metrics[slug];
}

export async function getEntityAnomalies(slug: EntitySlug): Promise<Anomaly[]> {
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
  return loadMockData().anomalies[slug] ?? [];
}

export async function getEntityFinancials(slug: EntitySlug, asOf: string): Promise<FinancialsData> {
  if (USE_DRIVE) {
    try {
      return await transformFinancials(slug, asOf);
    } catch (err) {
      console.warn(`[dataSource] failed to transform financials for ${slug}, falling back to mock:`, err);
    }
  }
  return loadEntityFile<FinancialsData>(slug, "financials");
}

export async function getEntityCustomers(slug: EntitySlug, asOf: string): Promise<CustomersData> {
  if (USE_DRIVE) {
    try {
      return await transformCustomers(slug, asOf);
    } catch (err) {
      console.warn(`[dataSource] failed to transform customers for ${slug}, falling back to mock:`, err);
    }
  }
  return loadEntityFile<CustomersData>(slug, "customers");
}

export async function getEntityVendors(slug: EntitySlug, asOf: string): Promise<VendorsData> {
  if (USE_DRIVE) {
    try {
      return await transformVendors(slug, asOf);
    } catch (err) {
      console.warn(`[dataSource] failed to transform vendors for ${slug}, falling back to mock:`, err);
    }
  }
  return loadEntityFile<VendorsData>(slug, "vendors");
}

export async function getEntityBanking(slug: EntitySlug, asOf: string): Promise<BankingData> {
  if (USE_DRIVE) {
    try {
      return await transformBanking(slug, asOf);
    } catch (err) {
      console.warn(`[dataSource] failed to transform banking for ${slug}, falling back to mock:`, err);
    }
  }
  return loadEntityFile<BankingData>(slug, "banking");
}

export async function getEntityFile<T>(slug: EntitySlug, file: EntityDataFile): Promise<T> {
  const asOf = new Date().toISOString();
  switch (file) {
    case "financials":
      return (await getEntityFinancials(slug, asOf)) as unknown as T;
    case "customers":
      return (await getEntityCustomers(slug, asOf)) as unknown as T;
    case "vendors":
      return (await getEntityVendors(slug, asOf)) as unknown as T;
    case "banking":
      return (await getEntityBanking(slug, asOf)) as unknown as T;
    default:
      return loadEntityFile<T>(slug, file);
  }
}
