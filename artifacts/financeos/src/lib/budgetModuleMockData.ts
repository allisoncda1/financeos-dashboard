// Budget YTD (Jul-Mar) revenue = $12,400,000, matching the monthly revenue
// budget in budgetMockData.ts. All KPI/table/chart figures below reconcile
// to that single source of truth.
export const BVA_KPIS = [
  { title: "Actual Revenue (YTD)", value: "$12,700,000", variance: "+2.4%", status: "favorable" },
  { title: "Budget Revenue (YTD)", value: "$12,400,000", variance: "0.0%", status: "neutral" },
  { title: "Revenue Variance", value: "$300,000", variance: "+2.4%", status: "favorable" },
  { title: "Expense Variance", value: "($280,000)", variance: "-2.8%", status: "unfavorable" },
];

export const BVA_TABLE = [
  { category: "Revenue", actual: 12700000, budget: 12400000, variance: 300000, variancePct: 2.4, status: "favorable" },
  { category: "COGS", actual: 4850000, budget: 4600000, variance: -250000, variancePct: -5.4, status: "unfavorable" },
  { category: "Gross Profit", actual: 7850000, budget: 7800000, variance: 50000, variancePct: 0.6, status: "favorable" },
  { category: "Sales & Marketing", actual: 2450000, budget: 2500000, variance: 50000, variancePct: 2.0, status: "favorable" },
  { category: "G&A", actual: 1550000, budget: 1450000, variance: -100000, variancePct: -6.9, status: "unfavorable" },
  { category: "Product / Tech", actual: 1200000, budget: 1220000, variance: 20000, variancePct: 1.6, status: "favorable" },
  { category: "Other Expenses", actual: 240000, budget: 240000, variance: 0, variancePct: 0.0, status: "neutral" },
  { category: "Net Income", actual: 2410000, budget: 2390000, variance: 20000, variancePct: 0.8, status: "favorable" },
];

export const BVA_CHART = [
  { month: "Jul", actual: 1240000, budget: 1200000 },
  { month: "Aug", actual: 1300000, budget: 1250000 },
  { month: "Sep", actual: 1320000, budget: 1300000 },
  { month: "Oct", actual: 1380000, budget: 1350000 },
  { month: "Nov", actual: 1440000, budget: 1400000 },
  { month: "Dec", actual: 1520000, budget: 1500000 },
  { month: "Jan", actual: 1500000, budget: 1450000 },
  { month: "Feb", actual: 1430000, budget: 1400000 },
  { month: "Mar", actual: 1570000, budget: 1550000 },
];

export const DEPARTMENTS_DATA = [
  { name: "Sales & Marketing", owner: "Sarah Jenkins", budget: 3480000, actual: 2450000, variance: 50000, status: "favorable" },
  { name: "G&A", owner: "Michael Chang", budget: 2088000, actual: 1550000, variance: -100000, status: "unfavorable" },
  { name: "Product / Tech", owner: "David Kim", budget: 1740000, actual: 1200000, variance: 20000, status: "favorable" },
  { name: "Operations", owner: "Elena Rostova", budget: 1100000, actual: 850000, variance: 15000, status: "favorable" },
];

export const VERSIONS_DATA = [
  { id: "v4", name: "FY26 Working Draft", fy: "FY2026", createdBy: "Allison Fabbri", lastUpdated: "Today, 10:45 AM", status: "Draft" },
  { id: "v3", name: "FY26 Base Plan", fy: "FY2026", createdBy: "Allison Fabbri", lastUpdated: "2 days ago", status: "Current" },
  { id: "v2", name: "FY25 Final Approved", fy: "FY2025", createdBy: "John Smith", lastUpdated: "Jun 15, 2025", status: "Approved" },
  { id: "v1", name: "FY25 Scenario B (Downside)", fy: "FY2025", createdBy: "John Smith", lastUpdated: "May 20, 2025", status: "Archived" },
];

export const ASSUMPTIONS_DATA = [
  { id: 1, assumption: "Revenue Growth", value: "+12.5% YoY", category: "Revenue", owner: "Sales VP", confidence: "High", notes: "Based on Q3 pipeline" },
  { id: 2, assumption: "COGS % of Rev", value: "38.0%", category: "COGS", owner: "Operations", confidence: "Medium", notes: "Dependent on vendor renegotiation" },
  { id: 3, assumption: "Payroll Growth", value: "+4.0%", category: "G&A", owner: "HR", confidence: "High", notes: "Annual standard increase" },
  { id: 4, assumption: "Software Optimization", value: "-$120k", category: "Product / Tech", owner: "CTO", confidence: "Low", notes: "Pending audit of SaaS tools" },
  { id: 5, assumption: "Marketing Spend", value: "20.0% of Rev", category: "Sales & Marketing", owner: "CMO", confidence: "High", notes: "Locked in budget" },
];

export const REPORTS_DATA = [
  { id: 1, title: "Budget Summary", description: "High-level overview of total revenue, expenses, and net income." },
  { id: 2, title: "Budget vs Actual", description: "Detailed variance analysis across all P&L categories." },
  { id: 3, title: "Department Budget", description: "Breakdown of spend vs budget grouped by department and owner." },
  { id: 4, title: "Budget Assumptions", description: "Log of all driving metrics, growth rates, and dependencies." },
  { id: 5, title: "Board Budget Pack", description: "Consolidated executive presentation ready for board review." },
];
