import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { getMockData, getFinancials, getCustomers, getVendors, getBanking } from '@/lib/mock';
import type { DashboardData, FinancialsData, CustomersData, VendorsData, BankingData, EntitySlug } from '@/lib/types';

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
