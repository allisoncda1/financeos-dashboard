import { DollarSign, Banknote, Clock, Users, CalendarClock } from "lucide-react";
import type { ComponentType } from "react";

type LucideIcon = ComponentType<{ className?: string }>;

// KPI cards ------------------------------------------------------------------

export const COMMISSION_KPIS: {
  label: string;
  value: string;
  sub: string;
  subTone: "up" | "down" | "neutral" | "alert";
  icon: LucideIcon;
  iconBg: string;
  spark?: number[];
}[] = [
  { label: "Total Commission Earned", value: "$142,450", sub: "+18.6% vs May 2026", subTone: "up", icon: DollarSign, iconBg: "#10B981", spark: [42, 48, 45, 52, 58, 55, 63, 68, 72, 78, 85, 92] },
  { label: "Total Commission Paid", value: "$98,250", sub: "+15.3% vs May 2026", subTone: "up", icon: Banknote, iconBg: "#8B5CF6", spark: [30, 34, 33, 38, 41, 40, 46, 50, 52, 58, 61, 66] },
  { label: "Pending Approval", value: "$44,200", sub: "18 invoices", subTone: "neutral", icon: Clock, iconBg: "#F59E0B", spark: [12, 14, 11, 15, 18, 16, 20, 19, 22, 24, 21, 26] },
  { label: "Reps Paid This Month", value: "2 of 5", sub: "40%", subTone: "neutral", icon: Users, iconBg: "#3B82F6" },
  { label: "Commission Payout Date", value: "Due in 5 days", sub: "Friday, July 5, 2026", subTone: "alert", icon: CalendarClock, iconBg: "#EF4444" },
];

// Trend chart ------------------------------------------------------------------

export const COMMISSION_TREND = [
  { month: "Jul", earned: 82000, paid: 61000, forecast: 88000 },
  { month: "Aug", earned: 91000, paid: 70000, forecast: 95000 },
  { month: "Sep", earned: 87500, paid: 66000, forecast: 92000 },
  { month: "Oct", earned: 98000, paid: 74000, forecast: 101000 },
  { month: "Nov", earned: 112000, paid: 84000, forecast: 115000 },
  { month: "Dec", earned: 126000, paid: 95000, forecast: 128000 },
  { month: "Jan", earned: 104000, paid: 79000, forecast: 110000 },
  { month: "Feb", earned: 96500, paid: 72000, forecast: 103000 },
  { month: "Mar", earned: 118000, paid: 88000, forecast: 121000 },
  { month: "Apr", earned: 124500, paid: 91000, forecast: 129000 },
  { month: "May", earned: 120100, paid: 85200, forecast: 131000 },
  { month: "Jun", earned: 142450, paid: 98250, forecast: 156000 },
];

// Commission by rep ------------------------------------------------------------

export const COMMISSION_BY_REP = [
  { name: "Jason Lafakis", earned: 68250, pct: 47.9, color: "#10B981" },
  { name: "Jerod McLachlan", earned: 42100, pct: 29.6, color: "#8B5CF6" },
  { name: "Mike Chen", earned: 18750, pct: 13.2, color: "#3B82F6" },
  { name: "Sarah Johnson", earned: 8900, pct: 6.3, color: "#F59E0B" },
  { name: "Lisa Park", earned: 4450, pct: 3.0, color: "#67E8F9" },
];

// Commission status table --------------------------------------------------------

export type CommissionStatus = "Pending" | "Approved" | "Locked" | "Paid";

export const COMMISSION_INVOICES: {
  id: string; number: string; customer: string; rep: string; date: string;
  invoiceAmount: number; commissionAmount: number; status: CommissionStatus;
}[] = [
  { id: "ci-1", number: "INV-10584", customer: "South Suburban Mitsubishi", rep: "Jason Lafakis", date: "Jun 28, 2026", invoiceAmount: 12500, commissionAmount: 2500, status: "Pending" },
  { id: "ci-2", number: "INV-10583", customer: "Barbarino Nissan", rep: "Jason Lafakis", date: "Jun 27, 2026", invoiceAmount: 8750, commissionAmount: 1750, status: "Pending" },
  { id: "ci-3", number: "INV-10582", customer: "Elite Motors", rep: "Jerod McLachlan", date: "Jun 26, 2026", invoiceAmount: 15000, commissionAmount: 3600, status: "Approved" },
  { id: "ci-4", number: "INV-10581", customer: "Speedy Auto Group", rep: "Jason Lafakis", date: "Jun 25, 2026", invoiceAmount: 6300, commissionAmount: 1260, status: "Approved" },
  { id: "ci-5", number: "INV-10580", customer: "Northland Ford", rep: "Jerod McLachlan", date: "Jun 24, 2026", invoiceAmount: 9200, commissionAmount: 2208, status: "Locked" },
  { id: "ci-6", number: "INV-10579", customer: "Glenview Toyota", rep: "Mike Chen", date: "Jun 23, 2026", invoiceAmount: 7800, commissionAmount: 1326, status: "Paid" },
  { id: "ci-7", number: "INV-10578", customer: "Lakeshore Honda", rep: "Sarah Johnson", date: "Jun 22, 2026", invoiceAmount: 5400, commissionAmount: 810, status: "Paid" },
  { id: "ci-8", number: "INV-10577", customer: "Metro Kia Center", rep: "Lisa Park", date: "Jun 20, 2026", invoiceAmount: 4450, commissionAmount: 667.5, status: "Paid" },
];

export const COMMISSION_STATUS_COUNTS = { all: 51, pending: 18, approved: 12, locked: 4, paid: 23 };

// Commission by plan ------------------------------------------------------------

export const COMMISSION_BY_PLAN = [
  { id: "plan-1", name: "Standard 10% (Revenue)", reps: 2, earned: 82350, pct: 57.8 },
  { id: "plan-2", name: "Standard 12% (Revenue)", reps: 1, earned: 42100, pct: 29.6 },
  { id: "plan-3", name: "Custom 15% (Revenue)", reps: 1, earned: 18750, pct: 13.2 },
];

// Upcoming payout -----------------------------------------------------------------

export const UPCOMING_PAYOUT = {
  period: "Jun 1 - Jun 30, 2026",
  totalAmount: 98250,
  payoutDate: "Jul 5, 2026",
  status: "Scheduled",
};

// Sales reps ----------------------------------------------------------------------

export const SALES_REPS = [
  { id: "rep-1", name: "Jason Lafakis", email: "jason@t3marketing.com", plan: "Standard 10% (Revenue)", ytdEarned: 68250, clients: 14, status: "Active" },
  { id: "rep-2", name: "Jerod McLachlan", email: "jerod@t3marketing.com", plan: "Standard 12% (Revenue)", ytdEarned: 42100, clients: 9, status: "Active" },
  { id: "rep-3", name: "Mike Chen", email: "mike@t3marketing.com", plan: "Custom 15% (Revenue)", ytdEarned: 18750, clients: 5, status: "Active" },
  { id: "rep-4", name: "Sarah Johnson", email: "sarah@t3marketing.com", plan: "Standard 10% (Revenue)", ytdEarned: 8900, clients: 4, status: "Active" },
  { id: "rep-5", name: "Lisa Park", email: "lisa@t3marketing.com", plan: "Standard 10% (Revenue)", ytdEarned: 4450, clients: 2, status: "Onboarding" },
];

// Clients -----------------------------------------------------------------------

export const COMMISSION_CLIENTS = [
  { id: "cl-1", name: "South Suburban Mitsubishi", rep: "Jason Lafakis", mrr: 12500, ltv: 187500, since: "Mar 2024", status: "Active" },
  { id: "cl-2", name: "Barbarino Nissan", rep: "Jason Lafakis", mrr: 8750, ltv: 96250, since: "Aug 2024", status: "Active" },
  { id: "cl-3", name: "Elite Motors", rep: "Jerod McLachlan", mrr: 15000, ltv: 240000, since: "Jan 2024", status: "Active" },
  { id: "cl-4", name: "Speedy Auto Group", rep: "Jason Lafakis", mrr: 6300, ltv: 44100, since: "Feb 2025", status: "Active" },
  { id: "cl-5", name: "Northland Ford", rep: "Jerod McLachlan", mrr: 9200, ltv: 119600, since: "Jun 2024", status: "Active" },
  { id: "cl-6", name: "Glenview Toyota", rep: "Mike Chen", mrr: 7800, ltv: 62400, since: "Oct 2024", status: "Active" },
  { id: "cl-7", name: "Lakeshore Honda", rep: "Sarah Johnson", mrr: 5400, ltv: 27000, since: "May 2025", status: "Active" },
  { id: "cl-8", name: "Metro Kia Center", rep: "Lisa Park", mrr: 4450, ltv: 13350, since: "Mar 2026", status: "Trial" },
];

// Plans --------------------------------------------------------------------------

export const COMMISSION_PLANS = [
  { id: "cp-1", name: "Standard 10% (Revenue)", basis: "Invoice revenue", rate: "10%", reps: 3, earnedYtd: 82350, status: "Active" },
  { id: "cp-2", name: "Standard 12% (Revenue)", basis: "Invoice revenue", rate: "12%", reps: 1, earnedYtd: 42100, status: "Active" },
  { id: "cp-3", name: "Custom 15% (Revenue)", basis: "Invoice revenue", rate: "15%", reps: 1, earnedYtd: 18750, status: "Active" },
  { id: "cp-4", name: "Legacy 8% (Collected)", basis: "Collected cash", rate: "8%", reps: 0, earnedYtd: 0, status: "Archived" },
];

// Calculations -------------------------------------------------------------------

export const CALCULATION_RUNS = [
  { id: "run-1", period: "June 2026", ranAt: "Jul 1, 2026 9:00 AM", invoices: 51, total: 142450, status: "Pending Review" },
  { id: "run-2", period: "May 2026", ranAt: "Jun 1, 2026 9:00 AM", invoices: 47, total: 120100, status: "Locked" },
  { id: "run-3", period: "April 2026", ranAt: "May 1, 2026 9:00 AM", invoices: 49, total: 124500, status: "Paid" },
  { id: "run-4", period: "March 2026", ranAt: "Apr 1, 2026 9:00 AM", invoices: 44, total: 118000, status: "Paid" },
];

// Payouts ------------------------------------------------------------------------

export const PAYOUTS = [
  { id: "po-1", period: "June 2026", reps: 5, amount: 98250, date: "Jul 5, 2026", method: "ACH", status: "Scheduled" },
  { id: "po-2", period: "May 2026", reps: 5, amount: 85200, date: "Jun 5, 2026", method: "ACH", status: "Completed" },
  { id: "po-3", period: "April 2026", reps: 4, amount: 91000, date: "May 5, 2026", method: "ACH", status: "Completed" },
  { id: "po-4", period: "March 2026", reps: 4, amount: 88000, date: "Apr 5, 2026", method: "ACH", status: "Completed" },
];

// Reports ------------------------------------------------------------------------

export const COMMISSION_REPORTS = [
  { id: "rep-report-1", name: "Commission Statement by Rep", description: "Per-rep earned, adjustments, and paid amounts for a period", lastRun: "Jul 1, 2026" },
  { id: "rep-report-2", name: "Commission by Client", description: "Which clients generate the most commission", lastRun: "Jun 28, 2026" },
  { id: "rep-report-3", name: "Plan Performance", description: "Earned totals grouped by commission plan", lastRun: "Jun 25, 2026" },
  { id: "rep-report-4", name: "Payout History", description: "All payouts with dates, methods, and amounts", lastRun: "Jun 5, 2026" },
];
