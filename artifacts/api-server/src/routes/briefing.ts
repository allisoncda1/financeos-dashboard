import { Router, type IRouter } from "express";
import { buildAIContext } from "../ai/context";
import { getCached, setCached } from "../ai/cache";
import { formatBriefingResponse } from "../ai/formatter";
import { getProvider } from "../ai/provider";

const router: IRouter = Router();

// GET /api/briefing — thin proxy to the AI Platform's briefing capability.
// Kept as a stable, pre-existing URL for the frontend; all AI logic now
// lives behind ai/provider.ts + ai/context.ts, matching /api/ai/briefing.
router.get("/briefing", async (req, res) => {
  try {
    const cacheKey = "briefing";
    let response = getCached(cacheKey);
    if (!response) {
      const context = await buildAIContext();
      response = await getProvider().generateBriefing(context);
      setCached(cacheKey, response);
    }

    const data = formatBriefingResponse(response);
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
