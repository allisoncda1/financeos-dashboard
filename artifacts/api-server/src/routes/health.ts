import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { USE_DRIVE } from "../lib/dataSource";
import { getProvider } from "../ai/provider";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// GET /api/health — detailed health info reflecting the real runtime state
router.get("/health", (_req, res) => {
  const provider = getProvider();
  res.json({
    ok: true,
    source: "live",
    data: {
      status: "healthy",
      version: "1.0.0",
      dataSource: USE_DRIVE ? "google-drive" : "local mock JSON",
      drive: USE_DRIVE ? "connected" : "not connected",
      aiProvider: provider.name,
      uptime: Math.round(process.uptime()),
    },
    ts: new Date().toISOString(),
  });
});

export default router;
