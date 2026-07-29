import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert, ValidationMatrixData, EntityHistoryData, MetricSnapshotsData, EntityBudget, BvsAData, PortfolioBudget, BudgetPeriodInput, ConsolidatedCashFlow, HistoryResponse } from "./types";
import type { ReportTemplateSummary, ReportGenerateRequest, BuiltReport, ReportHistoryEntry } from "./reportTypes";
import type { AIStatus } from "./aiTypes";
import type { PipelineStatus } from "./pipelineTypes";
import type { ApiSource } from "./dataState";

import { SESSION_EXPIRED_EVENT } from "./auth";

const BASE = "/api";

/** Build a ?from=…&to=… query string for period-scoped endpoints. Returns "" when both are null. */
function buildPeriodQS(from?: string | null, to?: string | null): string {
  const parts: string[] = [];
  if (from) parts.push(`from=${encodeURIComponent(from)}`);
  if (to)   parts.push(`to=${encodeURIComponent(to)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export type Sourced<T> = { data: T; source: ApiSource };

function normalizeSource(value: unknown): ApiSource {
  return value === "db" || value === "live" || value === "cache" || value === "mock" ? value : "live";
}

/**
 * A 401 from any API call means the session ended (expired, logged out
 * elsewhere, server restarted). Broadcast it once so AuthProvider clears
 * user state and ProtectedRoute redirects to /login?reason=session_expired,
 * instead of every hook needing its own 401 handling.
 */
function handleUnauthorized(): void {
  if (window.location.pathname.endsWith("/login")) return;
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  const url = new URL(window.location.href);
  const loginPath = url.pathname.replace(/\/[^/]*$/, "/login");
  window.location.href = `${loginPath}?reason=session_expired`;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "API error");
  return json.data as T;
}

async function getSourced<T>(path: string): Promise<Sourced<T>> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "API error");
  return { data: json.data as T, source: normalizeSource(json.source) };
}

/** Extended response shape for accounting endpoints that carry optional top-level metadata. */
export type AccountingSourced<T> = Sourced<T> & {
  reconciliation?: ArApReconciliation | null;
  priorPeriod?: PriorPeriodMeta | null;
};

/**
 * Like getSourced but also extracts the optional `reconciliation` and `priorPeriod`
 * fields present on accounting invoices, bills, and transactions endpoints.
 */
async function getAccountingSourced<T>(path: string): Promise<AccountingSourced<T>> {
  const res = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "API error");
  return {
    data: json.data as T,
    source: normalizeSource(json.source),
    reconciliation: (json.reconciliation as ArApReconciliation | null | undefined) ?? null,
    priorPeriod: (json.priorPeriod as PriorPeriodMeta | null | undefined) ?? null,
  };
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  const json = await res.json().catch(() => ({ ok: false, error: `API ${path} → ${res.status}` }));
  if (!res.ok || !json.ok) throw new Error(json.error ?? `API ${path} → ${res.status}`);
  return json.data as T;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  const json = await res.json().catch(() => ({ ok: false, error: `API ${path} → ${res.status}` }));
  if (!res.ok || !json.ok) throw new Error(json.error ?? `API ${path} → ${res.status}`);
  return json.data as T;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", credentials: "include" });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? `API ${path} → ${res.status}`);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  const json = await res.json().catch(() => ({ ok: false, error: `API ${path} → ${res.status}` }));
  if (!res.ok || !json.ok) throw new Error(json.error ?? `API ${path} → ${res.status}`);
  return json.data as T;
}

export type DownloadedFile = { blob: Blob; filename: string };

/**
 * postForBlob — for binary/text report formats (pdf/excel/html), the server
 * responds with a raw file body (not the {ok, data} JSON envelope), so this
 * reads the response as a Blob and extracts the filename from
 * Content-Disposition instead of parsing JSON.
 */
async function postForBlob(path: string, body: unknown): Promise<DownloadedFile> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error ?? `API ${path} → ${res.status}`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "report";
  return { blob, filename };
}

export const api = {
  model:            ()           => getSourced<DashboardData>("/model"),
  entityFinancials: (s: string)  => getSourced<FinancialsData>(`/model/${s}/financials`),
  entityCustomers:  (s: string)  => getSourced<CustomersData>(`/model/${s}/customers`),
  entityVendors:    (s: string)  => getSourced<VendorsData>(`/model/${s}/vendors`),
  entityBanking:    (s: string)  => getSourced<BankingData>(`/model/${s}/banking`),
  entityHistory:    (s: string)  => getSourced<EntityHistoryData>(`/model/${s}/history`),
  consolidatedCashFlow: (slugs: string[]) => {
    const qs = slugs.length ? `?slugs=${encodeURIComponent(slugs.join(","))}` : "";
    return getSourced<ConsolidatedCashFlow>(`/model/cashflow${qs}`);
  },
  history: (slugs: string[]) => {
    const qs = slugs.length ? `?slugs=${encodeURIComponent(slugs.join(","))}` : "";
    return getSourced<HistoryResponse>(`/model/history${qs}`);
  },
  historySnapshots: ()           => getSourced<MetricSnapshotsData>("/model/history/snapshots"),
  briefing:         ()           => getSourced<BriefingResponse>("/briefing"),
  validationMatrix: ()           => getSourced<ValidationMatrixData>("/validation/matrix"),
  alerts:           ()           => getSourced<Alert[]>("/alerts"),
  reportTemplates:  ()           => getSourced<ReportTemplateSummary[]>("/reports"),
  reportHistory:    (slug?: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (slug)   params.set("slug",   slug);
    if (limit)  params.set("limit",  String(limit));
    if (offset) params.set("offset", String(offset));
    const qs = params.toString();
    return getSourced<ReportHistoryEntry[]>(`/reports/history${qs ? `?${qs}` : ""}`);
  },
  generateReport:   (req: ReportGenerateRequest) => post<BuiltReport>("/reports/generate", req),
  downloadReport:   (req: ReportGenerateRequest) => postForBlob("/reports/generate", req),
  aiStatus:         ()           => getSourced<AIStatus>("/ai/status"),
  pipelineStatus:   ()           => getSourced<PipelineStatus>("/pipeline/status"),

  entityBudget:         (slug: string, year?: number) =>
    getSourced<EntityBudget>(`/budget/${slug}${year ? `?year=${year}` : ""}`),
  budgetVsActual:       (slug: string, year?: number) =>
    getSourced<BvsAData>(`/budget/${slug}/vs-actual${year ? `?year=${year}` : ""}`),
  portfolioBudget:      (year?: number) =>
    getSourced<PortfolioBudget>(`/budget/portfolio${year ? `?year=${year}` : ""}`),
  upsertBudgetPeriod:   (slug: string, data: BudgetPeriodInput & { period_type?: "month" | "annual" }) =>
    put<BudgetPeriodInput>(`/budget/${slug}/period`, data),
  upsertAnnualBudget:   (slug: string, data: { year: number } & Partial<BudgetPeriodInput>) =>
    put<BudgetPeriodInput>(`/budget/${slug}/annual`, data),

  // ── Report Drafts ────────────────────────────────────────────────────────
  createDraft: (opts: { template: string; entities: string[] | "all"; period: string }) =>
    post<ReportDraft>("/drafts", opts),
  generateDraft: (id: string, format: "json" | "pdf" | "html") =>
    format === "json"
      ? post<{ reportId: string; historyId: string; draftId: string; draftVersion: number; approvedBy: string; approvedAt: string }>(
          `/drafts/${id}/generate`,
          { format },
        )
      : Promise.reject(new Error("Use downloadDraft for pdf/html formats")),
  downloadDraft: (id: string, format: "pdf" | "html") =>
    postForBlob(`/drafts/${id}/generate`, { format }),
  getDraft: (id: string) =>
    get<ReportDraft>(`/drafts/${id}`),
  listDrafts: (template: string, period: string) =>
    get<ReportDraft[]>(`/drafts?template=${encodeURIComponent(template)}&period=${encodeURIComponent(period)}`),
  saveDraftEdits: (id: string, editableContent: unknown, changeSummary?: string) =>
    patch<ReportDraft>(`/drafts/${id}/edits`, { editableContent, changeSummary }),
  getDraftVersions: (id: string) =>
    get<ReportDraftVersion[]>(`/drafts/${id}/versions`),
  restoreDraftVersion: (id: string, versionNumber: number) =>
    post<ReportDraft>(`/drafts/${id}/restore`, { versionNumber }),
  submitDraftForReview: (id: string) =>
    post<ReportDraft>(`/drafts/${id}/submit`, {}),
  approveDraft: (id: string) =>
    post<ReportDraft>(`/drafts/${id}/approve`, {}),
  getDraftPreview: (id: string) =>
    get<{ html: string; draft: ReportDraft; narrativeSectionKeys: string[]; isStale: boolean; staleReason: string | null }>(`/drafts/${id}/preview`),

  // ── Commentary ───────────────────────────────────────────────────────────
  getCommentary: (entity: string, period: string, template: string) =>
    get<CommentaryEntry[]>(`/drafts/commentary?entity=${encodeURIComponent(entity)}&period=${encodeURIComponent(period)}&template=${encodeURIComponent(template)}`),
  saveCommentary: (data: {
    entitySlug: string; reportingPeriod: string; templateId: string;
    sectionKey: string; commentaryType: "management_commentary" | "recommended_action";
    content: string; sortOrder?: number; existingId?: string;
  }) => post<CommentaryEntry>("/drafts/commentary", data),
  toggleCommentary: (id: string, included: boolean) =>
    patch<CommentaryEntry>(`/drafts/commentary/${id}/toggle`, { included }),
  deleteCommentary: (id: string) =>
    del(`/drafts/commentary/${id}`),
  approveCommentary: (id: string) =>
    post<CommentaryEntry>(`/drafts/commentary/${id}/approve`, {}),
  reorderCommentary: (ids: string[]) =>
    post<void>("/drafts/commentary/reorder", { ids }),

  // ── Accounting module ─────────────────────────────────────────────────────
  // customers/vendors/accounts are master records — not date-filtered.
  // invoices/transactions/bills accept optional from/to (YYYY-MM-DD) for period scoping.
  accountingCustomers:    (slug: string) => getSourced<AccountingCustomer[]>(`/accounting/${slug}/customers`),
  accountingVendors:      (slug: string) => getSourced<AccountingVendor[]>(`/accounting/${slug}/vendors`),
  accountingInvoices:     (slug: string, from?: string | null, to?: string | null) => {
    const qs = buildPeriodQS(from, to);
    return getAccountingSourced<AccountingInvoice[]>(`/accounting/${slug}/invoices${qs}`);
  },
  accountingAccounts:     (slug: string) => getSourced<AccountingAccount[]>(`/accounting/${slug}/accounts`),
  accountingTransactions: (slug: string, from?: string | null, to?: string | null) => {
    const qs = buildPeriodQS(from, to);
    return getAccountingSourced<AccountingTransaction[]>(`/accounting/${slug}/transactions${qs}`);
  },
  accountingBills:        (slug: string, from?: string | null, to?: string | null) => {
    const qs = buildPeriodQS(from, to);
    return getAccountingSourced<AccountingBill[]>(`/accounting/${slug}/bills${qs}`);
  },
  accountingCreditMemos:  (slug: string) => getSourced<AccountingCreditMemo[]>(`/accounting/${slug}/credit-memos`),
  accountingVendorCredits:(slug: string) => getSourced<AccountingVendorCredit[]>(`/accounting/${slug}/vendor-credits`),

  // ── Commissions module ─────────────────────────────────────────────────────
  commissionLines: (slug: string, params?: {
    representativeId?: string; lineStatus?: string;
    periodYear?: number; periodMonth?: number; limit?: number; offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.representativeId) qs.set("representativeId", params.representativeId);
    if (params?.lineStatus) qs.set("lineStatus", params.lineStatus);
    if (params?.periodYear)  qs.set("periodYear", String(params.periodYear));
    if (params?.periodMonth) qs.set("periodMonth", String(params.periodMonth));
    if (params?.limit)  qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    return get<{ data: CommissionRunLine[]; total: number }>(`/commissions/${slug}/lines${q ? `?${q}` : ""}`);
  },
  commissionSummary: (slug: string) =>
    get<{ data: CommissionRepSummary[] }>(`/commissions/${slug}/summary`),
  commissionRepresentatives: (slug: string) =>
    get<{ data: CommissionRepresentative[] }>(`/commissions/${slug}/representatives`),
  commissionRules: (slug: string) =>
    get<{ data: CommissionRule[] }>(`/commissions/${slug}/rules`),
  commissionRulePreview: (slug: string, body: CommissionRuleInput) =>
    post<{ data: CommissionRulePreview }>(`/commissions/${slug}/rules/preview`, body),
  createCommissionRule: (slug: string, body: CommissionRuleInput) =>
    post<{ data: CommissionRule }>(`/commissions/${slug}/rules`, body),
  ingestCommissions: (slug: string, body?: { fromDate?: string; toDate?: string }) =>
    post<{ data: unknown }>(`/commissions/${slug}/ingest`, body ?? {}),
  approveCommissionLine: (slug: string, lineId: string) =>
    post<{ ok: boolean }>(`/commissions/${slug}/lines/${lineId}/approve`, {}),
  lockCommissionPeriod: (slug: string, year: number, month: number) =>
    post<{ ok: boolean }>(`/commissions/${slug}/periods/lock`, { year, month }),
};

// ── Accounting module types ────────────────────────────────────────────────
// These mirror the JSON shapes returned by /api/accounting/:slug/* endpoints.

export type AccountingCustomer = {
  id: string;
  qboId: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  balance: number;
  currency: string;
  isActive: boolean;
  syncedAt: string | null;
};

export type AccountingVendor = {
  id: string;
  qboId: string;
  displayName: string;
  email: string | null;
  balance: number;
  currency: string;
  isActive: boolean;
  syncedAt: string | null;
};

export type AccountingInvoice = {
  id: string;
  qboId: string;
  customerName: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  amount: number;
  balance: number;
  status: string | null;
  daysOverdue: number | null;
  currency: string;
  memo: string | null;
  syncedAt: string | null;
};

export type AccountingAccount = {
  id: string;
  qboId: string;
  name: string;
  fullyQualifiedName: string | null;
  accountType: string;
  accountSubtype: string | null;
  classification: string | null;
  currentBalance: number;
  currency: string;
  isActive: boolean;
  isSubAccount: boolean;
  parentQboId: string | null;
  syncedAt: string | null;
};

export type AccountingTransaction = {
  id: string;
  qboId: string | null;
  accountId: string | null;
  transactionDate: string | null;
  transactionType: string | null;
  memo: string | null;
  amount: number | null;
  currency: string;
  category: string | null;
  isReconciled: boolean;
  syncedAt: string | null;
};

export type AccountingBill = {
  id: string;
  qboId: string;
  vendorName: string | null;
  billDate: string | null;
  dueDate: string | null;
  amount: number;
  balance: number;
  status: string | null;
  daysOverdue: number | null;
  currency: string;
  memo: string | null;
  syncedAt: string | null;
};

/**
 * Prior-period open item metadata — returned alongside invoices, bills, and
 * transactions when a period lower-bound (`from`) is active and open items
 * exist before that date. Null when no prior-period open items exist or when
 * the selected period has no lower bound (all_time).
 */
export type PriorPeriodMeta = {
  /** Number of excluded open items (invoices / bills / unreconciled transactions). */
  count: number;
  /**
   * Sum of open balances for excluded invoices or bills.
   * Undefined for transactions (no balance column).
   */
  totalBalance?: number;
  /** ISO date of the earliest excluded item. */
  earliestDate: string | null;
  /** ISO date of the latest excluded item. */
  latestDate: string | null;
};

export type AccountingCreditMemo = {
  id: string;
  qboId: string;
  docNumber: string | null;
  customerName: string | null;
  txnDate: string | null;
  currency: string;
  totalAmt: number;
  remainingCredit: number;
  applyStatus: string;
  isVoided: boolean;
  syncedAt: string | null;
};

export type AccountingVendorCredit = {
  id: string;
  qboId: string;
  docNumber: string | null;
  vendorName: string | null;
  txnDate: string | null;
  currency: string;
  totalAmt: number;
  remainingBalance: number;
  applyStatus: string;
  isVoided: boolean;
  syncedAt: string | null;
};

/** AR/AP reconciliation metadata returned alongside invoices and bills endpoints. */
export type ArApReconciliation = {
  officialTotal: number | null;
  normalizedGrossTotal: number | null;
  unappliedCredits: number | null;
  normalizedNetTotal: number | null;
  signedDifference: number | null;
  absoluteDifference: number | null;
  reconciliationStatus: string | null;
  officialSource: string;
  officialAsOf: string | null;
  normalizedAsOf: string | null;
  explanation: string | null;
};

// ── Frontend-side draft types ───────────────────────────────────────────────

export type CommentaryType = "financeos_analysis" | "management_commentary" | "recommended_action";
export type CommentaryStatus = "draft" | "approved" | "superseded" | "waived";
export type DraftStatus = "draft" | "ready_for_review" | "approved" | "superseded" | "generated";

export type CommentaryEntry = {
  id: string;
  entitySlug: string;
  reportingPeriod: string;
  templateId: string;
  sectionKey: string;
  commentaryType: CommentaryType;
  content: string;
  provenance: unknown;
  status: CommentaryStatus;
  version: number;
  included: boolean;
  sortOrder: number;
  createdBy: string | null;
  updatedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type ReportDraft = {
  id: string;
  templateId: string;
  reportingPeriod: string;
  entitySlugs: string[];
  status: DraftStatus;
  currentVersion: number;
  generatedAnalysis: unknown;
  editableContent: unknown;
  dataFingerprint: string | null;
  isStale: boolean;
  staleReason: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

export type ReportDraftVersion = {
  id: string;
  reportDraftId: string;
  versionNumber: number;
  contentSnapshot: unknown;
  changeSummary: string | null;
  createdBy: string | null;
  createdAt: string;
};

// ── Commission module types ────────────────────────────────────────────────────

export type CommissionRepresentative = {
  id: string;
  slug: string;
  displayName: string;
  representativeType: "external_rep" | "internal_house";
  payoutEligible: boolean;
  notes: string | null;
};

export type CommissionRule = {
  id: string;
  entityId: string;
  representativeId: string;
  coreCustomerId: string | null;
  customerNamePattern: string | null;
  formulaType: string;
  calculationBasis: string | null;
  commissionRate: number | null;
  fixedAmount: number | null;
  payableTrigger: string;
  ruleVersion: number;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
};

export type CommissionRuleInput = {
  representativeId: string;
  coreCustomerId?: string | null;
  customerNamePattern?: string | null;
  formulaType: string;
  calculationBasis?: string | null;
  commissionRate?: number | null;
  fixedAmount?: number | null;
  payableTrigger: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  notes?: string | null;
};

export type CommissionRunLine = {
  id: string;
  entityId: string;
  invoiceId: string;
  invoiceQboId: string;
  invoiceDocNumber: string | null;
  invoiceDate: string | null;
  customerId: string | null;
  customerName: string | null;
  invoiceAmount: number | null;
  invoiceStatus: string | null;
  representativeId: string | null;
  representativeSlug: string | null;
  representativeDisplayName: string | null;
  attributionMatchType: string | null;
  commissionRuleId: string | null;
  formulaType: string | null;
  calculationBasis: string | null;
  commissionRate: number | null;
  grossProfit: number | null;
  expensesAmount: number | null;
  commissionAmount: number | null;
  lineStatus: string;
  payoutEligible: boolean;
  exclusionReason: string | null;
  sourceFingerprint: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
};

export type CommissionRepSummary = {
  repSlug: string | null;
  repName: string | null;
  payoutEligible: boolean | null;
  lineCount: number;
  totalInvoiceAmount: number | null;
  totalGrossProfit: number | null;
  totalCommission: number | null;
  needsConfig: number;
  needsReview: number;
  calculated: number;
  approved: number;
  locked: number;
};

export type CommissionRulePreview = {
  lines: {
    invoiceId: string;
    invoiceDocNumber: string | null;
    invoiceDate: string | null;
    customerName: string | null;
    invoiceAmount: number | null;
    currentStatus: string;
    currentCommission: number | null;
    projectedCommission: number | null;
    projectedBasis: string | null;
    projectedStatus: string;
  }[];
  affectedCount: number;
  projectedTotal: number | null;
};

