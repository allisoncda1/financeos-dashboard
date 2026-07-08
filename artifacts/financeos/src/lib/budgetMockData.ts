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

export const RECENT_ACTIVITY = [
  { id: 1, action: "Budget v1 was approved", by: "Allison Fabbri", time: "2 hours ago" },
  { id: 2, action: "Marketing budget updated", by: "John Smith", time: "4 hours ago" },
  { id: 3, action: "Product / Tech budget updated", by: "Sarah Jones", time: "Yesterday" },
  { id: 4, action: "New budget version created", by: "Allison Fabbri", time: "2 days ago" },
  { id: 5, action: "QBO actuals synced", by: "System", time: "3 days ago" },
];
