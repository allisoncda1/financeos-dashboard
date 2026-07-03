---
name: Vercel/v0 import quirks
description: Broken-code patterns found in the FinanceOS Vercel/v0 import and how to catch them early
---

# Vercel/v0 import quirks

The imported code (v0-generated) shipped with bugs that compile-looking code hid until runtime:

- **Module-level React hook calls** — a page called `useDashboardData()` at file top level (outside any component), crashing the entire SPA with `Cannot read properties of null (reading 'useState')`. Fix: move hook calls inside the component body.
- **Missing imports** — many pages called mock-data helpers (`getMockData`, `getFinancials`, etc.) without importing them.

**Why:** v0 exports are not guaranteed to be self-consistent; a single broken page crashes the whole client-rendered app.

**How to apply:** After any Vercel/v0 import, run typecheck AND grep for `= use[A-Z]` calls at module scope across all pages before browser verification. Don't assume the imported code ever ran.
