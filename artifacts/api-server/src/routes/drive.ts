import { Router, type IRouter } from "express";
import { driveStatus } from "../lib/driveLoader";

const router: IRouter = Router();

// GET /api/drive/status — Google Drive connectivity/configuration status
router.get("/status", (_req, res) => {
  res.json({ ok: true, data: driveStatus(), ts: new Date().toISOString() });
});

export default router;
