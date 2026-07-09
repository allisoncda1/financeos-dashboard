# FinanceOS V1 — Release Candidate QA Report

**Date:** July 9, 2026
**Scope:** Post-Neon-migration validation. No code was modified.
**Method:** Automated browser test passes (navigation, data validation, financial consistency, UX/responsive), direct API numeric audit against live endpoints, server log analysis, and a code-level performance review.

---

## QA PASS 1 — Navigation

| Page | Status | Notes |
|---|---|---|
| Home (`/home`) | ✓ Works | Module launcher renders |
| Portfolio (`/`) | ✓ Works | KPI strip, 4 entity cards w/ logos, charts |
| Operations (`/operations`) | ✓ Works | Alerts inbox populated (18 alerts) |
| Analyze — Performance | ✓ Works | |
| Analyze — Consolidated | ✓ Works | |
| Analyze — Cash Flow | ⚠ Warning | Brief flash of partial "incomplete statement" state before data loads (missing loading state) |
| Analyze — History | ✓ Works | |
| Entity Dashboard (`/entity/:slug`) | ✓ Works | All 4 companies |
| Entity Financials | ✓ Works | |
| Entity Customers | ⚠ Warning | AR aging detail shows "aging unavailable" note (Core data gap, non-blocking) |
| Entity Vendors | ✓ Works | Proper zero-state for $0 AP companies |
| Entity Banking | ✓ Works | |
| Entity Reports / Report Center (`/reports`) | ✓ Works | Templates render |
| Control — Integrity | ✓ Works | |
| Control — Validation | ✓ Works | Matrix renders |
| Accounting (`/accounting`) | ✓ Works | Mock data (see Pass 4) |
| Accounting Transactions | ✓ Works | Mock |
| Accounting Reconciliation | ✓ Works | Mock |

**Result: 18/18 pages load. 0 broken. 2 warnings.**

## QA PASS 2 — Data Validation

- ✅ No `undefined`, `NaN`, or `Infinity` in any page text **or** any API payload (all payloads scanned programmatically).
- ✅ No broken charts, no migration-emptied tables, no missing logos; entity selector works in every module (4 companies + logos everywhere).
- ✅ No frontend console errors.
- ❌ **One API error:** `GET /api/briefing` → **500**. Root cause: Anthropic API rejects requests — *"Your credit balance is too low to access the Anthropic API."* The UI degrades gracefully (briefing panel falls back), but the Portfolio page fires a failing request on every cold load.

## QA PASS 3 — Financial Consistency (numeric audit)

Every metric was compared programmatically across `/api/model` (Portfolio + Entity Dashboard), `/api/model/:slug/financials` (Financials page), `/customers`, `/vendors`, and `/banking`:

| Company | Revenue YTD | Gross Profit | Net Income | Cash | AR | AP | All pages match? |
|---|---|---|---|---|---|---|---|
| CarDealer.ai | $268,355.00 | $204,077.84 | $115,573.44 | $122,777.58 | $34,035.00 | $0.00 | ✅ |
| T3 Marketing | $371,761.10 | $230,560.80 | $103,746.80 | $7,486.48 | $45,502.18 | $2,518.94 | ✅ |
| TopMrktr | $122,680.00 | $122,680.00 | $16,165.00 | $25,178.86 | $28,440.00 | $0.00 | ✅ |
| Smile More | $81,103.85 | $75,821.85 | $52,776.05 | **−$366,597.23** | $49,340.00 | $0.00 | ✅ |

Additional checks — all pass:
- Monthly P&L rows sum exactly to YTD summary for all 4 companies.
- Balance sheets balance (Assets = Liabilities + Equity) for all 4 companies.
- Portfolio rollups equal the sum of the 4 entities to the cent (Revenue $843,899.95, NI $288,261.29, AR $157,317.18, AP $2,518.94, Cash −$211,154.31).

⚠ **Data-quality flags (source data, not app bugs):**
- **Smile More cash = −$366,597** drags portfolio cash negative. Verify in Core/QBO whether this is a real overdraft/intercompany balance or a mapping issue.
- **TopMrktr COGS = $0** (GP = Revenue) — plausible for a services entity but worth confirming.
- Accounting module figures do NOT match (expected — it is mock data; see Pass 4).

**Verdict: the Neon migration is numerically sound. Zero cross-page inconsistencies.**

## QA PASS 4 — Data Source Audit

| Module | Target | Actual | Status |
|---|---|---|---|
| Reporting (Portfolio, Operations, Analyze, Entity, Reports) | Mostly Neon | **Neon** (all reads via api-server → Core) | ✅ Meets goal |
| Control (Integrity, Validation) | — | **Neon** | ✅ |
| Control Settings | — | Real (auth/AI status) | ✅ |
| History snapshots | — | Mixed (Neon + operational DB `metric_snapshots`) | ✅ by design |
| AI Briefing | — | Neon context + Anthropic (currently failing) | ⚠ |
| **Accounting** | **100% Neon** | **100% Mock** (`accountingMockData.ts`) | ❌ **Gap vs goal** |
| Budget | Mock | Mock | ✅ as planned |
| Forecast | Mock | Mock | ✅ as planned |
| Commissions | Mock | Mock | ✅ as planned |

Note: Neon Core already holds `invoices`, `transactions`, `accounts`, `customers`, `vendors`, `bills` — the raw material for Accounting's migration exists today.

## QA PASS 5 — UX Audit

Verified at 1280×720 and 390×844:
- ✅ Sidebar consistency across all 5 module layouts (same dark-green design language); logo alignment correct in cards, selectors, and sidebar company cards.
- ✅ Tables scroll horizontally inside their cards (no page overflow); mobile layouts stack KPI cards; no horizontal page scroll.
- ✅ Proper empty states (e.g., $0 AP vendors page).
- ⚠ Loading states: Analyze/Cash Flow (and to a lesser degree Portfolio) briefly show partial content instead of skeletons before data arrives.
- ⚠ Dark mode: there is no app-wide dark mode; the dark-green sidebars are consistent, but this is a fixed light theme (fine for V1 — just noting it is not a "mode").
- Low: minor typography drift — Budget pages use raw Tailwind tables while Forecast/Accounting/Commissions use the shared `AccountingUI` kit; visually close but not identical.

## QA PASS 6 — Performance

Measured (cold, authenticated):
- `GET /api/model` — **5.8s cold / ~0.5s warm, 134 KB** — the slowest and heaviest endpoint by far. Everything else: 120–730ms, ≤17 KB.

Code-level findings (with evidence):
1. **No frontend request cache** — `useApi.ts` is a raw `fetch` in `useEffect` per hook instance; no react-query/staleTime. Consequence: **duplicate `/api/model` requests on one page load** (confirmed in server logs: two back-to-back `/api/model` calls on Portfolio mount — `Sidebar.tsx` and the page both call `useDashboardData()`).
2. **Sequential N+1 on the server** — `/api/model` loops over the 4 entities with sequential `await`s (`routes/model.ts:51-58`) instead of `Promise.all`; latency grows linearly per entity.
3. **Over-fetching** — Sidebar fetches the full `/api/model` (metrics + anomalies for all entities) just to render names/logos that are already in the static entity registry.
4. **Briefing re-fetches everything** — `/api/briefing` rebuilds the full dashboard context server-side even when `/api/model` was just served (has its own 15-min cache, but no shared core-data cache).
5. **No pagination** — `/api/alerts` and banking transactions return full lists (currently small; fine for V1, a risk as data grows).
6. **No DB indexes declared** in `lib/db` schema for common filters (`entity_id`, dates) — Neon Core is read-only so this is a pipeline-side item.

Easy wins (post-RC, ~1 day total): parallelize the entity loop in `/api/model` (cold 5.8s → ~1.5s), add a tiny in-memory TTL cache or module-level request de-dupe in `useApi`, and stop the Sidebar from fetching `/api/model`.

---

## Issues by Priority

### Critical
- *None.* No blocking defects found.

### High
1. **`/api/briefing` 500** — Anthropic credit balance exhausted. Fix = fund/replace the AI provider key (config, not code). Until then Portfolio fires a failing request each cold load.
2. **Accounting is 100% mock but the stated goal is 100% Neon** — the largest gap between target and actual. (Planned work, but it is the one module that misses its data-source goal.)

### Medium
3. **Smile More cash −$366.6K** — verify at the source (Core/QBO mapping) before external users see portfolio cash as negative.
4. **Duplicate `/api/model` fetches + 5.8s cold load** — sequential server loop + no client cache (items 1–3 in Pass 6).
5. **Missing loading skeletons** on Analyze/Cash Flow (content flash).

### Low
6. Entity Customers page notes "aging detail unavailable" (known Core data gap — already documented).
7. TopMrktr $0 COGS — confirm intentional.
8. Typography/table-kit drift between Budget and the other modules.
9. No pagination on alerts/transactions endpoints (future-proofing).

## Recommendations

1. **Ship-blocker check:** none — RC is releasable for the Reporting + Control surface once the Anthropic key is funded (or briefing gracefully disabled by config).
2. Before the Budget migration begins, spend ~1 day on the three performance easy-wins (parallelize `/api/model`, client request de-dupe, sidebar over-fetch) — they benefit every future module.
3. Resolve the Smile More cash question with the accounting source before demoing portfolio-level cash.
4. Treat **Accounting → Neon** as the first data-migration workstream after Budget, since all required Core tables already exist.
5. Add loading skeletons to Analyze pages when convenient (low effort, high perceived quality).

## Overall Readiness Score: **88 / 100**

| Category | Score | Weight-limiting factor |
|---|---|---|
| Navigation | 100 | 18/18 pages load |
| Data integrity | 98 | Perfect numeric consistency; 1 source-data anomaly to verify |
| API health | 85 | One failing endpoint (briefing, config issue) |
| Data-source goals | 80 | Accounting still mock vs 100%-Neon target |
| UX / responsive | 90 | Minor loading-state and typography nits |
| Performance | 78 | /api/model cold latency + duplicate fetches |

**Verdict: Release Candidate APPROVED for the Reporting/Control platform**, with the Anthropic key fix as the only pre-release action item. Budget module migration can begin.
