import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert, ValidationMatrixData, EntityHistoryData, MetricSnapshotsData, EntityBudget, BvsAData, PortfolioBudget, BudgetPeriodInput, ConsolidatedCashFlow, HistoryResponse } from "./types";
import type { ReportTemplateSummary, ReportGenerateRequest, BuiltReport, ReportHistoryEntry } from "./reportTypes";
import type { AIStatus } from "./aiTypes";
import type { PipelineStatus } from "./pipelineTypes";
import type { ApiSource } from "./dataState";

import { SESSION_EXPIRED_EVENT } from "./auth";

const BASE = "/api";

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
