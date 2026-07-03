import { Router } from "express";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataRoot = path.resolve(__dirname, "../../data/mock");

// GET /api/validation — validation summary + per-entity breakdown
router.get("/", (_req, res) => {
  try {
    const summary = require(`${dataRoot}/validation/validation_summary.json`);
    res.json({ ok: true, data: summary, ts: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Failed to load validation data", ts: new Date().toISOString() });
  }
});

export default router;
