import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { getMockData, getFinancials, getCustomers, getVendors, getBanking } from '@/lib/mock';
import { ENTITY_SLUGS } from '@/lib/entities';
import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert, ValidationMatrixData, EntityHistoryData, MetricSnapshotsData, EntityBudget, BvsAData, PortfolioBudget, BudgetPeriodInput, ConsolidatedCashFlow, HistoryResponse } from '@/lib/types';
import type { AccountingCustomer, AccountingVendor, AccountingInvoice, AccountingAccount, AccountingTransaction, AccountingBill } from '@/lib/api';
import type { ReportTemplateSummary, ReportGenerateRequest, BuiltReport, ReportHistoryEntry } from '@/lib/reportTypes';
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
  fetcher: () => Promise<{ data: T; source: 'db' | 'live' | 'cache' | 'mock'; reconciliation?: import('@/lib/api').ArApReconciliation | null }>,
  mockInit: (() => T) | null,
  deps: unknown[],
  reportGlobal: boolean = true,
): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>(() =>
    USE_MOCK_FALLBACK && mockInit
      ? { data: mockInit(), source: 'mock', lastSuccessfulFetch: null }
      : { data: null, source: 'loading', lastSuccessfulFetch: null },
  );
  const lastGoodRef = useRef<T | null>(USE_MOCK_FALLBACK && mockInit ? mockInit() : null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then(({ data, source, reconciliation }) => {
        if (cancelled) return;
        lastGoodRef.current = data;
        setState({ data, source, lastSuccessfulFetch: new Date().toISOString(), reconciliation });
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

  // Manual refetch — re-runs the same fetcher on demand (e.g. a Refresh
  // button). Reuses the identical success/failure handling as the mount
  // effect; hits the same endpoint with no extra side effects.
  const refetch = useCallback(async () => {
    try {
      const { data, source, reconciliation } = await fetcher();
      if (!mountedRef.current) return;
      lastGoodRef.current = data;
      setState({ data, source, lastSuccessfulFetch: new Date().toISOString(), reconciliation });
    } catch {
      if (!mountedRef.current) return;
      setState((prev) => ({
        data: lastGoodRef.current,
        source: lastGoodRef.current ? prev.source : 'unavailable',
        lastSuccessfulFetch: prev.lastSuccessfulFetch,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (!reportGlobal) return;
    reportDataSource(key, { source: state.source, lastSuccessfulFetch: state.lastSuccessfulFetch });
    return () => clearDataSource(key);
  }, [key, state.source, state.lastSuccessfulFetch, reportGlobal]);

  return { ...state, refetch };
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
      const source = sources.includes('mock') ? 'mock' : sources.includes('cache') ? 'cache' : sources.includes('live') ? 'live' : 'db';
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
      const source = sources.includes('mock') ? 'mock' : sources.includes('cache') ? 'cache' : sources.includes('live') ? 'live' : 'db';
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

/**
 * useConsolidatedCashFlow — fetches the portfolio statement of cash flows for
 * the given selected entities from GET /api/model/cashflow. ALL summation is
 * performed server-side from published Neon rows; this hook and its consumers
 * only render the returned totals. Re-fetches when the selection changes. No
 * mock fallback: when Core has published nothing the endpoint returns an honest
 * unavailable/partial state.
 */
export function useConsolidatedCashFlow(slugs: EntitySlug[]): FetchState<ConsolidatedCashFlow> {
  const key = slugs.join(',');
  return useTrackedFetch(
    `consolidatedCashFlow:${key}`,
    () => api.consolidatedCashFlow(slugs),
    null,
    [key],
  );
}

/**
 * useHistory — fetches the consolidated monthly history for the selected
 * entities from GET /api/model/history. ALL aggregation and month-over-month
 * math is performed server-side; this hook and its consumers only render the
 * returned values. Re-fetches when the selection changes. No mock fallback:
 * when Neon has published nothing the endpoint returns status='unavailable'.
 */
export function useHistory(slugs: EntitySlug[]): FetchState<HistoryResponse> {
  const key = slugs.join(',');
  return useTrackedFetch(
    `history:${key}`,
    () => api.history(slugs),
    null,
    [key],
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
      const source = sources.includes('mock') ? 'mock' : sources.includes('cache') ? 'cache' : sources.includes('live') ? 'live' : 'db';
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
 *
 * Excluded from the global DataSourceBanner aggregation (reportGlobal=false):
 * the briefing's "cache" source reflects AI-narrative response caching, not
 * financial-data staleness, so it must not drive the page-level "cached data"
 * banner. The underlying data source is still surfaced by useDashboardData.
 */
export function useBriefing(): FetchState<BriefingResponse> {
  return useTrackedFetch('briefing', () => api.briefing(), null, [], false);
}

/**
 * useReportTemplates — fetches the Report Engine's available template
 * catalog from GET /api/reports. Exposes {data, source, lastSuccessfulFetch}.
 */
export function useReportTemplates(): FetchState<ReportTemplateSummary[]> {
  return useTrackedFetch('reportTemplates', () => api.reportTemplates(), null, []);
}

/**
 * useReportHistory — fetches the persisted report generation history from
 * GET /api/reports/history. Pass a slug to scope to a single entity.
 * No mock fallback: returns null source="unavailable" when the endpoint fails
 * so the UI can show an empty state rather than fabricated data.
 * The refreshKey param can be incremented to force a re-fetch after generation.
 */
export function useReportHistory(slug?: string, refreshKey?: number): FetchState<ReportHistoryEntry[]> {
  return useTrackedFetch(
    `reportHistory:${slug ?? 'all'}`,
    () => api.reportHistory(slug),
    null,
    [slug, refreshKey],
    false,
  );
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

export function useEntityBudget(slug: EntitySlug, year?: number, refreshKey?: number): FetchState<EntityBudget> {
  return useTrackedFetch(
    `entityBudget:${slug}:${year ?? 'cur'}`,
    () => api.entityBudget(slug, year),
    null,
    [slug, year, refreshKey],
  );
}

export function useBudgetVsActual(slug: EntitySlug, year?: number): FetchState<BvsAData> {
  return useTrackedFetch(
    `budgetVsActual:${slug}:${year ?? 'cur'}`,
    () => api.budgetVsActual(slug, year),
    null,
    [slug, year],
  );
}

export function usePortfolioBudget(year?: number): FetchState<PortfolioBudget> {
  return useTrackedFetch(
    `portfolioBudget:${year ?? 'cur'}`,
    () => api.portfolioBudget(year),
    null,
    [year],
  );
}

export function useBudgetMutation() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const save = useCallback(
    async (slug: EntitySlug, data: BudgetPeriodInput & { period_type?: "month" | "annual" }) => {
      setSaving(true);
      setError(null);
      try {
        await api.upsertBudgetPeriod(slug, data);
        setRefreshKey((k) => k + 1);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save budget";
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const reset = useCallback(() => setError(null), []);

  return { save, saving, error, reset, refreshKey };
}

// ── Accounting module hooks — live Neon data, no mock fallback ───────────────
// These hooks serve the /accounting/* pages with authoritative QBO-derived data.
// No mock fallback: if data is unavailable the page renders an honest empty state.

export function useAccountingCustomers(slug: EntitySlug): FetchState<AccountingCustomer[]> {
  return useTrackedFetch(`accountingCustomers:${slug}`, () => api.accountingCustomers(slug), null, [slug]);
}

export function useAccountingVendors(slug: EntitySlug): FetchState<AccountingVendor[]> {
  return useTrackedFetch(`accountingVendors:${slug}`, () => api.accountingVendors(slug), null, [slug]);
}

export function useAccountingInvoices(slug: EntitySlug): FetchState<AccountingInvoice[]> {
  return useTrackedFetch(`accountingInvoices:${slug}`, () => api.accountingInvoices(slug), null, [slug]);
}

export function useAccountingAccounts(slug: EntitySlug): FetchState<AccountingAccount[]> {
  return useTrackedFetch(`accountingAccounts:${slug}`, () => api.accountingAccounts(slug), null, [slug]);
}

export function useAccountingTransactions(slug: EntitySlug): FetchState<AccountingTransaction[]> {
  return useTrackedFetch(`accountingTransactions:${slug}`, () => api.accountingTransactions(slug), null, [slug]);
}

export function useAccountingBills(slug: EntitySlug): FetchState<AccountingBill[]> {
  return useTrackedFetch(`accountingBills:${slug}`, () => api.accountingBills(slug), null, [slug]);
}
