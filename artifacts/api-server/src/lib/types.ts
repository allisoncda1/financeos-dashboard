/**
 * Shared TypeScript types — used by both frontend (src/) and backend (server/).
 * These mirror the JSON schemas produced by 08_DATA_MODEL in Google Drive.
 * Do NOT import from lib/types.ts here — this file must be framework-agnostic.
 */

export const ENTITY_SLUGS = [
  "CarDealer_ai",
  "T3_Marketing",
  "TopMrktr",
  "Smile_More",
] as const;

export type EntitySlug = (typeof ENTITY_SLUGS)[number];

export type EntityMetrics = {
  entity: string;
  slug: EntitySlug;
  basis: "Cash" | "Accrual";
  as_of: string;
  pipeline_run: string;
  revenue_ytd: number;
  cogs_ytd: number;
  gross_profit_ytd: number;
  gross_margin_pct: number;
  opex_ytd: number;
  net_income_ytd: number;
  net_margin_pct: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
  open_ar: number;
  open_ap: number;
  dso_days: number;
  dpo_days: number;
  cash_on_hand: number;
  ar_overdue_pct: number;
  ap_overdue_pct: number;

  // Company Health Score — injected server-side (lib/health.ts) so every
  // surface renders one authoritative value. Optional here because raw
  // producers (Neon/Drive/mock) build metrics before the score is attached;
  // withHealth() populates these before the data leaves the API.
  health_score?: number;
  health_label?: "Excellent" | "Good" | "Needs Attention";
};

export type Anomaly = {
  rule: string;
  severity: "warning" | "error" | "info";
  description: string;
  amount: number;
  period: string;
};

export type PortfolioSummary = {
  as_of: string;
  pipeline_run: string;
  entities: string[];
  entity_count: number;
  portfolio_revenue_ytd: number;
  portfolio_cogs_ytd: number;
  portfolio_gross_profit_ytd: number;
  portfolio_opex_ytd: number;
  portfolio_net_income_ytd: number;
  portfolio_net_margin_pct: number;
  portfolio_open_ar: number;
  portfolio_open_ap: number;
  portfolio_cash_on_hand: number;
  cash_runway_months: number | null;
};

export type ValidationSummary = {
  run_date: string;
  as_of: string;
  total_checks: number;
  passed: number;
  failed: number;
  all_passed: boolean;
  entities: string[];
  rules_checked: string[];
  rule_count: number;
  entity_count: number;
  /**
   * Per-entity × per-rule pass/fail, keyed entity_slug → rule_id → passed.
   * Present only when the source publishes detailed rule_results (Core);
   * undefined for summary-only sources (Drive/mock), which fall back to
   * summary-count inference in the validation matrix.
   */
  rule_matrix?: Record<string, Record<string, boolean>>;
};

export type DataFreshness = {
  pipeline_run: string;
  data_as_of: string;
  entities_built: number;
  qbo_connection: string;
  phase2_extraction: string;
  model_build: string;
  drive_upload: string;
  snapshot_archived: boolean;
  model_history_archived: boolean;
  latest_trigger?: string | null;
  avg_entity_sync_duration_seconds?: number | null;
  pipeline_uptime_30d_pct?: number | null;
  successful_runs_30d?: number;
  total_runs_30d?: number;
};

export type DashboardData = {
  portfolio: PortfolioSummary;
  validation: ValidationSummary;
  freshness: DataFreshness;
  metrics: Record<EntitySlug, EntityMetrics>;
  anomalies: Record<EntitySlug, Anomaly[]>;
};

export type EntityDefinition = {
  slug: EntitySlug;
  displayName: string;
  shortName: string;
  logo: string | null;
  fallbackInitials: string;
  primaryColor: string;
  accentColor: string;
  accountingBasis: "Cash" | "Accrual";
  companyType: "Agency" | "Internal";
  includedInPortfolio: boolean;
  includedInAgencyView: boolean;
  includedInDefaultConsolidation: boolean;
  defaultCurrency: "USD";
  status: "active" | "inactive" | "onboarding";
  healthThresholds: { green: number; amber: number; red: number };
};

export type ApiResponse<T> = {
  ok: true;
  data: T;
  ts: string;
} | {
  ok: false;
  error: string;
  ts: string;
};

export type AgingBucket = {
  label: string;
  days: string;
  amount: number;
  count: number;
};

export type Customer = {
  name: string;
  balance: number;
  last_payment_date: string;
  dso_days: number;
  status: "current" | "overdue" | "late";
};

export type CustomersData = {
  entity_slug: string;
  as_of: string;
  /** Authoritative open AR total — sourced from the QBO AgedReceivableSummary
   *  via the Python semantic layer. Never derived from summing invoice records. */
  open_ar: number;
  /** Authoritative overdue dollar amount (all non-Current buckets). */
  ar_overdue: number;
  /** Authoritative overdue percentage (ar_overdue / open_ar × 100). */
  ar_overdue_pct: number;
  /** Authoritative aging buckets — sourced from QBO AgedReceivableSummary. */
  aging: AgingBucket[];
  /** Indicates whether aging totals came from the semantic layer snapshot or
   *  fell back to the invoice table (snapshot should always be preferred). */
  aging_source: "snapshot" | "invoices";
  top_customers: Customer[];
  dso_history: number[];
};

export type Vendor = {
  name: string;
  balance: number;
  due_date: string;
  status: "current" | "overdue" | "scheduled";
};

export type VendorsData = {
  entity_slug: string;
  as_of: string;
  open_ap: number;
  aging: AgingBucket[];
  top_vendors: Vendor[];
  ap_history: number[];
};

export type MonthlyPL = {
  month: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  net_income: number;
};

export type BalanceSheet = {
  as_of: string;
  assets: {
    cash: number;
    accounts_receivable: number;
    prepaid_expenses: number;
    equipment_net: number;
    total: number;
  };
  liabilities: {
    accounts_payable: number;
    accrued_liabilities: number;
    deferred_revenue: number;
    notes_payable: number;
    total: number;
  };
  equity: {
    paid_in_capital: number;
    retained_earnings: number;
    total: number;
  };
};

export type CashFlowLine = {
  label: string;
  amount: number;
  is_subtotal: boolean;
};

export type CashFlowSection = {
  name: string;
  lines: CashFlowLine[];
  net_cash: number;
};

export type CashFlowStatement = {
  as_of: string;
  sections: CashFlowSection[];
  net_cash_change: number | null;
  cash_at_end: number | null;
};

/** One selected entity's contribution to the consolidated cash flow. */
export type ConsolidatedCashFlowEntity = {
  slug: EntitySlug;
  entity: string;
  as_of: string;
  operating: number;
  investing: number;
  financing: number;
  net_change: number;
  beginning_cash: number;
  ending_cash: number;
};

/**
 * Portfolio-level statement of cash flows, consolidated across the selected
 * entities from their published (validation_status='passed' AND
 * publication_status='published') Neon rows. ALL summation is performed on the
 * backend; the frontend only renders these totals.
 *
 * `available` is false when NONE of the selected entities has an eligible
 * published statement. `partial` is true when SOME (but not all) selected
 * entities are missing an eligible statement — the totals then cover only the
 * entities in `entities`, and `missing` names the rest. Incompatible period
 * end-dates across the contributing entities also collapse to unavailable
 * rather than summing mismatched periods.
 */
export type ConsolidatedCashFlow = {
  available: boolean;
  partial: boolean;
  as_of: string | null;
  operating: number;
  investing: number;
  financing: number;
  net_change: number;
  beginning_cash: number;
  ending_cash: number;
  entities: ConsolidatedCashFlowEntity[];
  missing: EntitySlug[];
  /** Reason surfaced when available=false (e.g. "no_published_statements",
   * "incompatible_periods"). null when available. */
  reason: string | null;
};

export type FinancialsData = {
  entity_slug: string;
  as_of: string;
  monthly_pl: MonthlyPL[];
  ytd_summary: {
    revenue: number;
    cogs: number;
    gross_profit: number;
    opex: number;
    net_income: number;
  };
  balance_sheet: BalanceSheet;
  cash_flow: CashFlowStatement | null;
};

export type PriorYearBalanceSheetSummary = {
  as_of: string;
  cash: number;
  total_assets: number;
  total_liabilities: number;
  total_equity: number;
};

export type PriorYearHistory = {
  fiscal_year: number;
  monthly_pl: MonthlyPL[];
  summary: {
    revenue: number;
    cogs: number;
    gross_profit: number;
    opex: number;
    net_income: number;
  };
  balance_sheet: PriorYearBalanceSheetSummary | null;
};

export type EntityHistoryData = {
  entity_slug: string;
  prior_years: PriorYearHistory[];
};

export type MetricSnapshot = {
  month: string;
  as_of: string;
  metrics: EntityMetrics;
};

export type MetricSnapshotsData = Record<EntitySlug, MetricSnapshot[]>;

// ─── RC-017: consolidated monthly history (/analyze/history) ─────────────────
// All aggregation and month-over-month math is performed on the backend from
// financial_periods monthly rows. The frontend renders these values verbatim.

export type HistoryStatus =
  | "available"
  | "partial"
  | "unavailable"
  | "incompatible_periods";

/** One consolidated month across the selected entities. */
export type HistoryMonthlyPoint = {
  period: string; // YYYY-MM
  period_start: string; // ISO date
  period_end: string; // ISO date
  revenue: number | null;
  net_income: number | null;
  by_entity: Record<string, { revenue: number | null; net_income: number | null }>;
  /** true when at least one — but not all — selected contributing entities has
   * an authoritative row for this period. The revenue/net_income totals then
   * sum only the entities that reported; the rest are listed in `missing`. */
  partial: boolean;
  /** Slugs of contributing entities that reported a row for this period. */
  contributing: string[];
  /** Slugs of contributing entities that had NO row for this period. */
  missing: string[];
};

/** Month-over-month change, computed server-side (never in the frontend). */
export type HistoryChange = {
  period: string;
  revenue_change: number | null;
  revenue_change_pct: number | null;
  net_income_change: number | null;
  net_income_change_pct: number | null;
};

/** One entity-period snapshot row. */
export type HistorySnapshotRow = {
  entity: string;
  slug: string;
  period: string;
  revenue: number | null;
  net_income: number | null;
};

export type HistoryHealthPoint = { period: string; score: number | null };

export type HistoryResponse = {
  available: boolean;
  status: HistoryStatus;
  entities: string[];
  period_start: string | null;
  period_end: string | null;
  generated_at: string;
  monthly: HistoryMonthlyPoint[];
  changes: HistoryChange[];
  snapshots: HistorySnapshotRow[];
  health_score_history: HistoryHealthPoint[] | null;
  health_score_available: boolean;
  health_score_unavailable_reason?: string;
};

export type BankAccount = {
  id: string;
  name: string;
  institution: string;
  account_type: string;
  last_four: string;
  balance: number;
  color: string;
  reconciled: boolean;
  last_reconciled: string;
  /**
   * Total non-deleted transactions for this account (0 = seed/placeholder).
   * Only populated by the authoritative Neon (source=db) path. Left undefined
   * for the Drive fallback, where no reliable per-bank-account activity source
   * exists — undefined signals the UI to show the account rather than hide it.
   */
  transaction_count?: number;
  /**
   * ISO date of the most recent transaction, or "" when none. Only populated
   * by the authoritative Neon (source=db) path; undefined for Drive fallback.
   */
  last_transaction_date?: string;
};

export type BankTransaction = {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  reconciled: boolean;
};

export type BankingData = {
  entity_slug: string;
  as_of: string;
  total_cash: number;
  reconciliation_status: "clean" | "pending" | "needs_review";
  unreconciled_count: number;
  accounts: BankAccount[];
  transactions: BankTransaction[];
};

// ─── AI CFO Briefing Engine (Sprint 13) ────────────────────────────────────
// Deterministic — no LLM. Every field is computed from live DashboardData.

export type Sentiment = "positive" | "negative" | "neutral";
export type Severity = "high" | "medium" | "low";

export type Highlight = {
  icon: string;
  text: string;
  sentiment: Sentiment;
};

export type Risk = {
  title: string;
  description: string;
  severity: Severity;
  entity: string;
};

export type Opportunity = {
  title: string;
  description: string;
  entity: string;
};

export type Priority = {
  title: string;
  description: string;
  severity: Severity;
  entity: string;
  recommendedAction: string;
  status: "New";
};

export type BriefingResponse = {
  greeting: string;
  executiveSummary: string[];
  highlights: Highlight[];
  priorities: Priority[];
  risks: Risk[];
  opportunities: Opportunity[];
  confidenceScore: number;
  generatedAt: string;
};

// ─── Budget types ─────────────────────────────────────────────────────────────

export type BudgetTargets = {
  revenue: number | null;
  cogs: number | null;
  opex: number | null;
  net_income: number | null;
};

export type BudgetVariance = {
  revenue: number | null;
  cogs: number | null;
  opex: number | null;
  net_income: number | null;
};

export type BudgetVariancePct = {
  revenue: number | null;
  cogs: number | null;
  opex: number | null;
  net_income: number | null;
};

export type BudgetActuals = {
  revenue: number;
  cogs: number;
  opex: number;
  net_income: number;
};

export type BvsAMonth = {
  month: string;           // 'YYYY-MM'
  period_start: string;    // 'YYYY-MM-DD'
  period_end: string;
  budget: BudgetTargets;
  actual: BudgetActuals | null;
  variance: BudgetVariance;
  variance_pct: BudgetVariancePct;
  has_budget: boolean;
  has_actual: boolean;
};

export type BvsAData = {
  entity_slug: EntitySlug;
  year: number;
  months: BvsAMonth[];
  ytd: {
    budget: BudgetTargets;
    actual: BudgetActuals;
    variance: BudgetVariance;
    variance_pct: BudgetVariancePct;
  };
};

export type EntityBudgetMonth = {
  period_start: string;
  period_end: string;
  revenue_target: number | null;
  cogs_target: number | null;
  opex_target: number | null;
  net_income_target: number | null;
};

export type EntityBudget = {
  entity_slug: EntitySlug;
  year: number;
  months: EntityBudgetMonth[];
  annual: {
    revenue_target: number | null;
    cogs_target: number | null;
    opex_target: number | null;
    net_income_target: number | null;
  } | null;
  months_with_budgets: number;
};

export type PortfolioEntityBudget = {
  slug: EntitySlug;
  budget_revenue: number;
  actual_revenue: number;
  budget_net_income: number;
  actual_net_income: number;
  attainment_pct: number | null;
};

export type PortfolioBudget = {
  year: number;
  entity_slugs: EntitySlug[];
  portfolio_budget_revenue: number;
  portfolio_actual_revenue: number;
  portfolio_variance_revenue: number;
  portfolio_attainment_pct: number | null;
  portfolio_budget_net_income: number;
  portfolio_actual_net_income: number;
  entity_budgets: PortfolioEntityBudget[];
  months_with_budgets: number;
  months_without_budgets: number;
};
