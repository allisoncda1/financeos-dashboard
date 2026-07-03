import { Router } from "express";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import type { DashboardData, EntitySlug } from "../../shared/types.js";

const router = Router();
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(__dirname, "../../data/mock");

function loadMockData(): DashboardData {
  return {
    portfolio:  require(`${dataRoot}/portfolio/summary.json`),
    validation: require(`${dataRoot}/validation/validation_summary.json`),
    freshness:  require(`${dataRoot}/audit/data_freshness.json`),
    metrics: {
      CarDealer_ai: require(`${dataRoot}/entities/CarDealer_ai/metrics.json`),
      T3_Marketing: require(`${dataRoot}/entities/T3_Marketing/metrics.json`),
      TopMrktr:     require(`${dataRoot}/entities/TopMrktr/metrics.json`),
      Smile_More:   require(`${dataRoot}/entities/Smile_More/metrics.json`),
    },
    anomalies: {
      CarDealer_ai: require(`${dataRoot}/entities/CarDealer_ai/anomalies.json`),
      T3_Marketing: require(`${dataRoot}/entities/T3_Marketing/anomalies.json`),
      TopMrktr:     require(`${dataRoot}/entities/TopMrktr/anomalies.json`),
      Smile_More:   require(`${dataRoot}/entities/Smile_More/anomalies.json`),
    },
  };
}

// GET /api/model — full dashboard data for all entities
router.get("/", (_req, res) => {
  try {
    const data = loadMockData();
    res.json({ ok: true, data, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Failed to load model data", ts: new Date().toISOString() });
  }
});

// GET /api/model/:slug — single entity data
router.get("/:slug", (req, res) => {
  const slug = req.params.slug as EntitySlug;
  try {
    const data = loadMockData();
    const metrics = data.metrics[slug];
    if (!metrics) {
      res.status(404).json({ ok: false, error: `Entity "${slug}" not found`, ts: new Date().toISOString() });
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
    res.status(500).json({ ok: false, error: "Failed to load entity data", ts: new Date().toISOString() });
  }
});

export default router;
