import { Router, type IRouter } from "express";
import { buildAIContext } from "../ai/context";
import { getCacheStats, getCached, setCached } from "../ai/cache";
import { formatAnalysisResponse, formatBriefingResponse } from "../ai/formatter";
import { getProvider } from "../ai/provider";
import { ENTITY_SLUGS, type EntitySlug } from "../lib/types";

const router: IRouter = Router();

function isEntitySlug(value: unknown): value is EntitySlug {
  return typeof value === "string" && (ENTITY_SLUGS as readonly string[]).includes(value);
}

function parseEntitySlugs(value: unknown): EntitySlug[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const slugs = value.filter(isEntitySlug);
  return slugs.length > 0 ? slugs : undefined;
}

// GET /api/ai/status — provider identity, availability, and cache stats.
// Never exposes API keys or prompts — read-only operational status only.
router.get("/status", async (_req, res) => {
  try {
    const provider = getProvider();
    res.json({
      ok: true,
      data: {
        provider: provider.name,
        model: provider.model,
        available: true,
        cacheStats: getCacheStats(),
        lastRequest: null,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Failed to load AI status", ts: new Date().toISOString() });
  }
});

// GET /api/ai/briefing — the AI Platform's briefing capability. Cached 15 min.
router.get("/briefing", async (req, res) => {
  try {
    const cacheKey = "briefing";
    const cached = getCached(cacheKey);
    if (cached) {
      res.json({ ok: true, data: formatBriefingResponse(cached), ts: new Date().toISOString() });
      return;
    }

    const context = await buildAIContext();
    const response = await getProvider().generateBriefing(context);
    setCached(cacheKey, response);

    res.json({ ok: true, data: formatBriefingResponse(response), ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to generate AI briefing");
    res.status(500).json({ ok: false, error: "Failed to generate AI briefing", ts: new Date().toISOString() });
  }
});

// POST /api/ai/report-summary — body: { template?, sections? }
router.post("/report-summary", async (req, res) => {
  try {
    const { sections } = req.body as { template?: string; sections?: Record<string, unknown> };
    const context = await buildAIContext();
    context.reportSections = sections;

    const response = await getProvider().summarizeReport(context);
    res.json({ ok: true, data: { summary: response.content }, ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to generate report summary");
    res.status(500).json({ ok: false, error: "Failed to generate report summary", ts: new Date().toISOString() });
  }
});

// POST /api/ai/analyze — body: { entities? }
router.post("/analyze", async (req, res) => {
  try {
    const { entities } = req.body as { entities?: unknown };
    const slugs = parseEntitySlugs(entities);
    const context = await buildAIContext(slugs);

    const response = await getProvider().analyzeFinancials(context);
    res.json({ ok: true, data: formatAnalysisResponse(response), ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to analyze financials");
    res.status(500).json({ ok: false, error: "Failed to analyze financials", ts: new Date().toISOString() });
  }
});

// POST /api/ai/question — body: { question, entities? }
router.post("/question", async (req, res) => {
  try {
    const { question, entities } = req.body as { question?: string; entities?: unknown };
    if (!question || typeof question !== "string") {
      res.status(400).json({ ok: false, error: "question is required", ts: new Date().toISOString() });
      return;
    }

    const slugs = parseEntitySlugs(entities);
    const context = await buildAIContext(slugs);
    context.question = question;

    const response = await getProvider().answerQuestion(context);
    res.json({
      ok: true,
      data: { answer: response.content, provider: response.provider },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to answer question");
    res.status(500).json({ ok: false, error: "Failed to answer question", ts: new Date().toISOString() });
  }
});

export default router;
