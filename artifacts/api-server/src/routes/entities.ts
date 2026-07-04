import { Router, type IRouter } from "express";
import { ENTITY_DEFINITIONS } from "../lib/entities";

const router: IRouter = Router();

// GET /api/entities — entity registry
// Entity definitions are static application config, so source is "live".
router.get("/entities", (_req, res) => {
  res.json({ ok: true, data: ENTITY_DEFINITIONS, source: "live", ts: new Date().toISOString() });
});

// GET /api/entities/:slug — single entity definition
router.get("/entities/:slug", (req, res) => {
  const entity = ENTITY_DEFINITIONS.find((e) => e.slug === req.params["slug"]);
  if (!entity) {
    res.status(404).json({
      ok: false,
      error: `Entity "${req.params["slug"]}" not found`,
      ts: new Date().toISOString(),
    });
    return;
  }
  res.json({ ok: true, data: entity, source: "live", ts: new Date().toISOString() });
});

export default router;
