/**
 * FinanceOS Analytics — Management Accounting & Cost Allocation types.
 *
 * Central typed data layer. All Analytics pages must consume data through
 * lib/analyticsDemoData.ts (clearly-labelled demo data) using these types.
 * Never scatter ad-hoc mock objects inside components.
 */

import type { EntitySlug } from "@/lib/types";

// ─── Global filters ───────────────────────────────────────────────────────────

/** "consolidated" = all four companies combined */
export type AnalyticsEntityFilter = "consolidated" | EntitySlug;

export type AccountingBasis = "accrual" | "cash";

export type AllocationScenarioId =
  | "actual-books"
  | "approved-allocation"
  | "draft-scenario"
  | "custom-scenario";

export interface AllocationScenario {
  id: AllocationScenarioId;
  name: string;
  description: string;
  locked: boolean;
}

// ─── Cost centers ─────────────────────────────────────────────────────────────

export type CostCenterType =
  | "Operating"
  | "Support"
  | "Revenue Generating"
  | "Shared Service"
  | "Administrative";

export interface CostCenter {
  id: string;
  name: string;
  code: string;
  /** null = top-level center */
  parentId: string | null;
  owner: string;
  type: CostCenterType;
  /** "All Entities" or a specific entity slug */
  entityScope: "all" | EntitySlug;
  directCosts: number;
  allocatedCosts: number;
  monthlyBudget: number;
  status: "Active" | "Inactive";
}

// ─── Shared expenses ──────────────────────────────────────────────────────────

export type AllocationStatus =
  | "Unreviewed"
  | "Rule Suggested"
  | "Draft"
  | "Approved"
  | "Partially Allocated"
  | "Fully Allocated"
  | "Excluded";

export type CostCategory =
  | "Finance"
  | "Executive"
  | "Technology"
  | "Software"
  | "Human Resources"
  | "Marketing"
  | "Operations"
  | "Insurance"
  | "Professional Services"
  | "General Administration";

export interface SharedExpense {
  id: string;
  date: string; // ISO date
  vendorOrEmployee: string;
  description: string;
  payingEntity: EntitySlug;
  originalAccount: string;
  amount: number;
  costCategory: CostCategory;
  /** Matching allocation rule, if any */
  ruleId: string | null;
  status: AllocationStatus;
  allocatedAmount: number;
  /** Suggested / assigned cost center */
  costCenterId: string | null;
  sourceSystem: string;
  notes: string;
}

// ─── Allocation rules ─────────────────────────────────────────────────────────

export type AllocationMethod =
  | "Fixed Percentage"
  | "Equal Split"
  | "Revenue Based"
  | "Headcount Based"
  | "Employee Time Based"
  | "Transaction Volume Based"
  | "Client Count Based"
  | "User Count Based"
  | "Square Footage Based"
  | "Manual Allocation"
  | "Custom Driver";

export type RuleApprovalStatus = "Draft" | "Pending Approval" | "Approved" | "Rejected";

export interface AllocationDestination {
  entity: EntitySlug;
  costCenterId: string | null;
  percentage: number; // 0-100; destinations must total 100
}

export interface AllocationRule {
  id: string;
  name: string;
  ruleType: "Vendor" | "Employee" | "Account" | "Category";
  sourceEntity: EntitySlug;
  vendorOrEmployee: string;
  account: string;
  costCategory: CostCategory;
  destinations: AllocationDestination[];
  method: AllocationMethod;
  effectiveDate: string;
  endDate: string | null;
  priority: number;
  approvalStatus: RuleApprovalStatus;
  active: boolean;
  monthlyImpactEstimate: number;
  version: number;
}

// ─── Allocation journal ───────────────────────────────────────────────────────

export type AllocationEntryStatus =
  | "Draft"
  | "Pending Review"
  | "Approved"
  | "Rejected"
  | "Posted to Analytics"
  | "Posted to Accounting";

export interface AllocationEntry {
  id: string;
  date: string;
  sourceTransaction: string;
  sourceEntity: EntitySlug;
  destinationEntity: EntitySlug;
  destinationCostCenterId: string;
  driver: AllocationMethod;
  percentage: number;
  amount: number;
  scenario: AllocationScenarioId;
  status: AllocationEntryStatus;
  approvedBy: string | null;
}

// ─── Entity books & profitability ─────────────────────────────────────────────

export interface EntityBooks {
  slug: EntitySlug;
  bookRevenue: number;
  bookExpenses: number;
  /** Shared costs this entity paid on behalf of others (allocated out) */
  sharedCostsPaid: number;
  /** Shared costs allocated into this entity from others */
  sharedCostsReceived: number;
}

// ─── Department / cost-center P&L ─────────────────────────────────────────────

export interface PnlLine {
  label: string;
  bookAmount: number;
  allocationAdjustment: number;
  budget: number;
  priorPeriod: number;
  priorYear: number;
  /** "revenue" lines display positive-good; "expense" the reverse */
  kind: "revenue" | "expense";
  section:
    | "Revenue"
    | "Cost of Revenue"
    | "Operating Expenses";
}

export interface DepartmentPnl {
  costCenterId: string;
  entity: AnalyticsEntityFilter;
  lines: PnlLine[];
}

// ─── Clients & projects ───────────────────────────────────────────────────────

export type ProfitabilityStatus =
  | "Highly Profitable"
  | "Profitable"
  | "Low Margin"
  | "Break Even"
  | "Unprofitable"
  | "Missing Data";

export interface ClientProfitability {
  id: string;
  name: string;
  entity: EntitySlug;
  revenue: number;
  directLabor: number;
  contractors: number;
  softwareCosts: number;
  callCosts: number;
  mediaCosts: number;
  allocatedOverhead: number;
  trend: number[]; // monthly profit trend (last 6 months)
  employeesAssigned: number;
  callVolume: number;
  projects: string[];
}

export type ProjectKind =
  | "Project"
  | "Service"
  | "Product"
  | "Campaign"
  | "Contract"
  | "Client Engagement";

export interface ProjectProfitability {
  id: string;
  name: string;
  kind: ProjectKind;
  clientId: string | null;
  entity: EntitySlug;
  revenue: number;
  laborCost: number;
  vendorCost: number;
  softwareCost: number;
  allocatedOverhead: number;
  status: "Active" | "Completed" | "On Hold" | "Internal";
}

// ─── Trend & misc ─────────────────────────────────────────────────────────────

export interface MonthlyAllocationTrend {
  month: string; // e.g. "Jan"
  directCosts: number;
  sharedCosts: number;
  allocatedCosts: number;
  unallocatedCosts: number;
}

export interface AnalyticsSettings {
  materialityThreshold: number;
  defaultMethod: AllocationMethod;
  requireApproval: boolean;
  allocationPeriod: "Monthly" | "Quarterly";
  fiscalYearStart: string;
  accountingBasis: AccountingBasis;
  currency: "USD";
  rounding: "Cent" | "Dollar";
  closedThrough: string;
}
