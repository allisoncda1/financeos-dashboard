import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("RC-009 — Replit reverse-proxy configuration", () => {
  let app: Awaited<typeof import("../app")>["default"];

  beforeAll(async () => {
    process.env.SESSION_SECRET = "rc009-test-secret";
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.CORE_DATABASE_URL = "postgresql://test:test@localhost:5432/core";
    ({ default: app } = await import("../app"));
  });

  afterAll(() => {
    delete process.env.SESSION_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.CORE_DATABASE_URL;
  });

  it("trusts exactly one reverse-proxy hop", () => {
    expect(app.get("trust proxy")).toBe(1);
  });

  it("does not use Express's default disabled proxy setting", () => {
    expect(app.get("trust proxy")).not.toBe(false);
  });
});
