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
