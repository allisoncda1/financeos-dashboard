import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert } from "./types";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  const json = await res.json();
  if (!json.ok) throw new Error(json.error ?? "API error");
  return json.data as T;
}

export const api = {
  model:            ()           => get<DashboardData>("/model"),
  entityFinancials: (s: string)  => get<FinancialsData>(`/model/${s}/financials`),
  entityCustomers:  (s: string)  => get<CustomersData>(`/model/${s}/customers`),
  entityVendors:    (s: string)  => get<VendorsData>(`/model/${s}/vendors`),
  entityBanking:    (s: string)  => get<BankingData>(`/model/${s}/banking`),
  briefing:         ()           => get<BriefingResponse>("/briefing"),
  alerts:           ()           => get<Alert[]>("/alerts"),
};
