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
import { RulesEngine } from "../rules/engine";
import type { AIContext } from "./types";

export async function buildAIContext(entitySlugs?: EntitySlug[]): Promise<AIContext> {
  const slugs = entitySlugs && entitySlugs.length > 0 ? entitySlugs : ENTITY_SLUGS;

  const [portfolio, validation, freshness, alerts, metricsList, anomaliesList] = await Promise.all([
    getPortfolioSummary(),
    getValidationSummary(),
    getDataFreshness(),
    RulesEngine.run(),
    Promise.all(slugs.map((slug) => getEntityMetrics(slug))),
    Promise.all(slugs.map((slug) => getEntityAnomalies(slug))),
  ]);

  const entities = Object.fromEntries(
    slugs.map((slug, i) => [slug, { metrics: metricsList[i]!.data, anomalies: anomaliesList[i]!.data }]),
  ) as AIContext["entities"];

  console.log(`[ai/context] built context for ${slugs.length} entities, ${alerts.length} alerts`);

  return {
    portfolio: portfolio.data,
    entities,
    alerts,
    validation: validation.data,
    freshness: freshness.data,
  };
}
