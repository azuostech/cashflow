import * as XLSX from 'xlsx';
import type { DRENodeResult, DREResult } from '@/lib/reports/dre';

export function exportDREToExcel(dre: DREResult, compareDre?: DREResult, companyName?: string): Buffer {
  const workbook = XLSX.utils.book_new();
  const periodLabel = `${dre.period.start.toLocaleDateString('pt-BR')} - ${dre.period.end.toLocaleDateString('pt-BR')}`;
  const technicalRows: (string | number)[][] = [[companyName ?? 'Empresa', 'DRE', periodLabel], []];
  const headers = ['Linha DRE', `Valor (${dre.currency})`];

  if (compareDre) headers.push(`Anterior (${compareDre.currency})`, 'Delta %');
  technicalRows.push(headers);

  function addNodeRows(nodes: DRENodeResult[], level = 0) {
    for (const node of nodes) {
      const label = `${'  '.repeat(level)}${node.isSubtotal ? '(=) ' : ''}${node.name}`;
      const row: (string | number)[] = [label, node.value];

      if (compareDre) {
        const compareValue = compareDre.nodes[node.code]?.value ?? 0;
        const delta = compareValue !== 0 ? ((node.value - compareValue) / Math.abs(compareValue)) * 100 : 0;
        row.push(compareValue, delta);
      }

      technicalRows.push(row);

      if (!node.isSubtotal && node.categories && node.categories.length > 1) {
        for (const category of [...node.categories].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))) {
          const categoryRow: (string | number)[] = [`${'  '.repeat(level + 1)}${category.name}`, category.value];
          if (compareDre) categoryRow.push(0, 0);
          technicalRows.push(categoryRow);
        }
      }

      if (node.children.length > 0) addNodeRows(node.children, level + 1);
    }
  }

  addNodeRows(dre.tree);
  const technicalSheet = XLSX.utils.aoa_to_sheet(technicalRows);
  technicalSheet['!cols'] = [{ wch: 42 }, { wch: 16 }, ...(compareDre ? [{ wch: 16 }, { wch: 10 }] : [])];
  XLSX.utils.book_append_sheet(workbook, technicalSheet, 'DRE Tecnica');

  const executiveRows: (string | number)[][] = [
    [companyName ?? 'Empresa', 'Resumo Executivo', periodLabel],
    [],
    ['Receita Bruta', dre.nodes['1.0']?.value ?? 0],
    ['(-) Deducoes', dre.nodes['2.0']?.value ?? 0],
    ['(=) Receita Liquida', dre.subtotals.S1 ?? 0],
    ['(-) Custos Variaveis', dre.nodes['3.0']?.value ?? 0],
    ['(=) Margem de Contribuicao', dre.subtotals.S2 ?? 0],
    ['(-) Despesas Operacionais', dre.nodes['4.0']?.value ?? 0],
    ['(=) Resultado Operacional', dre.subtotals.S3 ?? 0],
    ['(+/-) Resultado Financeiro', dre.nodes['5.0']?.value ?? 0],
    ['(=) LAIR', dre.subtotals.S4 ?? 0],
    ['(-) Impostos', dre.nodes['6.0']?.value ?? 0],
    ['(=) Lucro Liquido', dre.subtotals.S5 ?? 0]
  ];
  const executiveSheet = XLSX.utils.aoa_to_sheet(executiveRows);
  executiveSheet['!cols'] = [{ wch: 34 }, { wch: 16 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, executiveSheet, 'Executiva');

  const output = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(output) ? output : Buffer.from(output);
}
