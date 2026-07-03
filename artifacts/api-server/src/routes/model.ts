import { Router, type IRouter } from "express";
import { ENTITY_SLUGS } from "../lib/mockData";
import {
  getPortfolioSummary,
  getValidationSummary,
  getDataFreshness,
  getEntityMetrics,
  getEntityAnomalies,
  getEntityFinancials,
  getEntityCustomers,
  getEntityVendors,
  getEntityBanking,
} from "../lib/dataSource";
import type { EntitySlug } from "../lib/types";

const router: IRouter = Router();

// GET /api/model — full dashboard data for all entities
router.get("/model", async (req, res) => {
  try {
    const [portfolio, validation, freshness] = await Promise.all([
      getPortfolioSummary(),
      getValidationSummary(),
      getDataFreshness(),
    ]);

    const metrics = {} as Record<EntitySlug, Awaited<ReturnType<typeof getEntityMetrics>>>;
    const anomalies = {} as Record<EntitySlug, Awaited<ReturnType<typeof getEntityAnomalies>>>;
    for (const slug of ENTITY_SLUGS) {
      metrics[slug] = await getEntityMetrics(slug);
      anomalies[slug] = await getEntityAnomalies(slug);
    }

    const data = { portfolio, validation, freshness, metrics, anomalies };
    res.json({ ok: true, data, ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to load model data");
    res.status(500).json({
      ok: false,
      error: "Failed to load model data",
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
      data: { metrics, anomalies, freshness },
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
      const data = await loader(slug, metrics.as_of);
      res.json({ ok: true, data, ts: new Date().toISOString() });
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
