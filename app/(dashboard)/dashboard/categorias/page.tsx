'use client';

import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  keywords: string[];
}

const colors = ['#E24B4A', '#639922', '#D85A30', '#BA7517', '#378ADD', '#993556', '#1D9E75'];

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [form, setForm] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: '#E24B4A',
    keywords: [] as string[]
  });

  const mode = useMemo(() => (selected ? 'edit' : 'create'), [selected]);

  async function fetchCategories() {
    const response = await fetch('/api/categories/list');
    const data = await response.json();
    setCategories(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    fetchCategories().catch(() => setCategories([]));
  }, []);

  function resetForm() {
    setSelected(null);
    setKeywordInput('');
    setForm({
      name: '',
      type: 'expense',
      color: '#E24B4A',
      keywords: []
    });
  }

  async function saveCategory() {
    const url = mode === 'create' ? '/api/categories/list' : `/api/categories/${selected?.id}`;
    const method = mode === 'create' ? 'POST' : 'PATCH';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    await fetchCategories();
    resetForm();
  }

  async function deleteCategory(id: string) {
    const confirmed = window.confirm('Deseja excluir esta categoria?');
    if (!confirmed) return;

    await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    await fetchCategories();

    if (selected?.id === id) resetForm();
  }

  async function applyKeyword(keyword: string) {
    if (!selected || !keyword.trim()) return;

    await fetch('/api/categories/apply-keyword', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: selected.id,
        keyword
      })
    });
  }

  function addKeyword() {
    const value = keywordInput.trim();
    if (!value) return;

    if (!form.keywords.includes(value)) {
      setForm((prev) => ({ ...prev, keywords: [...prev.keywords, value] }));
    }

    setKeywordInput('');
  }

  function removeKeyword(index: number) {
    setForm((prev) => ({ ...prev, keywords: prev.keywords.filter((_, idx) => idx !== index) }));
  }

  return (
    <section>
      <Header title="Gestao de Categorias" subtitle="Organize palavras-chave e regras de classificacao automatica." />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Categorias</h2>
          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="w-full rounded-lg border border-app-border p-4 text-left transition hover:bg-app-muted"
                onClick={() => {
                  setSelected(category);
                  setForm({
                    name: category.name,
                    type: category.type,
                    color: category.color,
                    keywords: category.keywords || []
                  });
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelected(category);
                    setForm({
                      name: category.name,
                      type: category.type,
                      color: category.color,
                      keywords: category.keywords || []
                    });
                  }
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="h-4 w-4 rounded" style={{ backgroundColor: category.color }} />
                  <div className="flex-1">
                    <p className="font-semibold">{category.name}</p>
                    <p className="text-sm text-app-subtle">
                      {category.type === 'income' ? 'Entrada' : 'Saida'} • {category.keywords?.length ?? 0} keywords
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteCategory(category.id);
                    }}
                  >
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
            {categories.length === 0 ? <p className="text-sm text-app-subtle">Nenhuma categoria cadastrada.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">{mode === 'create' ? 'Nova categoria' : 'Editar categoria'}</h2>

          <div className="space-y-4">
            <Input
              placeholder="Nome da categoria"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />

            <Select
              value={form.type}
              onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as 'income' | 'expense' }))}
            >
              <option value="expense">Saida</option>
              <option value="income">Entrada</option>
            </Select>

            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="h-10 w-10 rounded-lg border border-app-border"
                  style={{ backgroundColor: color }}
                  onClick={() => setForm((prev) => ({ ...prev, color }))}
                  aria-label={`Selecionar cor ${color}`}
                />
              ))}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Palavras-chave</label>
              <div className="mb-2 flex flex-wrap gap-2">
                {form.keywords.map((keyword, idx) => (
                  <span key={`${keyword}-${idx}`} className="flex items-center gap-2 rounded-full bg-app-muted px-3 py-1 text-sm">
                    {keyword}
                    <button type="button" onClick={() => removeKeyword(idx)} aria-label={`Remover ${keyword}`}>
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar palavra-chave"
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={addKeyword}>
                  Adicionar
                </Button>
              </div>
              {selected ? (
                <Button type="button" variant="outline" className="mt-3" onClick={() => applyKeyword(keywordInput || form.keywords.at(-1) || '')}>
                  Aplicar keyword em transacoes antigas
                </Button>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button type="button" onClick={saveCategory}>
                {mode === 'create' ? 'Criar categoria' : 'Salvar alteracoes'}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                Limpar
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
