import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getMockData, getFinancials, getCustomers, getVendors, getBanking } from '@/lib/mock';
import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug, BriefingResponse, Alert } from '@/lib/types';

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
