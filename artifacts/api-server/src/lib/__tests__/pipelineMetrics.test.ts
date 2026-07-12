import { describe, expect, it } from "vitest";
import { computePipelineMetrics } from "../pipelineMetrics";

describe("computePipelineMetrics", () => {
  it("returns unavailable metrics when Neon has no qualifying runs", () => {
    expect(computePipelineMetrics([])).toEqual({
      avgEntitySyncDurationSeconds: null,
      pipelineUptime30dPct: null,
      successfulRuns30d: 0,
      totalRuns30d: 0,
    });
  });

  it("derives duration and success rate from persisted runs", () => {
    const result = computePipelineMetrics([
      { status: "success", startedAt: new Date("2026-07-12T00:00:00Z"), completedAt: new Date("2026-07-12T00:00:10Z") },
      { status: "success", startedAt: new Date("2026-07-12T01:00:00Z"), completedAt: new Date("2026-07-12T01:00:20Z") },
      { status: "failed", startedAt: new Date("2026-07-12T02:00:00Z"), completedAt: new Date("2026-07-12T02:00:30Z") },
    ]);

    expect(result).toEqual({
      avgEntitySyncDurationSeconds: 20,
      pipelineUptime30dPct: 66.7,
      successfulRuns30d: 2,
      totalRuns30d: 3,
    });
  });

  it("excludes incomplete and invalid durations from the average", () => {
    const result = computePipelineMetrics([
      { status: "success", startedAt: new Date("2026-07-12T00:00:10Z"), completedAt: new Date("2026-07-12T00:00:00Z") },
      { status: "partial", startedAt: new Date("2026-07-12T01:00:00Z"), completedAt: null },
    ]);

    expect(result.avgEntitySyncDurationSeconds).toBeNull();
    expect(result.pipelineUptime30dPct).toBe(50);
  });
});
