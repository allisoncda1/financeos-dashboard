import { Router, type IRouter } from "express";
import { driveStatus } from "../lib/driveLoader";

const router: IRouter = Router();

// GET /api/drive/status — Google Drive connectivity/configuration status
router.get("/status", (_req, res) => {
  // Connectivity status is computed from the live runtime, never cached/mocked.
  res.json({ ok: true, data: driveStatus(), source: "live", ts: new Date().toISOString() });
});

export default router;
