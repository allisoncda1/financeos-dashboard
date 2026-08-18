import { describe, it, expect, afterEach } from "vitest";
import { isCommissionDocumentsEnabled } from "../config/featureFlags";

describe("isCommissionDocumentsEnabled", () => {
  afterEach(() => {
    delete process.env["COMMISSION_DOCUMENTS_ENABLED"];
  });

  it("is false when the env var is unset", () => {
    delete process.env["COMMISSION_DOCUMENTS_ENABLED"];
    expect(isCommissionDocumentsEnabled()).toBe(false);
  });

  it.each(["false", "0", "1", "yes", "TRUE", "True", " true", "true "])(
    "is false for %j — only the exact string 'true' enables it",
    (value) => {
      process.env["COMMISSION_DOCUMENTS_ENABLED"] = value;
      expect(isCommissionDocumentsEnabled()).toBe(false);
    },
  );

  it("is true only for the exact string 'true'", () => {
    process.env["COMMISSION_DOCUMENTS_ENABLED"] = "true";
    expect(isCommissionDocumentsEnabled()).toBe(true);
  });

  it("reflects a change made after the module was already loaded (read fresh every call, never cached)", () => {
    process.env["COMMISSION_DOCUMENTS_ENABLED"] = "true";
    expect(isCommissionDocumentsEnabled()).toBe(true);
    process.env["COMMISSION_DOCUMENTS_ENABLED"] = "false";
    expect(isCommissionDocumentsEnabled()).toBe(false);
  });
});
