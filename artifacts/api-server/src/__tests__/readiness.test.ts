import { describe, it, expect, vi, afterEach } from "vitest";

const executeMock = vi.fn();
vi.mock("../db/ops-connection", () => ({
  getCommissionOpsDb: () => ({ execute: executeMock }),
}));

const storageAvailableMock = vi.fn();
vi.mock("../services/commissionDocumentStorage", () => ({
  isDocumentStorageAvailable: () => storageAvailableMock(),
}));

import { getAiProviderReadiness, computeReadiness } from "../services/readiness";

function resetEnv() {
  delete process.env["NODE_ENV"];
  delete process.env["AI_PROVIDER"];
  delete process.env["ANTHROPIC_API_KEY"];
  delete process.env["COMMISSION_DOCUMENTS_ENABLED"];
}

describe("getAiProviderReadiness", () => {
  afterEach(resetEnv);

  it("is ready outside production even with no provider/key configured at all — mock is the correct default", () => {
    resetEnv();
    expect(getAiProviderReadiness()).toEqual({ ready: true });
  });

  it("is ready in development explicitly with AI_PROVIDER unset", () => {
    resetEnv();
    process.env["NODE_ENV"] = "development";
    expect(getAiProviderReadiness().ready).toBe(true);
  });

  it("is NOT ready in production when AI_PROVIDER is unset (implicit mock default)", () => {
    resetEnv();
    process.env["NODE_ENV"] = "production";
    const r = getAiProviderReadiness();
    expect(r.ready).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("is NOT ready in production when AI_PROVIDER is explicitly 'mock'", () => {
    resetEnv();
    process.env["NODE_ENV"] = "production";
    process.env["AI_PROVIDER"] = "mock";
    expect(getAiProviderReadiness().ready).toBe(false);
  });

  it("is NOT ready in production when AI_PROVIDER=claude but ANTHROPIC_API_KEY is missing", () => {
    resetEnv();
    process.env["NODE_ENV"] = "production";
    process.env["AI_PROVIDER"] = "claude";
    const r = getAiProviderReadiness();
    expect(r.ready).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("is ready in production when AI_PROVIDER=claude AND ANTHROPIC_API_KEY is set", () => {
    resetEnv();
    process.env["NODE_ENV"] = "production";
    process.env["AI_PROVIDER"] = "claude";
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-test-not-a-real-key";
    expect(getAiProviderReadiness()).toEqual({ ready: true });
  });

  it("never reveals the configured provider name, the env var name, or any part of a key in its reason", () => {
    resetEnv();
    process.env["NODE_ENV"] = "production";
    process.env["AI_PROVIDER"] = "some-fake-provider-xyz";
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-super-secret-value-do-not-leak";
    const r = getAiProviderReadiness();
    expect(r.ready).toBe(false);
    expect(r.reason).not.toMatch(/some-fake-provider-xyz|sk-ant-super-secret|ANTHROPIC_API_KEY|AI_PROVIDER/);
  });
});

describe("computeReadiness", () => {
  afterEach(() => { resetEnv(); vi.clearAllMocks(); });

  it("reports all four booleans, with no secret/connection-detail leakage of any kind", async () => {
    resetEnv();
    process.env["COMMISSION_DOCUMENTS_ENABLED"] = "true";
    executeMock.mockResolvedValue({ rows: [] });
    storageAvailableMock.mockResolvedValue(true);

    const readiness = await computeReadiness();

    expect(readiness).toEqual({
      featureEnabled: true,
      databaseReady: true,
      objectStorageReady: true,
      aiProviderReady: true,
    });
    // Exactly these four keys — nothing else is ever exposed.
    expect(Object.keys(readiness).sort()).toEqual(["aiProviderReady", "databaseReady", "featureEnabled", "objectStorageReady"]);
  });

  it("databaseReady is false when the DB ping throws (connection string never touched by this function's return value)", async () => {
    resetEnv();
    executeMock.mockRejectedValue(new Error("connection to 10.0.0.5:5432 failed for commission_writer"));
    storageAvailableMock.mockResolvedValue(true);

    const readiness = await computeReadiness();
    expect(readiness.databaseReady).toBe(false);
    expect(JSON.stringify(readiness)).not.toMatch(/10\.0\.0\.5|commission_writer/);
  });

  it("objectStorageReady is false when the storage probe rejects", async () => {
    resetEnv();
    executeMock.mockResolvedValue({ rows: [] });
    storageAvailableMock.mockRejectedValue(new Error("bucket credentials invalid"));

    const readiness = await computeReadiness();
    expect(readiness.objectStorageReady).toBe(false);
  });

  it("featureEnabled reflects COMMISSION_DOCUMENTS_ENABLED exactly, never defaulting to true", async () => {
    resetEnv();
    executeMock.mockResolvedValue({ rows: [] });
    storageAvailableMock.mockResolvedValue(true);

    const readiness = await computeReadiness();
    expect(readiness.featureEnabled).toBe(false);
  });

  it("aiProviderReady is false in production without a real provider, even when DB and storage are healthy", async () => {
    resetEnv();
    process.env["NODE_ENV"] = "production";
    executeMock.mockResolvedValue({ rows: [] });
    storageAvailableMock.mockResolvedValue(true);

    const readiness = await computeReadiness();
    expect(readiness.aiProviderReady).toBe(false);
    expect(readiness.databaseReady).toBe(true);
    expect(readiness.objectStorageReady).toBe(true);
  });
});
