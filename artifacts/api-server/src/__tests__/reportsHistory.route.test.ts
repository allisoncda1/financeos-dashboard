/**
 * RC-015 — GET /api/reports/history route-level tests
 *
 * Exercises the actual Express route handler including the requirePermission
 * middleware, slug validation, and pagination validation. DB calls are mocked
 * so no real database is needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

// ── Mock DB service before importing the router ───────────────────────────────

const { listHistoryMock } = vi.hoisted(() => ({
  listHistoryMock: vi.fn(),
}));

vi.mock("../db/index.js", () => ({
  ReportHistoryService: {
    listReportHistory:  listHistoryMock,
    insertReportHistory: vi.fn(),
  },
}));

// Mock the reports engine and templates so the router can be imported cleanly.
vi.mock("../reports/engine.js", () => ({ generateReport: vi.fn() }));
vi.mock("../reports/templates.js", () => ({ REPORT_TEMPLATES: [] }));

import reportsRouter from "../routes/reports.js";

// ── Test app factory ──────────────────────────────────────────────────────────

type MockUser = { id: string; email: string; role: string; name: string } | undefined;

function createApp(sessionUser: MockUser) {
  const app = express();
  app.use(express.json());

  // Inject req.log (pinoHttp not used here — tests only need a stub).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>)["log"] = {
      error: vi.fn(),
      warn:  vi.fn(),
      info:  vi.fn(),
      debug: vi.fn(),
    };
    next();
  });

  // Inject a session with the provided user (or no user if undefined).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>)["session"] = { user: sessionUser };
    next();
  });

  app.use("/api", reportsRouter);
  return app;
}

const REPORTER_USER: MockUser = { id: "u1", email: "allison@cardealer.ai", role: "cfo",        name: "Allison" };
const BOOKKEEPER_USER: MockUser = { id: "u2", email: "bk@example.com",       role: "bookkeeper", name: "Bookkeeper" };
const INVESTOR_USER: MockUser  = { id: "u3", email: "inv@example.com",       role: "investor",   name: "Investor" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/reports/history — authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("R-01: returns 401 when there is no session", async () => {
    const app = createApp(undefined);
    const res = await request(app).get("/api/reports/history");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("NOT_AUTHENTICATED");
  });

  it("R-02: returns 403 for a bookkeeper (no 'reports' permission)", async () => {
    const app = createApp(BOOKKEEPER_USER);
    const res = await request(app).get("/api/reports/history");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("R-03: returns 200 for a cfo (has 'reports' permission)", async () => {
    listHistoryMock.mockResolvedValue([]);
    const app = createApp(REPORTER_USER);
    const res = await request(app).get("/api/reports/history");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("R-04: returns 200 for an investor (has 'reports' permission)", async () => {
    listHistoryMock.mockResolvedValue([]);
    const app = createApp(INVESTOR_USER);
    const res = await request(app).get("/api/reports/history");
    expect(res.status).toBe(200);
  });
});

describe("GET /api/reports/history — slug validation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("R-05: returns 400 for an unknown entity slug", async () => {
    const app = createApp(REPORTER_USER);
    const res = await request(app).get("/api/reports/history?slug=not_a_real_entity");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown entity slug/);
  });

  it("R-06: accepts a valid entity slug and filters by it", async () => {
    listHistoryMock.mockResolvedValue([]);
    const app = createApp(REPORTER_USER);
    const res = await request(app).get("/api/reports/history?slug=CarDealer_ai");
    expect(res.status).toBe(200);
    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "CarDealer_ai" }),
    );
  });
});

describe("GET /api/reports/history — pagination validation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("R-07: returns 400 when limit is not a number (NaN)", async () => {
    const app = createApp(REPORTER_USER);
    const res = await request(app).get("/api/reports/history?limit=abc");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/limit must be a positive integer/);
  });

  it("R-08: returns 400 when limit is zero", async () => {
    const app = createApp(REPORTER_USER);
    const res = await request(app).get("/api/reports/history?limit=0");
    expect(res.status).toBe(400);
  });

  it("R-09: returns 400 when offset is negative", async () => {
    const app = createApp(REPORTER_USER);
    const res = await request(app).get("/api/reports/history?offset=-1");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/offset must be a non-negative integer/);
  });

  it("R-10: passes valid limit and offset to the service", async () => {
    listHistoryMock.mockResolvedValue([]);
    const app = createApp(REPORTER_USER);
    const res = await request(app).get("/api/reports/history?limit=25&offset=50");
    expect(res.status).toBe(200);
    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, offset: 50 }),
    );
  });
});

describe("sanitizeErrorMessage — route-level sanitization", () => {
  it("R-11: strips URLs from error messages before persisting", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    const dirty = "Connection failed: postgresql://user:secret@db.internal/prod";
    const result = sanitizeErrorMessage(new Error(dirty));
    expect(result).not.toContain("secret");
    expect(result).not.toContain("postgresql://");
    expect(result).toContain("[connection-string]");
  });

  it("R-12: strips file paths from error messages", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    const dirty = new Error("ENOENT: no such file /Users/allison/.env");
    const result = sanitizeErrorMessage(dirty);
    expect(result).not.toContain("/Users/allison/.env");
    expect(result).toContain("[path]");
  });

  it("R-13: strips http URLs", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    const dirty = new Error("Fetch failed: https://api.internal.com/v1/data?token=abc123");
    const result = sanitizeErrorMessage(dirty);
    expect(result).not.toContain("https://");
    expect(result).not.toContain("token=abc123");
    expect(result).toContain("[url]");
  });

  it("R-14: passes clean messages through unchanged", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    const clean = new Error("Template disabled for this period");
    const result = sanitizeErrorMessage(clean);
    expect(result).toBe("Template disabled for this period");
  });

  it("R-15: caps output at 200 characters", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    const long = new Error("x".repeat(500));
    const result = sanitizeErrorMessage(long);
    expect(result.length).toBeLessThanOrEqual(200);
  });
});
