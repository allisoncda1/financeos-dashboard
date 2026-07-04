import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { getMockData, getFinancials, getCustomers, getVendors, getBanking } from '@/lib/mock';
import { ENTITY_SLUGS } from '@/lib/entities';
import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert, ValidationMatrixData, EntityHistoryData, MetricSnapshotsData } from '@/lib/types';
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
  mockInit: (() => T) | null,
  deps: unknown[],
): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>(() =>
    USE_MOCK_FALLBACK && mockInit
      ? { data: mockInit(), source: 'mock', lastSuccessfulFetch: null }
      : { data: null, source: 'loading', lastSuccessfulFetch: null },
  );
  const lastGoodRef = useRef<T | null>(USE_MOCK_FALLBACK && mockInit ? mockInit() : null);

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

/**
 * useAllEntityHistory — fetches real prior-fiscal-year history for every
 * entity in parallel from GET /api/model/:slug/history. There is no mock
 * fallback: when the pipeline archives are unreachable the hook reports
 * "unavailable" and the History page simply offers no prior periods,
 * instead of fabricating them.
 */
export function useAllEntityHistory(): FetchState<Record<EntitySlug, EntityHistoryData>> {
  return useTrackedFetch(
    'allEntityHistory',
    async () => {
      const entries = await Promise.all(
        ENTITY_SLUGS.map(s => api.entityHistory(s).then(r => [s, r] as const)),
      );
      const data = Object.fromEntries(entries.map(([s, r]) => [s, r.data])) as Record<EntitySlug, EntityHistoryData>;
      const sources = entries.map(([, r]) => r.source);
      const source = sources.includes('mock') ? 'mock' : sources.includes('cache') ? 'cache' : 'live';
      return { data, source };
    },
    null,
    [],
  );
}

/**
 * useHealthSnapshots — fetches stored monthly metric snapshots from
 * GET /api/model/history/snapshots. The server archives one snapshot per
 * entity per month from live pipeline data; the History page recomputes
 * health scores from what was actually observed each month.
 */
export function useHealthSnapshots(): FetchState<MetricSnapshotsData> {
  return useTrackedFetch('healthSnapshots', () => api.historySnapshots(), null, []);
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
 * useAllEntityBanking — fetches live banking data for every entity in
 * parallel, mirroring useAllEntityFinancials. Reports the worst-case
 * source across all entities once they resolve.
 */
export function useAllEntityBanking(): FetchState<Record<EntitySlug, BankingData>> {
  const mockInit = useCallback(
    () => Object.fromEntries(ENTITY_SLUGS.map(s => [s, getBanking(s)])) as Record<EntitySlug, BankingData>,
    [],
  );
  return useTrackedFetch(
    'allEntityBanking',
    async () => {
      const entries = await Promise.all(
        ENTITY_SLUGS.map(s => api.entityBanking(s).then(r => [s, r] as const)),
      );
      const data = Object.fromEntries(entries.map(([s, r]) => [s, r.data])) as Record<EntitySlug, BankingData>;
      const sources = entries.map(([, r]) => r.source);
      const source = sources.includes('mock') ? 'mock' : sources.includes('cache') ? 'cache' : 'live';
      return { data, source };
    },
    mockInit,
    [],
  );
}

/**
 * useValidationMatrix — fetches the per-entity × per-rule validation matrix
 * from GET /api/validation/matrix. Statuses come strictly from the
 * pipeline's published output ("unknown" = not reported), never from
 * client-side heuristics. No mock fallback: data stays null until the
 * endpoint responds.
 */
export function useValidationMatrix(): FetchState<ValidationMatrixData> {
  return useTrackedFetch('validationMatrix', () => api.validationMatrix(), null, []);
}

/**
 * useAlerts — fetches live operational alerts from the Rules Engine via
 * GET /api/alerts. Exposes {data, source, lastSuccessfulFetch}; data is
 * null until the fetch resolves (source === "loading") or when the
 * endpoint is unreachable (source === "unavailable").
 */
export function useAlerts(): FetchState<Alert[]> {
  return useTrackedFetch('alerts', () => api.alerts(), null, []);
}

/**
 * useBriefing — fetches the deterministic AI CFO briefing from /api/briefing.
 * Exposes {data, source, lastSuccessfulFetch}; data stays null on failure
 * (never throws) so callers can render a graceful fallback.
 */
export function useBriefing(): FetchState<BriefingResponse> {
  return useTrackedFetch('briefing', () => api.briefing(), null, []);
}

/**
 * useReportTemplates — fetches the Report Engine's available template
 * catalog from GET /api/reports. Exposes {data, source, lastSuccessfulFetch}.
 */
export function useReportTemplates(): FetchState<ReportTemplateSummary[]> {
  return useTrackedFetch('reportTemplates', () => api.reportTemplates(), null, []);
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
 * useReportDownload — imperative helper to POST /api/reports/generate for
 * binary/text formats (pdf/excel/html) and trigger a browser file download.
 * Tracks in-flight/downloading/error state per-format so the Report Center
 * UI can show a spinner on just the button that was clicked.
 */
export function useReportDownload() {
  const [downloadingFormat, setDownloadingFormat] = useState<ReportGenerateRequest["format"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (req: ReportGenerateRequest) => {
    setDownloadingFormat(req.format);
    setError(null);
    try {
      const { blob, filename } = await api.downloadReport(req);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to download report";
      setError(message);
      throw err;
    } finally {
      setDownloadingFormat(null);
    }
  }, []);

  return { downloadingFormat, error, download };
}

/**
 * usePipelineStatus — fetches the external pipeline's self-reported status
 * from GET /api/pipeline/status, once on mount (no polling). Read-only —
 * FinanceOS never runs or triggers the pipeline, it only displays what it
 * last reported. Exposes {data, source, lastSuccessfulFetch}.
 */
export function usePipelineStatus(): FetchState<PipelineStatus> {
  return useTrackedFetch('pipelineStatus', () => api.pipelineStatus(), null, []);
}

/**
 * useAiStatus — fetches the AI Platform's status (provider, model, cache
 * stats) from GET /api/ai/status. Read-only — used to render the Settings
 * page's AI Platform section. Exposes {data, source, lastSuccessfulFetch}.
 */
export function useAiStatus(): FetchState<AIStatus> {
  return useTrackedFetch('aiStatus', () => api.aiStatus(), null, []);
}
