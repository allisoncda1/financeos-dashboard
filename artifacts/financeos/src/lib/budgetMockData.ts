// MOCK/PLACEHOLDER DATA — to be replaced with Neon/reporting data

export const BUDGET_KPIS = [
  { title: "Total Budgeted Revenue", value: "$17,400,000", change: "+12%", vs: "vs FY2025", type: "revenue" },
  { title: "Total Budgeted Expenses", value: "$14,250,000", change: "+8%", vs: "vs FY2025", type: "expense" },
  { title: "Budgeted Net Income", value: "$3,150,000", change: "+24%", vs: "vs FY2025", type: "income" },
  { title: "Gross Margin", value: "62.1%", change: "+1.2%", vs: "vs FY2025", type: "margin" },
  { title: "Budget Completion", value: "68%", change: "", vs: "Tasks completed", type: "completion" },
];

export const BUDGET_VS_PRIOR_YEAR_DATA = [
  { month: "Jul", fy26: 1200000, fy25: 1100000, variance: 9.1 },
  { month: "Aug", fy26: 1250000, fy25: 1150000, variance: 8.7 },
  { month: "Sep", fy26: 1300000, fy25: 1200000, variance: 8.3 },
  { month: "Oct", fy26: 1350000, fy25: 1250000, variance: 8.0 },
  { month: "Nov", fy26: 1400000, fy25: 1300000, variance: 7.7 },
  { month: "Dec", fy26: 1500000, fy25: 1400000, variance: 7.1 },
  { month: "Jan", fy26: 1450000, fy25: 1350000, variance: 7.4 },
  { month: "Feb", fy26: 1400000, fy25: 1300000, variance: 7.7 },
  { month: "Mar", fy26: 1550000, fy25: 1400000, variance: 10.7 },
  { month: "Apr", fy26: 1600000, fy25: 1450000, variance: 10.3 },
  { month: "May", fy26: 1650000, fy25: 1500000, variance: 10.0 },
  { month: "Jun", fy26: 1750000, fy25: 1600000, variance: 9.4 },
];

// % of Total = share of total budgeted revenue ($17.4M).
// inDonut categories are the allocation of revenue (COGS + opex + other expenses + net income = $17.4M).
export const BUDGET_CATEGORIES = [
  { name: "Revenue", value: 17400000, percentage: 100.0, color: "#10B981", inDonut: false },
  { name: "COGS", value: 6594600, percentage: 37.9, color: "#F43F5E", inDonut: true },
  { name: "Gross Profit", value: 10805400, percentage: 62.1, color: "#34D399", inDonut: false },
  { name: "Sales & Marketing", value: 3480000, percentage: 20.0, color: "#8B5CF6", inDonut: true },
  { name: "G&A", value: 2088000, percentage: 12.0, color: "#F59E0B", inDonut: true },
  { name: "Product / Tech", value: 1740000, percentage: 10.0, color: "#3B82F6", inDonut: true },
  { name: "Other Income", value: 0, percentage: 0.0, color: "#F472B6", inDonut: false },
  { name: "Other Expenses", value: 347400, percentage: 2.0, color: "#64748B", inDonut: true },
  { name: "Net Income", value: 3150000, percentage: 18.1, color: "#059669", inDonut: true },
];

export const BUDGET_TABLE_DATA = [
  {
    category: "Revenue",
    months: { "Jul 26": 1200000, "Aug 26": 1250000, "Sep 26": 1300000, "Oct 26": 1350000, "Nov 26": 1400000, "Dec 26": 1500000, "Jan 27": 1450000, "Feb 27": 1400000, "Mar 27": 1550000, "Apr 27": 1600000, "May 27": 1650000, "Jun 27": 1750000 },
    ytd: 17400000,
    total: 17400000,
    isBold: true
  },
  {
    category: "COGS",
    months: { "Jul 26": -454800, "Aug 26": -473750, "Sep 26": -492700, "Oct 26": -511650, "Nov 26": -530600, "Dec 26": -568500, "Jan 27": -549550, "Feb 27": -530600, "Mar 27": -587450, "Apr 27": -606400, "May 27": -625350, "Jun 27": -663250 },
    ytd: -6594600,
    total: -6594600,
    isBold: false
  },
  {
    category: "Gross Profit",
    months: { "Jul 26": 745200, "Aug 26": 776250, "Sep 26": 807300, "Oct 26": 838350, "Nov 26": 869400, "Dec 26": 931500, "Jan 27": 900450, "Feb 27": 869400, "Mar 27": 962550, "Apr 27": 993600, "May 27": 1024650, "Jun 27": 1086750 },
    ytd: 10805400,
    total: 10805400,
    isBold: true
  },
  {
    category: "Sales & Marketing",
    months: { "Jul 26": -240000, "Aug 26": -250000, "Sep 26": -260000, "Oct 26": -270000, "Nov 26": -280000, "Dec 26": -300000, "Jan 27": -290000, "Feb 27": -280000, "Mar 27": -310000, "Apr 27": -320000, "May 27": -330000, "Jun 27": -350000 },
    ytd: -3480000,
    total: -3480000,
    isBold: false
  },
  {
    category: "G&A",
    months: { "Jul 26": -144000, "Aug 26": -150000, "Sep 26": -156000, "Oct 26": -162000, "Nov 26": -168000, "Dec 26": -180000, "Jan 27": -174000, "Feb 27": -168000, "Mar 27": -186000, "Apr 27": -192000, "May 27": -198000, "Jun 27": -210000 },
    ytd: -2088000,
    total: -2088000,
    isBold: false
  },
  {
    category: "Product / Tech",
    months: { "Jul 26": -120000, "Aug 26": -125000, "Sep 26": -130000, "Oct 26": -135000, "Nov 26": -140000, "Dec 26": -150000, "Jan 27": -145000, "Feb 27": -140000, "Mar 27": -155000, "Apr 27": -160000, "May 27": -165000, "Jun 27": -175000 },
    ytd: -1740000,
    total: -1740000,
    isBold: false
  },
  {
    category: "Other Expenses",
    months: { "Jul 26": -24000, "Aug 26": -25000, "Sep 26": -26000, "Oct 26": -27000, "Nov 26": -28000, "Dec 26": -30000, "Jan 27": -29000, "Feb 27": -28000, "Mar 27": -31000, "Apr 27": -32000, "May 27": -33000, "Jun 27": -34400 },
    ytd: -347400,
    total: -347400,
    isBold: false
  },
  {
    category: "Net Income",
    months: { "Jul 26": 217200, "Aug 26": 226250, "Sep 26": 235300, "Oct 26": 244350, "Nov 26": 253400, "Dec 26": 271500, "Jan 27": 262450, "Feb 27": 253400, "Mar 27": 280550, "Apr 27": 289600, "May 27": 298650, "Jun 27": 317350 },
    ytd: 3150000,
    total: 3150000,
    isBold: true
  }
];

// ─── Detail tab data (quarterly, FY2026) ─────────────────────────────────────

export type BudgetDetailRow = {
  label: string;
  values: number[]; // Q1..Q4
  total: number;
  bold?: boolean;
  section?: boolean; // section header row (no values)
};

export const BUDGET_DETAIL_QUARTERS = ["Q1 FY26", "Q2 FY26", "Q3 FY26", "Q4 FY26"];

export const BUDGET_PNL_DETAIL: BudgetDetailRow[] = [
  { label: "Revenue", values: [3750000, 4250000, 4400000, 5000000], total: 17400000, bold: true },
  { label: "Service Revenue", values: [2812500, 3187500, 3300000, 3750000], total: 13050000 },
  { label: "Recurring / Retainers", values: [937500, 1062500, 1100000, 1250000], total: 4350000 },
  { label: "COGS", values: [-1421250, -1610750, -1667600, -1895000], total: -6594600 },
  { label: "Gross Profit", values: [2328750, 2639250, 2732400, 3105000], total: 10805400, bold: true },
  { label: "Sales & Marketing", values: [-750000, -850000, -880000, -1000000], total: -3480000 },
  { label: "G&A", values: [-450000, -510000, -528000, -600000], total: -2088000 },
  { label: "Product / Tech", values: [-375000, -425000, -440000, -500000], total: -1740000 },
  { label: "Other Expenses", values: [-75000, -85000, -88000, -99400], total: -347400 },
  { label: "Net Income", values: [678750, 769250, 796400, 905600], total: 3150000, bold: true },
];

export const BUDGET_CASH_FLOW_DETAIL: BudgetDetailRow[] = [
  { label: "Operating Activities", values: [], total: 0, section: true },
  { label: "Net Income", values: [678750, 769250, 796400, 905600], total: 3150000 },
  { label: "Depreciation & Amortization", values: [45000, 45000, 47500, 47500], total: 185000 },
  { label: "Change in AR", values: [-120000, -95000, -60000, -145000], total: -420000 },
  { label: "Change in AP", values: [55000, 32000, 28000, 60000], total: 175000 },
  { label: "Cash from Operations", values: [658750, 751250, 811900, 868100], total: 3090000, bold: true },
  { label: "Investing Activities", values: [], total: 0, section: true },
  { label: "Capital Expenditures", values: [-60000, -40000, -75000, -50000], total: -225000 },
  { label: "Software / Tooling", values: [-25000, -25000, -25000, -25000], total: -100000 },
  { label: "Cash from Investing", values: [-85000, -65000, -100000, -75000], total: -325000, bold: true },
  { label: "Financing Activities", values: [], total: 0, section: true },
  { label: "Owner Distributions", values: [-250000, -250000, -250000, -350000], total: -1100000 },
  { label: "Debt Repayment", values: [-30000, -30000, -30000, -30000], total: -120000 },
  { label: "Cash from Financing", values: [-280000, -280000, -280000, -380000], total: -1220000, bold: true },
  { label: "Net Change in Cash", values: [293750, 406250, 431900, 413100], total: 1545000, bold: true },
];

export const BUDGET_BALANCE_SHEET_DETAIL: BudgetDetailRow[] = [
  { label: "Assets", values: [], total: 0, section: true },
  { label: "Cash & Equivalents", values: [2143750, 2550000, 2981900, 3395000], total: 3395000 },
  { label: "Accounts Receivable", values: [1320000, 1415000, 1475000, 1620000], total: 1620000 },
  { label: "Fixed Assets (net)", values: [515000, 510000, 537500, 540000], total: 540000 },
  { label: "Total Assets", values: [3978750, 4475000, 4994400, 5555000], total: 5555000, bold: true },
  { label: "Liabilities", values: [], total: 0, section: true },
  { label: "Accounts Payable", values: [485000, 517000, 545000, 605000], total: 605000 },
  { label: "Credit Cards", values: [92000, 88000, 95000, 90000], total: 90000 },
  { label: "Notes Payable", values: [360000, 330000, 300000, 270000], total: 270000 },
  { label: "Total Liabilities", values: [937000, 935000, 940000, 965000], total: 965000, bold: true },
  { label: "Equity", values: [], total: 0, section: true },
  { label: "Retained Earnings", values: [2363000, 2770750, 3257600, 3684400], total: 3684400 },
  { label: "Current Year Earnings", values: [678750, 769250, 796800, 905600], total: 905600 },
  { label: "Total Equity", values: [3041750, 3540000, 4054400, 4590000], total: 4590000, bold: true },
];

export const RECENT_ACTIVITY = [
  { id: 1, action: "Budget v1 was approved", by: "Allison Fabbri", time: "2 hours ago" },
  { id: 2, action: "Marketing budget updated", by: "John Smith", time: "4 hours ago" },
  { id: 3, action: "Product / Tech budget updated", by: "Sarah Jones", time: "Yesterday" },
  { id: 4, action: "New budget version created", by: "Allison Fabbri", time: "2 days ago" },
  { id: 5, action: "QBO actuals synced", by: "System", time: "3 days ago" },
];
