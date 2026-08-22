import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { 
  Plus, Search, ListFilter, ArrowUpDown, Edit, Trash2, Calendar, 
  Repeat, Layers, PlayCircle, CheckCircle2, Clock, XCircle, AlertCircle, 
  MoreVertical, ClipboardList
} from 'lucide-react';
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

const STATUS_ICON: Record<TestRunStatus, React.ElementType> = {
  planned: Clock,
  in_progress: PlayCircle,
  completed: CheckCircle2,
  aborted: XCircle,
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
      const sortedPlans = [...plansData].sort((a: any, b: any) => 
        (b.sequence || 0) - (a.sequence || 0) || 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setPlans(sortedPlans);
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

  // Statistics for Market Leader KPI Bar
  const stats = useMemo(() => {
    const total = runs.length;
    const inProgress = runs.filter(r => r.status === 'in_progress').length;
    const completed = runs.filter(r => r.status === 'completed').length;
    const planned = runs.filter(r => r.status === 'planned').length;
    const aborted = runs.filter(r => r.status === 'aborted').length;

    let totalProgressSum = 0;
    let runsWithProgress = 0;
    runs.forEach(r => {
      const prog = progressMap[r.id];
      if (prog && prog.totals.total > 0) {
        totalProgressSum += prog.completionRate;
        runsWithProgress++;
      }
    });

    const avgProgress = runsWithProgress > 0 ? Math.round((totalProgressSum / runsWithProgress) * 100) : 0;

    return {
      total,
      inProgress,
      completed,
      planned,
      aborted,
      avgProgress,
    };
  }, [runs, progressMap]);

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
    plans.forEach((p) => { 
      const seq = p.sequence != null ? `PT-${String(p.sequence).padStart(3, '0')} — ` : '';
      map[p.id] = `${seq}${p.title}`; 
    });
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
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Progresso</span>
          <span>{total > 0 ? `${pct}% • ${total} execuções` : 'Sem execuções'}</span>
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
    <div className="flex-1 space-y-6 p-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Repeat className="h-6 w-6 text-brand" />
            Ciclos de Teste
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Agrupamento estruturado de execuções para iterações, releases e sprints.
          </p>
        </div>
        {canManage && currentProject && !isProjectInactive && (
          <StandardButton variant="brand" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo Ciclo de Teste
          </StandardButton>
        )}
      </div>

      {/* Market Leader KPI Bar */}
      {currentProject && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Total de Ciclos</span>
              <Layers className="h-4 w-4 text-brand/70" />
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">{stats.total}</div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Progresso Médio</span>
              <PlayCircle className="h-4 w-4 text-brand/70" />
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">{stats.avgProgress}%</div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Em Andamento</span>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-500 mt-1">{stats.inProgress}</div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Concluídos</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-500 mt-1">{stats.completed}</div>
          </div>

          <div className="p-3.5 rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Planejados</span>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-500 mt-1">{stats.planned}</div>
          </div>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/40 p-3 rounded-xl border border-border/60">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por título, descrição ou RUN-XXX…"
              className="pl-9 h-9 bg-background/50 border-border/70 text-xs"
            />
          </div>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs border-border/70 bg-background/50">
                <ListFilter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                {filterStatus === 'all' ? 'Status: Todos' : `Status: ${STATUS_LABEL[filterStatus]}`}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setFilterStatus('all')}>Todos os Status</DropdownMenuItem>
              <DropdownMenuSeparator />
              {(['planned', 'in_progress', 'completed', 'aborted'] as TestRunStatus[]).map((s) => {
                const Icon = STATUS_ICON[s];
                return (
                  <DropdownMenuItem key={s} onClick={() => setFilterStatus(s)} className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{STATUS_LABEL[s]}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs border-border/70 bg-background/50">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" /> Ordenar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => { setSortBy('sequence'); setSortOrder('desc'); }}>ID (Maior primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('sequence'); setSortOrder('asc'); }}>ID (Menor primeiro)</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setSortBy('created_at'); setSortOrder('desc'); }}>Mais recentes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('created_at'); setSortOrder('asc'); }}>Mais antigos</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        </div>
      </div>

      {/* Empty / loading States */}
      {!currentProject && (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecione um projeto ativo para visualizar e gerenciar os ciclos de teste.
          </CardContent>
        </Card>
      )}

      {currentProject && loading && (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="py-12 text-center text-muted-foreground animate-pulse">
            Carregando ciclos de execução...
          </CardContent>
        </Card>
      )}

      {currentProject && !loading && filtered.length === 0 && (
        <Card className="border-border/60 bg-card/40">
          <CardContent className="py-12 text-center text-muted-foreground">
            {runs.length === 0
              ? 'Nenhum ciclo criado neste projeto. Crie o primeiro para agrupar execuções por release ou sprint.'
              : 'Nenhum ciclo encontrado com os filtros atuais.'}
          </CardContent>
        </Card>
      )}

      {/* Cards View */}
      {currentProject && !loading && filtered.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((run) => (
            <div
              key={run.id}
              className="rounded-xl border border-border/70 bg-card/60 backdrop-blur-sm p-4 cursor-pointer card-hover flex flex-col justify-between transition-all hover:border-brand/40 shadow-xs"
              onClick={() => handleOpenEdit(run)}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-md">
                    {RUN_BADGE(run.sequence)}
                  </span>
                  <StatusDot status={run.status} label={STATUS_LABEL[run.status]} />
                </div>

                <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-1">
                  {run.title}
                </h3>

                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[32px]">
                  {run.description || 'Sem descrição cadastrada'}
                </p>

                {run.plan_id && planTitleById[run.plan_id] && (
                  <div className="mb-3">
                    <Badge variant="outline" className="text-[11px] py-0.5 px-2 bg-muted/40 border-border/70 truncate max-w-full font-normal">
                      <ClipboardList className="h-3 w-3 mr-1 text-brand shrink-0" />
                      <span className="truncate">{planTitleById[run.plan_id]}</span>
                    </Badge>
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3">{renderProgress(run)}</div>

                <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span>{formatLocalDate(run.created_at)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {run.assigned_to && <UserAvatar userId={run.assigned_to} />}
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(run)}>
                            <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete(run)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List / Table View */}
      {currentProject && !loading && filtered.length > 0 && viewMode === 'list' && (
        <div className="bg-card/70 border border-border/70 rounded-xl overflow-hidden shadow-xs">
          <div className="grid grid-cols-[90px_3fr_1.5fr_2fr_2fr_120px_70px] items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border/70 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div>ID</div>
            <div>Ciclo de Teste</div>
            <div>Status</div>
            <div>Plano Vinculado</div>
            <div>Progresso & Execuções</div>
            <div>Criado em</div>
            <div className="text-right">Ações</div>
          </div>
          <div className="divide-y divide-border/50">
            {filtered.map((run) => {
              const prog = progressMap[run.id];
              const pct = prog ? Math.round(prog.completionRate * 100) : 0;
              return (
                <div
                  key={run.id}
                  className="grid grid-cols-[90px_3fr_1.5fr_2fr_2fr_120px_70px] items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => handleOpenEdit(run)}
                >
                  <div>
                    <span className="text-xs font-mono font-bold bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-md">
                      {RUN_BADGE(run.sequence)}
                    </span>
                  </div>
                  <div className="min-w-0 pr-2">
                    <div className="text-sm font-semibold text-foreground truncate">{run.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{run.description || 'Sem descrição'}</div>
                  </div>
                  <div><StatusDot status={run.status} label={STATUS_LABEL[run.status]} /></div>
                  <div className="text-xs text-muted-foreground truncate">
                    {run.plan_id ? (
                      <span className="font-medium text-foreground">{planTitleById[run.plan_id] || '—'}</span>
                    ) : (
                      '—'
                    )}
                  </div>
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{pct}% concluído</span>
                      <span>{prog?.totals.total || 0} execuções</span>
                    </div>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(run)}>
                            <Edit className="h-3.5 w-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete(run)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de Criação / Edição */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[540px] rounded-xl border border-border/80 bg-card shadow-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Repeat className="h-5 w-5 text-brand" />
              {form.id ? 'Editar Ciclo de Teste' : 'Novo Ciclo de Teste'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Agrupe execuções para uma sprint, release ou janela de testes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Título *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Sprint 24 — Validação de Release"
                className="bg-muted/20 border-border/70 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Escopo, objetivo e contexto operacional do ciclo..."
                className="bg-muted/20 border-border/70 text-xs resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
                <SearchableCombobox
                  items={[
                    { value: 'planned', label: 'Planejado' },
                    { value: 'in_progress', label: 'Em andamento' },
                    { value: 'completed', label: 'Concluído' },
                    { value: 'aborted', label: 'Abortado' },
                  ]}
                  value={form.status}
                  onChange={(v) => v && setForm((f) => ({ ...f, status: v as TestRunStatus }))}
                  placeholder="Selecione o status"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Plano Vinculado
                </Label>
                <SearchableCombobox
                  items={[{ value: '', label: '— Nenhum —' }, ...plans.map((p) => ({ 
                    value: p.id, 
                    label: `${p.sequence != null ? `PT-${String(p.sequence).padStart(3, '0')} — ` : ''}${p.title}` 
                  }))]}
                  value={form.plan_id}
                  onChange={(v) => setForm((f) => ({ ...f, plan_id: v || '' }))}
                  placeholder="Selecione um plano"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Responsável
              </Label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                className="w-full rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-brand/50"
              >
                <option value="">Nenhum responsável atribuído</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{labelFor(u)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data de Início</Label>
                <Input
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  className="bg-muted/20 border-border/70 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Data de Término</Label>
                <Input
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  className="bg-muted/20 border-border/70 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2 border-t border-border/40">
            <StandardButton variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancelar
            </StandardButton>
            <StandardButton variant="brand" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : form.id ? 'Atualizar Ciclo' : 'Criar Ciclo'}
            </StandardButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent className="rounded-xl border border-border/80 bg-card shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ciclo de teste?</AlertDialogTitle>
            <AlertDialogDescription>
              As execuções vinculadas serão desassociadas deste ciclo, mas não serão removidas do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TestRuns;
