import { Router, type IRouter } from "express";
import { getDataFreshness } from "../lib/dataSource";
import { invalidateCache as invalidateDriveCache } from "../lib/driveLoader";
import { RulesEngine } from "../rules/engine";
import { invalidateCache as invalidateAiCache } from "../ai/cache";

const router: IRouter = Router();

type StaleStatus = "fresh" | "amber" | "red";

function computeStaleStatus(dataAgeHours: number | null): StaleStatus {
  if (dataAgeHours === null || !Number.isFinite(dataAgeHours)) return "red";
  if (dataAgeHours < 24) return "fresh";
  if (dataAgeHours <= 48) return "amber";
  return "red";
}

// GET /api/pipeline/status — read-only summary of the external pipeline's
// self-reported status (audit/data_freshness.json on Drive). This app never
// runs or triggers the pipeline; it only relays what it last wrote.
router.get("/status", async (_req, res) => {
  try {
    const freshness = await getDataFreshness();

    const pipelineRunDate = new Date(freshness.pipeline_run);
    const dataAgeHours =
      freshness.pipeline_run && !Number.isNaN(pipelineRunDate.getTime())
        ? (Date.now() - pipelineRunDate.getTime()) / (1000 * 60 * 60)
        : null;

    res.json({
      ok: true,
      data: {
        lastPipelineRun: freshness.pipeline_run,
        driveUpload: freshness.drive_upload,
        modelBuild: freshness.model_build,
        qboConnection: freshness.qbo_connection,
        dataAgeHours: dataAgeHours === null ? null : Math.round(dataAgeHours * 10) / 10,
        staleStatus: computeStaleStatus(dataAgeHours),
        entitiesBuilt: freshness.entities_built,
        snapshotArchived: freshness.snapshot_archived,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      ok: true,
      data: {
        lastPipelineRun: null,
        driveUpload: null,
        modelBuild: null,
        qboConnection: null,
        dataAgeHours: null,
        staleStatus: "red" as StaleStatus,
        entitiesBuilt: null,
        snapshotArchived: null,
      },
      ts: new Date().toISOString(),
    });
    void err;
  }
});

// POST /api/pipeline/refresh — webhook for the external pipeline to call
// after it finishes writing fresh data to Drive. Only clears this app's
// in-memory caches so the next request re-fetches from Drive; never writes
// to Drive and never triggers any external process itself.
router.post("/refresh", (req, res) => {
  const expectedToken = process.env["PIPELINE_REFRESH_TOKEN"];
  if (!expectedToken) {
    res.status(503).json({
      ok: false,
      error: "Refresh endpoint not configured",
      ts: new Date().toISOString(),
    });
    return;
  }

  const headerToken = req.header("x-refresh-token");
  const bodyToken =
    req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>)["token"] : undefined;
  const receivedToken = headerToken ?? (typeof bodyToken === "string" ? bodyToken : undefined);

  if (receivedToken !== expectedToken) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized",
      ts: new Date().toISOString(),
    });
    return;
  }

  invalidateDriveCache();
  RulesEngine.invalidateCache();
  invalidateAiCache();

  req.log.info("[pipeline] cache invalidated via refresh webhook");

  res.json({
    ok: true,
    data: {
      message: "Cache cleared. Next request will fetch fresh data from Drive.",
      clearedAt: new Date().toISOString(),
    },
    ts: new Date().toISOString(),
  });
});

export default router;
