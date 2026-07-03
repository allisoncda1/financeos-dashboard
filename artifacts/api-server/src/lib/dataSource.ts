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
      return await driveLoadJson<PortfolioSummary>("portfolio/summary.json");
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
