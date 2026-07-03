import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getMockData, getFinancials, getCustomers, getVendors, getBanking } from '@/lib/mock';
import { ENTITY_SLUGS } from '@/lib/entities';
import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert } from '@/lib/types';
import type { ReportTemplateSummary, ReportGenerateRequest, BuiltReport } from '@/lib/reportTypes';
import type { AIStatus } from '@/lib/aiTypes';
import type { PipelineStatus } from '@/lib/pipelineTypes';

export function useDashboardData(): DashboardData {
  const [data, setData] = useState<DashboardData>(getMockData);
  useEffect(() => { api.model().then(setData).catch(() => {}); }, []);
  return data;
}

export function useEntityFinancials(slug: EntitySlug): FinancialsData {
  const [data, setData] = useState<FinancialsData>(() => getFinancials(slug));
  useEffect(() => { api.entityFinancials(slug).then(setData).catch(() => {}); }, [slug]);
  return data;
}

/**
 * useAllEntityFinancials — fetches live financials for every entity in
 * parallel. Starts from mock data (same pattern as the other hooks) and
 * swaps in the live API results once all fetches resolve.
 */
export function useAllEntityFinancials(): Record<EntitySlug, FinancialsData> {
  const [data, setData] = useState<Record<EntitySlug, FinancialsData>>(() =>
    Object.fromEntries(ENTITY_SLUGS.map(s => [s, getFinancials(s)])) as Record<EntitySlug, FinancialsData>
  );
  useEffect(() => {
    let cancelled = false;
    Promise.all(ENTITY_SLUGS.map(s => api.entityFinancials(s).then(f => [s, f] as const)))
      .then(entries => {
        if (!cancelled) setData(Object.fromEntries(entries) as Record<EntitySlug, FinancialsData>);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return data;
}

export function useEntityCustomers(slug: EntitySlug): CustomersData {
  const [data, setData] = useState<CustomersData>(() => getCustomers(slug));
  useEffect(() => { api.entityCustomers(slug).then(setData).catch(() => {}); }, [slug]);
  return data;
}

export function useEntityVendors(slug: EntitySlug): VendorsData {
  const [data, setData] = useState<VendorsData>(() => getVendors(slug));
  useEffect(() => { api.entityVendors(slug).then(setData).catch(() => {}); }, [slug]);
  return data;
}

export function useEntityBanking(slug: EntitySlug): BankingData {
  const [data, setData] = useState<BankingData>(() => getBanking(slug));
  useEffect(() => { api.entityBanking(slug).then(setData).catch(() => {}); }, [slug]);
  return data;
}

/**
 * useAlerts — fetches live operational alerts from the Rules Engine via
 * GET /api/alerts. Returns an empty array until the fetch resolves so
 * callers never see undefined.
 */
export function useAlerts(): { data: Alert[]; loading: boolean; failed: boolean } {
  const [data, setData] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.alerts()
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, failed };
}

/**
 * useBriefing — fetches the deterministic AI CFO briefing from /api/briefing.
 * Returns `null` on failure (never throws), so callers can render a graceful
 * fallback instead of crashing.
 */
export function useBriefing(): { data: BriefingResponse | null; loading: boolean; failed: boolean } {
  const [data, setData] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.briefing()
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, failed };
}

/**
 * useReportTemplates — fetches the Report Engine's available template
 * catalog from GET /api/reports. Returns an empty array until the fetch
 * resolves so callers never see undefined.
 */
export function useReportTemplates(): { data: ReportTemplateSummary[]; loading: boolean; failed: boolean } {
  const [data, setData] = useState<ReportTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.reportTemplates()
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, failed };
}

/**
 * useReportGenerator — imperative helper to POST /api/reports/generate.
 * Tracks in-flight/loading/error state so the Report Center UI can drive
 * a "Generate" button without duplicating fetch plumbing.
 */
export function useReportGenerator() {
  const [report, setReport] = useState<BuiltReport | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (req: ReportGenerateRequest) => {
    setGenerating(true);
    setError(null);
    try {
      const result = await api.generateReport(req);
      setReport(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate report";
      setError(message);
      throw err;
    } finally {
      setGenerating(false);
    }
  }, []);

  const reset = useCallback(() => { setReport(null); setError(null); }, []);

  return { report, generating, error, generate, reset };
}

/**
 * usePipelineStatus — fetches the external pipeline's self-reported status
 * from GET /api/pipeline/status, once on mount (no polling). Read-only —
 * FinanceOS never runs or triggers the pipeline, it only displays what it
 * last reported.
 */
export function usePipelineStatus(): { data: PipelineStatus | null; loading: boolean; failed: boolean } {
  const [data, setData] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.pipelineStatus()
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, failed };
}

/**
 * useAiStatus — fetches the AI Platform's status (provider, model, cache
 * stats) from GET /api/ai/status. Read-only — used to render the Settings
 * page's AI Platform section.
 */
export function useAiStatus(): { data: AIStatus | null; loading: boolean; failed: boolean } {
  const [data, setData] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.aiStatus()
      .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
      .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { data, loading, failed };
}
