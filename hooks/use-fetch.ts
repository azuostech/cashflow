'use client';

import { useCallback, useEffect, useState } from 'react';

export function useFetch<T>(url: string | null, options?: RequestInit) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData(await response.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [url, options]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}
