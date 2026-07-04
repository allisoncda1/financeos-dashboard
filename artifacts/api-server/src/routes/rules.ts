import { Router, type IRouter } from "express";
import { RulesEngine } from "../rules/engine";

const router: IRouter = Router();

// GET /api/rules — metadata for every registered rule (no evaluate functions)
router.get("/rules", async (req, res) => {
  try {
    const data = RulesEngine.getRegisteredRules();
    // Rule metadata is static application config, not fetched data.
    res.json({ ok: true, data, source: "live", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to load rules");
    res.status(500).json({
      ok: false,
      error: "Failed to load rules",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/alerts — every active alert produced by the Rules Engine
router.get("/alerts", async (req, res) => {
  try {
    const { alerts: data, source } = await RulesEngine.runWithSource();
    res.json({ ok: true, data, source, ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to evaluate alerts");
    res.status(500).json({
      ok: false,
      error: "Failed to evaluate alerts",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/alerts/:entity — alerts filtered to a single entity name
router.get("/alerts/:entity", async (req, res) => {
  try {
    const { alerts, source } = await RulesEngine.runWithSource();
    const data = alerts.filter(
      (alert) => alert.entity.toLowerCase() === req.params.entity.toLowerCase(),
    );
    res.json({ ok: true, data, source, ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to evaluate alerts for entity");
    res.status(500).json({
      ok: false,
      error: "Failed to evaluate alerts for entity",
      ts: new Date().toISOString(),
    });
  }
});

export default router;
