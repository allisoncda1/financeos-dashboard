import { Router, type IRouter } from "express";
import { RulesEngine } from "../rules/engine";
import { getAlertsFromNeon } from "../lib/neonSource";

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

// GET /api/alerts — every active (non-resolved) alert read from FinanceOS Core.
// The Dashboard does NOT calculate alerts; they are read straight from Core's
// `alerts` table. Source is always "db" (Neon); no Drive/mock fallback.
router.get("/alerts", async (req, res) => {
  try {
    const alerts = await getAlertsFromNeon();
    const data = alerts.filter((a) => a.status !== "resolved");
    res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to read alerts from Core");
    res.status(500).json({
      ok: false,
      error: "Failed to read alerts",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/alerts/portfolio — portfolio-scoped alerts (Core entity_id IS NULL).
// Declared before /alerts/:entity so "portfolio" is not captured as an entity.
router.get("/alerts/portfolio", async (req, res) => {
  try {
    const alerts = await getAlertsFromNeon();
    const data = alerts.filter((a) => a.scope === "portfolio" && a.status !== "resolved");
    res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to read portfolio alerts from Core");
    res.status(500).json({
      ok: false,
      error: "Failed to read portfolio alerts",
      ts: new Date().toISOString(),
    });
  }
});

// GET /api/alerts/:entity — alerts for a single entity. Matches Core slug
// (lower-case), the Dashboard's display-cased slug, or the display name.
router.get("/alerts/:entity", async (req, res) => {
  try {
    const param = req.params.entity.toLowerCase();
    const alerts = await getAlertsFromNeon();
    const data = alerts.filter(
      (a) =>
        a.status !== "resolved" &&
        a.scope === "entity" &&
        (a.entitySlug?.toLowerCase() === param || a.entity.toLowerCase() === param),
    );
    res.json({ ok: true, data, source: "db", ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to read alerts for entity from Core");
    res.status(500).json({
      ok: false,
      error: "Failed to read alerts for entity",
      ts: new Date().toISOString(),
    });
  }
});

export default router;
