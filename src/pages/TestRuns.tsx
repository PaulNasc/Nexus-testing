import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import SearchableCombobox from '@/components/SearchableCombobox';
import { Plus, Search, ListFilter, ArrowUpDown, Edit, Trash2, Calendar, Repeat } from 'lucide-react';
import { StatusDot } from '@/components/ui/StatusDot';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { StandardButton } from '@/components/StandardButton';
import { cn, formatLocalDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectUsers } from '@/hooks/useProjectUsers';
import {
  listTestRunsByProject,
  createTestRun,
  updateTestRun,
  deleteTestRun,
  getRunProgress,
} from '@/services/testRunsService';
import { getTestPlans } from '@/services/apiClientService';
import { TestRunInputSchema, canTransitionRun, formatZodError } from '@/lib/schemas';
import type { TestRun, TestRunProgress, TestRunStatus, TestPlan } from '@/types';

const STATUS_LABEL: Record<TestRunStatus, string> = {
  planned: 'Planejado',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  aborted: 'Abortado',
};

interface RunFormState {
  id?: string;
  title: string;
  description: string;
  status: TestRunStatus;
  plan_id: string;
  assigned_to: string;
  starts_at: string;
  ends_at: string;
}

const emptyForm: RunFormState = {
  title: '',
  description: '',
  status: 'planned',
  plan_id: '',
  assigned_to: '',
  starts_at: '',
  ends_at: '',
};

const RUN_BADGE = (seq?: number) => `RUN-${String(seq ?? '').padStart(3, '0')}`;

export const TestRuns = () => {
  const { currentProject } = useProject();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const { users, labelFor } = useProjectUsers();
  const canManage = hasPermission('can_manage_executions');
  const isProjectInactive = !!currentProject && currentProject.status !== 'active';

  const [runs, setRuns] = useState<TestRun[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, TestRunProgress>>({});
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(false);

  // UI state
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    const saved = localStorage.getItem('testRuns_viewMode');
    return (saved as 'cards' | 'list') || 'cards';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TestRunStatus>('all');
  const [sortBy, setSortBy] = useState<'sequence' | 'created_at'>('sequence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modais
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RunFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TestRun | null>(null);

  useEffect(() => {
    localStorage.setItem('testRuns_viewMode', viewMode);
  }, [viewMode]);

  const loadRuns = useCallback(async () => {
    if (!currentProject?.id) {
      setRuns([]);
      setProgressMap({});
      return;
    }
    setLoading(true);
    try {
      const [runsData, plansData] = await Promise.all([
        listTestRunsByProject(currentProject.id),
        getTestPlans(undefined as any, currentProject.id).catch(() => [] as TestPlan[]),
      ]);
      setRuns(runsData);
      setPlans(plansData);
      const entries = await Promise.all(
        runsData.map(async (r) => {
          try {
            return [r.id, await getRunProgress(r.id)] as const;
          } catch {
            return [r.id, null] as const;
          }
        })
      );
      const map: Record<string, TestRunProgress> = {};
      for (const [id, prog] of entries) if (prog) map[id] = prog;
      setProgressMap(map);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar ciclos', description: e?.message || '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, toast]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let list = runs;
    if (filterStatus !== 'all') list = list.filter((r) => r.status === filterStatus);
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q) ||
          RUN_BADGE(r.sequence).toLowerCase().includes(q)
      );
    }
    const sorted = [...list].sort((a, b) => {
      const av = sortBy === 'sequence' ? (a.sequence || 0) : new Date(a.created_at).getTime();
      const bv = sortBy === 'sequence' ? (b.sequence || 0) : new Date(b.created_at).getTime();
      return sortOrder === 'asc' ? av - bv : bv - av;
    });
    return sorted;
  }, [runs, searchTerm, filterStatus, sortBy, sortOrder]);

  const planTitleById = useMemo(() => {
    const map: Record<string, string> = {};
    plans.forEach((p) => { map[p.id] = p.title; });
    return map;
  }, [plans]);

  const handleOpenCreate = () => {
    if (isProjectInactive) {
      toast({ title: 'Projeto não ativo', description: 'Não é possível criar ciclos em projetos inativos.', variant: 'destructive' });
      return;
    }
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleOpenEdit = (run: TestRun) => {
    setForm({
      id: run.id,
      title: run.title,
      description: run.description || '',
      status: run.status,
      plan_id: run.plan_id || '',
      assigned_to: run.assigned_to || '',
      starts_at: run.starts_at ? String(run.starts_at).slice(0, 10) : '',
      ends_at: run.ends_at ? String(run.ends_at).slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!currentProject?.id) {
      toast({ title: 'Selecione um projeto', variant: 'destructive' });
      return;
    }
    const payload = {
      project_id: currentProject.id,
      title: form.title,
      description: form.description,
      status: form.status,
      plan_id: form.plan_id || null,
      assigned_to: form.assigned_to || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    const parsed = TestRunInputSchema.safeParse(payload);
    if (!parsed.success) {
      toast({ title: 'Validação', description: formatZodError(parsed.error), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        const prev = runs.find((r) => r.id === form.id);
        if (prev && !canTransitionRun(prev.status, form.status)) {
          toast({ title: 'Transição inválida', description: `${STATUS_LABEL[prev.status]} → ${STATUS_LABEL[form.status]}`, variant: 'destructive' });
          setSaving(false);
          return;
        }
        await updateTestRun(form.id, parsed.data as any);
        toast({ title: 'Ciclo atualizado' });
      } else {
        await createTestRun(parsed.data as any);
        toast({ title: 'Ciclo criado' });
      }
      setShowForm(false);
      await loadRuns();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message || '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteTestRun(confirmDelete.id);
      toast({ title: 'Ciclo removido' });
      setConfirmDelete(null);
      await loadRuns();
    } catch (e: any) {
      toast({ title: 'Erro ao remover', description: e?.message || '', variant: 'destructive' });
    }
  };

  const renderProgress = (run: TestRun) => {
    const prog = progressMap[run.id];
    const total = prog?.totals.total || 0;
    const pct = prog ? Math.round(prog.completionRate * 100) : 0;
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progresso</span>
          <span>{total > 0 ? `${pct}% • ${total} execuções` : '—'}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, backgroundColor: pct > 0 ? (currentProject?.color || 'hsl(var(--brand))') : undefined }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Repeat className="h-6 w-6 text-amber-400" /> Ciclos de Execução
          </h1>
          <p className="text-sm text-muted-foreground">
            Agrupa execuções por sprint, release ou janela de testes.
          </p>
        </div>
        {canManage && currentProject && !isProjectInactive && (
          <StandardButton variant="brand" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo ciclo
          </StandardButton>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, descrição ou ID…"
            className="pl-8"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ListFilter className="h-4 w-4 mr-1.5" />
              {filterStatus === 'all' ? 'Status' : STATUS_LABEL[filterStatus]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setFilterStatus('all')}>Todos</DropdownMenuItem>
            <DropdownMenuSeparator />
            {(['planned', 'in_progress', 'completed', 'aborted'] as TestRunStatus[]).map((s) => (
              <DropdownMenuItem key={s} onClick={() => setFilterStatus(s)}>
                {STATUS_LABEL[s]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="h-4 w-4 mr-1.5" /> Ordenar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => { setSortBy('sequence'); setSortOrder('desc'); }}>ID (desc)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSortBy('sequence'); setSortOrder('asc'); }}>ID (asc)</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSortBy('created_at'); setSortOrder('desc'); }}>Mais recentes</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setSortBy('created_at'); setSortOrder('asc'); }}>Mais antigos</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      {/* Empty / loading */}
      {!currentProject && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um projeto para visualizar ciclos.
          </CardContent>
        </Card>
      )}
      {currentProject && loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Carregando…</CardContent>
        </Card>
      )}
      {currentProject && !loading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {runs.length === 0
              ? 'Nenhum ciclo criado neste projeto. Crie o primeiro para agrupar execuções.'
              : 'Nenhum resultado encontrado com os filtros atuais.'}
          </CardContent>
        </Card>
      )}

      {/* Cards */}
      {currentProject && !loading && filtered.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((run) => (
            <Card
              key={run.id}
              className="border border-border/50 cursor-pointer card-hover flex flex-col"
              onClick={() => handleOpenEdit(run)}
            >
              <CardHeader className="p-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded flex-shrink-0 mt-0.5">
                      {RUN_BADGE(run.sequence)}
                    </span>
                    <CardTitle className="text-sm font-semibold line-clamp-2 leading-snug min-w-0">
                      {run.title}
                    </CardTitle>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  <StatusDot status={run.status} label={STATUS_LABEL[run.status]} />
                  {run.plan_id && planTitleById[run.plan_id] && (
                    <Badge variant="outline" className="text-[10px] py-0 h-5">
                      {planTitleById[run.plan_id]}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex flex-col flex-1">
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[32px]">
                  {run.description || 'Sem descrição'}
                </p>
                <div className="mb-3">{renderProgress(run)}</div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatLocalDate(run.created_at)}
                  </div>
                  {run.assigned_to && <UserAvatar userId={run.assigned_to} />}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List */}
      {currentProject && !loading && filtered.length > 0 && viewMode === 'list' && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[88px_3fr_1.5fr_2fr_1.5fr_120px_60px] items-center gap-3 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div>ID</div>
            <div>Título</div>
            <div>Status</div>
            <div>Plano vinculado</div>
            <div>Progresso</div>
            <div>Criado em</div>
            <div className="text-right">Ações</div>
          </div>
          <div className="divide-y divide-border/60">
            {filtered.map((run) => {
              const prog = progressMap[run.id];
              const pct = prog ? Math.round(prog.completionRate * 100) : 0;
              return (
                <div
                  key={run.id}
                  className="grid grid-cols-[88px_3fr_1.5fr_2fr_1.5fr_120px_60px] items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => handleOpenEdit(run)}
                >
                  <div>
                    <span className="text-xs font-mono bg-brand/10 text-brand px-2 py-0.5 rounded">
                      {RUN_BADGE(run.sequence)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{run.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{run.description}</div>
                  </div>
                  <div><StatusDot status={run.status} label={STATUS_LABEL[run.status]} /></div>
                  <div className="text-xs text-muted-foreground truncate">
                    {run.plan_id ? planTitleById[run.plan_id] || '—' : '—'}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">{prog?.totals.total || 0} execuções</div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: pct > 0 ? (currentProject?.color || 'hsl(var(--brand))') : undefined }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{formatLocalDate(run.created_at)}</div>
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(run)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(run)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de criação/edição */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar ciclo' : 'Novo ciclo de execução'}</DialogTitle>
            <DialogDescription>
              Agrupa execuções por sprint, release ou janela específica de testes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Sprint 12 - QA Run"
                className="bg-muted/30 border-border/60 focus:border-brand/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Escopo, objetivo e contexto do ciclo"
                className="bg-muted/30 border-border/60 focus:border-brand/50 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</Label>
                <SearchableCombobox
                  items={[
                    { value: 'planned', label: 'Planejado' },
                    { value: 'in_progress', label: 'Em andamento' },
                    { value: 'completed', label: 'Concluído' },
                    { value: 'aborted', label: 'Abortado' },
                  ]}
                  value={form.status}
                  onChange={(v) => v && setForm((f) => ({ ...f, status: v as TestRunStatus }))}
                  placeholder="Selecione"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Plano vinculado <span className="normal-case font-normal">(opcional)</span>
                </Label>
                <SearchableCombobox
                  items={[{ value: '', label: '— nenhum —' }, ...plans.map((p) => ({ value: p.id, label: p.title }))]}
                  value={form.plan_id}
                  onChange={(v) => setForm((f) => ({ ...f, plan_id: v || '' }))}
                  placeholder="Selecione um plano"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Interessado <span className="normal-case font-normal">(opcional)</span>
              </Label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                className="w-full rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand/50"
              >
                <option value="">Nenhum</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{labelFor(u)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Início</Label>
                <Input
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  className="bg-muted/30 border-border/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fim</Label>
                <Input
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  className="bg-muted/30 border-border/60"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <StandardButton variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancelar
            </StandardButton>
            <StandardButton variant="brand" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : form.id ? 'Atualizar' : 'Criar Ciclo'}
            </StandardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ciclo?</AlertDialogTitle>
            <AlertDialogDescription>
              As execuções vinculadas serão desassociadas (run_id passa a null), mas não serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TestRuns;
