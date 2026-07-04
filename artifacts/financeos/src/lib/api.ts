import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert } from "./types";
import type { ReportTemplateSummary, ReportGenerateRequest, BuiltReport } from "./reportTypes";
import type { AIStatus } from "./aiTypes";
import type { PipelineStatus } from "./pipelineTypes";
import type { ApiSource } from "./dataState";

const BASE = "/api";

export type Sourced<T> = { data: T; source: ApiSource };

function normalizeSource(value: unknown): ApiSource {
  return value === "live" || value === "cache" || value === "mock" ? value : "live";
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "API error");
  return json.data as T;
}

async function getSourced<T>(path: string): Promise<Sourced<T>> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "API error");
  return { data: json.data as T, source: normalizeSource(json.source) };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({ ok: false, error: `API ${path} → ${res.status}` }));
  if (!res.ok || !json.ok) throw new Error(json.error ?? `API ${path} → ${res.status}`);
  return json.data as T;
}

export const api = {
  model:            ()           => getSourced<DashboardData>("/model"),
  entityFinancials: (s: string)  => getSourced<FinancialsData>(`/model/${s}/financials`),
  entityCustomers:  (s: string)  => getSourced<CustomersData>(`/model/${s}/customers`),
  entityVendors:    (s: string)  => getSourced<VendorsData>(`/model/${s}/vendors`),
  entityBanking:    (s: string)  => getSourced<BankingData>(`/model/${s}/banking`),
  briefing:         ()           => get<BriefingResponse>("/briefing"),
  alerts:           ()           => get<Alert[]>("/alerts"),
  reportTemplates:  ()           => get<ReportTemplateSummary[]>("/reports"),
  generateReport:   (req: ReportGenerateRequest) => post<BuiltReport>("/reports/generate", req),
  aiStatus:         ()           => get<AIStatus>("/ai/status"),
  pipelineStatus:   ()           => get<PipelineStatus>("/pipeline/status"),
};
