/**
 * AI Platform — context builder.
 *
 * Loads all live FinanceOS data in parallel and assembles it into a single
 * normalized AIContext. This is the ONLY data any AIProvider ever sees —
 * never raw CSV rows, never unparsed Google Drive file contents. Every
 * field here is already a typed, validated FinanceOS domain object.
 */

import {
  getDataFreshness,
  getEntityAnomalies,
  getEntityMetrics,
  getPortfolioSummary,
  getValidationSummary,
} from "../lib/dataSource";
import { ENTITY_SLUGS, type EntitySlug } from "../lib/types";
import { combineSources, type DataSourceKind } from "../lib/sourceTracker";
import { RulesEngine } from "../rules/engine";
import type { AIContext } from "./types";

/**
 * buildAIContextWithSource — builds the AIContext and also reports the
 * worst-case source (mock > cache > live) of every dataset that went into
 * it, so AI endpoints can honestly label their responses.
 */
export async function buildAIContextWithSource(
  entitySlugs?: EntitySlug[],
): Promise<{ context: AIContext; source: DataSourceKind }> {
  const slugs = entitySlugs && entitySlugs.length > 0 ? entitySlugs : ENTITY_SLUGS;

  const [portfolio, validation, freshness, alertsResult, metricsList, anomaliesList] = await Promise.all([
    getPortfolioSummary(),
    getValidationSummary(),
    getDataFreshness(),
    RulesEngine.runWithSource(),
    Promise.all(slugs.map((slug) => getEntityMetrics(slug))),
    Promise.all(slugs.map((slug) => getEntityAnomalies(slug))),
  ]);
  const alerts = alertsResult.alerts;

  const entities = Object.fromEntries(
    slugs.map((slug, i) => [slug, { metrics: metricsList[i]!.data, anomalies: anomaliesList[i]!.data }]),
  ) as AIContext["entities"];

  const source = combineSources([
    portfolio.source,
    validation.source,
    freshness.source,
    alertsResult.source,
    ...metricsList.map((m) => m.source),
    ...anomaliesList.map((a) => a.source),
  ]);

  console.log(`[ai/context] built context for ${slugs.length} entities, ${alerts.length} alerts (source=${source})`);

  return {
    context: {
      portfolio: portfolio.data,
      entities,
      alerts,
      validation: validation.data,
      freshness: freshness.data,
    },
    source,
  };
}

export async function buildAIContext(entitySlugs?: EntitySlug[]): Promise<AIContext> {
  const { context } = await buildAIContextWithSource(entitySlugs);
  return context;
}
