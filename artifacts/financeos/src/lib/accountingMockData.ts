import {
  FileText,
  CreditCard,
  CheckCircle,
  AlertCircle,
  FileCheck,
  BrainCircuit,
  Users,
  Repeat,
  Search,
  ArrowRightLeft
} from "lucide-react";

export const ACCOUNTING_KPIS = [
  {
    label: "Transactions to categorize",
    value: "37",
    description: "View transactions \u2192",
    icon: CreditCard,
    iconBg: "#F59E0B", // Amber
    href: "/accounting/transactions/uncategorized"
  },
  {
    label: "Invoices to send",
    value: "5",
    description: "Draft invoices \u2192",
    icon: FileText,
    iconBg: "#3B82F6", // Blue
    href: "/accounting/invoices/draft"
  },
  {
    label: "Accounts to reconcile",
    value: "2",
    description: "Start reconciliation \u2192",
    icon: CheckCircle,
    iconBg: "#10B981", // Emerald
    href: "/accounting/reconciliation/accounts"
  },
  {
    label: "Customer missing info",
    value: "1",
    description: "Update details \u2192",
    icon: Users,
    iconBg: "#EF4444", // Red
    href: "/accounting/customers"
  },
  {
    label: "Items need review",
    value: "4",
    description: "Review items \u2192",
    icon: AlertCircle,
    iconBg: "#8B5CF6", // Blue/purple
    href: "/accounting/transactions/categorized"
  }
];

export const TRANSACTIONS = [
  {
    id: "tx-1",
    date: "Jul 8, 2026",
    description: "Facebook Ads",
    account: "Checking \u2022\u2022\u2022\u2022 1234",
    suggestedCategory: "Advertising",
    categoryColor: "bg-blue-100 text-blue-700",
    confidence: 99,
    confidenceColor: "bg-emerald-500",
    amount: -125.00
  },
  {
    id: "tx-2",
    date: "Jul 8, 2026",
    description: "Google Workspace",
    account: "Checking \u2022\u2022\u2022\u2022 1234",
    suggestedCategory: "Software",
    categoryColor: "bg-purple-100 text-purple-700",
    confidence: 98,
    confidenceColor: "bg-emerald-500",
    amount: -14.40
  },
  {
    id: "tx-3",
    date: "Jul 7, 2026",
    description: "Amazon AWS",
    account: "Checking \u2022\u2022\u2022\u2022 1234",
    suggestedCategory: "Cloud Infrastructure",
    categoryColor: "bg-indigo-100 text-indigo-700",
    confidence: 96,
    confidenceColor: "bg-emerald-500",
    amount: -85.67
  },
  {
    id: "tx-4",
    date: "Jul 7, 2026",
    description: "Starbucks",
    account: "Checking \u2022\u2022\u2022\u2022 1234",
    suggestedCategory: "Meals & Entertainment",
    categoryColor: "bg-orange-100 text-orange-700",
    confidence: 92,
    confidenceColor: "bg-emerald-400",
    amount: -6.35
  },
  {
    id: "tx-5",
    date: "Jul 6, 2026",
    description: "Uber",
    account: "Checking \u2022\u2022\u2022\u2022 1234",
    suggestedCategory: "Travel",
    categoryColor: "bg-rose-100 text-rose-700",
    confidence: 90,
    confidenceColor: "bg-emerald-400",
    amount: -24.18
  }
];

export const AI_SUGGESTIONS = [
  {
    id: "sug-1",
    title: "34 transactions can be auto-approved",
    description: "Based on your rules and AI learning",
    icon: CheckCircle,
    iconColor: "text-emerald-600",
    iconBg: "bg-emerald-100"
  },
  {
    id: "sug-2",
    title: "3 new vendors detected",
    description: "Review and categorize",
    icon: Users,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100"
  },
  {
    id: "sug-3",
    title: "1 duplicate invoice found",
    description: "INV-2456 matches INV-2456",
    icon: Repeat,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100"
  },
  {
    id: "sug-4",
    title: "2 possible miscategorizations",
    description: "Review suggested changes",
    icon: Search,
    iconColor: "text-purple-600",
    iconBg: "bg-purple-100"
  }
];

export const RECENT_ACTIVITY = [
  {
    id: "act-1",
    title: "Invoice INV-2458 sent to Precision Roofing LLC",
    time: "09:14 AM",
    icon: FileText,
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50"
  },
  {
    id: "act-2",
    title: "Bank sync completed",
    description: "15 new transactions imported",
    time: "09:02 AM",
    icon: ArrowRightLeft,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50"
  },
  {
    id: "act-3",
    title: "15 transactions categorized",
    description: "Auto-categorized with 95% accuracy",
    time: "08:58 AM",
    icon: BrainCircuit,
    iconColor: "text-purple-500",
    iconBg: "bg-purple-50"
  },
  {
    id: "act-4",
    title: "Checking account reconciled",
    description: "June 2026 reconciliation completed",
    time: "08:45 AM",
    icon: FileCheck,
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-50"
  },
  {
    id: "act-5",
    title: "Rule \"Software Subscriptions\" applied",
    description: "12 transactions auto-categorized",
    time: "08:30 AM",
    icon: Search,
    iconColor: "text-gray-500",
    iconBg: "bg-gray-100"
  }
];

export const BANK_ACCOUNTS = [
  {
    id: "acc-1",
    name: "Checking \u2022\u2022\u2022\u2022 1234",
    balance: 248750.00,
    status: "In Sync"
  },
  {
    id: "acc-2",
    name: "Savings \u2022\u2022\u2022\u2022 5678",
    balance: 91000.00,
    status: "In Sync"
  },
  {
    id: "acc-3",
    name: "Credit Card \u2022\u2022\u2022\u2022 9012",
    balance: -12450.00,
    status: "In Sync"
  }
];

export const RECONCILIATION_ACCOUNTS = [
  {
    id: "rec-1",
    name: "Checking Account \u2022\u2022\u2022\u2022 1234",
    period: "June 2026",
    balance: 248750.00,
    status: "Reconciled",
    date: "Jul 7 2026"
  },
  {
    id: "rec-2",
    name: "Credit Card \u2022\u2022\u2022\u2022 9012",
    period: "June 2026",
    balance: -12450.00,
    status: "In Progress",
    matchPercent: 65
  }
];

// ── Phase 2 data ─────────────────────────────────────────────────────────────

export type InvoiceStatus = "Draft" | "Sent" | "Paid" | "Overdue" | "Recurring";

export const INVOICES: {
  id: string; number: string; customer: string; issued: string; due: string;
  amount: number; status: InvoiceStatus;
}[] = [
  { id: "inv-1", number: "INV-2461", customer: "Precision Roofing LLC", issued: "Jul 8, 2026", due: "Jul 22, 2026", amount: 4850.0, status: "Draft" },
  { id: "inv-2", number: "INV-2460", customer: "Bluewater Dental Group", issued: "Jul 8, 2026", due: "Jul 22, 2026", amount: 2200.0, status: "Draft" },
  { id: "inv-3", number: "INV-2459", customer: "Harbor Auto Sales", issued: "Jul 7, 2026", due: "Jul 21, 2026", amount: 7500.0, status: "Draft" },
  { id: "inv-4", number: "INV-2458", customer: "Precision Roofing LLC", issued: "Jul 8, 2026", due: "Jul 22, 2026", amount: 3100.0, status: "Sent" },
  { id: "inv-5", number: "INV-2457", customer: "Summit Legal Partners", issued: "Jul 5, 2026", due: "Jul 19, 2026", amount: 5400.0, status: "Sent" },
  { id: "inv-6", number: "INV-2456", customer: "Bluewater Dental Group", issued: "Jun 28, 2026", due: "Jul 12, 2026", amount: 2200.0, status: "Overdue" },
  { id: "inv-7", number: "INV-2455", customer: "Northgate Fitness", issued: "Jun 24, 2026", due: "Jul 8, 2026", amount: 1350.0, status: "Paid" },
  { id: "inv-8", number: "INV-2454", customer: "Harbor Auto Sales", issued: "Jun 20, 2026", due: "Jul 4, 2026", amount: 7500.0, status: "Paid" },
  { id: "inv-9", number: "INV-2453", customer: "Summit Legal Partners", issued: "Jun 15, 2026", due: "Jun 29, 2026", amount: 5400.0, status: "Paid" },
  { id: "inv-10", number: "INV-2452", customer: "Northgate Fitness", issued: "Jun 1, 2026", due: "Jul 1, 2026", amount: 1350.0, status: "Recurring" },
  { id: "inv-11", number: "INV-2451", customer: "Bluewater Dental Group", issued: "Jun 1, 2026", due: "Jul 1, 2026", amount: 2200.0, status: "Recurring" },
  { id: "inv-12", number: "INV-2450", customer: "Riverside Property Mgmt", issued: "Jul 6, 2026", due: "Jul 20, 2026", amount: 980.0, status: "Draft" },
  { id: "inv-13", number: "INV-2449", customer: "Riverside Property Mgmt", issued: "Jul 4, 2026", due: "Jul 18, 2026", amount: 1600.0, status: "Draft" },
];

export const CATEGORIZATION_RULES = [
  { id: "rule-1", name: "Software Subscriptions", condition: "Description contains \"Google\", \"Adobe\", \"Slack\"", category: "Software", categoryTone: "purple", applied: 128, active: true },
  { id: "rule-2", name: "Ad Platforms", condition: "Description contains \"Facebook Ads\", \"Google Ads\"", category: "Advertising", categoryTone: "blue", applied: 96, active: true },
  { id: "rule-3", name: "Cloud Hosting", condition: "Description contains \"AWS\", \"Vercel\", \"Neon\"", category: "Cloud Infrastructure", categoryTone: "indigo", applied: 74, active: true },
  { id: "rule-4", name: "Client Meals", condition: "Merchant category is Restaurants and amount < $200", category: "Meals & Entertainment", categoryTone: "orange", applied: 41, active: true },
  { id: "rule-5", name: "Rideshare", condition: "Description contains \"Uber\", \"Lyft\"", category: "Travel", categoryTone: "rose", applied: 33, active: false },
];

export const CATEGORIZED_TRANSACTIONS = [
  { id: "ctx-1", date: "Jul 6, 2026", description: "Adobe Creative Cloud", account: "Checking \u2022\u2022\u2022\u2022 1234", category: "Software", categoryTone: "purple", amount: -59.99, reviewed: true },
  { id: "ctx-2", date: "Jul 5, 2026", description: "Google Ads", account: "Credit Card \u2022\u2022\u2022\u2022 9012", category: "Advertising", categoryTone: "blue", amount: -1240.0, reviewed: true },
  { id: "ctx-3", date: "Jul 5, 2026", description: "Neon Database", account: "Checking \u2022\u2022\u2022\u2022 1234", category: "Cloud Infrastructure", categoryTone: "indigo", amount: -69.0, reviewed: false },
  { id: "ctx-4", date: "Jul 3, 2026", description: "Delta Airlines", account: "Credit Card \u2022\u2022\u2022\u2022 9012", category: "Travel", categoryTone: "rose", amount: -486.4, reviewed: true },
  { id: "ctx-5", date: "Jul 2, 2026", description: "Client payment - Harbor Auto", account: "Checking \u2022\u2022\u2022\u2022 1234", category: "Sales Revenue", categoryTone: "emerald", amount: 7500.0, reviewed: true },
];

export const RECON_ACCOUNT_LIST = [
  { id: "ra-1", name: "Checking \u2022\u2022\u2022\u2022 1234", lastReconciled: "Jul 7, 2026", period: "June 2026", status: "Reconciled", difference: 0 },
  { id: "ra-2", name: "Credit Card \u2022\u2022\u2022\u2022 9012", lastReconciled: "Jun 8, 2026", period: "June 2026", status: "In Progress", difference: -312.45 },
  { id: "ra-3", name: "Savings \u2022\u2022\u2022\u2022 5678", lastReconciled: "Jun 5, 2026", period: "June 2026", status: "Not Started", difference: 0 },
];

export const RECON_MATCHES = [
  { id: "m-1", bankLine: "ACH DEPOSIT HARBOR AUTO 07/02", bankAmount: 7500.0, ledgerLine: "Invoice INV-2454 payment", ledgerAmount: 7500.0, confidence: 99 },
  { id: "m-2", bankLine: "CHECK 1088 06/29", bankAmount: -1850.0, ledgerLine: "Rent - July office lease", ledgerAmount: -1850.0, confidence: 97 },
  { id: "m-3", bankLine: "POS DEBIT STAPLES 06/27", bankAmount: -214.6, ledgerLine: "Office supplies order", ledgerAmount: -214.6, confidence: 94 },
  { id: "m-4", bankLine: "WIRE OUT 06/26", bankAmount: -4200.0, ledgerLine: "Contractor payment - DevWorks", ledgerAmount: -4200.0, confidence: 88 },
];

export const RECON_HISTORY = [
  { id: "h-1", account: "Checking \u2022\u2022\u2022\u2022 1234", period: "June 2026", completed: "Jul 7, 2026", by: "Allison Fabbri", matched: 142, difference: 0, status: "Reconciled" },
  { id: "h-2", account: "Checking \u2022\u2022\u2022\u2022 1234", period: "May 2026", completed: "Jun 6, 2026", by: "Allison Fabbri", matched: 138, difference: 0, status: "Reconciled" },
  { id: "h-3", account: "Credit Card \u2022\u2022\u2022\u2022 9012", period: "May 2026", completed: "Jun 8, 2026", by: "Allison Fabbri", matched: 87, difference: 0, status: "Reconciled" },
  { id: "h-4", account: "Savings \u2022\u2022\u2022\u2022 5678", period: "May 2026", completed: "Jun 5, 2026", by: "Marcus Lee", matched: 6, difference: 0, status: "Reconciled" },
];

export const CUSTOMERS = [
  { id: "c-1", name: "Precision Roofing LLC", email: "billing@precisionroofing.com", openBalance: 7950.0, invoices: 14, status: "Active", missingInfo: false },
  { id: "c-2", name: "Bluewater Dental Group", email: "accounts@bluewaterdental.com", openBalance: 4400.0, invoices: 22, status: "Active", missingInfo: false },
  { id: "c-3", name: "Harbor Auto Sales", email: "ap@harborauto.com", openBalance: 7500.0, invoices: 9, status: "Active", missingInfo: false },
  { id: "c-4", name: "Summit Legal Partners", email: "finance@summitlegal.com", openBalance: 5400.0, invoices: 11, status: "Active", missingInfo: false },
  { id: "c-5", name: "Northgate Fitness", email: "", openBalance: 0, invoices: 8, status: "Active", missingInfo: true },
  { id: "c-6", name: "Riverside Property Mgmt", email: "office@riversidepm.com", openBalance: 2580.0, invoices: 5, status: "Active", missingInfo: false },
];

export const VENDORS = [
  { id: "v-1", name: "Amazon Web Services", category: "Cloud Infrastructure", ytdSpend: 6480.2, lastPayment: "Jul 7, 2026", status: "Active" },
  { id: "v-2", name: "Meta Platforms", category: "Advertising", ytdSpend: 18240.0, lastPayment: "Jul 8, 2026", status: "Active" },
  { id: "v-3", name: "Google LLC", category: "Software", ytdSpend: 4120.8, lastPayment: "Jul 8, 2026", status: "Active" },
  { id: "v-4", name: "DevWorks Contracting", category: "Professional Services", ytdSpend: 25200.0, lastPayment: "Jun 26, 2026", status: "Active" },
  { id: "v-5", name: "Lakeside Properties", category: "Rent", ytdSpend: 12950.0, lastPayment: "Jun 29, 2026", status: "Active" },
  { id: "v-6", name: "Staples", category: "Office Supplies", ytdSpend: 1480.35, lastPayment: "Jun 27, 2026", status: "Active" },
];

export const CHART_OF_ACCOUNTS = [
  { code: "1000", name: "Checking Account", type: "Asset", balance: 248750.0 },
  { code: "1010", name: "Savings Account", type: "Asset", balance: 91000.0 },
  { code: "1200", name: "Accounts Receivable", type: "Asset", balance: 27830.0 },
  { code: "1500", name: "Fixed Assets", type: "Asset", balance: 64200.0 },
  { code: "1510", name: "Accumulated Depreciation", type: "Asset", balance: -21450.0 },
  { code: "2000", name: "Accounts Payable", type: "Liability", balance: 9840.0 },
  { code: "2100", name: "Credit Card Payable", type: "Liability", balance: 12450.0 },
  { code: "3000", name: "Owner's Equity", type: "Equity", balance: 250000.0 },
  { code: "4000", name: "Sales Revenue", type: "Income", balance: 412600.0 },
  { code: "4100", name: "Recurring Services Revenue", type: "Income", balance: 86400.0 },
  { code: "5000", name: "Advertising", type: "Expense", balance: 48120.0 },
  { code: "5100", name: "Software", type: "Expense", balance: 14890.0 },
  { code: "5200", name: "Cloud Infrastructure", type: "Expense", balance: 6480.0 },
  { code: "5300", name: "Meals & Entertainment", type: "Expense", balance: 3210.0 },
  { code: "5400", name: "Travel", type: "Expense", balance: 5940.0 },
];

export const JOURNAL_ENTRIES = [
  { id: "je-1", date: "Jul 7, 2026", ref: "JE-0142", memo: "June depreciation - office equipment", debit: 1787.5, credit: 1787.5, status: "Posted" },
  { id: "je-2", date: "Jul 5, 2026", ref: "JE-0141", memo: "Reclass prepaid software to expense", debit: 620.0, credit: 620.0, status: "Posted" },
  { id: "je-3", date: "Jul 3, 2026", ref: "JE-0140", memo: "Accrue June contractor invoice", debit: 4200.0, credit: 4200.0, status: "Posted" },
  { id: "je-4", date: "Jul 8, 2026", ref: "JE-0143", memo: "July rent allocation - draft", debit: 1850.0, credit: 1850.0, status: "Draft" },
];

export const FIXED_ASSETS = [
  { id: "fa-1", name: "Office build-out", category: "Leasehold Improvements", purchased: "Mar 2024", cost: 32000.0, accumDep: 11733.33, method: "SL / 5 yr" },
  { id: "fa-2", name: "MacBook fleet (6)", category: "Computer Equipment", purchased: "Jan 2025", cost: 14400.0, accumDep: 7200.0, method: "SL / 3 yr" },
  { id: "fa-3", name: "Studio camera kit", category: "Production Equipment", purchased: "Aug 2025", cost: 9800.0, accumDep: 1796.67, method: "SL / 5 yr" },
  { id: "fa-4", name: "Conference room AV", category: "Office Equipment", purchased: "Nov 2025", cost: 8000.0, accumDep: 720.0, method: "SL / 7 yr" },
];

export const CLOSE_TASKS = [
  { id: "t-1", task: "Import and categorize all bank transactions", owner: "Allison Fabbri", status: "In Progress" },
  { id: "t-2", task: "Reconcile checking account", owner: "Allison Fabbri", status: "Complete" },
  { id: "t-3", task: "Reconcile credit card", owner: "Allison Fabbri", status: "In Progress" },
  { id: "t-4", task: "Reconcile savings account", owner: "Marcus Lee", status: "Not Started" },
  { id: "t-5", task: "Send all outstanding invoices", owner: "Allison Fabbri", status: "In Progress" },
  { id: "t-6", task: "Review AR aging and follow up overdue", owner: "Marcus Lee", status: "Not Started" },
  { id: "t-7", task: "Post depreciation journal entry", owner: "Allison Fabbri", status: "Complete" },
  { id: "t-8", task: "Accrue unbilled contractor costs", owner: "Allison Fabbri", status: "Complete" },
  { id: "t-9", task: "Review P&L vs budget for June", owner: "Marcus Lee", status: "Not Started" },
  { id: "t-10", task: "Lock the period", owner: "Allison Fabbri", status: "Not Started" },
];
