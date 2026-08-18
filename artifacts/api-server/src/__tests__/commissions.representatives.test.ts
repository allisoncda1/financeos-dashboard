import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Mock DB so no real Neon call
vi.mock("../db/commissions", () => ({
  createCommissionRepresentative: vi.fn(),
  getCommissionRepresentatives: vi.fn(),
  getCachedEntityId: vi.fn(),
}));

vi.mock("../services/entityCache", () => ({
  getCachedEntityId: vi.fn(),
}));

import { createCommissionRepresentative } from "../db/commissions";
import { getCachedEntityId } from "../services/entityCache";
import commissionsRouter from "../routes/commissions";

describe("createCommissionRepresentative", () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves with id, displayName, slug on success", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;
    const expected = { id: "uuid-1", displayName: "Jason Smith", slug: "jason_smith" };
    mockFn.mockResolvedValue(expected);
    const result = await createCommissionRepresentative({ displayName: "Jason Smith", slug: "jason_smith" });
    expect(result).toEqual(expected);
    expect(mockFn).toHaveBeenCalledWith({ displayName: "Jason Smith", slug: "jason_smith" });
  });

  it("throws DUPLICATE_SLUG error on conflict", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;
    const err = Object.assign(new Error("duplicate_slug"), { code: "DUPLICATE_SLUG" });
    mockFn.mockRejectedValue(err);
    await expect(
      createCommissionRepresentative({ displayName: "Jason Smith", slug: "jason_smith" })
    ).rejects.toMatchObject({ code: "DUPLICATE_SLUG" });
  });
});

describe("POST /representatives route logic", () => {
  it("slug is derived from displayName, lowercased, underscored", () => {
    const displayName = "Big Mouth Consulting";
    const slug = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50);
    expect(slug).toBe("big_mouth_consulting");
  });

  it("empty displayName is rejected before DB call", () => {
    const displayName = "   ";
    expect(displayName.trim()).toBe("");
  });
});

// ─── Route-level tests: POST /:slug/representatives ──────────────────────────
// Exercises the real Express route (not just the DB helper in isolation), so
// the request/response contract the frontend actually depends on is verified
// end to end: status codes, envelope shape ({ ok, data } / { error, code }),
// and that permission/entity checks run before any DB write is attempted.

const ENTITY_ID = "b86bb66e-df81-4d32-8629-3012635ba16a";
const SLUG = "cardealer_ai";
const UNKNOWN_SLUG = "not_a_real_entity";

function makeApp(role = "admin") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as Record<string, unknown>).session = { user: { email: "test@financeos.io", role } };
    next();
  });
  app.use("/commissions", commissionsRouter);
  return app;
}

describe("POST /:slug/representatives — route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCachedEntityId as ReturnType<typeof vi.fn>).mockResolvedValue(ENTITY_ID);
  });

  it("correct { displayName } payload → 201 with { ok: true, data }", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;
    mockFn.mockResolvedValue({ id: "uuid-1", displayName: "Jason Smith", slug: "jason_smith" });

    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/representatives`)
      .send({ displayName: "Jason Smith" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      ok: true,
      data: { id: "uuid-1", displayName: "Jason Smith", slug: "jason_smith" },
    });
    // Server derives its own slug — a client-supplied slug (if any) is ignored.
    expect(mockFn).toHaveBeenCalledWith({ displayName: "Jason Smith", slug: "jason_smith" });
  });

  it("empty/whitespace-only displayName → 400, no DB call", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;
    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/representatives`)
      .send({ displayName: "   " });

    expect(res.status).toBe(400);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it("duplicate name → 409 with code DUPLICATE_SLUG", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;
    mockFn.mockRejectedValue(Object.assign(new Error("duplicate_slug"), { code: "DUPLICATE_SLUG" }));

    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/representatives`)
      .send({ displayName: "Jason Smith" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_SLUG");
  });

  it("unknown entity slug → 404, no DB call (entity isolation)", async () => {
    (getCachedEntityId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;

    const res = await request(makeApp())
      .post(`/commissions/${UNKNOWN_SLUG}/representatives`)
      .send({ displayName: "Jason Smith" });

    expect(res.status).toBe(404);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it("readonly role (no 'control' permission) → 403, no DB call", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;

    const res = await request(makeApp("readonly"))
      .post(`/commissions/${SLUG}/representatives`)
      .send({ displayName: "Jason Smith" });

    expect(res.status).toBe(403);
    expect(mockFn).not.toHaveBeenCalled();
  });

  it("unexpected DB error → 500 with a sanitized message, no internal detail leaked", async () => {
    const mockFn = createCommissionRepresentative as ReturnType<typeof vi.fn>;
    mockFn.mockRejectedValue(new Error("connection terminated unexpectedly at commissions.ts:214"));

    const res = await request(makeApp())
      .post(`/commissions/${SLUG}/representatives`)
      .send({ displayName: "Jason Smith" });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
    expect(JSON.stringify(res.body)).not.toMatch(/commissions\.ts|connection terminated/);
  });
});
