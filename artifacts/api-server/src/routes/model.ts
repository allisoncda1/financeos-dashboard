import { Router, type IRouter } from "express";
import { loadMockData, loadEntityFile, ENTITY_SLUGS } from "../lib/mockData";
import type { EntitySlug } from "../lib/types";

const router: IRouter = Router();

// GET /api/model — full dashboard data for all entities
router.get("/model", (req, res) => {
  try {
    const data = loadMockData();
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
router.get("/model/:slug", (req, res) => {
  const slug = req.params["slug"] as EntitySlug;
  try {
    const data = loadMockData();
    const metrics = data.metrics[slug];
    if (!metrics) {
      res.status(404).json({
        ok: false,
        error: `Entity "${slug}" not found`,
        ts: new Date().toISOString(),
      });
      return;
    }
    res.json({
      ok: true,
      data: {
        metrics: data.metrics[slug],
        anomalies: data.anomalies[slug] ?? [],
        freshness: data.freshness,
      },
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
  router.get(`/model/:slug/${file}`, (req, res) => {
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
      const data = loadEntityFile(slug, file);
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
