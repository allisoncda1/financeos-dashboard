// FinanceOS — pipeline status shape, mirrors artifacts/api-server's
// GET /api/pipeline/status response. Read-only; FinanceOS never runs or
// triggers the pipeline, it only displays what it last reported.

export type StaleStatus = "fresh" | "amber" | "red";

export type PipelineStatus = {
  lastPipelineRun: string | null;
  driveUpload: string | null;
  modelBuild: string | null;
  qboConnection: string | null;
  dataAgeHours: number | null;
  staleStatus: StaleStatus;
  entitiesBuilt: number | null;
  snapshotArchived: boolean | null;
};
