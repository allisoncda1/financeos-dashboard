import { Router, type IRouter } from "express";
import { getValidationSummary } from "../lib/dataSource";

const router: IRouter = Router();

// GET /api/validation — validation summary + per-entity breakdown
router.get("/validation", async (req, res) => {
  try {
    const result = await getValidationSummary();
    res.json({ ok: true, data: result.data, source: result.source, ts: new Date().toISOString() });
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
