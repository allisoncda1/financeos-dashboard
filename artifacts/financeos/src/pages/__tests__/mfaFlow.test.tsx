import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const login = read("src/pages/login.tsx");
const auth = read("src/lib/auth.tsx");
const setup = read("src/pages/mfa-setup.tsx");
const challenge = read("src/pages/mfa-challenge.tsx");
const app = read("src/App.tsx");

describe("MFA frontend flow", () => {
  it("routes first-time users to mandatory setup", () => {
    expect(auth).toContain('next: "mfa_enrollment"');
    expect(login).toContain('router.replace("/mfa/setup")');
    expect(app).toContain('path="/mfa/setup"');
  });

  it("routes enrolled users to the challenge screen", () => {
    expect(auth).toContain('next: "mfa_challenge"');
    expect(login).toContain('router.replace("/mfa/challenge")');
    expect(app).toContain('path="/mfa/challenge"');
  });

  it("does not persist the TOTP secret or recovery codes in browser storage", () => {
    expect(setup).not.toMatch(/localStorage|sessionStorage/);
    expect(challenge).not.toMatch(/localStorage|sessionStorage/);
  });

  it("shows a QR, manual key, six-digit verification, and one-time recovery codes", () => {
    expect(setup).toContain("enrollment.qrDataUrl");
    expect(setup).toContain("enrollment.secret");
    expect(setup).toContain("maxLength={6}");
    expect(setup).toContain("recoveryCodes.map");
  });

  it("supports authenticator and recovery-code challenges", () => {
    expect(challenge).toContain("completeMfaChallenge");
    expect(challenge).toContain("Use a recovery code");
    expect(challenge).toContain("autoComplete=\"one-time-code\"");
  });
});
