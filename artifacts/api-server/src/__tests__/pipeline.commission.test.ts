/**
 * Pipeline → Commission sync: POST /api/pipeline/refresh
 *
 * Verifies:
 *   PC1. Refresh returns 200 immediately (commission re-ingest is non-blocking)
 *   PC2. ingestEntityInvoices is called once per entity after the response
 *   PC3. ingestEntityInvoices failure does NOT change the 200 response
 *   PC4. Commission sync uses a 90-day rolling window
 */

vi.mock("../lib/driveLoader", () => ({ invalidateCache: vi.fn() }));
vi.mock("../rules/engine", () => ({ RulesEngine: { invalidateCache: vi.fn() } }));
vi.mock("../ai/cache", () => ({ invalidateCache: vi.fn() }));
vi.mock("../lib/sourceTracker", () => ({ getSourceSummary: vi.fn(() => ({})) }));
vi.mock("../services/commissionEngine", () => ({ ingestEntityInvoices: vi.fn() }));
vi.mock("../db", () => ({
  EntitiesService: {
    getAllEntities: vi.fn(),
  },
}));

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import request from "supertest";
import express from "express";
import pipelineRouter from "../routes/pipeline";
import { ingestEntityInvoices } from "../services/commissionEngine";
import { EntitiesService } from "../db";

const TOKEN = "test-refresh-token-abc";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as Record<string, unknown>).log = {
      info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    };
    next();
  });
  app.use("/pipeline", pipelineRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env["PIPELINE_REFRESH_TOKEN"] = TOKEN;
  (EntitiesService.getAllEntities as Mock).mockResolvedValue([
    { id: "entity-1" },
    { id: "entity-2" },
  ]);
  (ingestEntityInvoices as Mock).mockResolvedValue({
    entityId: "entity-1", processed: 5, created: 2, updated: 3, sourceChanged: 0, skipped: 0, errors: [],
  });
});

describe("PC1: POST /pipeline/refresh returns 200 immediately (non-blocking)", () => {
  it("responds 200 before commission ingest completes", async () => {
    let resolveIngest!: () => void;
    (ingestEntityInvoices as Mock).mockImplementation(
      () => new Promise((resolve) => { resolveIngest = () => resolve({ processed: 0, created: 0, updated: 0, sourceChanged: 0, skipped: 0, errors: [] }); })
    );
    const res = await request(makeApp())
      .post("/pipeline/refresh")
      .set("x-refresh-token", TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    resolveIngest(); // settle dangling promise
  });
});

describe("PC2: ingestEntityInvoices called once per entity", () => {
  it("calls ingest for each entity returned by getAllEntities", async () => {
    await request(makeApp())
      .post("/pipeline/refresh")
      .set("x-refresh-token", TOKEN);
    // Fire-and-forget: wait for the microtask queue to settle
    await vi.waitFor(() => {
      expect(ingestEntityInvoices).toHaveBeenCalledTimes(2);
    }, { timeout: 1000 });
    const calls = (ingestEntityInvoices as Mock).mock.calls;
    expect(calls[0][0]).toBe("entity-1");
    expect(calls[1][0]).toBe("entity-2");
  });

  it("passes a 90-day fromDate and today as toDate", async () => {
    await request(makeApp())
      .post("/pipeline/refresh")
      .set("x-refresh-token", TOKEN);
    await vi.waitFor(() => expect(ingestEntityInvoices).toHaveBeenCalled(), { timeout: 1000 });
    const opts = (ingestEntityInvoices as Mock).mock.calls[0][1];
    const from = new Date(opts.fromDate);
    const to   = new Date(opts.toDate);
    expect(to.getTime() - from.getTime()).toBeGreaterThan(88 * 24 * 3600 * 1000);
    expect(to.getTime() - from.getTime()).toBeLessThan(92 * 24 * 3600 * 1000);
    expect(opts.reingesterBy).toBe("pipeline/refresh");
  });
});

describe("PC3: commission ingest failure does NOT affect the 200 response", () => {
  it("200 even when ingestEntityInvoices throws", async () => {
    (ingestEntityInvoices as Mock).mockRejectedValue(new Error("DB timeout"));
    const res = await request(makeApp())
      .post("/pipeline/refresh")
      .set("x-refresh-token", TOKEN);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("200 even when getAllEntities throws", async () => {
    (EntitiesService.getAllEntities as Mock).mockRejectedValue(new Error("connection refused"));
    const res = await request(makeApp())
      .post("/pipeline/refresh")
      .set("x-refresh-token", TOKEN);
    expect(res.status).toBe(200);
  });
});

describe("PC4: wrong token → 401 (commission ingest never fires)", () => {
  it("returns 401 for bad token", async () => {
    const res = await request(makeApp())
      .post("/pipeline/refresh")
      .set("x-refresh-token", "wrong-token");
    expect(res.status).toBe(401);
    expect(ingestEntityInvoices).not.toHaveBeenCalled();
  });
});
