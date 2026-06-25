'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFetch } from '@/hooks/use-fetch';
import { formatCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils/cn';

type DREView = 'executive' | 'technical';

interface CostCenter {
  id: string;
  name: string;
  active: boolean;
}

interface DRECategory {
  id: string;
  name: string;
  color: string | null;
  value: number;
}

interface DRENode {
  id: string;
  code: string;
  name: string;
  isSubtotal: boolean;
  value: number;
  compareValue?: number;
  delta?: number | null;
  children: DRENode[];
  categories?: DRECategory[];
}

interface DREData {
  tree: DRENode[];
  executive: {
    received: number;
    spent: number;
    result: number;
    margin: number;
    topExpenses: { categoryName: string; value: number; percent: number }[];
  };
  currency: string;
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const monthRange = (() => {
  const now = new Date();
  return {
    start: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
})();

function shiftMonth(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setMonth(date.getMonth() + amount);
  return toDateInput(date);
}

export default function DREReportPage() {
  const [view, setView] = useState<DREView>('executive');
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [costCenterId, setCostCenterId] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const { data: costCenters } = useFetch<CostCenter[]>('/api/cost-centers');

  const compareStart = compareEnabled ? shiftMonth(startDate, -1) : undefined;
  const compareEnd = compareEnabled ? shiftMonth(endDate, -1) : undefined;
  const reportUrl = useMemo(() => {
    const params = new URLSearchParams({ startDate, endDate, view });
    if (compareStart) params.set('compareStart', compareStart);
    if (compareEnd) params.set('compareEnd', compareEnd);
    if (costCenterId) params.set('costCenterId', costCenterId);
    return `/api/reports/dre?${params.toString()}`;
  }, [compareEnd, compareStart, costCenterId, endDate, startDate, view]);
  const { data, loading, error } = useFetch<DREData>(reportUrl);
  const executive = data?.executive;
  const currency = data?.currency ?? 'BRL';

  function toggleNode(code: string) {
    setExpandedNodes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleExport() {
    const params = new URLSearchParams({ startDate, endDate });
    if (compareStart) params.set('compareStart', compareStart);
    if (compareEnd) params.set('compareEnd', compareEnd);
    if (costCenterId) params.set('costCenterId', costCenterId);
    window.open(`/api/reports/dre/export?${params.toString()}`, '_blank');
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">DRE</h1>
          <p className="mt-0.5 text-sm text-gray-500">Demonstracao de Resultado do Exercicio</p>
        </div>
        <Button type="button" variant="outline" className="h-9 gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" />
          Excel
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setView('executive')}
            className={cn('h-9 px-3 text-sm font-medium transition', view === 'executive' ? 'bg-gray-900 text-white' : 'text-gray-500')}
          >
            Executiva
          </button>
          <button
            type="button"
            onClick={() => setView('technical')}
            className={cn('h-9 px-3 text-sm font-medium transition', view === 'technical' ? 'bg-gray-900 text-white' : 'text-gray-500')}
          >
            Tecnica
          </button>
        </div>
        <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 w-40" />
        <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 w-40" />
        <label className="flex h-9 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-600">
          <input type="checkbox" checked={compareEnabled} onChange={(event) => setCompareEnabled(event.target.checked)} />
          vs mes anterior
        </label>
        <Select value={costCenterId} onChange={(event) => setCostCenterId(event.target.value)} className="h-9 w-56 py-1.5">
          <option value="">Toda a empresa</option>
          {(costCenters ?? [])
            .filter((costCenter) => costCenter.active)
            .map((costCenter) => (
              <option key={costCenter.id} value={costCenter.id}>
                {costCenter.name}
              </option>
            ))}
        </Select>
      </div>

      {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Calculando DRE...</div>
      ) : data ? (
        view === 'executive' && executive ? (
          <ExecutiveView executive={executive} currency={currency} onShowTechnical={() => setView('technical')} />
        ) : (
          <TechnicalView
            nodes={data.tree}
            currency={currency}
            showCompare={compareEnabled}
            expandedNodes={expandedNodes}
            onToggle={toggleNode}
          />
        )
      ) : null}
    </div>
  );
}

function ExecutiveView({
  executive,
  currency,
  onShowTechnical
}: {
  executive: DREData['executive'];
  currency: string;
  onShowTechnical: () => void;
}) {
  const kpis = [
    { label: 'Recebeu', value: executive.received, color: 'text-emerald-600' },
    { label: 'Gastou', value: executive.spent, color: 'text-red-600' },
    { label: 'Sobrou', value: executive.result, color: executive.result >= 0 ? 'text-emerald-600' : 'text-red-600' },
    { label: 'Margem', custom: `${executive.margin.toFixed(1)}%`, color: executive.margin >= 0 ? 'text-emerald-600' : 'text-red-600' }
  ];

  return (
    <div>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-gray-400">{kpi.label}</p>
            <p className={cn('text-xl font-semibold', kpi.color)}>
              {kpi.custom ?? formatCurrency(kpi.value ?? 0, currency)}
            </p>
          </div>
        ))}
      </div>

      {executive.topExpenses.length > 0 ? (
        <div className="mb-5 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Maiores despesas</h2>
          <div className="space-y-3">
            {executive.topExpenses.map((expense) => (
              <div key={expense.categoryName} className="flex items-center gap-3">
                <span className="w-40 truncate text-xs text-gray-500">{expense.categoryName}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-red-400" style={{ width: `${Math.min(expense.percent, 100)}%` }} />
                </div>
                <span className="w-24 text-right text-sm font-medium text-gray-700">{formatCurrency(expense.value, currency)}</span>
                <span className="w-10 text-right text-xs text-gray-400">{expense.percent.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Button type="button" variant="outline" className="w-full border-dashed text-gray-500" onClick={onShowTechnical}>
        Ver DRE tecnica completa
      </Button>
    </div>
  );
}

function TechnicalView({
  nodes,
  currency,
  showCompare,
  expandedNodes,
  onToggle
}: {
  nodes: DRENode[];
  currency: string;
  showCompare: boolean;
  expandedNodes: Set<string>;
  onToggle: (code: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Linha DRE</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Valor</th>
            {showCompare ? (
              <>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Anterior</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-gray-400">Delta</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>{renderDRERows(nodes, 0, showCompare, expandedNodes, onToggle, currency)}</tbody>
      </table>
    </div>
  );
}

function renderDRERows(
  nodes: DRENode[],
  level: number,
  showCompare: boolean,
  expanded: Set<string>,
  onToggle: (code: string) => void,
  currency: string
): ReactNode[] {
  return nodes.flatMap((node) => {
    const hasCategories = Boolean(node.categories && node.categories.length > 1);
    const isExpanded = expanded.has(node.code);
    const valueColor = node.value > 0 ? 'text-emerald-600' : node.value < 0 ? 'text-red-600' : 'text-gray-400';
    const rows: ReactNode[] = [
      <tr
        key={node.code}
        className={cn('border-b border-gray-100', node.isSubtotal ? 'bg-gray-50' : 'hover:bg-gray-50', hasCategories ? 'cursor-pointer' : '')}
        onClick={() => {
          if (hasCategories && !node.isSubtotal) onToggle(node.code);
        }}
      >
        <td
          className={cn('px-4 py-2.5', node.isSubtotal ? 'font-semibold text-gray-800' : 'text-gray-600')}
          style={{ paddingLeft: `${16 + level * 20}px` }}
        >
          <span className="flex items-center gap-1.5">
            {hasCategories && !node.isSubtotal ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
              )
            ) : null}
            {node.isSubtotal ? `(=) ${node.name}` : node.name}
          </span>
        </td>
        <td className={cn('px-4 py-2.5 text-right font-medium', valueColor, node.isSubtotal ? 'text-base' : 'text-sm')}>
          {formatCurrency(Math.abs(node.value), currency)}
        </td>
        {showCompare ? (
          <>
            <td className="px-4 py-2.5 text-right text-sm text-gray-400">
              {node.compareValue !== undefined ? formatCurrency(Math.abs(node.compareValue), currency) : '--'}
            </td>
            <td
              className={cn(
                'px-4 py-2.5 text-right text-xs',
                (node.delta ?? 0) > 0 ? 'text-emerald-600' : (node.delta ?? 0) < 0 ? 'text-red-600' : 'text-gray-400'
              )}
            >
              {node.delta !== null && node.delta !== undefined ? `${node.delta > 0 ? '+' : ''}${node.delta.toFixed(1)}%` : '--'}
            </td>
          </>
        ) : null}
      </tr>
    ];

    if (isExpanded && hasCategories) {
      for (const category of [...(node.categories ?? [])].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))) {
        rows.push(
          <tr key={`${node.code}-${category.id}`} className="border-b border-gray-50 bg-blue-50/30">
            <td className="px-4 py-1.5 text-xs text-gray-500" style={{ paddingLeft: `${16 + (level + 1) * 20}px` }}>
              <span className="flex items-center gap-1.5">
                {category.color ? <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} /> : null}
                {category.name}
              </span>
            </td>
            <td className="px-4 py-1.5 text-right text-xs text-gray-600">{formatCurrency(Math.abs(category.value), currency)}</td>
            {showCompare ? <td colSpan={2} /> : null}
          </tr>
        );
      }
    }

    if (node.children.length > 0) {
      rows.push(...renderDRERows(node.children, level + 1, showCompare, expanded, onToggle, currency));
    }

    return rows;
  });
}
