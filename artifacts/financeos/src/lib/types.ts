// FinanceOS Dashboard — TypeScript types
//
// These types mirror the JSON schemas produced by extraction/build_model.py
// and stored in Google Shared Drive / FinanceOS / 08_DATA_MODEL.
//
// Source of truth: Google Shared Drive (not this repo).
// Mock data in data/mock/ uses these same shapes for UI development.

// ─── Entity registry ─────────────────────────────────────────────────────────

export const ENTITY_SLUGS = [
  "CarDealer_ai",
  "T3_Marketing",
  "TopMrktr",
  "Smile_More",
] as const;

export type EntitySlug = (typeof ENTITY_SLUGS)[number];

export const ENTITY_CONFIG: Record<
  EntitySlug,
  { name: string; basis: "Cash" | "Accrual"; color: string }
> = {
  CarDealer_ai: { name: "CarDealer.ai", basis: "Accrual", color: "#00d4b8" },
  T3_Marketing: { name: "T3 Marketing", basis: "Cash",    color: "#f59e0b" },
  TopMrktr:     { name: "TopMrktr",     basis: "Accrual", color: "#8b5cf6" },
  Smile_More:   { name: "Smile More",   basis: "Accrual", color: "#3b82f6" },
};

// ─── 08_DATA_MODEL schemas ───────────────────────────────────────────────────

/** 08_DATA_MODEL/entities/{slug}/metrics.json */
export type EntityMetrics = {
  entity: string;
  slug: EntitySlug;
  basis: "Cash" | "Accrual";
  as_of: string;
  pipeline_run: string;

  // Income statement
  revenue_ytd: number;
  cogs_ytd: number;
  gross_profit_ytd: number;
  gross_margin_pct: number;
  opex_ytd: number;
  net_income_ytd: number;
  net_margin_pct: number;

  // Balance sheet
  total_assets: number;
  total_liabilities: number;
  total_equity: number;

  // Working capital
  open_ar: number;
  open_ap: number;
  dso_days: number;
  dpo_days: number;
  cash_on_hand: number;
  ar_overdue_pct: number;
  ap_overdue_pct: number;
};

/** 08_DATA_MODEL/entities/{slug}/anomalies.json — one item per anomaly */
export type Anomaly = {
  rule: string;
  severity: "warning" | "error" | "info";
  description: string;
  amount: number;
  period: string;
};

/** 08_DATA_MODEL/portfolio/summary.json */
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
};

/** 08_DATA_MODEL/validation/validation_summary.json */
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
};

/** 08_DATA_MODEL/audit/data_freshness.json */
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
};

// ─── Sprint 2: Entity sub-page data types ────────────────────────────────────

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
  open_ar: number;
  aging: AgingBucket[];
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
  assets: { cash: number; accounts_receivable: number; prepaid_expenses: number; equipment_net: number; total: number };
  liabilities: { accounts_payable: number; accrued_liabilities: number; deferred_revenue: number; notes_payable: number; total: number };
  equity: { paid_in_capital: number; retained_earnings: number; total: number };
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

export type FinancialsData = {
  entity_slug: string;
  as_of: string;
  monthly_pl: MonthlyPL[];
  ytd_summary: { revenue: number; cogs: number; gross_profit: number; opex: number; net_income: number };
  balance_sheet: BalanceSheet;
  cash_flow?: CashFlowStatement | null;
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

// ─── Aggregated dashboard payload ────────────────────────────────────────────

/** Full data bundle consumed by dashboard components */
export type DashboardData = {
  portfolio: PortfolioSummary;
  validation: ValidationSummary;
  freshness: DataFreshness;
  metrics: Record<EntitySlug, EntityMetrics>;
  anomalies: Record<EntitySlug, Anomaly[]>;
};

// ─── AI CFO Briefing Engine (Sprint 13) ────────────────────────────────────
// Mirrors artifacts/api-server/src/lib/types.ts — deterministic, no LLM.

export type BriefingSentiment = "positive" | "negative" | "neutral";
export type BriefingSeverity = "high" | "medium" | "low";

export type Highlight = {
  icon: string;
  text: string;
  sentiment: BriefingSentiment;
};

export type Risk = {
  title: string;
  description: string;
  severity: BriefingSeverity;
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
  severity: BriefingSeverity;
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

// ─── Rules Engine alerts (Sprint 14) ────────────────────────────────────────
// Mirrors artifacts/api-server/src/rules/evaluator.ts Alert type.

export type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
export type AlertCategory = "receivables" | "payables" | "cash" | "revenue" | "validation" | "portfolio";

export type Alert = {
  id: string;
  ruleId: string;
  entity: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  recommendedAction: string;
  createdAt: string;
  status: "active";
};
