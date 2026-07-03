---
name: Google Drive OAuth debugging
description: How to diagnose a Drive/Google API integration that silently falls back to mock data instead of erroring loudly.
---

When a data-source layer has a "try Drive, catch and fall back to mock" pattern, a bad refresh token (or `googleapis` package version mismatch when mixed with a separately-installed `google-auth-library`) will silently succeed the request but always serve mock data — no error surfaces anywhere in normal logs.

**Why:** The fallback is intentional (keeps the app usable when Drive is down), but it means a misconfigured credential looks identical to "not configured" or "working as designed" from the outside. The only visible signal is `cacheSize` staying at 0 forever in a status endpoint.

**How to apply:** When verifying such an integration, temporarily add a `console.error` inside the catch block, trigger a request, check workflow logs, then remove the debug line. A Google OAuth `invalid_grant` error on the `oauth2.googleapis.com/token` call means the refresh token itself is expired/revoked — this is a credentials problem for the user to fix (re-authorize and get a new refresh token), not a code bug. Also: prefer `google.auth.OAuth2` from the `googleapis` package itself over importing `google-auth-library` separately — the two can resolve to different versions via pnpm and cause a TS2769 type-incompatibility on `OAuth2Client`.

**Second failure mode — pasted URL fragments as IDs:** Users often paste Drive URL fragments (e.g. `/folders/<id>`) into `GOOGLE_SHARED_DRIVE_ID` / folder-ID secrets instead of bare IDs, producing `Shared drive not found: /folders/<id>` (404). Normalize IDs in code (strip `folders/`, `drives/`, `d/` prefixes and `?id=` query params) rather than asking the user to re-enter the secret. The success signal is the status endpoint's `cacheSize` going above 0 after a data request.
