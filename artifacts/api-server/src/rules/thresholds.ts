/**
 * Rules Engine — configurable numeric thresholds.
 *
 * Single source of truth for every limit used by RULE_REGISTRY. Change a
 * number here to retune alerting across the whole engine — never hardcode
 * a threshold inside a rule's evaluate() function.
 */
export const THRESHOLDS = {
  dso_warning_days: 45,
  dso_critical_days: 60,
  ar_overdue_pct_warning: 20,
  ar_overdue_pct_critical: 35,
  ap_overdue_pct_warning: 25,
  ap_overdue_pct_critical: 40,
  cash_runway_warning_months: 3,
  cash_runway_critical_months: 1.5,
  net_margin_warning_pct: 5,
  net_margin_critical_pct: 0,
  entity_health_warning: 65,
  entity_health_critical: 40,
  anomaly_count_warning: 3,
  revenue_mom_decline_pct: 10,
  customer_concentration_pct: 50,
  vendor_concentration_pct: 50,
  stale_data_days: 2,
};
