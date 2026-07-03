import { driveLoadJson } from "./driveLoader";
import { loadMockData, loadEntityFile, loadValidationSummary, type EntityDataFile } from "./mockData";
import type {
  PortfolioSummary,
  ValidationSummary,
  DataFreshness,
  EntityMetrics,
  Anomaly,
  EntitySlug,
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
      return await driveLoadJson<Anomaly[]>(`entities/${slug}/anomalies.json`);
    } catch {
      // fall through to mock
    }
  }
  return loadMockData().anomalies[slug] ?? [];
}

export async function getEntityFile<T>(slug: EntitySlug, file: EntityDataFile): Promise<T> {
  if (USE_DRIVE) {
    try {
      return await driveLoadJson<T>(`entities/${slug}/${file}.json`);
    } catch {
      // fall through to mock
    }
  }
  return loadEntityFile<T>(slug, file);
}
