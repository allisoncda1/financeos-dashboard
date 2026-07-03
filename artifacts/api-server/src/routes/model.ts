import { Router, type IRouter } from "express";
import { ENTITY_SLUGS } from "../lib/mockData";
import {
  getPortfolioSummary,
  getValidationSummary,
  getDataFreshness,
  getEntityMetrics,
  getEntityAnomalies,
  getEntityFile,
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
const ENTITY_FILES = ["financials", "customers", "vendors", "banking"] as const;

for (const file of ENTITY_FILES) {
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
      const data = await getEntityFile(slug, file);
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
