---
name: connect-pg-simple in bundled builds
description: createTableIfMissing silently fails when the server is bundled with esbuild
---

`connect-pg-simple`'s `createTableIfMissing: true` reads `table.sql` relative to its own module path at runtime. When the API server is bundled (esbuild → single dist/index.mjs), that path resolves inside `dist/`, so table creation throws `ENOENT: dist/table.sql` — but only as an async log line; login still returns 200 while sessions silently fail to persist (subsequent `/me` returns 401).

**Why:** The bundler inlines the JS but not the package's SQL asset, and the store swallows the error per-request instead of crashing at startup.

**How to apply:** In any bundled server using connect-pg-simple, do NOT use `createTableIfMissing`. Instead run idempotent `CREATE TABLE IF NOT EXISTS "session" (...)` + expire index SQL at startup (before `listen`) and fail fast on error. Watch for the 200-login/401-me symptom when debugging session stores.
