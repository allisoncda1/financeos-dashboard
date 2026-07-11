import { Router, type IRouter } from "express";
import { getValidationSummary } from "../lib/dataSource";
import { buildValidationMatrix } from "../lib/validationMatrix";

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

// GET /api/validation/matrix — per-entity × per-rule validation results
// derived strictly from the pipeline's published output (summary counts),
// with cell statuses of "unknown" where the pipeline never reported an
// outcome, plus explicit discrepancy notes when its counts contradict
// themselves (e.g. 87 passed vs 40 declared total).
router.get("/validation/matrix", async (req, res) => {
  try {
    const result = await getValidationSummary();
    const data = buildValidationMatrix(result.data);
    res.json({ ok: true, data, source: result.source, ts: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to build validation matrix");
    res.status(500).json({
      ok: false,
      error: "Failed to build validation matrix",
      ts: new Date().toISOString(),
    });
  }
});

export default router;
