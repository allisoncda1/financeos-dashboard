import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { DashboardData, EntitySlug } from "./types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDataRoot(): string {
  const candidates = [
    path.resolve(__dirname, "../data/mock"),
    path.resolve(__dirname, "../../data/mock"),
    path.resolve(process.cwd(), "data/mock"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error("Mock data directory not found");
}

const dataRoot = resolveDataRoot();

function loadJson<T>(relativePath: string): T {
  const filePath = path.join(dataRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export function loadMockData(): DashboardData {
  const slugs: EntitySlug[] = [
    "CarDealer_ai",
    "T3_Marketing",
    "TopMrktr",
    "Smile_More",
  ];

  const metrics = {} as DashboardData["metrics"];
  const anomalies = {} as DashboardData["anomalies"];
  for (const slug of slugs) {
    metrics[slug] = loadJson(`entities/${slug}/metrics.json`);
    anomalies[slug] = loadJson(`entities/${slug}/anomalies.json`);
  }

  return {
    portfolio: loadJson("portfolio/summary.json"),
    validation: loadJson("validation/validation_summary.json"),
    freshness: loadJson("audit/data_freshness.json"),
    metrics,
    anomalies,
  };
}

export function loadValidationSummary(): unknown {
  return loadJson("validation/validation_summary.json");
}
