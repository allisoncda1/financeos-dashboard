import { Router, type IRouter } from "express";
import { loadMockData } from "../lib/mockData";
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

export default router;
