import { Router, type IRouter } from "express";
import { loadValidationSummary } from "../lib/mockData";

const router: IRouter = Router();

// GET /api/validation — validation summary + per-entity breakdown
router.get("/validation", (req, res) => {
  try {
    const summary = loadValidationSummary();
    res.json({ ok: true, data: summary, ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to load validation data");
    res.status(500).json({
      ok: false,
      error: "Failed to load validation data",
      ts: new Date().toISOString(),
    });
  }
});

export default router;
