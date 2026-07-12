export type PipelineRunMetric = {
  status: string;
  startedAt: Date;
  completedAt: Date | null;
};

export type PipelineMetrics = {
  avgEntitySyncDurationSeconds: number | null;
  pipelineUptime30dPct: number | null;
  successfulRuns30d: number;
  totalRuns30d: number;
};

/** Compute display metrics only from persisted pipeline runs; never invent values. */
export function computePipelineMetrics(runs: PipelineRunMetric[]): PipelineMetrics {
  const completedDurations = runs.flatMap((run) => {
    if (!run.completedAt) return [];
    const seconds = (run.completedAt.getTime() - run.startedAt.getTime()) / 1000;
    return Number.isFinite(seconds) && seconds >= 0 ? [seconds] : [];
  });
  const successfulRuns = runs.filter((run) => run.status === "success").length;
  const avgDuration = completedDurations.length > 0
    ? completedDurations.reduce((sum, seconds) => sum + seconds, 0) / completedDurations.length
    : null;
  const uptimePct = runs.length > 0 ? (successfulRuns / runs.length) * 100 : null;

  return {
    avgEntitySyncDurationSeconds: avgDuration === null ? null : Math.round(avgDuration * 10) / 10,
    pipelineUptime30dPct: uptimePct === null ? null : Math.round(uptimePct * 10) / 10,
    successfulRuns30d: successfulRuns,
    totalRuns30d: runs.length,
  };
}
