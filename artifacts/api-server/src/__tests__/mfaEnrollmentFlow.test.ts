import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const authRoute = src("src/routes/auth.ts");
const middleware = src("src/auth/middleware.ts");
const mfaRoutes = src("src/auth/mfaRoutes.ts");
const sessionTypes = src("src/auth/types.ts");

describe("mandatory MFA enrollment contract", () => {
  it("returns a restricted enrollment response for users without TOTP", () => {
    expect(authRoute).toContain("req.session.mfaEnrollmentRequired = true");
    expect(authRoute).toContain("mfaEnrollmentRequired: true");
    expect(authRoute).toContain("res.status(202)");
  });

  it("keeps existing MFA users on the challenge path", () => {
    expect(authRoute).toContain("req.session.mfaPending = true");
    expect(authRoute).toContain("req.session.pendingUser = user");
    expect(authRoute).toContain("mfaRequired: true");
  });

  it("blocks enrollment-only sessions from normal protected routes and /me", () => {
    expect(middleware).toContain("req.session.mfaEnrollmentRequired");
    expect(middleware).toContain('"MFA_ENROLLMENT_REQUIRED"');
    expect(authRoute).toContain("req.session.mfaEnrollmentRequired || req.session.mfaPending");
  });

  it("allows only a restricted enrollment session to call enrollment routes", () => {
    expect(middleware).toContain("export function requireMfaEnrollment");
    expect(middleware).toContain("!req.session.mfaEnrollmentRequired");
    expect(mfaRoutes).toContain('router.post("/enroll/totp", requireMfaEnrollment');
    expect(mfaRoutes).toContain('router.post("/enroll/totp/verify", requireMfaEnrollment');
  });

  it("clears the restriction only after a valid code enables TOTP", () => {
    const enableIndex = mfaRoutes.indexOf("SET totp_enabled = true");
    const clearIndex = mfaRoutes.indexOf("req.session.user = promotedUser", enableIndex);
    expect(enableIndex).toBeGreaterThan(-1);
    expect(clearIndex).toBeGreaterThan(enableIndex);
  });

  it("declares enrollment state in the typed session contract", () => {
    expect(sessionTypes).toContain("mfaEnrollmentRequired?: boolean");
  });
});
