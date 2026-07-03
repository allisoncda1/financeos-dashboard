import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// GET /api/health — detailed health info (ported from original server)
router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    data: {
      status: "healthy",
      version: "1.0.0",
      phase: "1 — mock data",
      dataSource: "local mock JSON",
      drive: "not connected",
      uptime: Math.round(process.uptime()),
    },
    ts: new Date().toISOString(),
  });
});

export default router;
