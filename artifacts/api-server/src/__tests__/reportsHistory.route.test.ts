/**
 * RC-015 — Route-level integration tests
 *
 * Covers GET /api/reports/history (auth, slug, pagination) and
 * POST /api/reports/generate (persistence, failure paths, input validation).
 * All DB and engine calls are mocked — no real database required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { listHistoryMock, insertHistoryMock, generateReportMock } = vi.hoisted(() => ({
  listHistoryMock:    vi.fn(),
  insertHistoryMock:  vi.fn(),
  generateReportMock: vi.fn(),
}));

vi.mock("../db/index.js", () => ({
  ReportHistoryService: {
    listReportHistory:   listHistoryMock,
    insertReportHistory: insertHistoryMock,
  },
}));

vi.mock("../reports/engine.js", () => ({ generateReport: generateReportMock }));
vi.mock("../reports/templates.js", () => ({ REPORT_TEMPLATES: [] }));

import reportsRouter from "../routes/reports.js";

// ── Test app factory ──────────────────────────────────────────────────────────

type MockUser = { id: string; email: string; role: string; name: string } | undefined;

function createApp(sessionUser: MockUser) {
  const app = express();
  app.use(express.json());

  // Stub req.log — pinoHttp is not used in tests.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    (req as unknown as Record<string, unknown>)["log"] = log;
    next();
  });

  // Inject session.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>)["session"] = { user: sessionUser };
    next();
  });

  app.use("/api", reportsRouter);
  return app;
}

const CFO_USER:        MockUser = { id: "u1", email: "allison@cardealer.ai", role: "cfo",        name: "Allison" };
const BOOKKEEPER_USER: MockUser = { id: "u2", email: "bk@example.com",       role: "bookkeeper", name: "Bookkeeper" };
const INVESTOR_USER:   MockUser = { id: "u3", email: "inv@example.com",       role: "investor",   name: "Investor" };

// Minimal generateReport return value for successful generation tests.
function makeGenerateResult(overrides: Record<string, unknown> = {}) {
  return {
    report: {
      id:          "rpt-uuid",
      template:    { id: "monthly-close", name: "Monthly Close" },
      period:      "Jun 2026 (Latest)",
      generatedAt: new Date().toISOString(),
      branding:    {},
      sections:    [],
      metadata:    {
        dataFreshness:   "2026-06-30",
        entityCount:     4,
        confidenceScore: 90,
      },
      source: "live",
    },
    output: Buffer.from("PDF_BYTES"),
    ...overrides,
  };
}

// ── GET /history — authorization ──────────────────────────────────────────────

describe("GET /api/reports/history — authorization", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("R-01: returns 401 when there is no session", async () => {
    const res = await request(createApp(undefined)).get("/api/reports/history");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("NOT_AUTHENTICATED");
  });

  it("R-02: returns 403 for a bookkeeper (no 'reports' permission)", async () => {
    const res = await request(createApp(BOOKKEEPER_USER)).get("/api/reports/history");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("R-03: returns 200 for a cfo (has 'reports' permission)", async () => {
    listHistoryMock.mockResolvedValue([]);
    const res = await request(createApp(CFO_USER)).get("/api/reports/history");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("R-04: returns 200 for an investor (has 'reports' permission)", async () => {
    listHistoryMock.mockResolvedValue([]);
    const res = await request(createApp(INVESTOR_USER)).get("/api/reports/history");
    expect(res.status).toBe(200);
  });
});

// ── GET /history — slug validation ────────────────────────────────────────────

describe("GET /api/reports/history — slug validation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("R-05: returns 400 for an unknown entity slug", async () => {
    const res = await request(createApp(CFO_USER)).get("/api/reports/history?slug=not_a_real_entity");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unknown entity slug/);
  });

  it("R-06: accepts a valid entity slug and passes it to the service", async () => {
    listHistoryMock.mockResolvedValue([]);
    const res = await request(createApp(CFO_USER)).get("/api/reports/history?slug=CarDealer_ai");
    expect(res.status).toBe(200);
    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "CarDealer_ai" }),
    );
  });
});

// ── GET /history — pagination validation ─────────────────────────────────────

describe("GET /api/reports/history — pagination validation", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("R-07: returns 400 when limit is not a number (NaN)", async () => {
    const res = await request(createApp(CFO_USER)).get("/api/reports/history?limit=abc");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/limit must be an integer between 1 and 200/);
  });

  it("R-08: returns 400 when limit is zero", async () => {
    const res = await request(createApp(CFO_USER)).get("/api/reports/history?limit=0");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/limit must be an integer between 1 and 200/);
  });

  it("R-09: returns 400 when offset is negative", async () => {
    const res = await request(createApp(CFO_USER)).get("/api/reports/history?offset=-1");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/offset must be a non-negative integer/);
  });

  it("R-10: passes valid limit and offset to the service", async () => {
    listHistoryMock.mockResolvedValue([]);
    const res = await request(createApp(CFO_USER)).get("/api/reports/history?limit=25&offset=50");
    expect(res.status).toBe(200);
    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25, offset: 50 }),
    );
  });

  it("R-11: returns 400 when limit exceeds 200 and does not call the DB", async () => {
    const res = await request(createApp(CFO_USER)).get("/api/reports/history?limit=201");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/limit must be an integer between 1 and 200/);
    expect(listHistoryMock).not.toHaveBeenCalled();
  });

  it("R-12: accepts limit=200 (maximum allowed)", async () => {
    listHistoryMock.mockResolvedValue([]);
    const res = await request(createApp(CFO_USER)).get("/api/reports/history?limit=200");
    expect(res.status).toBe(200);
    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 200 }),
    );
  });
});

// ── sanitizeErrorMessage ──────────────────────────────────────────────────────

describe("sanitizeErrorMessage — exported helper", () => {
  it("R-13: strips postgresql:// connection strings", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    const result = sanitizeErrorMessage(new Error("Connection failed: postgresql://user:secret@db.internal/prod"));
    expect(result).not.toContain("secret");
    expect(result).not.toContain("postgresql://");
    expect(result).toContain("[connection-string]");
  });

  it("R-14: strips /Users/… file paths", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    const result = sanitizeErrorMessage(new Error("ENOENT: no such file /Users/allison/.env"));
    expect(result).not.toContain("/Users/allison/.env");
    expect(result).toContain("[path]");
  });

  it("R-15: strips https:// URLs", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    const result = sanitizeErrorMessage(new Error("Fetch failed: https://api.internal.com/v1/data?token=abc123"));
    expect(result).not.toContain("https://");
    expect(result).not.toContain("token=abc123");
    expect(result).toContain("[url]");
  });

  it("R-16: passes clean messages through unchanged", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    expect(sanitizeErrorMessage(new Error("Template disabled for this period"))).toBe(
      "Template disabled for this period",
    );
  });

  it("R-17: caps output at 200 characters", async () => {
    const { sanitizeErrorMessage } = await import("../routes/reports.js");
    expect(sanitizeErrorMessage(new Error("x".repeat(500))).length).toBeLessThanOrEqual(200);
  });
});

// ── POST /generate — successful generation ────────────────────────────────────

describe("POST /api/reports/generate — successful generation (JSON)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("P-01: inserts a completed history row with correct metadata before responding", async () => {
    insertHistoryMock.mockResolvedValue({ id: "h-1" });
    generateReportMock.mockResolvedValue(makeGenerateResult());

    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", format: "json", entities: "all" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    expect(insertHistoryMock).toHaveBeenCalledOnce();
    const insertArg = insertHistoryMock.mock.calls[0]![0];
    expect(insertArg.template).toBe("monthly-close");
    expect(insertArg.format).toBe("json");
    expect(insertArg.status).toBe("completed");
    expect(insertArg.requestedBy).toBe("allison@cardealer.ai");
    expect(Array.isArray(insertArg.entitySlugs)).toBe(true);
    expect(insertArg.entitySlugs.length).toBeGreaterThan(0);
    expect(insertArg.completedAt).toBeInstanceOf(Date);
  });

  it("P-02: history write is awaited — insert resolves before response is returned", async () => {
    let insertResolved = false;
    insertHistoryMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      insertResolved = true;
      return { id: "h-1" };
    });
    generateReportMock.mockResolvedValue(makeGenerateResult());

    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", format: "json", entities: "all" });

    // Because we await the insert, insertResolved must be true by the time the
    // HTTP response is received by the test client.
    expect(res.status).toBe(200);
    expect(insertResolved).toBe(true);
  });

  it("P-03: entity slug list is populated when entities='all'", async () => {
    insertHistoryMock.mockResolvedValue({ id: "h-1" });
    generateReportMock.mockResolvedValue(makeGenerateResult());

    await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", format: "json", entities: "all" });

    const { entitySlugs } = insertHistoryMock.mock.calls[0]![0];
    expect(entitySlugs).not.toHaveLength(0);
    // All entries must be non-empty strings (valid slugs, not "all").
    for (const s of entitySlugs) {
      expect(typeof s).toBe("string");
      expect(s).not.toBe("all");
    }
  });
});

describe("POST /api/reports/generate — successful generation (PDF binary)", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("P-04: returns binary and inserts completed history row for pdf format", async () => {
    insertHistoryMock.mockResolvedValue({ id: "h-2" });
    generateReportMock.mockResolvedValue(makeGenerateResult());

    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", format: "pdf", entities: "all" });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
    expect(insertHistoryMock).toHaveBeenCalledOnce();
    expect(insertHistoryMock.mock.calls[0]![0].format).toBe("pdf");
    expect(insertHistoryMock.mock.calls[0]![0].status).toBe("completed");
  });
});

// ── POST /generate — history DB failure ──────────────────────────────────────

describe("POST /api/reports/generate — history DB failure", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("P-05: report is still delivered when history insert rejects", async () => {
    insertHistoryMock.mockRejectedValue(new Error("DB connection lost"));
    generateReportMock.mockResolvedValue(makeGenerateResult());

    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", format: "json", entities: "all" });

    // Report delivery must succeed despite the history failure.
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("P-06: req.log.error is called when history insert rejects", async () => {
    insertHistoryMock.mockRejectedValue(new Error("DB connection lost"));
    generateReportMock.mockResolvedValue(makeGenerateResult());

    // Capture the log stub injected by createApp.
    let capturedLog: Record<string, ReturnType<typeof vi.fn>> | null = null;
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
      capturedLog = log;
      (req as unknown as Record<string, unknown>)["log"] = log;
      next();
    });
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as unknown as Record<string, unknown>)["session"] = { user: CFO_USER };
      next();
    });
    app.use("/api", reportsRouter);

    await request(app)
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", format: "json", entities: "all" });

    expect(capturedLog).not.toBeNull();
    expect(capturedLog!["error"]).toHaveBeenCalledOnce();
    const logCall = capturedLog!["error"].mock.calls[0];
    expect(logCall[1]).toMatch(/persist report history/i);
  });
});

// ── POST /generate — generation failure ──────────────────────────────────────

describe("POST /api/reports/generate — generation failure with sensitive error", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const DIRTY_ERROR = new Error(
    "Cannot fetch data: https://neon.tech/api?token=sk-secret123 from /Users/allison/financeos/.env",
  );

  it("P-07: inserts a failed history row with sanitized message", async () => {
    generateReportMock.mockRejectedValue(DIRTY_ERROR);
    insertHistoryMock.mockResolvedValue({ id: "h-3" });

    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", format: "json", entities: "all" });

    expect(res.status).toBe(400);
    expect(insertHistoryMock).toHaveBeenCalledOnce();

    const insertArg = insertHistoryMock.mock.calls[0]![0];
    expect(insertArg.status).toBe("failed");
    expect(insertArg.template).toBe("monthly-close");
    expect(insertArg.period).toBe("Jun 2026 (Latest)");
    expect(insertArg.format).toBe("json");
    expect(Array.isArray(insertArg.entitySlugs)).toBe(true);

    // Sensitive content must not appear in the persisted message.
    const saved = insertArg.errorMessage as string;
    expect(saved).not.toContain("sk-secret123");
    expect(saved).not.toContain("https://");
    expect(saved).not.toContain("/Users/allison");
  });

  it("P-08: API response also contains the sanitized message, not the raw error", async () => {
    generateReportMock.mockRejectedValue(DIRTY_ERROR);
    insertHistoryMock.mockResolvedValue({ id: "h-3" });

    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", format: "json", entities: "all" });

    expect(res.status).toBe(400);
    expect(res.body.error).not.toContain("sk-secret123");
    expect(res.body.error).not.toContain("https://");
    expect(res.body.error).not.toContain("/Users/allison");
  });
});

// ── POST /generate — input validation (no DB calls) ──────────────────────────

describe("POST /api/reports/generate — input validation failures", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("P-09: missing template → 400, no generation, no history insert", async () => {
    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ period: "Jun 2026", format: "json", entities: "all" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/template/i);
    expect(generateReportMock).not.toHaveBeenCalled();
    expect(insertHistoryMock).not.toHaveBeenCalled();
  });

  it("P-10: invalid format → 400, no generation, no history insert", async () => {
    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026", format: "docx", entities: "all" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/format/i);
    expect(generateReportMock).not.toHaveBeenCalled();
    expect(insertHistoryMock).not.toHaveBeenCalled();
  });

  it("P-11: invalid entities array → 400, no generation, no history insert", async () => {
    const res = await request(createApp(CFO_USER))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026", format: "json", entities: ["not-valid-slug"] });

    expect(res.status).toBe(400);
    expect(generateReportMock).not.toHaveBeenCalled();
    expect(insertHistoryMock).not.toHaveBeenCalled();
  });

  it("P-12: unauthenticated request → 401, no generation, no history insert", async () => {
    const res = await request(createApp(undefined))
      .post("/api/reports/generate")
      .send({ template: "monthly-close", period: "Jun 2026", format: "json", entities: "all" });

    expect(res.status).toBe(401);
    expect(generateReportMock).not.toHaveBeenCalled();
    expect(insertHistoryMock).not.toHaveBeenCalled();
  });
});
