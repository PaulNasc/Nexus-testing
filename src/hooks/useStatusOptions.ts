import { useCallback, useEffect, useMemo, useState } from 'react';

export interface StatusOption {
  value: string;
  label: string;
}

const DEFAULT_STATUS: StatusOption[] = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'active', label: 'Ativo' },
  { value: 'review', label: 'Em Revisão' },
  { value: 'approved', label: 'Aprovado' },
  { value: 'archived', label: 'Arquivado' },
];

const storageKey = (projectId?: string | null) =>
  `krigzis_status_options:${projectId || 'global'}`;

export function useStatusOptions(projectId?: string | null) {
  const [options, setOptions] = useState<StatusOption[]>(DEFAULT_STATUS);

  // Load from localStorage per project
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(projectId));
      if (raw) {
        const parsed: StatusOption[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOptions(parsed);
          return;
        }
      }
    } catch (e) { /* noop: fallback para DEFAULT_STATUS logo abaixo */ }
    setOptions(DEFAULT_STATUS);
  }, [projectId]);

  const save = useCallback((next: StatusOption[]) => {
    setOptions(next);
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify(next));
    } catch (e) { /* noop: se falhar storage, mantém apenas em memória */ }
  }, [projectId]);

  const addStatus = useCallback((opt: StatusOption) => {
    save(prevNormalize([...options, opt]));
  }, [options, save]);

  const removeStatus = useCallback((value: string) => {
    save(options.filter(o => o.value !== value));
  }, [options, save]);

  const renameStatus = useCallback((value: string, nextLabel: string, nextValue?: string) => {
    const next = options.map(o => o.value === value ? { value: nextValue ?? o.value, label: nextLabel } : o);
    save(prevNormalize(next));
  }, [options, save]);

  const getLabelFor = useCallback((value: string) => {
    const found = options.find(o => o.value === value);
    return found?.label || value;
  }, [options]);

  const defaults = useMemo(() => DEFAULT_STATUS, []);

  return { options, setOptions: save, addStatus, removeStatus, renameStatus, getLabelFor, defaults };
}

function prevNormalize(arr: StatusOption[]): StatusOption[] {
  // Remove duplicados por value, manter primeiro
  const seen = new Set<string>();
  const out: StatusOption[] = [];
  for (const o of arr) {
    const value = slugify(o.value);
    if (!seen.has(value)) {
      seen.add(value);
      out.push({ value, label: o.label.trim() || value });
    }
  }
  return out;
}

export function slugify(str: string) {
  return str
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}
