import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
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
