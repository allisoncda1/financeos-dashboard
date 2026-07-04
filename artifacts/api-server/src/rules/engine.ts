/**
 * Rules Engine — singleton entry point.
 *
 * Loads live DashboardData, runs every enabled rule via evaluateAllRules(),
 * and caches the resulting Alert[] for 5 minutes (same TTL pattern as
 * driveLoader's Drive-file cache) so /api/alerts, /api/rules, and the AI CFO
 * briefing all read from one consistent, deduplicated source of truth.
 */

import {
  getEntityAnomalies,
  getDataFreshness,
  getPortfolioSummary,
  getValidationSummary,
  getEntityMetrics,
} from "../lib/dataSource";
import { ENTITY_SLUGS, type DashboardData } from "../lib/types";
import { combineSources, type DataSourceKind } from "../lib/sourceTracker";
import { evaluateAllRules, type Alert } from "./evaluator";
import { RULE_REGISTRY, type Rule } from "./registry";

const CACHE_TTL_MS = 5 * 60 * 1000;

async function getDashboardData(): Promise<{ data: DashboardData; source: DataSourceKind }> {
  const [portfolio, validation, freshness, metricsList, anomaliesList] = await Promise.all([
    getPortfolioSummary(),
    getValidationSummary(),
    getDataFreshness(),
    Promise.all(ENTITY_SLUGS.map((slug) => getEntityMetrics(slug))),
    Promise.all(ENTITY_SLUGS.map((slug) => getEntityAnomalies(slug))),
  ]);

  const metrics = Object.fromEntries(
    ENTITY_SLUGS.map((slug, i) => [slug, metricsList[i]!.data]),
  ) as DashboardData["metrics"];
  const anomalies = Object.fromEntries(
    ENTITY_SLUGS.map((slug, i) => [slug, anomaliesList[i]!.data]),
  ) as DashboardData["anomalies"];

  const source = combineSources([
    portfolio.source,
    validation.source,
    freshness.source,
    ...metricsList.map((m) => m.source),
    ...anomaliesList.map((a) => a.source),
  ]);

  return {
    data: {
      portfolio: portfolio.data,
      validation: validation.data,
      freshness: freshness.data,
      metrics,
      anomalies,
    },
    source,
  };
}

class RulesEngineImpl {
  private cachedAlerts: Alert[] | null = null;
  private cachedSource: DataSourceKind = "live";
  private cacheExpiresAt = 0;

  async run(): Promise<Alert[]> {
    const { alerts } = await this.runWithSource();
    return alerts;
  }

  /**
   * runWithSource — same as run() but also reports the worst-case data
   * source (mock > cache > live) of the underlying dashboard data the
   * alerts were computed from, so /api/alerts can honestly label itself.
   */
  async runWithSource(): Promise<{ alerts: Alert[]; source: DataSourceKind }> {
    const now = Date.now();
    if (this.cachedAlerts && this.cacheExpiresAt > now) {
      return { alerts: this.cachedAlerts, source: this.cachedSource };
    }

    const { data, source } = await getDashboardData();
    const alerts = await evaluateAllRules(data);

    this.cachedAlerts = alerts;
    this.cachedSource = source;
    this.cacheExpiresAt = now + CACHE_TTL_MS;
    return { alerts, source };
  }

  getRegisteredRules(): Omit<Rule, "evaluate">[] {
    return RULE_REGISTRY.map(({ evaluate, ...meta }) => meta);
  }

  invalidateCache(): void {
    this.cachedAlerts = null;
    this.cacheExpiresAt = 0;
  }
}

export const RulesEngine = new RulesEngineImpl();
export type { Alert } from "./evaluator";
export type { Rule } from "./registry";
