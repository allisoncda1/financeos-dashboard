/**
 * Draft & Commentary Routes — HTTP route-level tests.
 *
 * Covers all 14 draft/commentary endpoints:
 *   POST   /api/drafts                      — create draft (editor only)
 *   GET    /api/drafts                      — list drafts (reports permission)
 *   GET    /api/drafts/:id                  — get draft
 *   PATCH  /api/drafts/:id/edits            — save edits (editor only)
 *   GET    /api/drafts/:id/versions         — list versions
 *   POST   /api/drafts/:id/restore          — restore version (editor only)
 *   POST   /api/drafts/:id/submit           — submit for review (editor only)
 *   POST   /api/drafts/:id/approve          — approve (admin/cfo only)
 *   GET    /api/drafts/:id/preview          — preview HTML
 *   GET    /api/drafts/commentary           — list commentary
 *   POST   /api/drafts/commentary           — save commentary (editor only)
 *   PATCH  /api/drafts/commentary/:id/toggle — toggle included (editor)
 *   DELETE /api/drafts/commentary/:id       — delete commentary (editor)
 *   POST   /api/drafts/commentary/reorder   — reorder (editor)
 *   POST   /api/drafts/commentary/:id/approve — approve commentary (admin/cfo)
 *
 * All DB and engine calls are mocked — no real database or live data required.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  getDraftMock, listDraftsMock, createDraftMock, saveDraftEditsMock,
  listVersionsMock, restoreVersionMock, submitForReviewMock, approveDraftMock,
  markStaleIfChangedMock,
  getCommentaryMock, upsertCommentaryMock, toggleIncludedMock,
  deleteCommentaryMock, reorderCommentaryMock, approveCommentaryMock,
} = vi.hoisted(() => ({
  getDraftMock:            vi.fn(),
  listDraftsMock:          vi.fn(),
  createDraftMock:         vi.fn(),
  saveDraftEditsMock:      vi.fn(),
  listVersionsMock:        vi.fn(),
  restoreVersionMock:      vi.fn(),
  submitForReviewMock:     vi.fn(),
  approveDraftMock:        vi.fn(),
  markStaleIfChangedMock:  vi.fn(),
  getCommentaryMock:       vi.fn(),
  upsertCommentaryMock:    vi.fn(),
  toggleIncludedMock:      vi.fn(),
  deleteCommentaryMock:    vi.fn(),
  reorderCommentaryMock:   vi.fn(),
  approveCommentaryMock:   vi.fn(),
}));

vi.mock("../db/reportDrafts.js", () => ({
  DraftService: {
    getDraft:           getDraftMock,
    listDrafts:         listDraftsMock,
    createDraft:        createDraftMock,
    saveDraftEdits:     saveDraftEditsMock,
    listVersions:       listVersionsMock,
    restoreVersion:     restoreVersionMock,
    submitForReview:    submitForReviewMock,
    approveDraft:       approveDraftMock,
    markStaleIfChanged: markStaleIfChangedMock,
    markGenerated:      vi.fn(),
    linkHistoryToDraft: vi.fn(),
  },
  CommentaryService: {
    getCommentaryByScope: getCommentaryMock,
    bulkUpsertCommentary: vi.fn(),
    saveCommentary:       upsertCommentaryMock,
    toggleIncluded:       toggleIncludedMock,
    deleteCommentary:     deleteCommentaryMock,
    reorderCommentary:    reorderCommentaryMock,
    approveCommentary:    approveCommentaryMock,
  },
}));

vi.mock("../reports/builder.js", () => ({
  buildReport: vi.fn().mockResolvedValue({
    id: "rpt-1",
    template: { id: "monthly-close", name: "Monthly Close" },
    request: { template: "monthly-close", entities: ["T3_Marketing"], period: "Jun 2026 (Latest)", format: "json" },
    branding: { mode: "single", primaryEntity: { slug: "T3_Marketing", name: "T3 Marketing", primaryColor: "#f59e0b", logoPath: null }, entities: [{ slug: "T3_Marketing", name: "T3 Marketing", logoPath: null }], financeosBranding: false },
    generatedAt: new Date().toISOString(),
    period: "Jun 2026 (Latest)",
    source: "live",
    sections: {
      entity_summary: { T3_Marketing: { metrics: { revenue: 112400, net_income: 15000, cash_on_hand: 42000, open_ar: 12000 }, anomalies: [] } },
      financials: {},
      portfolio_kpis: { portfolio: { total_revenue: 112400, total_net_income: 15000, entity_count: 1 } },
      alerts: [],
      validation: { summary: { all_passed: true } },
    },
    metadata: { entityCount: 1, dataFreshness: "2026-06-30", confidenceScore: 92 },
  }),
}));

vi.mock("../reports/renderers/html.js", () => ({
  HtmlRenderer: {
    format: "html",
    render: vi.fn().mockReturnValue("<html><body>Preview HTML</body></html>"),
  },
}));

vi.mock("../reports/templates.js", () => ({
  REPORT_TEMPLATES: [{ id: "monthly-close", name: "Monthly Close Report", enabled: true }],
}));

import draftsRouter from "../routes/drafts.js";

// ── Test app factory ──────────────────────────────────────────────────────────

type MockUser = { id: string; email: string; role: string; name: string } | undefined;

function createApp(sessionUser: MockUser) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const log = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() };
    (req as any).log = log;
    next();
  });
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).session = { user: sessionUser };
    next();
  });
  app.use("/api", draftsRouter);
  return app;
}

const ADMIN: MockUser      = { id: "u1", email: "admin@test.com",  role: "admin",      name: "Admin" };
const CFO: MockUser        = { id: "u2", email: "cfo@test.com",    role: "cfo",        name: "CFO" };
const CONTROLLER: MockUser = { id: "u3", email: "ctrl@test.com",   role: "controller", name: "Controller" };
const BOOKKEEPER: MockUser = { id: "u4", email: "bk@test.com",     role: "bookkeeper", name: "Bookkeeper" };
const NO_USER: MockUser    = undefined;

const DRAFT_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const COMMENTARY_ID = "11111111-2222-3333-4444-555555555555";

const MOCK_DRAFT = {
  id:               DRAFT_ID,
  templateId:       "monthly-close",
  reportingPeriod:  "Jun 2026 (Latest)",
  entitySlugs:      ["T3_Marketing"],
  status:           "draft",
  currentVersion:   1,
  generatedAnalysis: [],
  editableContent:  {},
  dataFingerprint:  "fp-abc",
  isStale:          false,
  staleReason:      null,
  createdBy:        "admin@test.com",
  updatedBy:        null,
  approvedBy:       null,
  createdAt:        new Date().toISOString(),
  updatedAt:        new Date().toISOString(),
  approvedAt:       null,
};

const MOCK_COMMENTARY = {
  id:              COMMENTARY_ID,
  entitySlug:      "T3_Marketing",
  reportingPeriod: "Jun 2026 (Latest)",
  templateId:      "monthly-close",
  sectionKey:      "management_comments",
  commentaryType:  "management_commentary",
  content:         "Campaign delayed to July.",
  provenance:      null,
  status:          "draft",
  version:         1,
  included:        true,
  sortOrder:       0,
  createdBy:       "admin@test.com",
  updatedBy:       null,
  approvedBy:      null,
  createdAt:       new Date().toISOString(),
  updatedAt:       new Date().toISOString(),
  approvedAt:      null,
};

// ── Authentication guard (applies to every endpoint) ─────────────────────────

describe("authentication — all draft endpoints reject unauthenticated requests", () => {
  const app = createApp(NO_USER);

  it("POST /api/drafts → 401", () =>
    request(app).post("/api/drafts").send({ template: "monthly-close", period: "Jun 2026", entities: "all" }).expect(401));

  it("GET /api/drafts → 401", () =>
    request(app).get("/api/drafts?template=monthly-close&period=Jun+2026").expect(401));

  it("GET /api/drafts/:id → 401", () =>
    request(app).get(`/api/drafts/${DRAFT_ID}`).expect(401));

  it("PATCH /api/drafts/:id/edits → 401", () =>
    request(app).patch(`/api/drafts/${DRAFT_ID}/edits`).send({ editableContent: {} }).expect(401));

  it("GET /api/drafts/:id/versions → 401", () =>
    request(app).get(`/api/drafts/${DRAFT_ID}/versions`).expect(401));

  it("POST /api/drafts/:id/restore → 401", () =>
    request(app).post(`/api/drafts/${DRAFT_ID}/restore`).send({ versionNumber: 1 }).expect(401));

  it("POST /api/drafts/:id/submit → 401", () =>
    request(app).post(`/api/drafts/${DRAFT_ID}/submit`).send({}).expect(401));

  it("POST /api/drafts/:id/approve → 401", () =>
    request(app).post(`/api/drafts/${DRAFT_ID}/approve`).send({}).expect(401));

  it("GET /api/drafts/:id/preview → 401", () =>
    request(app).get(`/api/drafts/${DRAFT_ID}/preview`).expect(401));

  it("GET /api/drafts/commentary → 401", () =>
    request(app).get("/api/drafts/commentary?entity=T3&period=Jun&template=monthly-close").expect(401));
});

// ── POST /api/drafts — Create draft ──────────────────────────────────────────

describe("POST /api/drafts", () => {
  beforeEach(() => {
    createDraftMock.mockResolvedValue(MOCK_DRAFT);
  });

  it("admin can create a draft → 201", async () => {
    const res = await request(createApp(ADMIN))
      .post("/api/drafts")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", entities: "all" });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.id).toBe(DRAFT_ID);
  });

  it("cfo can create a draft → 201", async () => {
    const res = await request(createApp(CFO))
      .post("/api/drafts")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", entities: ["T3_Marketing"] });
    expect(res.status).toBe(201);
  });

  it("bookkeeper cannot create a draft → 403", async () => {
    const res = await request(createApp(BOOKKEEPER))
      .post("/api/drafts")
      .send({ template: "monthly-close", period: "Jun 2026 (Latest)", entities: "all" });
    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
  });

  it("missing template → 400", async () => {
    const res = await request(createApp(ADMIN))
      .post("/api/drafts")
      .send({ period: "Jun 2026", entities: "all" });
    expect(res.status).toBe(400);
  });

  it("missing period → 400", async () => {
    const res = await request(createApp(ADMIN))
      .post("/api/drafts")
      .send({ template: "monthly-close", entities: "all" });
    expect(res.status).toBe(400);
  });

  it("invalid entities → 400", async () => {
    const res = await request(createApp(ADMIN))
      .post("/api/drafts")
      .send({ template: "monthly-close", period: "Jun 2026", entities: 42 });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/drafts — List drafts ─────────────────────────────────────────────

describe("GET /api/drafts", () => {
  beforeEach(() => {
    listDraftsMock.mockResolvedValue([MOCK_DRAFT]);
  });

  it("returns list with template+period params → 200", async () => {
    const res = await request(createApp(CFO))
      .get("/api/drafts?template=monthly-close&period=Jun+2026+%28Latest%29");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("missing template → 400", async () => {
    const res = await request(createApp(CFO)).get("/api/drafts?period=Jun+2026");
    expect(res.status).toBe(400);
  });

  it("missing period → 400", async () => {
    const res = await request(createApp(CFO)).get("/api/drafts?template=monthly-close");
    expect(res.status).toBe(400);
  });
});

// ── GET /api/drafts/:id — Get single draft ────────────────────────────────────

describe("GET /api/drafts/:id", () => {
  it("returns draft → 200", async () => {
    getDraftMock.mockResolvedValue(MOCK_DRAFT);
    const res = await request(createApp(CFO)).get(`/api/drafts/${DRAFT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(DRAFT_ID);
  });

  it("not found → 404", async () => {
    getDraftMock.mockResolvedValue(null);
    const res = await request(createApp(CFO)).get(`/api/drafts/${DRAFT_ID}`);
    expect(res.status).toBe(404);
  });
});

// ── PATCH /api/drafts/:id/edits — Save edits ─────────────────────────────────

describe("PATCH /api/drafts/:id/edits", () => {
  beforeEach(() => {
    saveDraftEditsMock.mockResolvedValue({ ...MOCK_DRAFT, currentVersion: 2 });
  });

  it("admin can save edits → 200", async () => {
    const res = await request(createApp(ADMIN))
      .patch(`/api/drafts/${DRAFT_ID}/edits`)
      .send({ editableContent: { reportTitle: "Updated" }, changeSummary: "Edited exec summary" });
    expect(res.status).toBe(200);
    expect(res.body.data.currentVersion).toBe(2);
  });

  it("controller can save edits → 200", async () => {
    const res = await request(createApp(CONTROLLER))
      .patch(`/api/drafts/${DRAFT_ID}/edits`)
      .send({ editableContent: { reportTitle: "v2" } });
    expect(res.status).toBe(200);
  });

  it("bookkeeper cannot save edits → 403", async () => {
    const res = await request(createApp(BOOKKEEPER))
      .patch(`/api/drafts/${DRAFT_ID}/edits`)
      .send({ editableContent: {} });
    expect(res.status).toBe(403);
  });

  it("missing editableContent → 400", async () => {
    const res = await request(createApp(ADMIN))
      .patch(`/api/drafts/${DRAFT_ID}/edits`)
      .send({ changeSummary: "No content" });
    expect(res.status).toBe(400);
  });

  it("saving to approved draft (service throws) → 400", async () => {
    saveDraftEditsMock.mockRejectedValue(new Error("Cannot edit a draft in status 'approved'"));
    const res = await request(createApp(ADMIN))
      .patch(`/api/drafts/${DRAFT_ID}/edits`)
      .send({ editableContent: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/approved/);
  });
});

// ── GET /api/drafts/:id/versions ──────────────────────────────────────────────

describe("GET /api/drafts/:id/versions", () => {
  it("returns version list → 200", async () => {
    listVersionsMock.mockResolvedValue([
      { id: "v1", reportDraftId: DRAFT_ID, versionNumber: 1, contentSnapshot: {}, changeSummary: null, createdBy: "admin", createdAt: new Date().toISOString() },
    ]);
    const res = await request(createApp(CFO)).get(`/api/drafts/${DRAFT_ID}/versions`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── POST /api/drafts/:id/restore ─────────────────────────────────────────────

describe("POST /api/drafts/:id/restore", () => {
  it("admin can restore version → 200", async () => {
    restoreVersionMock.mockResolvedValue({ ...MOCK_DRAFT, currentVersion: 3 });
    const res = await request(createApp(ADMIN))
      .post(`/api/drafts/${DRAFT_ID}/restore`)
      .send({ versionNumber: 1 });
    expect(res.status).toBe(200);
  });

  it("bookkeeper cannot restore → 403", async () => {
    const res = await request(createApp(BOOKKEEPER))
      .post(`/api/drafts/${DRAFT_ID}/restore`)
      .send({ versionNumber: 1 });
    expect(res.status).toBe(403);
  });

  it("version not found (service throws) → 400", async () => {
    restoreVersionMock.mockRejectedValue(new Error("Version not found"));
    const res = await request(createApp(ADMIN))
      .post(`/api/drafts/${DRAFT_ID}/restore`)
      .send({ versionNumber: 99 });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/drafts/:id/submit ───────────────────────────────────────────────

describe("POST /api/drafts/:id/submit", () => {
  it("admin can submit for review → 200", async () => {
    submitForReviewMock.mockResolvedValue({ ...MOCK_DRAFT, status: "ready_for_review" });
    const res = await request(createApp(ADMIN))
      .post(`/api/drafts/${DRAFT_ID}/submit`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ready_for_review");
  });

  it("bookkeeper cannot submit → 403", async () => {
    const res = await request(createApp(BOOKKEEPER))
      .post(`/api/drafts/${DRAFT_ID}/submit`)
      .send({});
    expect(res.status).toBe(403);
  });
});

// ── POST /api/drafts/:id/approve ─────────────────────────────────────────────

describe("POST /api/drafts/:id/approve", () => {
  beforeEach(() => {
    getDraftMock.mockResolvedValue({ ...MOCK_DRAFT, status: "ready_for_review" });
  });

  it("admin can approve → 200", async () => {
    approveDraftMock.mockResolvedValue({ ...MOCK_DRAFT, status: "approved", approvedBy: "admin@test.com" });
    markStaleIfChangedMock.mockReturnValue(false);
    const res = await request(createApp(ADMIN))
      .post(`/api/drafts/${DRAFT_ID}/approve`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("approved");
  });

  it("cfo can approve → 200", async () => {
    approveDraftMock.mockResolvedValue({ ...MOCK_DRAFT, status: "approved", approvedBy: "cfo@test.com" });
    markStaleIfChangedMock.mockReturnValue(false);
    const res = await request(createApp(CFO))
      .post(`/api/drafts/${DRAFT_ID}/approve`)
      .send({});
    expect(res.status).toBe(200);
  });

  it("controller cannot approve → 403", async () => {
    const res = await request(createApp(CONTROLLER))
      .post(`/api/drafts/${DRAFT_ID}/approve`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin or cfo/i);
  });

  it("stale draft → 400", async () => {
    markStaleIfChangedMock.mockReturnValue(true);
    getDraftMock.mockResolvedValue({ ...MOCK_DRAFT, isStale: true });
    const res = await request(createApp(ADMIN))
      .post(`/api/drafts/${DRAFT_ID}/approve`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/stale/i);
  });

  it("draft not found → 404", async () => {
    getDraftMock.mockResolvedValue(null);
    const res = await request(createApp(ADMIN))
      .post(`/api/drafts/${DRAFT_ID}/approve`)
      .send({});
    expect(res.status).toBe(404);
  });
});

// ── GET /api/drafts/:id/preview ───────────────────────────────────────────────

describe("GET /api/drafts/:id/preview", () => {
  it("returns preview with HTML → 200", async () => {
    getDraftMock.mockResolvedValue(MOCK_DRAFT);
    markStaleIfChangedMock.mockReturnValue(false);
    const res = await request(createApp(CFO)).get(`/api/drafts/${DRAFT_ID}/preview`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.data.html).toBe("string");
    expect(res.body.data.isStale).toBe(false);
  });

  it("not found → 404", async () => {
    getDraftMock.mockResolvedValue(null);
    const res = await request(createApp(CFO)).get(`/api/drafts/${DRAFT_ID}/preview`);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/drafts/commentary ────────────────────────────────────────────────

describe("GET /api/drafts/commentary", () => {
  it("returns commentary entries → 200", async () => {
    getCommentaryMock.mockResolvedValue([MOCK_COMMENTARY]);
    const res = await request(createApp(CFO))
      .get("/api/drafts/commentary?entity=T3_Marketing&period=Jun+2026&template=monthly-close");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].commentaryType).toBe("management_commentary");
  });

  it("missing entity → 400", async () => {
    const res = await request(createApp(CFO))
      .get("/api/drafts/commentary?period=Jun+2026&template=monthly-close");
    expect(res.status).toBe(400);
  });
});

// ── POST /api/drafts/commentary ───────────────────────────────────────────────

describe("POST /api/drafts/commentary", () => {
  beforeEach(() => {
    upsertCommentaryMock.mockResolvedValue(MOCK_COMMENTARY);
  });

  it("admin can save management commentary → 200", async () => {
    const res = await request(createApp(ADMIN))
      .post("/api/drafts/commentary")
      .send({
        entitySlug: "T3_Marketing",
        reportingPeriod: "Jun 2026 (Latest)",
        templateId: "monthly-close",
        sectionKey: "management_comments",
        commentaryType: "management_commentary",
        content: "Campaign delayed to July.",
      });
    expect(res.status).toBe(201);
    expect(res.body.data.commentaryType).toBe("management_commentary");
  });

  it("cannot save financeos_analysis via this endpoint → 400", async () => {
    const res = await request(createApp(ADMIN))
      .post("/api/drafts/commentary")
      .send({
        entitySlug: "T3_Marketing",
        reportingPeriod: "Jun 2026",
        templateId: "monthly-close",
        sectionKey: "executive_summary",
        commentaryType: "financeos_analysis",
        content: "Injected analysis.",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/management_commentary|recommended_action/i);
  });

  it("bookkeeper cannot save commentary → 403", async () => {
    const res = await request(createApp(BOOKKEEPER))
      .post("/api/drafts/commentary")
      .send({
        entitySlug: "T3", reportingPeriod: "Jun", templateId: "mc",
        sectionKey: "s1", commentaryType: "management_commentary", content: "test",
      });
    expect(res.status).toBe(403);
  });

  it("missing content → 400", async () => {
    const res = await request(createApp(ADMIN))
      .post("/api/drafts/commentary")
      .send({
        entitySlug: "T3", reportingPeriod: "Jun", templateId: "mc",
        sectionKey: "s1", commentaryType: "management_commentary",
      });
    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/drafts/commentary/:id/toggle ───────────────────────────────────

describe("PATCH /api/drafts/commentary/:id/toggle", () => {
  it("admin can toggle included → 200", async () => {
    toggleIncludedMock.mockResolvedValue({ ...MOCK_COMMENTARY, included: false });
    const res = await request(createApp(ADMIN))
      .patch(`/api/drafts/commentary/${COMMENTARY_ID}/toggle`)
      .send({ included: false });
    expect(res.status).toBe(200);
    expect(res.body.data.included).toBe(false);
  });

  it("missing included field → 400", async () => {
    const res = await request(createApp(ADMIN))
      .patch(`/api/drafts/commentary/${COMMENTARY_ID}/toggle`)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/drafts/commentary/:id ────────────────────────────────────────

describe("DELETE /api/drafts/commentary/:id", () => {
  it("admin can delete management commentary → 204", async () => {
    deleteCommentaryMock.mockResolvedValue(undefined);
    const res = await request(createApp(ADMIN))
      .delete(`/api/drafts/commentary/${COMMENTARY_ID}`);
    expect(res.status).toBe(204);
  });

  it("cannot delete FinanceOS analysis (service throws) → 400", async () => {
    deleteCommentaryMock.mockRejectedValue(new Error("FinanceOS analysis entries cannot be deleted"));
    const res = await request(createApp(ADMIN))
      .delete(`/api/drafts/commentary/${COMMENTARY_ID}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cannot be deleted/i);
  });

  it("bookkeeper cannot delete → 403", async () => {
    const res = await request(createApp(BOOKKEEPER))
      .delete(`/api/drafts/commentary/${COMMENTARY_ID}`);
    expect(res.status).toBe(403);
  });
});

// ── POST /api/drafts/commentary/reorder ──────────────────────────────────────

describe("POST /api/drafts/commentary/reorder", () => {
  it("admin can reorder → 200", async () => {
    reorderCommentaryMock.mockResolvedValue(undefined);
    const res = await request(createApp(ADMIN))
      .post("/api/drafts/commentary/reorder")
      .send({ ids: [COMMENTARY_ID] });
    expect(res.status).toBe(200);
  });

  it("missing ids → 400", async () => {
    const res = await request(createApp(ADMIN))
      .post("/api/drafts/commentary/reorder")
      .send({});
    expect(res.status).toBe(400);
  });
});

// ── POST /api/drafts/commentary/:id/approve ──────────────────────────────────

describe("POST /api/drafts/commentary/:id/approve", () => {
  it("admin can approve commentary → 200", async () => {
    approveCommentaryMock.mockResolvedValue({ ...MOCK_COMMENTARY, status: "approved" });
    const res = await request(createApp(ADMIN))
      .post(`/api/drafts/commentary/${COMMENTARY_ID}/approve`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("approved");
  });

  it("controller cannot approve commentary → 403", async () => {
    const res = await request(createApp(CONTROLLER))
      .post(`/api/drafts/commentary/${COMMENTARY_ID}/approve`)
      .send({});
    expect(res.status).toBe(403);
  });
});
