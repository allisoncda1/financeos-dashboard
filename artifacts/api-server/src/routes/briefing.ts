import { Router, type IRouter } from "express";
import { generateBriefing } from "../ai/briefing";

const router: IRouter = Router();

// GET /api/briefing — deterministic AI CFO briefing, computed from live data
router.get("/briefing", async (req, res) => {
  try {
    const data = await generateBriefing();
    res.json({ ok: true, data, ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to generate briefing");
    res.status(500).json({
      ok: false,
      error: "Failed to generate briefing",
      ts: new Date().toISOString(),
    });
  }
});

export default router;
