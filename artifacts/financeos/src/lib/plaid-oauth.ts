/**
 * plaid-oauth.ts — Pure helpers for Plaid OAuth continuation.
 *
 * Extracted from banking.tsx so they are unit-testable without a DOM component.
 * No credentials, access tokens, or secrets are handled here.
 */

export const PLAID_LINK_TOKEN_KEY = "financeos_plaid_link_token";

/** OAuth return path — must match the redirect_uri registered in Plaid Dashboard. */
export const PLAID_OAUTH_PATH = "/accounting/banking";

/** Returns the oauth_state_id query param from the current URL, or null. */
export function getOAuthStateId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("oauth_state_id");
  } catch {
    return null;
  }
}

/** True when this page load is an OAuth return from a bank (e.g. Chase). */
export function isOAuthReturn(): boolean {
  return Boolean(getOAuthStateId());
}

/** Persist the link token in sessionStorage so it survives the OAuth redirect. */
export function storeLinkToken(token: string): void {
  try {
    sessionStorage.setItem(PLAID_LINK_TOKEN_KEY, token);
  } catch { /* quota or private-browse — best-effort */ }
}

/** Restore the link token after returning from OAuth. Returns null if not found. */
export function restoreLinkToken(): string | null {
  try {
    return sessionStorage.getItem(PLAID_LINK_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Remove the persisted link token — call on success or final exit. */
export function clearLinkToken(): void {
  try {
    sessionStorage.removeItem(PLAID_LINK_TOKEN_KEY);
  } catch { /* best-effort */ }
}

/** Remove OAuth query params from the URL without a page reload. */
export function cleanOAuthParams(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("oauth_state_id");
    url.searchParams.delete("oauth_token");
    window.history.replaceState({}, "", url.toString());
  } catch { /* best-effort */ }
}

/**
 * Convert a raw Plaid onExit error object into a user-safe string.
 * Never exposes credentials, raw DB errors, or internal Plaid error details.
 */
export function sanitizePlaidExitError(error: unknown): string | null {
  if (!error) return null;
  const code = (error as Record<string, unknown>)["error_code"] as string | undefined;
  const FRIENDLY: Record<string, string> = {
    INVALID_LINK_TOKEN:               "Connection session expired — please try again.",
    OAUTH_STATE_ID_ALREADY_PROCESSED: "OAuth session already used — please try again.",
    ITEM_LOGIN_REQUIRED:              "Your bank requires re-authentication.",
    INSTITUTION_DOWN:                 "Your bank's connection is temporarily unavailable.",
    INSTITUTION_NOT_RESPONDING:       "Your bank is not responding. Please try again later.",
    USER_SETUP_REQUIRED:              "Additional setup is required at your bank.",
    TOO_MANY_VERIFICATION_ATTEMPTS:   "Too many verification attempts. Please try again later.",
  };
  if (code && FRIENDLY[code]) return FRIENDLY[code]!;
  if (code) return `Bank connection closed (${code}).`;
  return "Bank connection closed unexpectedly.";
}
