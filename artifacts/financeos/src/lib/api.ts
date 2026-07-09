import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert, EntityBudget, BvsAData, PortfolioBudget, BudgetPeriodInput } from "./types";
import type { ReportTemplateSummary, ReportGenerateRequest, BuiltReport } from "./reportTypes";
import type { AIStatus } from "./aiTypes";
import type { PipelineStatus } from "./pipelineTypes";
import type { ApiSource } from "./dataState";

import { SESSION_EXPIRED_EVENT } from "./auth";

const BASE = "/api";

export type Sourced<T> = { data: T; source: ApiSource };

function normalizeSource(value: unknown): ApiSource {
  return value === "live" || value === "cache" || value === "mock" ? value : "live";
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
  briefing:         ()           => getSourced<BriefingResponse>("/briefing"),
  alerts:           ()           => getSourced<Alert[]>("/alerts"),
  reportTemplates:  ()           => getSourced<ReportTemplateSummary[]>("/reports"),
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
};
