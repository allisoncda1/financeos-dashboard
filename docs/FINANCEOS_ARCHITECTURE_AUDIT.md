# FinanceOS — Architecture Audit & Development Roadmap

**Date:** July 8, 2026
**Scope:** Full application inventory — no code was modified.
**Reference implementation (frozen):** Reporting module.

---

## 1. Application Overview

- **Frontend:** `artifacts/financeos` — React + Vite SPA, wouter routing, Tailwind + shadcn/ui, Recharts.
- **Backend:** `artifacts/api-server` — Express on port 8080.
- **Databases:**
  - **Neon Core** (`CORE_DATABASE_URL`, read-only): all real financial data (snapshots, periods, AR/AP, banking, validation).
  - **Operational DB** (`DATABASE_URL`, writable): sessions, `metric_snapshots`.
- **Entity registry:** `src/lib/entities.ts` is the single source of truth for the 4 companies (CarDealer.ai, T3 Marketing, TopMrktr, Smile More) — names, colors, logos, ordering. All modules consume it.

---

## 2. Module Inventory

### 2.1 Reporting (FROZEN — reference implementation)

Covers Portfolio, Operations, Analyze, Entity, Reports, and Control. Uses `Sidebar.tsx` with workspace switcher (Portfolio Overview / Agency Views / Entities).

| Route | Purpose | Status | Data | Endpoints | Key components |
|---|---|---|---|---|---|
| `/` | Portfolio executive briefing + entity health | **Full** | Neon (real) | `/api/model`, `/api/briefing`, `/api/pipeline/status` | AIBriefingPanel, PortfolioKpiStrip, EntityCard |
| `/home` | Module launcher | **Full** | static | — | FinanceOSLogo |
| `/login` | Authentication | **Full** | real | `/api/auth/login` | LoginForm, AuthProvider |
| `/operations` | Alerts/anomaly inbox | **Full** | Neon (real) | `/api/alerts`, `/api/model` | OperationsInbox |
| `/reports` | Report Center (PDF/Excel/HTML generation) | **Full** | real | `/api/reports`, `/api/reports/generate` | useReportGenerator, EntityLogo |
| `/analyze/performance` | Entity benchmarking | **Full** | Neon | `/api/model`, `/api/model/:slug/financials` | Spark, HBar, PortfolioChart |
| `/analyze/consolidated` | Consolidated P&L/BS | **Full** | Neon | `/api/model`, `/api/model/:slug/financials` | EntityLogo, formatters |
| `/analyze/cashflow` | Aggregate cash + AR/AP | **Full** | Neon | `/api/model`, `/api/model/:slug/banking` | — |
| `/analyze/history` | Period comparisons (YTD vs PY) | **Full** | Neon + operational | `/api/model/:slug/history`, `/api/model/history/snapshots` | CompareRow |
| `/entity/:slug` | Single-entity dashboard | **Full** | Neon | `/api/model`, `.../financials`, `/api/alerts` | EntityHeader, ProfitChart, CompanyHealth |
| `/entity/:slug/financials` | P&L / BS / Cash flow | **Full** | Neon | `.../financials` | PageHeader, TabSwitcher, BSCard |
| `/entity/:slug/customers` | AR aging | **Full** | Neon | `.../customers` | AgingTable |
| `/entity/:slug/vendors` | AP aging | **Full** | Neon | `.../vendors` | AgingTable |
| `/entity/:slug/banking` | Accounts + transactions | **Full** | Neon | `.../banking` | TabSwitcher, AgingTable |
| `/entity/:slug/reports` | Entity-scoped reports | **Full** | real | `/api/reports` | ReportTemplates |

### 2.2 Control / Validation

| Route | Purpose | Status | Data | Endpoints |
|---|---|---|---|---|
| `/control/integrity` | Pipeline health & freshness audit | **Full** | Neon | `/api/model` |
| `/control/validation` | Per-entity/per-rule validation matrix | **Full** | Neon | `/api/validation/matrix` |
| `/control/settings` | AI provider + workspace config | **Partial** (some read-only/system config surface) | real | `/api/ai/status`, `/api/auth/me` |

### 2.3 Budget

Layout: `BudgetLayout` (dark green `BudgetSidebar`, `CompanySelectItems`, `BudgetTabs` on dashboard). **100% mock data** (`budgetMockData.ts`, `budgetModuleMockData.ts`).

| Route | Purpose | Status |
|---|---|---|
| `/budget` | Budget overview (KPIs, charts, monthly table) | **Full UI** |
| `/budget/pnl` | P&L budget detail (quarterly) | **Full UI** |
| `/budget/cash-flow` | Cash flow budget detail | **Full UI** |
| `/budget/balance-sheet` | Balance sheet budget detail | **Full UI** |
| `/budget/builder` | Line-by-line budget editor | **Full UI** (edits not persisted) |
| `/budget/budget-vs-actual` | Variance analysis | **Full UI** |
| `/budget/departments` | Department budgets | **Full UI** |
| `/budget/versions` | Version history | **Full UI** |
| `/budget/assumptions` | Budget assumptions | **Full UI** |
| `/budget/reports` | Budget report cards | **Full UI** (View/PDF/Excel buttons not wired) |
| `/budget/settings` | Module configuration | **Full UI** (static) |

Nav items: Dashboard, Budget Builder, Budget vs Actual, Department Budgets, Budget Versions, Assumptions, Reports, Settings.

### 2.4 Forecast

Layout: `ForecastLayout` + `ForecastSidebar` (+ `SidebarCompanyCard`). **100% mock data** (`forecastMockData.ts`).

| Route | Purpose | Status |
|---|---|---|
| `/forecast` | Forecast overview + AI insight card | **Full UI** |
| `/forecast/revenue` | Revenue forecast by entity (with logos) | **Full UI** |
| `/forecast/cash-flow` | Cash flow forecast | **Full UI** |
| `/forecast/pnl` | P&L forecast vs budget | **Full UI** |
| `/forecast/balance-sheet` | Balance sheet projections | **Full UI** |
| `/forecast/scenarios` | Scenario comparison | **Full UI** |
| `/forecast/drivers` | Drivers & assumptions | **Full UI** |
| `/forecast/reports` | Forecast reports | **Full UI** |
| `/forecast/settings` | Model/sync/permissions config | **Full UI** (static) |

Nav items: Overview, Revenue, Cash Flow, P&L, Balance Sheet, Scenarios, Drivers & Assumptions, Reports, Settings.

### 2.5 Commissions

Layout: `CommissionLayout` + flat `CommissionSidebar`. **100% mock data** (`commissionMockData.ts`).

| Route | Purpose | Status |
|---|---|---|
| `/commissions` | Overview dashboard (KPIs, trend chart) | **Full UI** |
| `/commissions/invoices` | Commission-eligible invoices | **Full UI** |
| `/commissions/sales-reps` | Rep profiles | **Full UI** |
| `/commissions/clients` | Commissions by client | **Full UI** |
| `/commissions/plans` | Commission plan definitions | **Full UI** |
| `/commissions/calculations` | Calculation run audit log | **Full UI** |
| `/commissions/payouts` | Payout management | **Full UI** |
| `/commissions/reports` | Commission analytics | **Full UI** |
| `/commissions/settings` | Calculation/payout/permission settings | **Full UI** (static) |

### 2.6 Accounting

Layout: `AccountingLayout` + `AccountingSidebar` with collapsible NavGroups. **100% mock data** (`accountingMockData.ts`).

| Route | Purpose | Status |
|---|---|---|
| `/accounting` | Workspace: overview + task queue + AI suggestions | **Full UI** |
| `/accounting/invoices` (+ `/draft`, `/sent`, `/paid`, `/recurring`) | Invoice management (filter prop drives sub-views) | **Full UI** |
| `/accounting/transactions` (+ `/uncategorized`, `/categorized`, `/rules`) | Bank transaction categorization | **Full UI** |
| `/accounting/reconciliation` (+ `/accounts`, `/match-center`, `/history`) | Bank reconciliation | **Full UI** |
| `/accounting/customers` | Customer ledger | **Full UI** |
| `/accounting/vendors` | Vendor ledger | **Full UI** |
| `/accounting/chart-of-accounts` | GL account structure | **Full UI** |
| `/accounting/rules` | Categorization rules | **Full UI** |
| `/accounting/journal-entries` | Manual GL entries | **Full UI** |
| `/accounting/fixed-assets` | Fixed assets & depreciation | **Full UI** |
| `/accounting/month-end-close` | Close checklist | **Full UI** |
| `/accounting/settings` | Company info, bank connections, automation | **Full UI** |

Submenus: **Invoices** (Draft/Sent/Paid/Recurring), **Bank Transactions** (Uncategorized/Categorized/Rules), **Reconciliation** (Accounts/Match Center/History).

### 2.7 Administration / Settings

There is **no standalone Administration module**. Settings are distributed:
- `/control/settings` — system-level (AI provider, workspace) — *partial*
- Per-module settings pages (Budget, Forecast, Commissions, Accounting) — static UI, not persisted.

**Gap:** no user management, roles/permissions admin, entity management, or integration management UI. Role labels exist in sidebars (`admin`, `cfo`, `controller`, …) but there is no admin surface to manage them.

### Duplicated / unused pages

- **No orphaned page files** — every file under `src/pages/**` is routed in `App.tsx`.
- **No duplicated pages.** Overlaps are intentional scoping, not duplication:
  - `accounting/customers|vendors` (mock ledgers) vs `entity/:slug/customers|vendors` (real Neon AR/AP aging) — will need consolidation when Accounting goes live.
  - Reports surfaces exist in 4 places (`/reports`, `/entity/:slug/reports`, `/budget/reports`, `/forecast/reports`, `/commissions/reports`); only the first two are wired to the real report engine.
- Minor duplicate *logic*: currency formatters re-implemented locally in several Budget/Forecast pages.

---

## 3. Backend: Endpoints, Databases, Tables

| Method | Path | DB | Tables |
|---|---|---|---|
| GET | `/api/model` | Neon | portfolio_snapshots, entity_snapshots, financial_periods, validation_results, sync_runs, entities |
| GET | `/api/model/:slug/financials` | Neon | financial_periods, entities |
| GET | `/api/model/:slug/customers` | Neon | customers, invoices, entities |
| GET | `/api/model/:slug/vendors` | Neon | vendors, bills, entities |
| GET | `/api/model/:slug/banking` | Neon | accounts, transactions, entities |
| GET | `/api/model/:slug/history` | Neon | financial_periods, entities |
| GET | `/api/model/history/snapshots` | Operational | metric_snapshots |
| GET | `/api/alerts` | Neon | alerts |
| GET | `/api/validation/matrix` | Neon | validation_results, entities |
| GET | `/api/briefing` | Neon | aggregated financials (AI context) |
| GET | `/api/pipeline/status` | Neon | sync_runs, portfolio_snapshots, entity_snapshots |
| GET | `/api/reports` | — | static template catalog |
| POST | `/api/reports/generate` | Neon | varies by report |
| POST | `/api/auth/login` (+ `/me`) | Operational | sessions |
| GET | `/api/ai/status` | — | — |

**Schema (lib/db):**
- Neon Core: `entities`, `portfolio_snapshots`, `entity_snapshots`, `financial_periods`, `validation_results`, `sync_runs`, `accounts`, `transactions`, `invoices`, `bills`, `customers`, `vendors`, `alerts`
- Operational: `metric_snapshots`, `sessions`

---

## 4. Reusable Asset Catalog

### Shared components (`src/components/shared/`)
`CompanySelectItems` (registry-backed entity dropdown w/ logos), `SidebarCompanyCard`, `PageHeader`, `TabSwitcher`, `AgingTable`, `SparklineChart`, `DataSourceBanner` (live/cache/mock indicator).

### Module UI kit — `AccountingUI.tsx` (de-facto design system for the new modules)
`Card`, `DataTable`, `Td`, `Pill`, `MiniKpi`, `PrimaryButton`, `SecondaryButton`, `EmptyState`. Used across Accounting, Commissions, Forecast, Budget.

### Charts (Recharts wrappers)
- Shared: `SparklineChart`
- Reporting: `ProfitChart`, `CashFlowChart`, `PortfolioChart`
- Budget: `BudgetCategoryChart`, `BudgetVsPriorYearChart`
- Forecast: `CashFlowForecastChart`, `ForecastVsBudgetChart`
- Commissions: `CommissionTrendChart`, `CommissionRepChart`

### Tables
`DataTable` (AccountingUI), `AgingTable`, `BudgetTable` (monthly grid), `BudgetDetailTable` (quarterly grid), `ForecastDriversTable`, `TransactionTable`.

### Layouts
Global: `AppShell`, `GlobalHeader`, `Sidebar`, `TopBar`, `CommandBar`.
Per module: `BudgetLayout`, `ForecastLayout`, `CommissionLayout`, `AccountingLayout` (all follow the same header + sidebar + company-selector pattern).

### Filters
`CompanySelectItems` (entity filter everywhere), invoice/transaction/reconciliation sub-view filters via route props, `TabSwitcher`, `BudgetTabs`.

### Dialogs
shadcn `dialog`, `alert-dialog`, `sheet`, `drawer`, `command` (CommandBar) are installed; module pages use few custom dialogs so far (mostly sidebar profile popovers).

### Hooks & API helpers
- `useAuth` (`lib/auth.tsx`) — session state, login/logout
- `useApi` / `useTrackedFetch` (`hooks/useApi.ts`) — data fetching + DataSourceBanner reporting
- `useEntitySelection` (`lib/entity-context.tsx`) — global entity state
- `api.ts` — fetch wrapper with 401 handling
- Endpoint hooks: `useDashboardData`, `useEntityFinancials`, `useEntityCustomers`, `useEntityVendors`, `useEntityBanking`, `useBriefing`, `useAlerts`, `useValidationMatrix`, `useReportTemplates`, `useReportGenerator`, `usePipelineStatus`
- Entity registry: `lib/entities.ts` (`getEntity`, `ENTITY_META`, `PORTFOLIO_META`, `resolveLogoSource`) + `EntityLogo` component

### Dependency map (who consumes what)

```
lib/entities.ts (registry) ──────────► ALL modules (selectors, logos, names, colors)
AccountingUI kit ────────────────────► Accounting, Commissions, Forecast, Budget
shared/ (PageHeader, AgingTable…) ───► Reporting(entity), Forecast, Budget
useApi + endpoint hooks ─────────────► Reporting, Analyze, Entity, Control ONLY
mock data libs (lib/*MockData.ts) ───► Budget, Forecast, Commissions, Accounting ONLY
api-server ──► Neon Core (reads) + Operational DB (sessions, snapshots)
```

---

## 5. Navigation Tree

```
FinanceOS
├── Home (/home) — module launcher
├── Reporting  [FROZEN]
│   ├── Portfolio Overview (/)
│   ├── Operations Inbox (/operations)
│   ├── Analyze
│   │   ├── Performance (/analyze/performance)
│   │   ├── Consolidated (/analyze/consolidated)
│   │   ├── Cash Flow (/analyze/cashflow)
│   │   └── History (/analyze/history)
│   ├── Report Center (/reports)
│   ├── Entity Views (/entity/:slug)
│   │   ├── Dashboard
│   │   ├── Financials
│   │   ├── Customers (AR)
│   │   ├── Vendors (AP)
│   │   ├── Banking
│   │   └── Reports
│   └── Control
│       ├── Integrity (/control/integrity)
│       ├── Validation (/control/validation)
│       └── Settings (/control/settings)
├── Budget
│   ├── Dashboard (/budget) [tabs: Summary | P&L | Cash Flow | Balance Sheet]
│   ├── Budget Builder (/budget/builder)
│   ├── Budget vs Actual (/budget/budget-vs-actual)
│   ├── Department Budgets (/budget/departments)
│   ├── Budget Versions (/budget/versions)
│   ├── Assumptions (/budget/assumptions)
│   ├── Reports (/budget/reports)
│   └── Settings (/budget/settings)
├── Forecast
│   ├── Overview (/forecast)
│   ├── Revenue Forecast (/forecast/revenue)
│   ├── Cash Flow Forecast (/forecast/cash-flow)
│   ├── P&L Forecast (/forecast/pnl)
│   ├── Balance Sheet Forecast (/forecast/balance-sheet)
│   ├── Scenarios (/forecast/scenarios)
│   ├── Drivers & Assumptions (/forecast/drivers)
│   ├── Reports (/forecast/reports)
│   └── Settings (/forecast/settings)
├── Commissions
│   ├── Overview (/commissions)
│   ├── Invoices (/commissions/invoices)
│   ├── Sales Reps (/commissions/sales-reps)
│   ├── Clients (/commissions/clients)
│   ├── Commission Plans (/commissions/plans)
│   ├── Calculations (/commissions/calculations)
│   ├── Payouts (/commissions/payouts)
│   ├── Reports (/commissions/reports)
│   └── Settings (/commissions/settings)
└── Accounting
    ├── Workspace (/accounting)
    ├── Invoices ▸ Draft | Sent | Paid | Recurring
    ├── Bank Transactions ▸ Uncategorized | Categorized | Rules
    ├── Reconciliation ▸ Accounts | Match Center | History
    ├── Customers (/accounting/customers)
    ├── Vendors (/accounting/vendors)
    ├── Chart of Accounts (/accounting/chart-of-accounts)
    ├── Categorization Rules (/accounting/rules)
    ├── Journal Entries (/accounting/journal-entries)
    ├── Fixed Assets (/accounting/fixed-assets)
    ├── Month-End Close (/accounting/month-end-close)
    └── Settings (/accounting/settings)
```

No dead links, no empty routes, no "coming soon" pages remain.

---

## 6. Executive Summary & Roadmap

### 1. Production-ready (real Neon data, end-to-end)
- **Reporting**: Portfolio, Operations, Analyze (all 4), Entity views (all 6), Report Center (real generation/download)
- **Control**: Integrity, Validation
- **Auth/session** infrastructure

### 2. Nearly complete
- **Control → Settings** — works but partial (AI status + profile; workspace config surface is thin).
- **Historical snapshots** (`metric_snapshots`) capture — wired but young.

### 3. UI only (complete screens, mock data, no persistence)
- **Budget** — all 11 routes
- **Forecast** — all 9 routes
- **Commissions** — all 9 routes
- **Accounting** — all 12+ routes
- All 4 module Settings pages (display-only)

### 4. Completely missing
- **Administration module**: user management, role/permission admin, entity onboarding, integration management, audit log.
- **Write APIs**: there are zero POST/PUT endpoints for budgets, forecasts, commissions, or accounting objects — the api-server is read-only against Neon Core.
- **Persistence layer for new modules**: no tables for budgets, forecast scenarios, commission plans/runs/payouts, journal entries, close checklists, categorization rules.
- Report generation wiring for Budget/Forecast/Commissions report pages (buttons are visual only).

### 5. Recommended build order
1. **Budget backend** — highest leverage: schema (budgets, budget_lines, versions, assumptions) in the operational DB + CRUD API; wire Budget vs Actual against real `financial_periods` actuals from Neon (read-only join is already possible today).
2. **Forecast backend** — reuses Budget patterns; scenarios/drivers tables + variance vs real actuals.
3. **Commissions backend** — invoices exist in Neon Core (`invoices`), so calculation runs can consume real revenue data; plans/runs/payouts go in the operational DB.
4. **Accounting integration** — largest scope; decide whether Accounting is a viewer over Neon Core (invoices, transactions, accounts already exist there) or a full ledger; consolidate with entity AR/AP pages.
5. **Administration module** — users/roles/entity management; unlocks multi-user rollout.

### 6. Neon tables already used, by module
| Module | Neon Core tables in use |
|---|---|
| Reporting (Portfolio/Analyze/Entity) | portfolio_snapshots, entity_snapshots, financial_periods, entities, customers, invoices, vendors, bills, accounts, transactions, alerts, sync_runs |
| Control | validation_results, sync_runs, entities |
| Budget / Forecast / Commissions / Accounting | **none** (all mock) |

### 7. Modules relying entirely on mock data
**Budget, Forecast, Commissions, Accounting** — every page. Mock files: `budgetMockData.ts`, `budgetModuleMockData.ts`, `forecastMockData.ts`, `commissionMockData.ts`, `accountingMockData.ts`. Notably, Neon Core already contains real `invoices`, `customers`, `vendors`, `bills`, `accounts`, and `transactions` — Accounting and Commissions could consume much of this read-only today without any new pipeline work.
