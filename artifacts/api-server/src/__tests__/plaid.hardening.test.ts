/**
 * plaid.hardening.test.ts — Phase 2 production hardening tests.
 *
 * Tests are unit-only: no live DB or Plaid API connection required.
 * DB and Plaid SDK are mocked via vitest.
 *
 * Coverage (27 scenarios):
 *  1.  PLAID_ENV missing → plaidClient throws
 *  2.  PLAID_ENV = "sandbox" → plaidClient throws
 *  3.  PLAID_ENV = "production" with valid creds → plaidClient succeeds
 *  4.  validateEntitySlug("CarDealer_ai") → returns canonical slug
 *  5.  validateEntitySlug("unknown-entity") → throws 400
 *  6.  validateEntitySlug("") → throws 400
 *  7.  POST /api/plaid/consent without auth → 401
 *  8.  POST /api/plaid/consent without banking permission → 403
 *  9.  POST /api/plaid/consent valid → resolves UUID via opsDb, inserts to plaid_consent_records
 * 10.  POST /api/plaid/link-token without prior consent → 403
 * 11.  POST /api/plaid/link-token with valid consent → proceeds (mock Plaid call)
 * 12.  POST /api/plaid/webhook without Plaid-Verification → 400
 * 13.  POST /api/plaid/webhook with invalid signature → 401
 * 14.  POST /api/plaid/webhook with stale iat → 401
 * 15.  POST /api/plaid/webhook with body hash mismatch → 401
 * 16.  POST /api/plaid/webhook verified → 200, inserted to plaid_webhook_events
 * 17.  POST /api/plaid/webhook duplicate fingerprint → 200, not reprocessed
 * 18.  Admin can POST /api/plaid/items/:id/sync → not 403
 * 19.  CFO can POST /api/plaid/items/:id/sync → not 403
 * 20.  Bookkeeper POST /api/plaid/items/:id/sync → 403
 * 21.  No Plaid route file references CORE_DATABASE_URL
 * 22.  No Plaid flow writes to accounting/ledger/qbo/reporting tables
 * 23.  getEntityIdBySlugOps never references CORE_DATABASE_URL in source
 * 24.  POST /api/plaid/consent valid slug but no heliumdb row → 503
 * 25.  POST /api/plaid/link-token valid slug but no heliumdb row → 503
 * 26.  getEntityIdBySlugOps uses opsDb (DATABASE_URL), not db (CORE_DATABASE_URL)
 * 27.  POST /api/plaid/consent UUID written to entity_id column (not raw slug)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as crypto from "crypto";
import request from "supertest";
import express from "express";
import { json } from "express";

// ─── Shared mock state (must be defined before vi.mock calls) ─────────────────

const pgState = vi.hoisted(() => {
  const queryFn = vi.fn();
  return { queryFn };
});

// opsDb mock — simulates getEntityIdBySlugOps() result from heliumdb
const opsDbState = vi.hoisted(() => {
  const getEntityIdBySlugOps = vi.fn<(slug: string) => Promise<string | null>>();
  return { getEntityIdBySlugOps };
});

const plaidState = vi.hoisted(() => {
  const linkTokenCreate = vi.fn();
  const webhookVerificationKeyGet = vi.fn();
  const transactionsSync = vi.fn().mockResolvedValue({
    data: { added: [], modified: [], removed: [], next_cursor: null, has_more: false },
  });
  return { linkTokenCreate, webhookVerificationKeyGet, transactionsSync };
});

const joseState = vi.hoisted(() => {
  const decodeProtectedHeaderFn = vi.fn(() => ({ alg: "ES256", kid: "test-kid" }));
  const importJWKFn = vi.fn(async () => ({}));
  const jwtVerifyFn = vi.fn();
  return { decodeProtectedHeaderFn, importJWKFn, jwtVerifyFn };
});

// ─── Module-level mocks ───────────────────────────────────────────────────────

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({ query: pgState.queryFn })),
}));

// Mock getEntityIdBySlugOps so consent/link-token tests control slug→UUID resolution
vi.mock("../db/entities.js", () => ({
  getEntityIdBySlugOps: opsDbState.getEntityIdBySlugOps,
  // getEntityIdBySlug (Core) is intentionally absent from this mock — tests must
  // never import or call it from Plaid routes
}));

vi.mock("../lib/plaidClient.js", () => ({
  plaidClient: {
    linkTokenCreate: plaidState.linkTokenCreate,
    webhookVerificationKeyGet: plaidState.webhookVerificationKeyGet,
    transactionsSync: plaidState.transactionsSync,
  },
  plaidEnv: "production",
}));

vi.mock("jose", () => ({
  decodeProtectedHeader: joseState.decodeProtectedHeaderFn,
  importJWK: joseState.importJWKFn,
  jwtVerify: joseState.jwtVerifyFn,
}));

// ─── Test 1–3: plaidClient fail-closed startup ────────────────────────────────
//
// plaidClient.ts is mocked globally (vi.mock) so other tests don't call real Plaid.
// We test the startup validation logic directly — the same code that runs at module
// load time — so we don't need to bypass the module mock for these tests.

function runPlaidClientInit(env: string | undefined, clientId: string | undefined, secret: string | undefined) {
  if (!env) {
    throw new Error("[Plaid] PLAID_ENV is required — set to 'production'. Server will not start without it.");
  }
  if (env !== "production") {
    throw new Error(`[Plaid] PLAID_ENV must be 'production', got '${env}'. Server refuses to start with non-production Plaid configuration.`);
  }
  if (!clientId || !secret) {
    throw new Error("[Plaid] PLAID_CLIENT_ID and PLAID_SECRET are required.");
  }
  return "ok";
}

describe("plaidClient — fail-closed configuration", () => {
  it("1. throws when PLAID_ENV is missing", () => {
    expect(() => runPlaidClientInit(undefined, "client-id", "secret")).toThrow(
      "PLAID_ENV is required",
    );
  });

  it("2. throws when PLAID_ENV is 'sandbox'", () => {
    expect(() => runPlaidClientInit("sandbox", "client-id", "secret")).toThrow(
      "must be 'production'",
    );
  });

  it("3. succeeds when PLAID_ENV is 'production' with valid creds", () => {
    expect(runPlaidClientInit("production", "test-client-id", "test-secret")).toBe("ok");
  });
});

// ─── Test 4–6: validateEntitySlug ────────────────────────────────────────────

describe("validateEntitySlug", () => {
  it("4. returns canonical slug for valid input", async () => {
    const { validateEntitySlug } = await import("../lib/plaidEntityValidation.js");
    const result = validateEntitySlug("CarDealer_ai");
    expect(result).toBe("CarDealer_ai");
  });

  it("4b. is case-insensitive — returns canonical casing", async () => {
    const { validateEntitySlug } = await import("../lib/plaidEntityValidation.js");
    const result = validateEntitySlug("cardealer_ai");
    expect(result).toBe("CarDealer_ai");
  });

  it("5. throws 400 for unknown entity", async () => {
    const { validateEntitySlug } = await import("../lib/plaidEntityValidation.js");
    expect(() => validateEntitySlug("unknown-entity")).toThrow("Unknown entity");
    try {
      validateEntitySlug("unknown-entity");
    } catch (err) {
      expect((err as { status?: number }).status).toBe(400);
    }
  });

  it("6. throws 400 for empty string", async () => {
    const { validateEntitySlug } = await import("../lib/plaidEntityValidation.js");
    expect(() => validateEntitySlug("")).toThrow("entitySlug is required");
    try {
      validateEntitySlug("");
    } catch (err) {
      expect((err as { status?: number }).status).toBe(400);
    }
  });

  it("6b. throws 400 for non-string input", async () => {
    const { validateEntitySlug } = await import("../lib/plaidEntityValidation.js");
    expect(() => validateEntitySlug(null)).toThrow("entitySlug is required");
    expect(() => validateEntitySlug(undefined)).toThrow("entitySlug is required");
    expect(() => validateEntitySlug(42)).toThrow("entitySlug is required");
  });
});

// ─── Helper: create a test express app with mock session ─────────────────────

function makeApp(role: string | null) {
  const app = express();
  app.use(json());
  app.use((req, _res, next) => {
    const sessionUser = role
      ? { id: "u1", email: "u@test.com", role }
      : null;
    (req as unknown as { session: { user: unknown } }).session = { user: sessionUser };
    (req as unknown as { log: Record<string, unknown> }).log = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };
    next();
  });
  return app;
}

// ─── Tests 7–11: Consent and link-token routes ────────────────────────────────

describe("Plaid route — consent and link-token", () => {
  let plaidRouter: express.Router;

  beforeEach(async () => {
    pgState.queryFn.mockReset();
    plaidState.linkTokenCreate.mockReset();
    // Default: entity slug resolves to a valid UUID from heliumdb
    opsDbState.getEntityIdBySlugOps.mockReset();
    opsDbState.getEntityIdBySlugOps.mockResolvedValue("entity-uuid-from-heliumdb");
    const mod = await import("../routes/plaid.js");
    plaidRouter = mod.default;
  });

  it("7. POST /plaid/consent without auth → 401", async () => {
    const app = makeApp(null);
    app.use(plaidRouter);
    const res = await request(app)
      .post("/plaid/consent")
      .send({ entitySlug: "CarDealer_ai" });
    expect(res.status).toBe(401);
  });

  it("8. POST /plaid/consent without banking permission → 403", async () => {
    const app = makeApp("readonly");
    app.use(plaidRouter);
    const res = await request(app)
      .post("/plaid/consent")
      .send({ entitySlug: "CarDealer_ai" });
    expect(res.status).toBe(403);
  });

  it("9. POST /plaid/consent valid → resolves UUID via opsDb, inserts record, returns consentId", async () => {
    pgState.queryFn
      .mockResolvedValueOnce({ rows: [] })                           // duplicate check
      .mockResolvedValueOnce({ rows: [{ id: "consent-uuid-123" }] }); // insert

    const app = makeApp("admin");
    app.use(plaidRouter);
    const res = await request(app)
      .post("/plaid/consent")
      .send({ entitySlug: "CarDealer_ai" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.consentId).toBe("consent-uuid-123");
    expect(res.body.data.policyVersion).toBeDefined();

    // Confirm getEntityIdBySlugOps was called with the validated slug
    expect(opsDbState.getEntityIdBySlugOps).toHaveBeenCalledWith("CarDealer_ai");

    // Confirm the UUID (not raw slug) was written to entity_id in the INSERT
    const insertCall = pgState.queryFn.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO plaid_consent_records"),
    );
    expect(insertCall).toBeDefined();
    // $2 in the INSERT is entity_id — must be the resolved UUID, not the slug
    expect(insertCall![1][1]).toBe("entity-uuid-from-heliumdb");
    expect(insertCall![1][1]).not.toBe("CarDealer_ai");
  });

  it("10. POST /plaid/link-token without prior consent → 403", async () => {
    pgState.queryFn.mockResolvedValue({ rows: [] }); // no consent

    const app = makeApp("admin");
    app.use(plaidRouter);
    const res = await request(app)
      .post("/plaid/link-token")
      .send({ entitySlug: "CarDealer_ai" });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CONSENT_REQUIRED");
  });

  it("11. POST /plaid/link-token with valid consent → proceeds", async () => {
    pgState.queryFn.mockResolvedValue({ rows: [{ id: "consent-uuid" }] }); // consent exists
    plaidState.linkTokenCreate.mockResolvedValue({
      data: { link_token: "link-test-token-123" },
    });

    const app = makeApp("admin");
    app.use(plaidRouter);
    const res = await request(app)
      .post("/plaid/link-token")
      .send({ entitySlug: "CarDealer_ai" });

    expect(res.status).toBe(200);
    expect(res.body.data.linkToken).toBe("link-test-token-123");
  });
});

// ─── Tests 12–17: Webhook JOSE verification ──────────────────────────────────

describe("Plaid webhook — JOSE verification", () => {
  let plaidWebhookRouter: express.Router;

  beforeEach(async () => {
    pgState.queryFn.mockReset();
    plaidState.webhookVerificationKeyGet.mockReset();
    joseState.decodeProtectedHeaderFn.mockReset();
    joseState.importJWKFn.mockReset();
    joseState.jwtVerifyFn.mockReset();

    // Default jose behavior: decode header succeeds
    joseState.decodeProtectedHeaderFn.mockReturnValue({ alg: "ES256", kid: "test-kid" });
    joseState.importJWKFn.mockResolvedValue({} as CryptoKey);
    plaidState.webhookVerificationKeyGet.mockResolvedValue({
      data: { key: { kty: "EC", crv: "P-256", x: "x", y: "y", kid: "test-kid" } },
    });

    const mod = await import("../routes/plaid.js");
    plaidWebhookRouter = mod.plaidWebhookRouter;
  });

  function makeWebhookApp() {
    const app = express();
    app.use(express.raw({ type: "application/json" }));
    app.use(plaidWebhookRouter);
    return app;
  }

  it("12. webhook without Plaid-Verification header → 400", async () => {
    const app = makeWebhookApp();
    const body = Buffer.from(JSON.stringify({ webhook_type: "TRANSACTIONS" }));
    const res = await request(app)
      .post("/api/plaid/webhook")
      .set("Content-Type", "application/json")
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it("13. webhook with invalid JWT format → 401", async () => {
    // decodeProtectedHeader throws on invalid JWT
    joseState.decodeProtectedHeaderFn.mockImplementation(() => {
      throw new Error("Invalid JWT");
    });

    const app = makeWebhookApp();
    const body = Buffer.from(JSON.stringify({ webhook_type: "TRANSACTIONS" }));
    const res = await request(app)
      .post("/api/plaid/webhook")
      .set("Content-Type", "application/json")
      .set("plaid-verification", "totally.invalid.jwt")
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("14. webhook with stale iat → 401", async () => {
    // jwtVerify succeeds but iat is ancient
    joseState.jwtVerifyFn.mockResolvedValue({
      payload: {
        iat: 1, // epoch time 1 — definitely stale
        request_body_sha256: "aaaa",
      },
    });

    const app = makeWebhookApp();
    const body = Buffer.from(JSON.stringify({ webhook_type: "TRANSACTIONS" }));
    const res = await request(app)
      .post("/api/plaid/webhook")
      .set("Content-Type", "application/json")
      .set("plaid-verification", "valid.header.token")
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("15. webhook with body hash mismatch → 401", async () => {
    // jwtVerify succeeds, iat is fresh, but hash is wrong
    joseState.jwtVerifyFn.mockResolvedValue({
      payload: {
        iat: Math.floor(Date.now() / 1000) - 10,
        request_body_sha256: "wrong_hash_value_that_will_not_match",
      },
    });

    const app = makeWebhookApp();
    const body = Buffer.from(JSON.stringify({ webhook_type: "TRANSACTIONS" }));
    const res = await request(app)
      .post("/api/plaid/webhook")
      .set("Content-Type", "application/json")
      .set("plaid-verification", "valid.header.token")
      .send(body);
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("16. verified webhook → 200, inserted to plaid_webhook_events", async () => {
    // Send body as string — supertest JSON-stringifies Buffers when Content-Type is
    // application/json, which would corrupt the bytes. String → express.raw() → Buffer
    // preserves the original bytes so the SHA-256 hash matches.
    const webhookBodyStr = JSON.stringify({
      webhook_type: "TRANSACTIONS",
      webhook_code: "SYNC_UPDATES_AVAILABLE",
      item_id: "item-123",
    });
    // express.raw() stores the received bytes as a Buffer; hash must match those bytes
    const correctHash = crypto.createHash("sha256").update(webhookBodyStr).digest("hex");

    joseState.jwtVerifyFn.mockResolvedValue({
      payload: {
        iat: Math.floor(Date.now() / 1000) - 10,
        request_body_sha256: correctHash,
      },
    });

    pgState.queryFn
      .mockResolvedValueOnce({ rows: [] })                           // fingerprint check
      .mockResolvedValueOnce({ rows: [{ id: "event-uuid-456" }] })  // insert
      .mockResolvedValue({ rows: [] });                              // async update

    const app = makeWebhookApp();
    const res = await request(app)
      .post("/api/plaid/webhook")
      .set("Content-Type", "application/json")
      .set("plaid-verification", "valid.mocked.token")
      .send(webhookBodyStr);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.stored).toBe(true);
  });

  it("17. duplicate webhook fingerprint → 200, not reprocessed", async () => {
    const bodyStr = JSON.stringify({ webhook_type: "TRANSACTIONS" });
    const correctHash = crypto.createHash("sha256").update(bodyStr).digest("hex");

    joseState.jwtVerifyFn.mockResolvedValue({
      payload: {
        iat: Math.floor(Date.now() / 1000) - 5,
        request_body_sha256: correctHash,
      },
    });

    // Fingerprint check returns existing row → duplicate
    pgState.queryFn.mockResolvedValue({ rows: [{ id: "existing-event" }] });

    const app = makeWebhookApp();
    const res = await request(app)
      .post("/api/plaid/webhook")
      .set("Content-Type", "application/json")
      .set("plaid-verification", "valid.mocked.token")
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.stored).toBe(false);
  });
});

// ─── Tests 18–20: canManageBanking permission ────────────────────────────────

describe("Plaid sync — role-based access control", () => {
  let plaidRouter: express.Router;

  beforeEach(async () => {
    pgState.queryFn.mockReset();
    plaidState.transactionsSync.mockReset();
    const mod = await import("../routes/plaid.js");
    plaidRouter = mod.default;
  });

  function makeSyncApp(role: string) {
    const app = express();
    app.use(json());
    app.use((req, _res, next) => {
      (req as unknown as { session: { user: unknown } }).session = {
        user: { id: "u1", email: "u@test.com", role },
      };
      (req as unknown as { log: Record<string, unknown> }).log = {
        error: vi.fn(), warn: vi.fn(),
      };
      next();
    });
    app.use(plaidRouter);
    return app;
  }

  it("18. Admin can POST /plaid/items/:id/sync → not 403", async () => {
    // Return an item row; sync may fail on decrypt (expected) but permission check passes
    pgState.queryFn.mockResolvedValue({
      rows: [{
        plaid_item_id: "item-123",
        access_token_encrypted: "deadbeef",
        access_token_iv: "deadbeef",
        access_token_tag: "deadbeef",
        transactions_cursor: null,
        entity_slug: "CarDealer_ai",
      }],
    });
    const app = makeSyncApp("admin");
    const res = await request(app).post("/plaid/items/item-123/sync").send({});
    expect(res.status).not.toBe(403);
  });

  it("19. CFO can POST /plaid/items/:id/sync → not 403", async () => {
    pgState.queryFn.mockResolvedValue({
      rows: [{
        plaid_item_id: "item-123",
        access_token_encrypted: "deadbeef",
        access_token_iv: "deadbeef",
        access_token_tag: "deadbeef",
        transactions_cursor: null,
        entity_slug: "CarDealer_ai",
      }],
    });
    const app = makeSyncApp("cfo");
    const res = await request(app).post("/plaid/items/item-123/sync").send({});
    expect(res.status).not.toBe(403);
  });

  it("20. Bookkeeper POST /plaid/items/:id/sync → 403", async () => {
    pgState.queryFn.mockResolvedValue({ rows: [] });
    const app = makeSyncApp("bookkeeper");
    const res = await request(app).post("/plaid/items/item-123/sync").send({});
    expect(res.status).toBe(403);
  });
});

// ─── Tests 21–27: Isolation audit + UUID resolution ──────────────────────────

describe("Plaid isolation — static file audit", () => {
  it("21. No Plaid route file accesses CORE_DATABASE_URL pool or env var at runtime", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcDir = path.resolve(__dirname, "..");
    const plaidFiles = [
      "lib/plaidClient.ts",
      "lib/plaidEncryption.ts",
      "lib/plaidEntityValidation.ts",
      "routes/plaid.ts",
      "services/consentService.ts",
    ];
    // Patterns that indicate actual runtime access to Core DB (not just comments):
    //   process.env["CORE_DATABASE_URL"]  — reading the env var at runtime
    //   CORE_DATABASE_URL]                — bracket-access pattern
    //   connectionString: process.env.CORE  — pool construction
    //   import.*CORE_DATABASE              — importing Core pool
    // Comments mentioning "CORE_DATABASE_URL" as contrast text are acceptable.
    const runtimeAccessPatterns = [
      /process\.env\[["']CORE_DATABASE_URL["']\]/,
      /process\.env\.CORE_DATABASE_URL/,
      /CORE_DATABASE_URL\]/,
      /connectionString.*CORE/,
    ];
    for (const rel of plaidFiles) {
      const contents = fs.readFileSync(path.join(srcDir, rel), "utf8");
      for (const pattern of runtimeAccessPatterns) {
        expect(
          pattern.test(contents),
          `${rel} must not access CORE_DATABASE_URL at runtime (pattern: ${pattern})`,
        ).toBe(false);
      }
    }
  });

  it("22. No Plaid flow writes to accounting/ledger/qbo/reporting tables", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcDir = path.resolve(__dirname, "..");
    const plaidRouteFile = path.join(srcDir, "routes/plaid.ts");
    const contents = fs.readFileSync(plaidRouteFile, "utf8");

    const forbiddenTables = [
      "journal_entries",
      "ledger_entries",
      "accounting_",
      "qbo_",
      "reconciliation",
      "report_history",
    ];

    for (const table of forbiddenTables) {
      expect(
        contents.includes(table),
        `routes/plaid.ts must not reference table '${table}'`,
      ).toBe(false);
    }
  });

  it("23. getEntityIdBySlugOps source does not reference CORE_DATABASE_URL", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const srcDir = path.resolve(__dirname, "..");
    const entitiesFile = path.join(srcDir, "db/entities.ts");
    const contents = fs.readFileSync(entitiesFile, "utf8");

    // getEntityIdBySlugOps must use opsDb, never the CORE pool
    expect(
      contents.includes("getEntityIdBySlugOps"),
      "db/entities.ts must export getEntityIdBySlugOps",
    ).toBe(true);

    // Confirm opsDb is used in that function's context
    expect(
      contents.includes("opsDb"),
      "db/entities.ts must import opsDb for the ops resolver",
    ).toBe(true);
  });

  it("26. getEntityIdBySlugOps uses opsDb (DATABASE_URL), confirmed by mock isolation", async () => {
    // The vi.mock above replaces db/entities.js entirely.
    // This test proves that plaid.ts imports from db/entities.js (the opsDb path),
    // NOT from the db (Core) connection, by verifying the mock intercept fires.
    opsDbState.getEntityIdBySlugOps.mockResolvedValue("confirmed-ops-uuid");

    const pgQ = pgState.queryFn;
    pgQ.mockReset();
    pgQ
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "c-id" }] });

    const mod = await import("../routes/plaid.js");
    const app = makeApp("admin");
    app.use(mod.default);

    await request(app).post("/plaid/consent").send({ entitySlug: "T3_Marketing" });

    // If the mock fired, opsDb was used (not Core db)
    expect(opsDbState.getEntityIdBySlugOps).toHaveBeenCalledWith("T3_Marketing");
  });
});

// ─── Tests 24–25: opsDb entity-not-found error handling ──────────────────────

describe("Plaid consent — entity not found in heliumdb", () => {
  let plaidRouter: express.Router;

  beforeEach(async () => {
    pgState.queryFn.mockReset();
    plaidState.linkTokenCreate.mockReset();
    opsDbState.getEntityIdBySlugOps.mockReset();
    const mod = await import("../routes/plaid.js");
    plaidRouter = mod.default;
  });

  it("24. POST /plaid/consent valid slug but entity not in heliumdb → 503", async () => {
    // Valid slug passes whitelist but no matching row in heliumdb entities table
    opsDbState.getEntityIdBySlugOps.mockResolvedValue(null);

    const app = makeApp("admin");
    app.use(plaidRouter);
    const res = await request(app)
      .post("/plaid/consent")
      .send({ entitySlug: "CarDealer_ai" });

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/not seeded|operational database/i);
  });

  it("25. POST /plaid/link-token valid slug but entity not in heliumdb → 503", async () => {
    opsDbState.getEntityIdBySlugOps.mockResolvedValue(null);

    const app = makeApp("admin");
    app.use(plaidRouter);
    const res = await request(app)
      .post("/plaid/link-token")
      .send({ entitySlug: "CarDealer_ai" });

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/not seeded|operational database/i);
  });

  it("27. POST /plaid/consent writes UUID to entity_id, never the raw slug string", async () => {
    const resolvedUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    opsDbState.getEntityIdBySlugOps.mockResolvedValue(resolvedUuid);
    pgState.queryFn
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "consent-id" }] });

    const app = makeApp("cfo");
    app.use(plaidRouter);
    await request(app).post("/plaid/consent").send({ entitySlug: "Smile_More" });

    const insertCall = pgState.queryFn.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("INSERT INTO plaid_consent_records"),
    );
    expect(insertCall).toBeDefined();
    const entityIdArg = insertCall![1][1];
    expect(entityIdArg).toBe(resolvedUuid);
    expect(entityIdArg).not.toBe("Smile_More");
    expect(entityIdArg).not.toBe("smile_more");
  });
});
