import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { getMockData, getFinancials, getCustomers, getVendors, getBanking } from '@/lib/mock';
import { ENTITY_SLUGS } from '@/lib/entities';
import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert } from '@/lib/types';
import type { ReportTemplateSummary, ReportGenerateRequest, BuiltReport } from '@/lib/reportTypes';
import type { AIStatus } from '@/lib/aiTypes';
import type { PipelineStatus } from '@/lib/pipelineTypes';
import {
  reportDataSource,
  clearDataSource,
  USE_MOCK_FALLBACK,
  type FetchState,
} from '@/lib/dataState';

/**
 * useTrackedFetch — shared plumbing for every hook that surfaces
 * {data, source, lastSuccessfulFetch}. Never silently swaps in mock data:
 * - starts at "loading" (or "mock" if VITE_USE_MOCK=true, dev only)
 * - on success: source = whatever the server reported ("live"/"cache"/"mock")
 * - on failure: keeps last known data if any, else data=null, source="unavailable"
 * Also reports its current state into the shared registry so the global
 * DataSourceBanner can reflect whichever hooks are mounted on the page.
 */
function useTrackedFetch<T>(
  key: string,
  fetcher: () => Promise<{ data: T; source: 'live' | 'cache' | 'mock' }>,
  mockInit: () => T,
  deps: unknown[],
): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>(() =>
    USE_MOCK_FALLBACK
      ? { data: mockInit(), source: 'mock', lastSuccessfulFetch: null }
      : { data: null, source: 'loading', lastSuccessfulFetch: null },
  );
  const lastGoodRef = useRef<T | null>(USE_MOCK_FALLBACK ? mockInit() : null);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then(({ data, source }) => {
        if (cancelled) return;
        lastGoodRef.current = data;
        setState({ data, source, lastSuccessfulFetch: new Date().toISOString() });
      })
      .catch(() => {
        if (cancelled) return;
        setState((prev) => ({
          data: lastGoodRef.current,
          source: lastGoodRef.current ? prev.source : 'unavailable',
          lastSuccessfulFetch: prev.lastSuccessfulFetch,
        }));
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reportDataSource(key, { source: state.source, lastSuccessfulFetch: state.lastSuccessfulFetch });
    return () => clearDataSource(key);
  }, [key, state.source, state.lastSuccessfulFetch]);

  return state;
}

export function useDashboardData(): FetchState<DashboardData> {
  return useTrackedFetch('dashboard', () => api.model(), getMockData, []);
}

export function useEntityFinancials(slug: EntitySlug): FetchState<FinancialsData> {
  return useTrackedFetch(
    `entityFinancials:${slug}`,
    () => api.entityFinancials(slug),
    () => getFinancials(slug),
    [slug],
  );
}

/**
 * useAllEntityFinancials — fetches live financials for every entity in
 * parallel. Never silently mock-swaps: starts at "loading" (or "mock" in
 * dev when VITE_USE_MOCK=true) and reports the worst-case source across all
 * four entities once they resolve.
 */
export function useAllEntityFinancials(): FetchState<Record<EntitySlug, FinancialsData>> {
  const mockInit = useCallback(
    () => Object.fromEntries(ENTITY_SLUGS.map(s => [s, getFinancials(s)])) as Record<EntitySlug, FinancialsData>,
    [],
  );
  return useTrackedFetch(
    'allEntityFinancials',
    async () => {
      const entries = await Promise.all(
        ENTITY_SLUGS.map(s => api.entityFinancials(s).then(r => [s, r] as const)),
      );
      const data = Object.fromEntries(entries.map(([s, r]) => [s, r.data])) as Record<EntitySlug, FinancialsData>;
      const sources = entries.map(([, r]) => r.source);
      const source = sources.includes('mock') ? 'mock' : sources.includes('cache') ? 'cache' : 'live';
      return { data, source };
    },
    mockInit,
    [],
  );
}

export function useEntityCustomers(slug: EntitySlug): FetchState<CustomersData> {
  return useTrackedFetch(
    `entityCustomers:${slug}`,
    () => api.entityCustomers(slug),
    () => getCustomers(slug),
    [slug],
  );
}

export function useEntityVendors(slug: EntitySlug): FetchState<VendorsData> {
  return useTrackedFetch(
    `entityVendors:${slug}`,
    () => api.entityVendors(slug),
    () => getVendors(slug),
    [slug],
  );
}

export function useEntityBanking(slug: EntitySlug): FetchState<BankingData> {
  return useTrackedFetch(
    `entityBanking:${slug}`,
    () => api.entityBanking(slug),
    () => getBanking(slug),
    [slug],
  );
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
