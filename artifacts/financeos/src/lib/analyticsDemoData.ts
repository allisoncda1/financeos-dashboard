/**
 * FinanceOS Analytics — DEMO DATA (clearly labelled).
 *
 * Centralized, deterministic demo dataset for the Management Accounting &
 * Cost Allocation module. This is NOT live accounting data. Every Analytics
 * page must read from this module (single source of truth) until the module
 * is wired to a real data source.
 */

import type { EntitySlug } from "@/lib/types";
import { ENTITY_SLUGS } from "@/lib/types";
import type {
  AllocationEntry,
  AllocationRule,
  AllocationScenario,
  AnalyticsEntityFilter,
  AnalyticsSettings,
  ClientProfitability,
  CostCenter,
  MonthlyAllocationTrend,
  PnlLine,
  ProfitabilityStatus,
  ProjectProfitability,
  SharedExpense,
} from "@/lib/analyticsTypes";

export const ANALYTICS_DATA_LABEL = "Demo data — not connected to live books";

// ─── Scenarios ────────────────────────────────────────────────────────────────

export const ALLOCATION_SCENARIOS: AllocationScenario[] = [
  { id: "actual-books", name: "Actual Books", description: "As recorded in QuickBooks — no reallocation", locked: true },
  { id: "approved-allocation", name: "Approved Allocation", description: "Management-approved allocation of shared costs", locked: true },
  { id: "draft-scenario", name: "Draft Scenario", description: "Work-in-progress allocation changes", locked: false },
  { id: "custom-scenario", name: "Custom Scenario", description: "Sandbox for what-if modeling", locked: false },
];

// ─── Cost centers (with hierarchy) ────────────────────────────────────────────

export const COST_CENTERS: CostCenter[] = [
  { id: "cc-shared", name: "Shared Services", code: "SS-000", parentId: null, owner: "Allison Carter", type: "Shared Service", entityScope: "all", directCosts: 0, allocatedCosts: 0, monthlyBudget: 92000, status: "Active" },
  { id: "cc-finance", name: "Finance", code: "SS-100", parentId: "cc-shared", owner: "Allison Carter", type: "Shared Service", entityScope: "all", directCosts: 28400, allocatedCosts: 0, monthlyBudget: 30000, status: "Active" },
  { id: "cc-accounting", name: "Accounting", code: "SS-110", parentId: "cc-shared", owner: "Allison Carter", type: "Shared Service", entityScope: "all", directCosts: 12600, allocatedCosts: 0, monthlyBudget: 12000, status: "Active" },
  { id: "cc-hr", name: "Human Resources", code: "SS-120", parentId: "cc-shared", owner: "Dana Whitfield", type: "Shared Service", entityScope: "all", directCosts: 9800, allocatedCosts: 0, monthlyBudget: 10500, status: "Active" },
  { id: "cc-technology", name: "Technology", code: "SS-130", parentId: "cc-shared", owner: "Marcus Lee", type: "Shared Service", entityScope: "all", directCosts: 31200, allocatedCosts: 0, monthlyBudget: 29000, status: "Active" },
  { id: "cc-executive", name: "Executive", code: "AD-200", parentId: null, owner: "Jordan Blake", type: "Administrative", entityScope: "all", directCosts: 41500, allocatedCosts: 0, monthlyBudget: 42000, status: "Active" },
  { id: "cc-sales", name: "Sales", code: "RV-300", parentId: null, owner: "Priya Nair", type: "Revenue Generating", entityScope: "all", directCosts: 54300, allocatedCosts: 6200, monthlyBudget: 52000, status: "Active" },
  { id: "cc-marketing", name: "Marketing", code: "RV-310", parentId: null, owner: "Chris Dominguez", type: "Revenue Generating", entityScope: "all", directCosts: 47800, allocatedCosts: 5400, monthlyBudget: 50000, status: "Active" },
  { id: "cc-operations", name: "Operations", code: "OP-400", parentId: null, owner: "Sam Porter", type: "Operating", entityScope: "all", directCosts: 0, allocatedCosts: 0, monthlyBudget: 88000, status: "Active" },
  { id: "cc-callcenter", name: "Call Center", code: "OP-410", parentId: "cc-operations", owner: "Sam Porter", type: "Operating", entityScope: "CarDealer_ai", directCosts: 62400, allocatedCosts: 8100, monthlyBudget: 60000, status: "Active" },
  { id: "cc-cs", name: "Customer Success", code: "OP-420", parentId: "cc-operations", owner: "Renee Alvarez", type: "Operating", entityScope: "all", directCosts: 23900, allocatedCosts: 4300, monthlyBudget: 25000, status: "Active" },
  { id: "cc-fulfillment", name: "Fulfillment", code: "OP-430", parentId: "cc-operations", owner: "Sam Porter", type: "Operating", entityScope: "T3_Marketing", directCosts: 18700, allocatedCosts: 2600, monthlyBudget: 19000, status: "Active" },
  { id: "cc-technology-product", name: "Product", code: "OP-440", parentId: "cc-technology", owner: "Marcus Lee", type: "Operating", entityScope: "all", directCosts: 26800, allocatedCosts: 3900, monthlyBudget: 28000, status: "Active" },
  { id: "cc-legal", name: "Legal", code: "AD-210", parentId: null, owner: "Jordan Blake", type: "Administrative", entityScope: "all", directCosts: 6400, allocatedCosts: 0, monthlyBudget: 7000, status: "Active" },
  { id: "cc-admin", name: "Administration", code: "AD-220", parentId: null, owner: "Dana Whitfield", type: "Administrative", entityScope: "all", directCosts: 11200, allocatedCosts: 1800, monthlyBudget: 12000, status: "Active" },
];

export function getCostCenter(id: string | null): CostCenter | undefined {
  return COST_CENTERS.find((c) => c.id === id);
}

export function costCenterChildren(parentId: string): CostCenter[] {
  return COST_CENTERS.filter((c) => c.parentId === parentId);
}

// ─── Allocation rules ─────────────────────────────────────────────────────────

export const ALLOCATION_RULES: AllocationRule[] = [
  {
    id: "rule-allison-finance",
    name: "Allison Finance Compensation",
    ruleType: "Employee",
    sourceEntity: "CarDealer_ai",
    vendorOrEmployee: "Allison Carter",
    account: "6010 · Payroll — Finance",
    costCategory: "Finance",
    method: "Employee Time Based",
    destinations: [
      { entity: "CarDealer_ai", costCenterId: "cc-finance", percentage: 35 },
      { entity: "T3_Marketing", costCenterId: "cc-finance", percentage: 25 },
      { entity: "TopMrktr", costCenterId: "cc-finance", percentage: 25 },
      { entity: "Smile_More", costCenterId: "cc-finance", percentage: 15 },
    ],
    effectiveDate: "2026-01-01",
    endDate: null,
    priority: 1,
    approvalStatus: "Approved",
    active: true,
    monthlyImpactEstimate: 14500,
    version: 3,
  },
  {
    id: "rule-google-workspace",
    name: "Google Workspace Licenses",
    ruleType: "Vendor",
    sourceEntity: "CarDealer_ai",
    vendorOrEmployee: "Google LLC",
    account: "6410 · Software Subscriptions",
    costCategory: "Software",
    method: "User Count Based",
    destinations: [
      { entity: "CarDealer_ai", costCenterId: "cc-technology", percentage: 46 },
      { entity: "T3_Marketing", costCenterId: "cc-technology", percentage: 22 },
      { entity: "TopMrktr", costCenterId: "cc-technology", percentage: 20 },
      { entity: "Smile_More", costCenterId: "cc-technology", percentage: 12 },
    ],
    effectiveDate: "2026-01-01",
    endDate: null,
    priority: 2,
    approvalStatus: "Approved",
    active: true,
    monthlyImpactEstimate: 1860,
    version: 2,
  },
  {
    id: "rule-quickbooks",
    name: "QuickBooks Online Subscriptions",
    ruleType: "Vendor",
    sourceEntity: "CarDealer_ai",
    vendorOrEmployee: "Intuit Inc.",
    account: "6410 · Software Subscriptions",
    costCategory: "Software",
    method: "Equal Split",
    destinations: [
      { entity: "CarDealer_ai", costCenterId: "cc-accounting", percentage: 25 },
      { entity: "T3_Marketing", costCenterId: "cc-accounting", percentage: 25 },
      { entity: "TopMrktr", costCenterId: "cc-accounting", percentage: 25 },
      { entity: "Smile_More", costCenterId: "cc-accounting", percentage: 25 },
    ],
    effectiveDate: "2026-01-01",
    endDate: null,
    priority: 3,
    approvalStatus: "Approved",
    active: true,
    monthlyImpactEstimate: 940,
    version: 1,
  },
  {
    id: "rule-executive-comp",
    name: "Executive Compensation Split",
    ruleType: "Category",
    sourceEntity: "CarDealer_ai",
    vendorOrEmployee: "Jordan Blake",
    account: "6020 · Payroll — Executive",
    costCategory: "Executive",
    method: "Revenue Based",
    destinations: [
      { entity: "CarDealer_ai", costCenterId: "cc-executive", percentage: 48 },
      { entity: "T3_Marketing", costCenterId: "cc-executive", percentage: 24 },
      { entity: "TopMrktr", costCenterId: "cc-executive", percentage: 18 },
      { entity: "Smile_More", costCenterId: "cc-executive", percentage: 10 },
    ],
    effectiveDate: "2026-01-01",
    endDate: null,
    priority: 4,
    approvalStatus: "Approved",
    active: true,
    monthlyImpactEstimate: 27300,
    version: 2,
  },
  {
    id: "rule-insurance",
    name: "Business Insurance Premium",
    ruleType: "Vendor",
    sourceEntity: "T3_Marketing",
    vendorOrEmployee: "The Hartford",
    account: "6620 · Insurance",
    costCategory: "Insurance",
    method: "Headcount Based",
    destinations: [
      { entity: "CarDealer_ai", costCenterId: "cc-admin", percentage: 42 },
      { entity: "T3_Marketing", costCenterId: "cc-admin", percentage: 26 },
      { entity: "TopMrktr", costCenterId: "cc-admin", percentage: 19 },
      { entity: "Smile_More", costCenterId: "cc-admin", percentage: 13 },
    ],
    effectiveDate: "2026-03-01",
    endDate: null,
    priority: 5,
    approvalStatus: "Pending Approval",
    active: true,
    monthlyImpactEstimate: 3120,
    version: 1,
  },
  {
    id: "rule-hr-contractor",
    name: "Fractional HR Contractor",
    ruleType: "Vendor",
    sourceEntity: "TopMrktr",
    vendorOrEmployee: "PeopleOps Partners",
    account: "6310 · Professional Services",
    costCategory: "Human Resources",
    method: "Fixed Percentage",
    destinations: [
      { entity: "CarDealer_ai", costCenterId: "cc-hr", percentage: 40 },
      { entity: "T3_Marketing", costCenterId: "cc-hr", percentage: 30 },
      { entity: "TopMrktr", costCenterId: "cc-hr", percentage: 30 },
    ],
    effectiveDate: "2026-02-01",
    endDate: "2026-12-31",
    priority: 6,
    approvalStatus: "Draft",
    active: false,
    monthlyImpactEstimate: 2400,
    version: 1,
  },
];

export function getRule(id: string | null): AllocationRule | undefined {
  return ALLOCATION_RULES.find((r) => r.id === id);
}

// ─── Shared expenses ──────────────────────────────────────────────────────────

export const SHARED_EXPENSES: SharedExpense[] = [
  { id: "se-001", date: "2026-06-30", vendorOrEmployee: "Allison Carter", description: "June payroll — Finance lead (works across all 4 companies)", payingEntity: "CarDealer_ai", originalAccount: "6010 · Payroll — Finance", amount: 14500, costCategory: "Finance", ruleId: "rule-allison-finance", status: "Fully Allocated", allocatedAmount: 14500, costCenterId: "cc-finance", sourceSystem: "QuickBooks — CarDealer.ai", notes: "Recurring monthly allocation per approved rule." },
  { id: "se-002", date: "2026-06-28", vendorOrEmployee: "Jordan Blake", description: "June payroll — CEO compensation", payingEntity: "CarDealer_ai", originalAccount: "6020 · Payroll — Executive", amount: 27300, costCategory: "Executive", ruleId: "rule-executive-comp", status: "Fully Allocated", allocatedAmount: 27300, costCenterId: "cc-executive", sourceSystem: "QuickBooks — CarDealer.ai", notes: "" },
  { id: "se-003", date: "2026-06-15", vendorOrEmployee: "Google LLC", description: "Google Workspace — 58 seats, all companies", payingEntity: "CarDealer_ai", originalAccount: "6410 · Software Subscriptions", amount: 1860, costCategory: "Software", ruleId: "rule-google-workspace", status: "Fully Allocated", allocatedAmount: 1860, costCenterId: "cc-technology", sourceSystem: "QuickBooks — CarDealer.ai", notes: "" },
  { id: "se-004", date: "2026-06-12", vendorOrEmployee: "Intuit Inc.", description: "QuickBooks Online Advanced — 4 company files", payingEntity: "CarDealer_ai", originalAccount: "6410 · Software Subscriptions", amount: 940, costCategory: "Software", ruleId: "rule-quickbooks", status: "Fully Allocated", allocatedAmount: 940, costCenterId: "cc-accounting", sourceSystem: "QuickBooks — CarDealer.ai", notes: "" },
  { id: "se-005", date: "2026-06-20", vendorOrEmployee: "The Hartford", description: "Business insurance premium — umbrella policy", payingEntity: "T3_Marketing", originalAccount: "6620 · Insurance", amount: 3120, costCategory: "Insurance", ruleId: "rule-insurance", status: "Draft", allocatedAmount: 1310, costCenterId: "cc-admin", sourceSystem: "QuickBooks — T3 Marketing", notes: "Awaiting approval of headcount-based rule." },
  { id: "se-006", date: "2026-06-18", vendorOrEmployee: "PeopleOps Partners", description: "Fractional HR retainer — June", payingEntity: "TopMrktr", originalAccount: "6310 · Professional Services", amount: 2400, costCategory: "Human Resources", ruleId: "rule-hr-contractor", status: "Rule Suggested", allocatedAmount: 0, costCenterId: "cc-hr", sourceSystem: "QuickBooks — TopMrktr", notes: "Rule drafted, not yet active." },
  { id: "se-007", date: "2026-06-25", vendorOrEmployee: "WeWork", description: "Shared office space — Austin HQ", payingEntity: "CarDealer_ai", originalAccount: "6510 · Rent & Facilities", amount: 8200, costCategory: "General Administration", ruleId: null, status: "Unreviewed", allocatedAmount: 0, costCenterId: "cc-admin", sourceSystem: "QuickBooks — CarDealer.ai", notes: "Candidate for square-footage-based rule." },
  { id: "se-008", date: "2026-06-22", vendorOrEmployee: "Deel Inc.", description: "Global contractor payroll platform fee", payingEntity: "CarDealer_ai", originalAccount: "6410 · Software Subscriptions", amount: 640, costCategory: "Software", ruleId: null, status: "Unreviewed", allocatedAmount: 0, costCenterId: "cc-hr", sourceSystem: "QuickBooks — CarDealer.ai", notes: "" },
  { id: "se-009", date: "2026-06-10", vendorOrEmployee: "Ramp Legal LLP", description: "Intercompany agreement review", payingEntity: "CarDealer_ai", originalAccount: "6320 · Legal Fees", amount: 4750, costCategory: "Professional Services", ruleId: null, status: "Partially Allocated", allocatedAmount: 2375, costCenterId: "cc-legal", sourceSystem: "QuickBooks — CarDealer.ai", notes: "50% manually allocated to T3 Marketing pending final scope." },
  { id: "se-010", date: "2026-06-08", vendorOrEmployee: "HubSpot", description: "Marketing Hub Professional — shared portal", payingEntity: "T3_Marketing", originalAccount: "6410 · Software Subscriptions", amount: 1780, costCategory: "Marketing", ruleId: null, status: "Rule Suggested", allocatedAmount: 0, costCenterId: "cc-marketing", sourceSystem: "QuickBooks — T3 Marketing", notes: "Suggest client-count-based split T3/TopMrktr." },
  { id: "se-011", date: "2026-06-05", vendorOrEmployee: "Marcus Lee", description: "June payroll — Head of Technology (all products)", payingEntity: "CarDealer_ai", originalAccount: "6030 · Payroll — Technology", amount: 16800, costCategory: "Technology", ruleId: null, status: "Draft", allocatedAmount: 10080, costCenterId: "cc-technology", sourceSystem: "QuickBooks — CarDealer.ai", notes: "Time-study in progress; draft 60/20/12/8 split." },
  { id: "se-012", date: "2026-06-02", vendorOrEmployee: "AWS", description: "Cloud infrastructure — shared accounts", payingEntity: "CarDealer_ai", originalAccount: "6420 · Hosting & Infrastructure", amount: 5340, costCategory: "Technology", ruleId: null, status: "Unreviewed", allocatedAmount: 0, costCenterId: "cc-technology", sourceSystem: "QuickBooks — CarDealer.ai", notes: "Tag-based usage split available from Cost Explorer." },
  { id: "se-013", date: "2026-05-30", vendorOrEmployee: "Gusto", description: "Payroll platform fee — May", payingEntity: "CarDealer_ai", originalAccount: "6410 · Software Subscriptions", amount: 420, costCategory: "Software", ruleId: "rule-quickbooks", status: "Fully Allocated", allocatedAmount: 420, costCenterId: "cc-hr", sourceSystem: "QuickBooks — CarDealer.ai", notes: "Reuses equal-split rule." },
  { id: "se-014", date: "2026-05-28", vendorOrEmployee: "Slack Technologies", description: "Slack Business+ — company-wide", payingEntity: "CarDealer_ai", originalAccount: "6410 · Software Subscriptions", amount: 730, costCategory: "Software", ruleId: "rule-google-workspace", status: "Approved", allocatedAmount: 730, costCenterId: "cc-technology", sourceSystem: "QuickBooks — CarDealer.ai", notes: "Follows user-count rule." },
  { id: "se-015", date: "2026-05-15", vendorOrEmployee: "Dana Whitfield", description: "May payroll — People & Admin lead", payingEntity: "Smile_More", originalAccount: "6040 · Payroll — Admin", amount: 7900, costCategory: "Human Resources", ruleId: null, status: "Unreviewed", allocatedAmount: 0, costCenterId: "cc-hr", sourceSystem: "QuickBooks — Smile More", notes: "Supports all entities; needs time-based rule." },
  { id: "se-016", date: "2026-05-12", vendorOrEmployee: "Vanta", description: "Compliance automation — SOC 2", payingEntity: "CarDealer_ai", originalAccount: "6410 · Software Subscriptions", amount: 1150, costCategory: "Technology", ruleId: null, status: "Excluded", allocatedAmount: 0, costCenterId: "cc-technology", sourceSystem: "QuickBooks — CarDealer.ai", notes: "CarDealer.ai-only certification; excluded from allocation." },
];

// ─── Allocation journal entries (Approved Allocation scenario) ────────────────

export const ALLOCATION_ENTRIES: AllocationEntry[] = [
  // Allison Finance Compensation — $14,500 (35/25/25/15)
  { id: "ae-001", date: "2026-06-30", sourceTransaction: "se-001 · Allison Carter June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "CarDealer_ai", destinationCostCenterId: "cc-finance", driver: "Employee Time Based", percentage: 35, amount: 5075, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Jordan Blake" },
  { id: "ae-002", date: "2026-06-30", sourceTransaction: "se-001 · Allison Carter June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "T3_Marketing", destinationCostCenterId: "cc-finance", driver: "Employee Time Based", percentage: 25, amount: 3625, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Jordan Blake" },
  { id: "ae-003", date: "2026-06-30", sourceTransaction: "se-001 · Allison Carter June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "TopMrktr", destinationCostCenterId: "cc-finance", driver: "Employee Time Based", percentage: 25, amount: 3625, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Jordan Blake" },
  { id: "ae-004", date: "2026-06-30", sourceTransaction: "se-001 · Allison Carter June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "Smile_More", destinationCostCenterId: "cc-finance", driver: "Employee Time Based", percentage: 15, amount: 2175, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Jordan Blake" },
  // Executive comp — $27,300 (48/24/18/10)
  { id: "ae-005", date: "2026-06-28", sourceTransaction: "se-002 · Jordan Blake June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "CarDealer_ai", destinationCostCenterId: "cc-executive", driver: "Revenue Based", percentage: 48, amount: 13104, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-006", date: "2026-06-28", sourceTransaction: "se-002 · Jordan Blake June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "T3_Marketing", destinationCostCenterId: "cc-executive", driver: "Revenue Based", percentage: 24, amount: 6552, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-007", date: "2026-06-28", sourceTransaction: "se-002 · Jordan Blake June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "TopMrktr", destinationCostCenterId: "cc-executive", driver: "Revenue Based", percentage: 18, amount: 4914, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-008", date: "2026-06-28", sourceTransaction: "se-002 · Jordan Blake June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "Smile_More", destinationCostCenterId: "cc-executive", driver: "Revenue Based", percentage: 10, amount: 2730, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  // Google Workspace — $1,860 (46/22/20/12)
  { id: "ae-009", date: "2026-06-15", sourceTransaction: "se-003 · Google Workspace June", sourceEntity: "CarDealer_ai", destinationEntity: "CarDealer_ai", destinationCostCenterId: "cc-technology", driver: "User Count Based", percentage: 46, amount: 855.6, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-010", date: "2026-06-15", sourceTransaction: "se-003 · Google Workspace June", sourceEntity: "CarDealer_ai", destinationEntity: "T3_Marketing", destinationCostCenterId: "cc-technology", driver: "User Count Based", percentage: 22, amount: 409.2, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-011", date: "2026-06-15", sourceTransaction: "se-003 · Google Workspace June", sourceEntity: "CarDealer_ai", destinationEntity: "TopMrktr", destinationCostCenterId: "cc-technology", driver: "User Count Based", percentage: 20, amount: 372, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-012", date: "2026-06-15", sourceTransaction: "se-003 · Google Workspace June", sourceEntity: "CarDealer_ai", destinationEntity: "Smile_More", destinationCostCenterId: "cc-technology", driver: "User Count Based", percentage: 12, amount: 223.2, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  // QuickBooks — $940 equal split
  { id: "ae-013", date: "2026-06-12", sourceTransaction: "se-004 · QuickBooks Online June", sourceEntity: "CarDealer_ai", destinationEntity: "CarDealer_ai", destinationCostCenterId: "cc-accounting", driver: "Equal Split", percentage: 25, amount: 235, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-014", date: "2026-06-12", sourceTransaction: "se-004 · QuickBooks Online June", sourceEntity: "CarDealer_ai", destinationEntity: "T3_Marketing", destinationCostCenterId: "cc-accounting", driver: "Equal Split", percentage: 25, amount: 235, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-015", date: "2026-06-12", sourceTransaction: "se-004 · QuickBooks Online June", sourceEntity: "CarDealer_ai", destinationEntity: "TopMrktr", destinationCostCenterId: "cc-accounting", driver: "Equal Split", percentage: 25, amount: 235, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  { id: "ae-016", date: "2026-06-12", sourceTransaction: "se-004 · QuickBooks Online June", sourceEntity: "CarDealer_ai", destinationEntity: "Smile_More", destinationCostCenterId: "cc-accounting", driver: "Equal Split", percentage: 25, amount: 235, scenario: "approved-allocation", status: "Posted to Analytics", approvedBy: "Allison Carter" },
  // Insurance draft — $3,120 (42/26/19/13) draft scenario
  { id: "ae-017", date: "2026-06-20", sourceTransaction: "se-005 · Hartford premium June", sourceEntity: "T3_Marketing", destinationEntity: "CarDealer_ai", destinationCostCenterId: "cc-admin", driver: "Headcount Based", percentage: 42, amount: 1310.4, scenario: "draft-scenario", status: "Pending Review", approvedBy: null },
  { id: "ae-018", date: "2026-06-20", sourceTransaction: "se-005 · Hartford premium June", sourceEntity: "T3_Marketing", destinationEntity: "TopMrktr", destinationCostCenterId: "cc-admin", driver: "Headcount Based", percentage: 19, amount: 592.8, scenario: "draft-scenario", status: "Pending Review", approvedBy: null },
  { id: "ae-019", date: "2026-06-10", sourceTransaction: "se-009 · Legal — intercompany review", sourceEntity: "CarDealer_ai", destinationEntity: "T3_Marketing", destinationCostCenterId: "cc-legal", driver: "Manual Allocation", percentage: 50, amount: 2375, scenario: "approved-allocation", status: "Approved", approvedBy: "Jordan Blake" },
  { id: "ae-020", date: "2026-06-05", sourceTransaction: "se-011 · Marcus Lee June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "T3_Marketing", destinationCostCenterId: "cc-technology", driver: "Employee Time Based", percentage: 20, amount: 3360, scenario: "draft-scenario", status: "Draft", approvedBy: null },
  { id: "ae-021", date: "2026-06-05", sourceTransaction: "se-011 · Marcus Lee June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "TopMrktr", destinationCostCenterId: "cc-technology", driver: "Employee Time Based", percentage: 12, amount: 2016, scenario: "draft-scenario", status: "Draft", approvedBy: null },
  { id: "ae-022", date: "2026-06-05", sourceTransaction: "se-011 · Marcus Lee June payroll", sourceEntity: "CarDealer_ai", destinationEntity: "Smile_More", destinationCostCenterId: "cc-technology", driver: "Employee Time Based", percentage: 8, amount: 1344, scenario: "draft-scenario", status: "Draft", approvedBy: null },
];

// ─── Entity books (YTD, demo) ─────────────────────────────────────────────────

export const ENTITY_BOOKS: Record<EntitySlug, { bookRevenue: number; bookExpenses: number }> = {
  CarDealer_ai: { bookRevenue: 1840000, bookExpenses: 1522000 },
  T3_Marketing: { bookRevenue: 962000, bookExpenses: 799000 },
  TopMrktr: { bookRevenue: 714000, bookExpenses: 631000 },
  Smile_More: { bookRevenue: 388000, bookExpenses: 352000 },
};

/** Allocation impact per entity computed from posted approved entries. */
export function entityAllocationImpact(slug: EntitySlug): { allocatedOut: number; allocatedIn: number } {
  const posted = ALLOCATION_ENTRIES.filter(
    (e) =>
      e.scenario === "approved-allocation" &&
      (e.status === "Posted to Analytics" || e.status === "Posted to Accounting" || e.status === "Approved"),
  );
  const allocatedOut = posted
    .filter((e) => e.sourceEntity === slug && e.destinationEntity !== slug)
    .reduce((s, e) => s + e.amount, 0);
  const allocatedIn = posted
    .filter((e) => e.destinationEntity === slug && e.sourceEntity !== slug)
    .reduce((s, e) => s + e.amount, 0);
  return { allocatedOut, allocatedIn };
}

export interface EntityAdjustedRow {
  slug: EntitySlug;
  bookRevenue: number;
  bookExpenses: number;
  bookNetIncome: number;
  allocatedOut: number;
  allocatedIn: number;
  netAllocationImpact: number; // out - in (positive improves NI)
  adjustedExpenses: number;
  adjustedNetIncome: number;
  adjustedMargin: number; // %
}

export function entityAdjustedRows(): EntityAdjustedRow[] {
  return ENTITY_SLUGS.map((slug) => {
    const books = ENTITY_BOOKS[slug];
    const { allocatedOut, allocatedIn } = entityAllocationImpact(slug);
    const adjustedExpenses = books.bookExpenses - allocatedOut + allocatedIn;
    const adjustedNetIncome = books.bookRevenue - adjustedExpenses;
    return {
      slug,
      bookRevenue: books.bookRevenue,
      bookExpenses: books.bookExpenses,
      bookNetIncome: books.bookRevenue - books.bookExpenses,
      allocatedOut,
      allocatedIn,
      netAllocationImpact: allocatedOut - allocatedIn,
      adjustedExpenses,
      adjustedNetIncome,
      adjustedMargin: books.bookRevenue > 0 ? (adjustedNetIncome / books.bookRevenue) * 100 : 0,
    };
  });
}

// ─── Overview aggregates ──────────────────────────────────────────────────────

/** Scope shared expenses to an entity filter ("consolidated" = all). */
export function scopedSharedExpenses(entity: AnalyticsEntityFilter = "consolidated"): SharedExpense[] {
  if (entity === "consolidated") return SHARED_EXPENSES;
  return SHARED_EXPENSES.filter((e) => e.payingEntity === entity);
}

export function sharedExpenseTotals(entity: AnalyticsEntityFilter = "consolidated") {
  const rows = scopedSharedExpenses(entity);
  const total = rows.reduce((s, e) => s + e.amount, 0);
  const excluded = rows.filter((e) => e.status === "Excluded").reduce((s, e) => s + e.amount, 0);
  const allocated = rows.reduce((s, e) => s + e.allocatedAmount, 0);
  const unallocated = total - excluded - allocated;
  return {
    total,
    excluded,
    allocated,
    unallocated,
    coveragePct: total - excluded > 0 ? (allocated / (total - excluded)) * 100 : 0,
    countTotal: rows.length,
    countFullyAllocated: rows.filter((e) => e.status === "Fully Allocated" || e.status === "Approved").length,
    countPartial: rows.filter((e) => e.status === "Partially Allocated" || e.status === "Draft").length,
    countUnallocated: rows.filter((e) => e.status === "Unreviewed" || e.status === "Rule Suggested").length,
  };
}

export function sharedCostByCategory(entity: AnalyticsEntityFilter = "consolidated"): { category: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const e of scopedSharedExpenses(entity)) {
    if (e.status === "Excluded") continue;
    map.set(e.costCategory, (map.get(e.costCategory) ?? 0) + e.amount);
  }
  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export const MONTHLY_ALLOCATION_TREND: MonthlyAllocationTrend[] = [
  { month: "Jan", directCosts: 268000, sharedCosts: 52400, allocatedCosts: 38200, unallocatedCosts: 14200 },
  { month: "Feb", directCosts: 261000, sharedCosts: 54100, allocatedCosts: 41500, unallocatedCosts: 12600 },
  { month: "Mar", directCosts: 279000, sharedCosts: 56800, allocatedCosts: 45900, unallocatedCosts: 10900 },
  { month: "Apr", directCosts: 272000, sharedCosts: 55200, allocatedCosts: 46700, unallocatedCosts: 8500 },
  { month: "May", directCosts: 284000, sharedCosts: 58600, allocatedCosts: 50100, unallocatedCosts: 8500 },
  { month: "Jun", directCosts: 291000, sharedCosts: 61300, allocatedCosts: 53800, unallocatedCosts: 7500 },
];

// ─── Department / cost-center P&L (deterministic generator) ──────────────────

/** Deterministic pseudo-random in [0,1) from a string seed. */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function departmentPnlLines(costCenterId: string, entity: AnalyticsEntityFilter): PnlLine[] {
  const cc = getCostCenter(costCenterId);
  const scale = cc ? Math.max(cc.directCosts, 8000) : 20000;
  const entityFactor = entity === "consolidated" ? 1 : 0.25 + seeded(entity) * 0.3;
  const v = (label: string, base: number) =>
    Math.round(base * entityFactor * (0.85 + seeded(costCenterId + label) * 0.3));

  const isRevenueGen = cc?.type === "Revenue Generating" || costCenterId === "cc-callcenter";
  const revenue = isRevenueGen ? v("rev", scale * 3.2) : 0;

  const lines: PnlLine[] = [
    { label: "Direct Revenue", bookAmount: revenue, allocationAdjustment: 0, budget: Math.round(revenue * 1.05), priorPeriod: Math.round(revenue * 0.96), priorYear: Math.round(revenue * 0.85), kind: "revenue", section: "Revenue" },
    { label: "Other Revenue", bookAmount: v("orev", scale * 0.1), allocationAdjustment: 0, budget: v("orevb", scale * 0.12), priorPeriod: v("orevp", scale * 0.09), priorYear: v("orevy", scale * 0.08), kind: "revenue", section: "Revenue" },
    { label: "Direct Labor", bookAmount: v("labor", scale * 0.52), allocationAdjustment: v("laboradj", scale * 0.06), budget: v("laborb", scale * 0.5), priorPeriod: v("laborp", scale * 0.5), priorYear: v("labory", scale * 0.45), kind: "expense", section: "Cost of Revenue" },
    { label: "Contractors", bookAmount: v("contr", scale * 0.18), allocationAdjustment: v("contradj", scale * 0.02), budget: v("contrb", scale * 0.2), priorPeriod: v("contrp", scale * 0.17), priorYear: v("contry", scale * 0.15), kind: "expense", section: "Cost of Revenue" },
    { label: "Software", bookAmount: v("sw", scale * 0.09), allocationAdjustment: v("swadj", scale * 0.03), budget: v("swb", scale * 0.1), priorPeriod: v("swp", scale * 0.09), priorYear: v("swy", scale * 0.07), kind: "expense", section: "Cost of Revenue" },
    { label: "Call Center Costs", bookAmount: costCenterId === "cc-callcenter" ? v("cc", scale * 0.4) : v("cc", scale * 0.05), allocationAdjustment: 0, budget: v("ccb", scale * 0.06), priorPeriod: v("ccp", scale * 0.05), priorYear: v("ccy", scale * 0.04), kind: "expense", section: "Cost of Revenue" },
    { label: "Other Direct Costs", bookAmount: v("odc", scale * 0.07), allocationAdjustment: 0, budget: v("odcb", scale * 0.08), priorPeriod: v("odcp", scale * 0.07), priorYear: v("odcy", scale * 0.06), kind: "expense", section: "Cost of Revenue" },
    { label: "Sales", bookAmount: v("sales", scale * 0.12), allocationAdjustment: v("salesadj", scale * 0.01), budget: v("salesb", scale * 0.13), priorPeriod: v("salesp", scale * 0.11), priorYear: v("salesy", scale * 0.1), kind: "expense", section: "Operating Expenses" },
    { label: "Marketing", bookAmount: v("mktg", scale * 0.1), allocationAdjustment: v("mktgadj", scale * 0.015), budget: v("mktgb", scale * 0.11), priorPeriod: v("mktgp", scale * 0.1), priorYear: v("mktgy", scale * 0.09), kind: "expense", section: "Operating Expenses" },
    { label: "Finance", bookAmount: v("fin", scale * 0.06), allocationAdjustment: v("finadj", scale * 0.04), budget: v("finb", scale * 0.07), priorPeriod: v("finp", scale * 0.06), priorYear: v("finy", scale * 0.05), kind: "expense", section: "Operating Expenses" },
    { label: "Accounting", bookAmount: v("acct", scale * 0.04), allocationAdjustment: v("acctadj", scale * 0.02), budget: v("acctb", scale * 0.05), priorPeriod: v("acctp", scale * 0.04), priorYear: v("accty", scale * 0.04), kind: "expense", section: "Operating Expenses" },
    { label: "Technology", bookAmount: v("tech", scale * 0.11), allocationAdjustment: v("techadj", scale * 0.05), budget: v("techb", scale * 0.12), priorPeriod: v("techp", scale * 0.11), priorYear: v("techy", scale * 0.09), kind: "expense", section: "Operating Expenses" },
    { label: "Human Resources", bookAmount: v("hr", scale * 0.05), allocationAdjustment: v("hradj", scale * 0.02), budget: v("hrb", scale * 0.05), priorPeriod: v("hrp", scale * 0.05), priorYear: v("hry", scale * 0.04), kind: "expense", section: "Operating Expenses" },
    { label: "Executive", bookAmount: v("exec", scale * 0.08), allocationAdjustment: v("execadj", scale * 0.06), budget: v("execb", scale * 0.09), priorPeriod: v("execp", scale * 0.08), priorYear: v("execy", scale * 0.07), kind: "expense", section: "Operating Expenses" },
    { label: "Administration", bookAmount: v("admin", scale * 0.05), allocationAdjustment: v("adminadj", scale * 0.01), budget: v("adminb", scale * 0.06), priorPeriod: v("adminp", scale * 0.05), priorYear: v("adminy", scale * 0.05), kind: "expense", section: "Operating Expenses" },
    { label: "Other Operating Expenses", bookAmount: v("oox", scale * 0.04), allocationAdjustment: 0, budget: v("ooxb", scale * 0.05), priorPeriod: v("ooxp", scale * 0.04), priorYear: v("ooxy", scale * 0.04), kind: "expense", section: "Operating Expenses" },
  ];
  return lines;
}

// ─── Clients ──────────────────────────────────────────────────────────────────

export const CLIENTS: ClientProfitability[] = [
  { id: "cl-001", name: "Sunrise Auto Group", entity: "CarDealer_ai", revenue: 148000, directLabor: 41000, contractors: 12000, softwareCosts: 6800, callCosts: 18400, mediaCosts: 9200, allocatedOverhead: 21500, trend: [5200, 6100, 6800, 7400, 8100, 8600], employeesAssigned: 6, callVolume: 12400, projects: ["pr-001", "pr-004"] },
  { id: "cl-002", name: "Metro Motors", entity: "CarDealer_ai", revenue: 112000, directLabor: 36500, contractors: 8400, softwareCosts: 5100, callCosts: 15900, mediaCosts: 7600, allocatedOverhead: 17800, trend: [3400, 3600, 3900, 3700, 4200, 4400], employeesAssigned: 5, callVolume: 10100, projects: ["pr-001"] },
  { id: "cl-003", name: "Lakeside Dental Partners", entity: "Smile_More", revenue: 64000, directLabor: 22400, contractors: 4300, softwareCosts: 2900, callCosts: 8800, mediaCosts: 6100, allocatedOverhead: 9800, trend: [1100, 1300, 1250, 1400, 1600, 1650], employeesAssigned: 3, callVolume: 6200, projects: ["pr-005"] },
  { id: "cl-004", name: "Brightline SaaS Co.", entity: "T3_Marketing", revenue: 96000, directLabor: 28800, contractors: 9600, softwareCosts: 4200, callCosts: 2100, mediaCosts: 18400, allocatedOverhead: 13900, trend: [2900, 3300, 3100, 3600, 3900, 4100], employeesAssigned: 4, callVolume: 900, projects: ["pr-002"] },
  { id: "cl-005", name: "Peak Performance Gyms", entity: "T3_Marketing", revenue: 58000, directLabor: 21700, contractors: 6200, softwareCosts: 2800, callCosts: 1400, mediaCosts: 14800, allocatedOverhead: 9100, trend: [800, 700, 950, 640, 720, 810], employeesAssigned: 3, callVolume: 400, projects: ["pr-002", "pr-006"] },
  { id: "cl-006", name: "Harbor Realty Network", entity: "TopMrktr", revenue: 74000, directLabor: 24100, contractors: 7800, softwareCosts: 3300, callCosts: 5200, mediaCosts: 11900, allocatedOverhead: 11200, trend: [1500, 1700, 1400, 1900, 2100, 2050], employeesAssigned: 4, callVolume: 3600, projects: ["pr-003"] },
  { id: "cl-007", name: "Evergreen Home Services", entity: "TopMrktr", revenue: 39000, directLabor: 17900, contractors: 5600, softwareCosts: 2400, callCosts: 4700, mediaCosts: 8300, allocatedOverhead: 7400, trend: [-450, -380, -520, -290, -410, -350], employeesAssigned: 2, callVolume: 2900, projects: ["pr-003"] },
  { id: "cl-008", name: "Cascade Ortho Clinics", entity: "Smile_More", revenue: 51000, directLabor: 16800, contractors: 3900, softwareCosts: 2200, callCosts: 7100, mediaCosts: 5400, allocatedOverhead: 8600, trend: [900, 1050, 1150, 1200, 1350, 1420], employeesAssigned: 3, callVolume: 5100, projects: ["pr-005"] },
  { id: "cl-009", name: "Velocity Powersports", entity: "CarDealer_ai", revenue: 0, directLabor: 6200, contractors: 1800, softwareCosts: 700, callCosts: 2400, mediaCosts: 1900, allocatedOverhead: 2800, trend: [0, 0, 0, 0, 0, 0], employeesAssigned: 1, callVolume: 1600, projects: [] },
];

export function clientTotals(c: ClientProfitability) {
  const directCosts = c.directLabor + c.contractors + c.softwareCosts + c.callCosts + c.mediaCosts;
  const totalCost = directCosts + c.allocatedOverhead;
  const profit = c.revenue - totalCost;
  const margin = c.revenue > 0 ? (profit / c.revenue) * 100 : null;
  return { directCosts, totalCost, profit, margin };
}

export function clientStatus(c: ClientProfitability): ProfitabilityStatus {
  const { margin } = clientTotals(c);
  if (c.revenue === 0) return "Missing Data";
  if (margin === null) return "Missing Data";
  if (margin >= 25) return "Highly Profitable";
  if (margin >= 10) return "Profitable";
  if (margin >= 2) return "Low Margin";
  if (margin >= -2) return "Break Even";
  return "Unprofitable";
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export const PROJECTS: ProjectProfitability[] = [
  { id: "pr-001", name: "Dealer Lead Engine", kind: "Service", clientId: "cl-001", entity: "CarDealer_ai", revenue: 186000, laborCost: 64000, vendorCost: 21000, softwareCost: 9800, allocatedOverhead: 28400, status: "Active" },
  { id: "pr-002", name: "Paid Media Management", kind: "Service", clientId: "cl-004", entity: "T3_Marketing", revenue: 128000, laborCost: 41200, vendorCost: 33800, softwareCost: 6100, allocatedOverhead: 18700, status: "Active" },
  { id: "pr-003", name: "Local SEO Retainers", kind: "Service", clientId: "cl-006", entity: "TopMrktr", revenue: 93000, laborCost: 35600, vendorCost: 12200, softwareCost: 5000, allocatedOverhead: 14800, status: "Active" },
  { id: "pr-004", name: "Direct Mail Campaign — Q2", kind: "Campaign", clientId: "cl-001", entity: "CarDealer_ai", revenue: 42000, laborCost: 9800, vendorCost: 19600, softwareCost: 900, allocatedOverhead: 5200, status: "Completed" },
  { id: "pr-005", name: "Patient Recall Program", kind: "Client Engagement", clientId: "cl-003", entity: "Smile_More", revenue: 57000, laborCost: 21500, vendorCost: 6900, softwareCost: 3100, allocatedOverhead: 9400, status: "Active" },
  { id: "pr-006", name: "Call Center Campaign — Gyms", kind: "Campaign", clientId: "cl-005", entity: "T3_Marketing", revenue: 18000, laborCost: 11900, vendorCost: 3400, softwareCost: 800, allocatedOverhead: 3600, status: "On Hold" },
  { id: "pr-007", name: "FinanceOS Development", kind: "Project", clientId: null, entity: "CarDealer_ai", revenue: 0, laborCost: 48200, vendorCost: 7400, softwareCost: 5600, allocatedOverhead: 11800, status: "Internal" },
  { id: "pr-008", name: "Commission Portal", kind: "Project", clientId: null, entity: "CarDealer_ai", revenue: 0, laborCost: 22600, vendorCost: 2100, softwareCost: 1900, allocatedOverhead: 5400, status: "Internal" },
  { id: "pr-009", name: "Client Onboarding Revamp", kind: "Project", clientId: null, entity: "T3_Marketing", revenue: 0, laborCost: 9400, vendorCost: 1200, softwareCost: 700, allocatedOverhead: 2300, status: "Internal" },
  { id: "pr-010", name: "Website Rebuild — TopMrktr", kind: "Product", clientId: null, entity: "TopMrktr", revenue: 0, laborCost: 13800, vendorCost: 4600, softwareCost: 1100, allocatedOverhead: 3100, status: "Internal" },
];

export function projectTotals(p: ProjectProfitability) {
  const totalCost = p.laborCost + p.vendorCost + p.softwareCost + p.allocatedOverhead;
  const profit = p.revenue - totalCost;
  const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : null;
  return { totalCost, profit, margin };
}

export function projectStatus(p: ProjectProfitability): ProfitabilityStatus {
  const { margin } = projectTotals(p);
  if (p.revenue === 0) return "Missing Data";
  if (margin === null) return "Missing Data";
  if (margin >= 25) return "Highly Profitable";
  if (margin >= 10) return "Profitable";
  if (margin >= 2) return "Low Margin";
  if (margin >= -2) return "Break Even";
  return "Unprofitable";
}

// ─── Settings defaults ────────────────────────────────────────────────────────

export const DEFAULT_ANALYTICS_SETTINGS: AnalyticsSettings = {
  materialityThreshold: 25,
  defaultMethod: "Fixed Percentage",
  requireApproval: true,
  allocationPeriod: "Monthly",
  fiscalYearStart: "July",
  accountingBasis: "accrual",
  currency: "USD",
  rounding: "Cent",
  closedThrough: "2026-05-31",
};

// ─── Formatting helpers shared by Analytics pages ─────────────────────────────

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function fmtMoneyFull(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}
