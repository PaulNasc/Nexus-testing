// Servico de Test Runs (Ciclos de Execucao). CRUD via /api/db + progresso via /api/runs/:id/progress.

import { apiClient } from '@/lib/api';
import type { TestRun, TestRunProgress } from '@/types';

const TOKEN_KEY = 'krg_local_auth_token';
const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

const readToken = () => localStorage.getItem(TOKEN_KEY);

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = readToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || `HTTP ${res.status}`);
  return body;
}

export async function listTestRunsByProject(projectId: string): Promise<TestRun[]> {
  const { data } = await supabase
    .from('test_runs' as any)
    .select('*')
    .eq('project_id', projectId)
    .order('sequence', { ascending: false });
  return (data as any[] as TestRun[]) || [];
}

export async function getTestRun(id: string): Promise<TestRun | null> {
  const { data } = await supabase
    .from('test_runs' as any)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as any as TestRun) || null;
}

export async function createTestRun(input: Partial<TestRun>): Promise<TestRun | null> {
  const { data, error } = await supabase
    .from('test_runs' as any)
    .insert(input as any)
    .select('*')
    .single();
  if (error) throw new Error(error.message || 'Falha ao criar ciclo.');
  return data as any as TestRun;
}

export async function updateTestRun(id: string, patch: Partial<TestRun>): Promise<TestRun | null> {
  const { data, error } = await supabase
    .from('test_runs' as any)
    .update(patch as any)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message || 'Falha ao atualizar ciclo.');
  return data as any as TestRun;
}

export async function deleteTestRun(id: string): Promise<void> {
  const { error } = await apiClient.from('test_runs' as any).delete().eq('id', id);
  if (error) throw new Error(error.message || 'Falha ao remover ciclo.');
}

export async function getRunProgress(id: string): Promise<TestRunProgress> {
  const res = await apiFetch(`/runs/${encodeURIComponent(id)}/progress`, { method: 'GET' });
  return res.data as TestRunProgress;
}
