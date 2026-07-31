/**
 * plaidOAuth.test.ts — Pure-logic tests for Plaid OAuth helpers.
 *
 * No DOM component rendering needed — helpers in plaid-oauth.ts are
 * pure functions that read/write window.location, sessionStorage, and
 * window.history. jsdom provides all of these.
 *
 * PO1.  getOAuthStateId returns null when no param in URL
 * PO2.  getOAuthStateId returns value when oauth_state_id present
 * PO3.  getOAuthStateId ignores unrelated query params
 * PO4.  isOAuthReturn() true only when oauth_state_id present
 * PO5.  storeLinkToken writes to sessionStorage under the correct key
 * PO6.  restoreLinkToken reads back the stored token
 * PO7.  clearLinkToken removes the key
 * PO8.  restoreLinkToken returns null when nothing stored
 * PO9.  cleanOAuthParams removes oauth_state_id from URL without reload
 * PO10. cleanOAuthParams removes oauth_token from URL without reload
 * PO11. cleanOAuthParams preserves unrelated query params
 * PO12. sanitizePlaidExitError returns null for null input
 * PO13. sanitizePlaidExitError maps INVALID_LINK_TOKEN to friendly message
 * PO14. sanitizePlaidExitError maps OAUTH_STATE_ID_ALREADY_PROCESSED
 * PO15. sanitizePlaidExitError includes error_code for unknown codes
 * PO16. sanitizePlaidExitError returns generic message for missing code
 * PO17. PLAID_OAUTH_PATH matches the banking route in App.tsx
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getOAuthStateId,
  isOAuthReturn,
  storeLinkToken,
  restoreLinkToken,
  clearLinkToken,
  cleanOAuthParams,
  sanitizePlaidExitError,
  PLAID_LINK_TOKEN_KEY,
  PLAID_OAUTH_PATH,
} from "@/lib/plaid-oauth";

// ─── URL helpers ──────────────────────────────────────────────────────────────

function setSearch(search: string) {
  Object.defineProperty(window, "location", {
    value: { ...window.location, search, href: `https://example.com/accounting/banking${search}` },
    writable: true,
    configurable: true,
  });
}

describe("getOAuthStateId and isOAuthReturn (PO1–PO4)", () => {
  afterEach(() => setSearch(""));

  it("PO1: returns null when no query params", () => {
    setSearch("");
    expect(getOAuthStateId()).toBeNull();
  });

  it("PO2: returns value when oauth_state_id present", () => {
    setSearch("?oauth_state_id=abc123xyz");
    expect(getOAuthStateId()).toBe("abc123xyz");
  });

  it("PO3: ignores unrelated query params", () => {
    setSearch("?foo=bar&baz=qux");
    expect(getOAuthStateId()).toBeNull();
  });

  it("PO4: isOAuthReturn true only when oauth_state_id present", () => {
    setSearch("");
    expect(isOAuthReturn()).toBe(false);
    setSearch("?oauth_state_id=state-token");
    expect(isOAuthReturn()).toBe(true);
  });
});

// ─── sessionStorage helpers ───────────────────────────────────────────────────

describe("storeLinkToken / restoreLinkToken / clearLinkToken (PO5–PO8)", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("PO5: storeLinkToken writes under the correct key", () => {
    storeLinkToken("link-prod-test-token");
    expect(sessionStorage.getItem(PLAID_LINK_TOKEN_KEY)).toBe("link-prod-test-token");
  });

  it("PO6: restoreLinkToken reads back the stored value", () => {
    storeLinkToken("link-prod-roundtrip");
    expect(restoreLinkToken()).toBe("link-prod-roundtrip");
  });

  it("PO7: clearLinkToken removes the key", () => {
    storeLinkToken("link-prod-to-clear");
    clearLinkToken();
    expect(sessionStorage.getItem(PLAID_LINK_TOKEN_KEY)).toBeNull();
  });

  it("PO8: restoreLinkToken returns null when nothing stored", () => {
    expect(restoreLinkToken()).toBeNull();
  });
});

// ─── URL cleanup ──────────────────────────────────────────────────────────────

describe("cleanOAuthParams (PO9–PO11)", () => {
  it("PO9: removes oauth_state_id from URL", () => {
    const replaced: string[] = [];
    const origHistory = window.history;
    Object.defineProperty(window, "history", {
      value: { replaceState: (_s: unknown, _t: unknown, url: string) => replaced.push(url) },
      writable: true, configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: { href: "https://example.com/accounting/banking?oauth_state_id=abc&other=x" },
      writable: true, configurable: true,
    });
    cleanOAuthParams();
    expect(replaced.length).toBe(1);
    expect(replaced[0]).not.toContain("oauth_state_id");
    Object.defineProperty(window, "history", { value: origHistory, writable: true, configurable: true });
  });

  it("PO10: removes oauth_token from URL", () => {
    const replaced: string[] = [];
    Object.defineProperty(window, "history", {
      value: { replaceState: (_s: unknown, _t: unknown, url: string) => replaced.push(url) },
      writable: true, configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: { href: "https://example.com/accounting/banking?oauth_token=tok&oauth_state_id=st" },
      writable: true, configurable: true,
    });
    cleanOAuthParams();
    expect(replaced[0]).not.toContain("oauth_token");
    expect(replaced[0]).not.toContain("oauth_state_id");
  });

  it("PO11: preserves unrelated query params", () => {
    const replaced: string[] = [];
    Object.defineProperty(window, "history", {
      value: { replaceState: (_s: unknown, _t: unknown, url: string) => replaced.push(url) },
      writable: true, configurable: true,
    });
    Object.defineProperty(window, "location", {
      value: { href: "https://example.com/accounting/banking?oauth_state_id=x&entity=cardealer_ai" },
      writable: true, configurable: true,
    });
    cleanOAuthParams();
    expect(replaced[0]).toContain("entity=cardealer_ai");
    expect(replaced[0]).not.toContain("oauth_state_id");
  });
});

// ─── Error sanitization ───────────────────────────────────────────────────────

describe("sanitizePlaidExitError (PO12–PO16)", () => {
  it("PO12: returns null for null input", () => {
    expect(sanitizePlaidExitError(null)).toBeNull();
  });

  it("PO13: INVALID_LINK_TOKEN → friendly message, not raw code", () => {
    const msg = sanitizePlaidExitError({ error_code: "INVALID_LINK_TOKEN" });
    expect(msg).toBeTruthy();
    expect(msg).not.toContain("INVALID_LINK_TOKEN");
    expect(msg!.toLowerCase()).toContain("session");
  });

  it("PO14: OAUTH_STATE_ID_ALREADY_PROCESSED → friendly message", () => {
    const msg = sanitizePlaidExitError({ error_code: "OAUTH_STATE_ID_ALREADY_PROCESSED" });
    expect(msg).toBeTruthy();
    expect(msg!.toLowerCase()).toContain("oauth");
  });

  it("PO15: unknown code is included in parentheses for traceability", () => {
    const msg = sanitizePlaidExitError({ error_code: "SOME_UNKNOWN_CODE" });
    expect(msg).toContain("SOME_UNKNOWN_CODE");
  });

  it("PO16: error object with no error_code returns generic message", () => {
    const msg = sanitizePlaidExitError({ some_other_field: "value" });
    expect(msg).toBeTruthy();
    expect(msg!.length).toBeGreaterThan(5);
  });
});

// ─── Route constant audit ─────────────────────────────────────────────────────

describe("PLAID_OAUTH_PATH (PO17)", () => {
  it("PO17: matches the banking route registered in App.tsx", async () => {
    const fs   = await import("fs");
    const path = await import("path");
    const appSrc = fs.readFileSync(
      path.resolve(__dirname, "../../App.tsx"),
      "utf8",
    );
    // App.tsx must have a Route whose path includes PLAID_OAUTH_PATH
    expect(appSrc).toContain(`"${PLAID_OAUTH_PATH}"`);
  });
});
