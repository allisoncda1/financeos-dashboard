import { Router, type IRouter } from "express";
import { ENTITY_SLUGS } from "../lib/mockData";
import {
  getPortfolioSummary,
  getValidationSummary,
  getDataFreshness,
  getEntityMetrics,
  getEntityAnomalies,
  getEntityFinancials,
  getEntityHistory,
  getEntityCustomers,
  getEntityVendors,
  getEntityBanking,
  getConsolidatedCashFlow,
} from "../lib/dataSource";
import { archiveMetricSnapshot, getMetricSnapshots } from "../lib/snapshotStore";
import { combineSources, type DataSourceKind } from "../lib/sourceTracker";
import type { EntityMetrics, EntitySlug } from "../lib/types";

const router: IRouter = Router();

/**
 * Persist this month's metric snapshot for entities whose metrics came from
 * live pipeline data (never mock — fabricated numbers must not enter the
 * historical record). Fire-and-forget: archiving failures are logged but
 * never fail the request that triggered them.
 */
function archiveLiveSnapshots(
  entries: { slug: EntitySlug; metrics: EntityMetrics; source: DataSourceKind }[],
): void {
  for (const { slug, metrics, source } of entries) {
    if (source === "mock") continue;
    archiveMetricSnapshot(slug, metrics).catch((err) => {
      console.warn(`[snapshots] failed to archive metric snapshot for ${slug}:`, err);
    });
  }
}

// GET /api/model — full dashboard data for all entities
router.get("/model", async (req, res) => {
  try {
    const [portfolio, validation, freshness] = await Promise.all([
      getPortfolioSummary(),
      getValidationSummary(),
      getDataFreshness(),
    ]);

    const metrics = {} as Record<EntitySlug, unknown>;
    const anomalies = {} as Record<EntitySlug, unknown>;
    const sources: DataSourceKind[] = [portfolio.source, validation.source, freshness.source];
    const snapshotEntries: { slug: EntitySlug; metrics: EntityMetrics; source: DataSourceKind }[] = [];
    for (const slug of ENTITY_SLUGS) {
      const m = await getEntityMetrics(slug);
      const a = await getEntityAnomalies(slug);
      metrics[slug] = m.data;
      anomalies[slug] = a.data;
      sources.push(m.source, a.source);
      snapshotEntries.push({ slug, metrics: m.data, source: m.source });
    }
    archiveLiveSnapshots(snapshotEntries);

    const data = {
      portfolio: portfolio.data,
      validation: validation.data,
      freshness: freshness.data,
      metrics,
      anomalies,
    };
    res.json({ ok: true, data, source: combineSources(sources), ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to load model data");
    res.status(500).json({
      ok: false,
      error: "Failed to load model data",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/model/history/snapshots — stored monthly metric snapshots for all
// entities (archived server-side from live pipeline data). Registered before
// the /model/:slug routes so "history" is never treated as an entity slug.
router.get("/model/history/snapshots", async (req, res) => {
  try {
    const data = await getMetricSnapshots();
    res.json({ ok: true, data, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to load metric snapshots");
    res.status(500).json({
      ok: false,
      error: "Failed to load metric snapshots",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/model/cashflow — consolidated (portfolio) statement of cash flows
// across the selected entities, summed server-side from published Neon rows.
// Registered before the /model/:slug routes so "cashflow" is never treated as
// an entity slug. Optional ?slugs=A,B,C selects entities (defaults to all).
router.get("/model/cashflow", async (req, res) => {
  const raw = typeof req.query["slugs"] === "string" ? (req.query["slugs"] as string) : "";
  const requested = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const slugs = (requested.length > 0 ? requested : ENTITY_SLUGS).filter(
    (s): s is EntitySlug => (ENTITY_SLUGS as readonly string[]).includes(s),
  );
  try {
    const result = await getConsolidatedCashFlow(slugs);
    res.json({
      ok: true,
      data: result.data,
      source: result.source,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load consolidated cash flow");
    res.status(500).json({
      ok: false,
      error: "Failed to load consolidated cash flow",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/model/:slug/history — real prior-period (prior fiscal year)
// financial history for one entity, from the pipeline's archived exports.
router.get("/model/:slug/history", async (req, res) => {
  const slug = req.params["slug"] as EntitySlug;
  if (!ENTITY_SLUGS.includes(slug)) {
    res.status(404).json({
      ok: false,
      error: `Entity "${slug}" not found`,
      ts: new Date().toISOString(),
    });
    return;
  }
  try {
    const result = await getEntityHistory(slug);
    res.json({
      ok: true,
      data: result.data,
      source: result.source,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, `Failed to load history data for ${slug}`);
    res.status(500).json({
      ok: false,
      error: "Failed to load history data",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/model/:slug — single entity data
router.get("/model/:slug", async (req, res) => {
  const slug = req.params["slug"] as EntitySlug;
  if (!ENTITY_SLUGS.includes(slug)) {
    res.status(404).json({
      ok: false,
      error: `Entity "${slug}" not found`,
      ts: new Date().toISOString(),
    });
    return;
  }
  try {
    const [metrics, anomalies, freshness] = await Promise.all([
      getEntityMetrics(slug),
      getEntityAnomalies(slug),
      getDataFreshness(),
    ]);
    res.json({
      ok: true,
      data: { metrics: metrics.data, anomalies: anomalies.data, freshness: freshness.data },
      source: combineSources([metrics.source, anomalies.source, freshness.source]),
      ts: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to load entity data");
    res.status(500).json({
      ok: false,
      error: "Failed to load entity data",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/model/:slug/{financials,customers,vendors,banking} — per-entity detail data
const ENTITY_FILE_LOADERS = {
  financials: getEntityFinancials,
  customers: getEntityCustomers,
  vendors: getEntityVendors,
  banking: getEntityBanking,
} as const;

for (const file of Object.keys(ENTITY_FILE_LOADERS) as (keyof typeof ENTITY_FILE_LOADERS)[]) {
  router.get(`/model/:slug/${file}`, async (req, res) => {
    const slug = req.params["slug"] as EntitySlug;
    if (!ENTITY_SLUGS.includes(slug)) {
      res.status(404).json({
        ok: false,
        error: `Entity "${slug}" not found`,
        ts: new Date().toISOString(),
      });
      return;
    }
    try {
      const metrics = await getEntityMetrics(slug);
      const loader = ENTITY_FILE_LOADERS[file];
      const result = await loader(slug, metrics.data.as_of);
      res.json({
        ok: true,
        data: result.data,
        source: combineSources([metrics.source, result.source]),
        ts: new Date().toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, `Failed to load ${file} data for ${slug}`);
      res.status(500).json({
        ok: false,
        error: `Failed to load ${file} data`,
        ts: new Date().toISOString(),
      });
    }
  });
}

export default router;
