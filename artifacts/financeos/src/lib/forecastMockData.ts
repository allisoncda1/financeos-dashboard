import { DollarSign, TrendingUp, Wallet, Landmark, Percent } from "lucide-react";
import type { ComponentType } from "react";
import { getEntity } from "@/lib/entities";

type LucideIcon = ComponentType<{ className?: string }>;

// KPI cards ------------------------------------------------------------------

export const FORECAST_KPIS: {
  label: string;
  value: string;
  sub: string;
  subTone: "up" | "down" | "neutral";
  icon: LucideIcon;
  iconBg: string;
  spark: number[];
  sparkColor: string;
}[] = [
  { label: "Forecasted Revenue", value: "$18.4M", sub: "-8.2% vs Budget", subTone: "down", icon: DollarSign, iconBg: "#10B981", spark: [64, 60, 66, 58, 62, 55, 60, 52, 57, 50, 54, 48], sparkColor: "#10B981" },
  { label: "Forecasted Net Income", value: "$2.2M", sub: "-26.7% vs Budget", subTone: "down", icon: TrendingUp, iconBg: "#3B82F6", spark: [40, 44, 38, 42, 36, 40, 33, 37, 31, 34, 29, 27], sparkColor: "#3B82F6" },
  { label: "Free Cash Flow", value: "$1.6M", sub: "+5.4% vs Budget", subTone: "up", icon: Wallet, iconBg: "#10B981", spark: [22, 25, 24, 28, 26, 30, 29, 33, 31, 35, 34, 38], sparkColor: "#10B981" },
  { label: "Cash Balance (EoY)", value: "$4.8M", sub: "Runway: 5.2 months", subTone: "neutral", icon: Landmark, iconBg: "#8B5CF6", spark: [50, 48, 52, 49, 53, 50, 55, 52, 56, 53, 57, 55], sparkColor: "#8B5CF6" },
  { label: "Gross Margin", value: "61.2%", sub: "-2.1 pts vs Budget", subTone: "down", icon: Percent, iconBg: "#F59E0B", spark: [66, 65, 66, 64, 65, 63, 64, 62, 63, 61, 62, 61], sparkColor: "#F59E0B" },
];

// Forecast vs Budget (Revenue) ------------------------------------------------
// Jul-Dec are actual months; Jan-Jun are forecast months.

export const FORECAST_VS_BUDGET: {
  month: string;
  budget: number;
  actual: number | null;
  forecast: number | null;
}[] = [
  { month: "Jul", budget: 1550000, actual: 1480000, forecast: null },
  { month: "Aug", budget: 1600000, actual: 1620000, forecast: null },
  { month: "Sep", budget: 1650000, actual: 1710000, forecast: null },
  { month: "Oct", budget: 1700000, actual: 1590000, forecast: null },
  { month: "Nov", budget: 1720000, actual: 1810000, forecast: null },
  { month: "Dec", budget: 1780000, actual: 1930000, forecast: null },
  { month: "Jan", budget: 1650000, actual: null, forecast: 1520000 },
  { month: "Feb", budget: 1680000, actual: null, forecast: 1490000 },
  { month: "Mar", budget: 1720000, actual: null, forecast: 1540000 },
  { month: "Apr", budget: 1750000, actual: null, forecast: 1500000 },
  { month: "May", budget: 1780000, actual: null, forecast: 1470000 },
  { month: "Jun", budget: 1820000, actual: null, forecast: 1450000 },
];

export const ACTUAL_MONTHS_COUNT = 6; // Jul-Dec actual, Jan-Jun forecast

// Forecast Summary (FY2026) -----------------------------------------------------

export const FORECAST_SUMMARY: {
  metric: string;
  budget: string;
  forecast: string;
  variance: string;
  variancePct: string;
  tone: "positive" | "negative" | "neutral";
}[] = [
  { metric: "Revenue", budget: "$20.0M", forecast: "$18.4M", variance: "-$1.6M", variancePct: "-8.2%", tone: "negative" },
  { metric: "Gross Profit", budget: "$12.3M", forecast: "$11.3M", variance: "-$1.0M", variancePct: "-8.1%", tone: "negative" },
  { metric: "Gross Margin", budget: "63.3%", forecast: "61.2%", variance: "-2.1 pp", variancePct: "—", tone: "negative" },
  { metric: "Operating Expenses", budget: "$8.7M", forecast: "$9.4M", variance: "+$0.7M", variancePct: "+8.0%", tone: "negative" },
  { metric: "Operating Income", budget: "$3.6M", forecast: "$1.9M", variance: "-$1.7M", variancePct: "-47.2%", tone: "negative" },
  { metric: "Net Income", budget: "$3.0M", forecast: "$2.2M", variance: "-$0.8M", variancePct: "-26.7%", tone: "negative" },
  { metric: "Free Cash Flow", budget: "$1.6M", forecast: "$1.6M", variance: "+$0.1M", variancePct: "+5.4%", tone: "positive" },
];

// Key Forecast Drivers -----------------------------------------------------------

export const FORECAST_DRIVERS: {
  id: string;
  driver: string;
  impact: number;
  vsBudget: string;
  trend: number[];
  trendColor: string;
  comment: string;
  color: string;
}[] = [
  { id: "d-1", driver: "Revenue", impact: -1250000, vsBudget: "-8.2%", trend: [60, 58, 55, 56, 52, 50, 47], trendColor: "#EF4444", comment: "Lower sales pipeline and churn", color: "#10B981" },
  { id: "d-2", driver: "COGS", impact: -320000, vsBudget: "+3.1%", trend: [40, 42, 41, 44, 45, 47, 48], trendColor: "#EF4444", comment: "Higher vendor costs", color: "#F59E0B" },
  { id: "d-3", driver: "Marketing Expenses", impact: -180000, vsBudget: "+14.2%", trend: [30, 33, 32, 36, 38, 41, 44], trendColor: "#EF4444", comment: "Increased paid acquisition", color: "#8B5CF6" },
  { id: "d-4", driver: "Payroll", impact: -120000, vsBudget: "+4.8%", trend: [50, 51, 52, 52, 54, 55, 56], trendColor: "#EF4444", comment: "New hires and salary increases", color: "#3B82F6" },
  { id: "d-5", driver: "Other Income", impact: 90000, vsBudget: "+10.0%", trend: [20, 22, 24, 23, 26, 28, 30], trendColor: "#10B981", comment: "Interest income higher than plan", color: "#67E8F9" },
];

// Cash Flow Forecast ---------------------------------------------------------------

export const CASH_FLOW_FORECAST: {
  month: string;
  operating: number;
  investing: number;
  financing: number;
  endingBalance: number;
  isActual: boolean;
}[] = [
  { month: "Jul", operating: 420000, investing: -150000, financing: -80000, endingBalance: 3900000, isActual: true },
  { month: "Aug", operating: 510000, investing: -90000, financing: -80000, endingBalance: 4240000, isActual: true },
  { month: "Sep", operating: 460000, investing: -220000, financing: -80000, endingBalance: 4400000, isActual: true },
  { month: "Oct", operating: 380000, investing: -110000, financing: -80000, endingBalance: 4590000, isActual: true },
  { month: "Nov", operating: 540000, investing: -130000, financing: -80000, endingBalance: 4920000, isActual: true },
  { month: "Dec", operating: 620000, investing: -160000, financing: -80000, endingBalance: 5300000, isActual: true },
  { month: "Jan", operating: 350000, investing: -120000, financing: -80000, endingBalance: 5450000, isActual: false },
  { month: "Feb", operating: 320000, investing: -100000, financing: -80000, endingBalance: 5590000, isActual: false },
  { month: "Mar", operating: 360000, investing: -140000, financing: -80000, endingBalance: 5730000, isActual: false },
  { month: "Apr", operating: 330000, investing: -110000, financing: -80000, endingBalance: 5870000, isActual: false },
  { month: "May", operating: 300000, investing: -130000, financing: -380000, endingBalance: 5660000, isActual: false },
  { month: "Jun", operating: 310000, investing: -690000, financing: -480000, endingBalance: 4800000, isActual: false },
];

// AI Insight ----------------------------------------------------------------------

export const FORECAST_AI_INSIGHT =
  "At current trends, we project a $1.6M revenue shortfall vs budget by year-end, primarily driven by CarDealer.ai and TopMrktr performance.";

// Placeholder page data --------------------------------------------------------------

export const REVENUE_FORECAST_BY_COMPANY = [
  { id: "rf-1", slug: "CarDealer_ai" as const, company: getEntity("CarDealer_ai").displayName, budget: 6400000, forecast: 5450000, variance: -950000, variancePct: "-14.8%" },
  { id: "rf-2", slug: "T3_Marketing" as const, company: getEntity("T3_Marketing").displayName, budget: 8200000, forecast: 8050000, variance: -150000, variancePct: "-1.8%" },
  { id: "rf-3", slug: "TopMrktr" as const, company: getEntity("TopMrktr").displayName, budget: 3600000, forecast: 3100000, variance: -500000, variancePct: "-13.9%" },
  { id: "rf-4", slug: "Smile_More" as const, company: getEntity("Smile_More").displayName, budget: 1800000, forecast: 1800000, variance: 0, variancePct: "0.0%" },
];

export const PNL_FORECAST_LINES = [
  { id: "pnl-1", line: "Revenue", budget: 20000000, forecast: 18400000, variance: -1600000, tone: "negative" },
  { id: "pnl-2", line: "Cost of Goods Sold", budget: 7700000, forecast: 7100000, variance: 600000, tone: "positive" },
  { id: "pnl-3", line: "Gross Profit", budget: 12300000, forecast: 11300000, variance: -1000000, tone: "negative" },
  { id: "pnl-4", line: "Payroll & Benefits", budget: 5200000, forecast: 5450000, variance: -250000, tone: "negative" },
  { id: "pnl-5", line: "Marketing", budget: 1300000, forecast: 1480000, variance: -180000, tone: "negative" },
  { id: "pnl-6", line: "G&A", budget: 2200000, forecast: 2470000, variance: -270000, tone: "negative" },
  { id: "pnl-7", line: "Operating Income", budget: 3600000, forecast: 1900000, variance: -1700000, tone: "negative" },
  { id: "pnl-8", line: "Other Income", budget: 900000, forecast: 990000, variance: 90000, tone: "positive" },
  { id: "pnl-9", line: "Net Income", budget: 3000000, forecast: 2200000, variance: -800000, tone: "negative" },
];

export const BALANCE_SHEET_FORECAST = [
  { id: "bs-1", line: "Cash & Equivalents", current: 5300000, eoy: 4800000 },
  { id: "bs-2", line: "Accounts Receivable", current: 2100000, eoy: 2350000 },
  { id: "bs-3", line: "Total Assets", current: 11200000, eoy: 11450000 },
  { id: "bs-4", line: "Accounts Payable", current: 980000, eoy: 1050000 },
  { id: "bs-5", line: "Total Liabilities", current: 3400000, eoy: 3250000 },
  { id: "bs-6", line: "Total Equity", current: 7800000, eoy: 8200000 },
];

export const FORECAST_SCENARIOS = [
  { id: "sc-1", name: "Base Case", revenue: 18400000, netIncome: 2200000, cashEoy: 4800000, status: "Active" },
  { id: "sc-2", name: "Upside — Pipeline Recovery", revenue: 19600000, netIncome: 2900000, cashEoy: 5400000, status: "Draft" },
  { id: "sc-3", name: "Downside — Churn Acceleration", revenue: 17100000, netIncome: 1300000, cashEoy: 3900000, status: "Draft" },
  { id: "sc-4", name: "Cost Reduction Plan", revenue: 18400000, netIncome: 2750000, cashEoy: 5200000, status: "Draft" },
];

export const FORECAST_ASSUMPTIONS = [
  { id: "as-1", driver: "New MRR growth", value: "4.2% / month", basis: "Trailing 3-month average", updated: "Jul 1, 2026" },
  { id: "as-2", driver: "Churn rate", value: "2.8% / month", basis: "Trailing 6-month average", updated: "Jul 1, 2026" },
  { id: "as-3", driver: "COGS % of revenue", value: "38.8%", basis: "Vendor contracts + trend", updated: "Jun 15, 2026" },
  { id: "as-4", driver: "Headcount plan", value: "+6 hires H2", basis: "Approved hiring plan", updated: "Jun 20, 2026" },
  { id: "as-5", driver: "Marketing spend", value: "$123K / month", basis: "Paid acquisition plan", updated: "Jul 1, 2026" },
];

export const FORECAST_REPORTS = [
  { id: "fr-1", name: "Forecast vs Budget Summary", description: "Full-year variance analysis across all P&L lines", lastRun: "Jul 5, 2026" },
  { id: "fr-2", name: "13-Week Cash Flow", description: "Weekly cash flow projection with runway analysis", lastRun: "Jul 7, 2026" },
  { id: "fr-3", name: "Scenario Comparison", description: "Side-by-side comparison of active forecast scenarios", lastRun: "Jun 30, 2026" },
  { id: "fr-4", name: "Driver Sensitivity", description: "Net income sensitivity to key driver changes", lastRun: "Jun 28, 2026" },
];
