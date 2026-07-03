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
