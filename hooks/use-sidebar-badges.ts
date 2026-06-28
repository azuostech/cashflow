'use client';

import { useEffect, useMemo } from 'react';
import { useFetch } from './use-fetch';

interface DashboardKpisResponse {
  overduePayables: number;
  overdueReceivables: number;
  unreconciledCount: number;
}

export interface SidebarBadges {
  overduePayables: number;
  overdueReceivables: number;
  unreconciled: number;
}

function monthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  return { start, end };
}

export function useSidebarBadges(): SidebarBadges {
  const url = useMemo(() => {
    const { start, end } = monthRange();
    return `/api/dashboard/kpis?startDate=${start}&endDate=${end}`;
  }, []);
  const { data, refetch } = useFetch<DashboardKpisResponse>(url);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refetch();
    }, 5 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [refetch]);

  return {
    overduePayables: data?.overduePayables ?? 0,
    overdueReceivables: data?.overdueReceivables ?? 0,
    unreconciled: data?.unreconciledCount ?? 0
  };
}
