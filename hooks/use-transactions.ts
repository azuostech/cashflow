'use client';

import { useMemo } from 'react';
import { useFetch } from './use-fetch';

export interface TransactionFilters {
  page: number;
  limit: number;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  categoryId: string;
  costCenterId: string;
  bankAccountId: string;
  contactId: string;
  search: string;
  sortBy: string;
  sortDir: string;
}

export interface TransactionListItem {
  id: string;
  type: string;
  description: string;
  notes: string | null;
  originalAmount: string | number;
  originalCurrency: string;
  convertedAmount: string | number;
  companyCurrency: string;
  exchangeRate: string | number;
  competenceDate: string;
  dueDate: string;
  paymentDate: string | null;
  status: string;
  categoryId: string | null;
  costCenterId: string | null;
  bankAccountId: string | null;
  destBankAccountId: string | null;
  contactId: string | null;
  isInstallment: boolean;
  installmentCount: number | null;
  recurrenceRuleId: string | null;
  recurrenceParentId: string | null;
  reconciliationStatus: string;
  isReversal: boolean;
  reversalOfId: string | null;
  sourceDocumentNumber: string | null;
  externalReference: string | null;
  category?: { id: string; name: string; color: string | null; type: string } | null;
  costCenter?: { id: string; name: string } | null;
  contact?: { id: string; name: string; type: string } | null;
  bankAccount?: { id: string; name: string; currency: string } | null;
  destBankAccount?: { id: string; name: string; currency: string } | null;
  _count?: { installments: number };
}

interface TransactionsResponse {
  data: TransactionListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary?: { revenue: number; expense: number; result: number };
  totals?: { revenue: number; expense: number; result: number };
}

export const DEFAULT_FILTERS: TransactionFilters = {
  page: 1,
  limit: 50,
  type: 'all',
  status: 'all',
  startDate: '',
  endDate: '',
  categoryId: '',
  costCenterId: '',
  bankAccountId: '',
  contactId: '',
  search: '',
  sortBy: 'competenceDate',
  sortDir: 'desc'
};

export function buildTransactionQuery(filters: TransactionFilters): string {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    if ((key === 'type' || key === 'status') && value === 'all') return;
    params.set(key, String(value));
  });

  return params.toString();
}

export function useTransactions(filters: TransactionFilters) {
  const url = useMemo(() => `/api/transactions?${buildTransactionQuery(filters)}`, [filters]);
  const { data, loading, error, refetch } = useFetch<TransactionsResponse>(url);
  const totals = data?.totals ?? data?.summary ?? { revenue: 0, expense: 0, result: 0 };

  return {
    transactions: data?.data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? filters.page,
    limit: data?.limit ?? filters.limit,
    totalPages: data?.totalPages ?? Math.ceil((data?.total ?? 0) / filters.limit),
    totals,
    loading,
    error,
    refetch
  };
}
