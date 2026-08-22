import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePaginationUrlSync } from '@/hooks/usePaginationUrlSync';
import { useVirtualTableHeight } from '@/hooks/useVirtualTableHeight';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Plus, PlayCircle, Edit, Trash2, Search, ArrowUpDown, ListFilter, 
  Download, Calendar, Sparkles, Bug as BugIcon, CheckCircle2, 
  XCircle, AlertOctagon, HelpCircle, FileSpreadsheet, FileCode2, 
  Copy, FileCheck2, Table, FileText, AlertTriangle, Eye, ShieldAlert,
  Percent
} from 'lucide-react';
import { StatusDot } from '@/components/ui/StatusDot';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { getTestExecutionsByProject, getTestPlansByIds, getTestCasesByIds, getTestCasesByProject, deleteTestExecution, getDefects, createDefect } from '@/services/apiClientService';
import { apiClient } from '@/lib/api';
import { TestExecution, TestCase } from '@/types';
import { TestExecutionForm } from '@/components/forms/TestExecutionForm';
import { DetailModal } from '@/components/DetailModal';
import { StandardButton } from '@/components/StandardButton';
import { AIGeneratorForm } from '@/components/forms/AIGeneratorForm';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { cn, formatLocalDate } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { executionStatusBadgeClass, executionStatusLabel } from '@/lib/labels';
import { useProject } from '@/contexts/ProjectContext';
import { InfoPill } from '@/components/InfoPill';
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

export const TestExecutions = () => {
  const { initFromSearchParams, writeFromState } = usePaginationUrlSync();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Refs para altura virtual
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const listCardRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);
  const [rowSize, setRowSize] = useState<number>(72);
  const [executions, setExecutions] = useState<TestExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<TestExecution | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    const saved = localStorage.getItem('testExecutions_viewMode');
    return (saved as 'cards' | 'list') || 'list';
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed' | 'blocked' | 'not_tested'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'executed_at' | 'sequence'>('sequence');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  // Paginação
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);
  const [q, setQ] = useState('');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'plan' | 'case' | 'execution'>('all');
  const [applied, setApplied] = useState<{ q: string; dateStart?: string; dateEnd?: string; type: 'all' | 'plan' | 'case' | 'execution' }>({ q: '', type: 'all' });
  
  // Projeto atual
  const { currentProject, projects } = useProject();
  const isProjectInactive = !!currentProject && currentProject.status !== 'active';
  
  // Mapas para enriquecer colunas
  const [planMap, setPlanMap] = useState<Record<string, { id: string; sequence?: number; project_id: string }>>({});
  const [caseMap, setCaseMap] = useState<Record<string, { id: string; sequence?: number; title?: string }>>({});
  const [defectsMap, setDefectsMap] = useState<Record<string, { count: number; defects: Array<{ id: string; title: string; status: string; severity?: string }> }>>({});
  
  // Exclusão e Bugs
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [showReportBugModal, setShowReportBugModal] = useState(false);
  const [executionToReport, setExecutionToReport] = useState<TestExecution | null>(null);
  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSeverity, setBugSeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [deletingExecutionId, setDeletingExecutionId] = useState<string | null>(null);
  const [bugStakeholder, setBugStakeholder] = useState<string>('');
  const [projectUsers, setProjectUsers] = useState<Array<{ id: string; display_name: string | null; email: string }>>([]);  
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Estados adicionais para criação de bug geral
  const [allProjectCases, setAllProjectCases] = useState<TestCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string>('');

  const currentCaseExecutions = useMemo(() => {
    if (!selectedCaseId) return [];
    return executions.filter(e => e.case_id === selectedCaseId);
  }, [selectedCaseId, executions]);

  const allowedStatuses = ['all', 'passed', 'failed', 'blocked', 'not_tested'] as const;
  type ExecStatus = typeof allowedStatuses[number];
  const isExecStatus = (s: string): s is ExecStatus => (allowedStatuses as readonly string[]).includes(s);

  useEffect(() => {
    if (user) {
      loadExecutions();
    }
  }, [user, currentProject?.id, projects]);

  useEffect(() => {
    localStorage.setItem('testExecutions_viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const handler = () => loadExecutions();
    window.addEventListener('krg:project-changed', handler as EventListener);
    window.addEventListener('nexus:executions-changed', handler as EventListener);
    return () => {
      window.removeEventListener('krg:project-changed', handler as EventListener);
      window.removeEventListener('nexus:executions-changed', handler as EventListener);
    };
  }, []);

  useEffect(() => {
    const id = searchParams.get('id');
    const modal = searchParams.get('modal');
    if (!id) return;
    if (modal === 'exec:new' || modal === 'exec:edit') return;
    if (executions.length === 0) return;
    const found = executions.find(e => e.id === id);
    if (found) {
      setSelectedExecution(found);
      setShowDetailModal(true);
    }
  }, [executions, searchParams]);

  useEffect(() => {
    const status = searchParams.get('status');
    const q = searchParams.get('q');
    if (status && isExecStatus(status)) {
      setFilterStatus(status);
    }
    if (q !== null) {
      setSearchTerm(q);
    }
  }, [searchParams]);

  useEffect(() => {
    const modal = searchParams.get('modal');
    if (modal === 'exec:new') {
      setShowForm(true);
    } else if (modal === 'exec:edit') {
      const id = searchParams.get('id');
      if (id && executions.length > 0) {
        const found = executions.find(e => e.id === id);
        if (found) {
          setSelectedExecution(found);
          setShowEditForm(true);
        }
      }
    }
  }, [searchParams, executions]);

  useEffect(() => {
    initFromSearchParams({ setQ, setDateStart, setDateEnd, setTypeFilter, setApplied, setPage });
    setSearchTerm(q);
  }, [initFromSearchParams, q]);

  // Métricas rápidas (Market Leader Metrics)
  const stats = useMemo(() => {
    const total = executions.length;
    const passed = executions.filter(e => e.status === 'passed').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const blocked = executions.filter(e => e.status === 'blocked').length;
    const notTested = executions.filter(e => e.status === 'not_tested').length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    // Contagem de defeitos vinculados
    let totalDefects = 0;
    Object.values(defectsMap).forEach(d => { totalDefects += d.count; });

    return { total, passed, failed, blocked, notTested, passRate, totalDefects };
  }, [executions, defectsMap]);

  const filteredExecutions = useMemo(() => {
    const raw = searchTerm.trim();
    const term = raw.toLowerCase();
    const numMatch = raw.match(/^#?\s*(\d+)\s*$/);
    return executions.filter((e) => {
      const statusOk = filterStatus === 'all' || e.status === filterStatus;
      if (!statusOk) return false;
      if (!term) return true;
      if (numMatch) {
        const qn = Number(numMatch[1]);
        const seqValue = e.sequence ?? null;
        return seqValue != null && Number(seqValue) === qn;
      }
      const seqStr = (e.sequence ?? e.id).toString().toLowerCase();
      const formattedSeq = `exe-${String(e.sequence ?? '').padStart(3, '0')}`;
      const idShort = e.id.slice(0, 8);
      const executedBy = e.executed_by?.toLowerCase() ?? '';
      const notes = e.notes?.toLowerCase() ?? '';
      const label = e.status;
      const cTitle = (caseMap[e.case_id]?.title || '').toLowerCase();
      return (
        seqStr.includes(term) ||
        formattedSeq.includes(term) ||
        idShort.includes(term) ||
        executedBy.includes(term) ||
        notes.includes(term) ||
        label.includes(term) ||
        cTitle.includes(term)
      );
    });
  }, [executions, filterStatus, searchTerm, caseMap]);

  const sortedExecutions = useMemo(() => {
    const list = [...filteredExecutions];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'sequence') {
        const aSeq = a.sequence ?? 0;
        const bSeq = b.sequence ?? 0;
        cmp = aSeq - bSeq;
      } else if (sortBy === 'executed_at') {
        const aTime = a.executed_at ? new Date(a.executed_at).getTime() : 0;
        const bTime = b.executed_at ? new Date(b.executed_at).getTime() : 0;
        cmp = aTime - bTime;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [filteredExecutions, sortBy, sortDir]);

  const totalItems = sortedExecutions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedExecutions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedExecutions.slice(start, start + pageSize);
  }, [sortedExecutions, currentPage, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    writeFromState(applied, page);
  }, [applied, page, writeFromState]);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      let data: TestExecution[] = [];
      if (currentProject?.id) {
        data = await getTestExecutionsByProject(user!.id, currentProject.id);
      } else {
        const active = (projects || []).filter(p => p.status === 'active');
        if (active.length > 0) {
          const lists = await Promise.all(active.map(p => getTestExecutionsByProject(user!.id, p.id)));
          data = lists.flat();
        } else {
          data = [];
        }
      }
      setExecutions(data);
      
      if (currentProject?.id) {
        getTestCasesByProject(user!.id, currentProject.id)
          .then(cases => setAllProjectCases(cases.sort((a, b) => (b.sequence || 0) - (a.sequence || 0))))
          .catch(() => setAllProjectCases([]));
      } else {
        setAllProjectCases([]);
      }

      const uniquePlanIds = Array.from(new Set(data.map(e => e.plan_id).filter(Boolean)));
      const uniqueCaseIds = Array.from(new Set(data.map(e => e.case_id).filter(Boolean)));
      const [plans, cases] = await Promise.all([
        getTestPlansByIds(user!.id, uniquePlanIds as string[]),
        getTestCasesByIds(user!.id, uniqueCaseIds as string[]),
      ]);
      const pMap: Record<string, { id: string; sequence?: number; project_id: string }> = {};
      plans.forEach(p => { pMap[p.id] = { id: p.id, sequence: p.sequence, project_id: p.project_id }; });
      setPlanMap(pMap);
      const cMap: Record<string, { id: string; sequence?: number; title?: string }> = {};
      cases.forEach(c => { cMap[c.id] = { id: c.id, sequence: c.sequence, title: c.title }; });
      setCaseMap(cMap);

      if (uniqueCaseIds.length > 0 && user) {
        try {
          const allDefects = await getDefects(user.id);
          const dMap: Record<string, { count: number; defects: Array<{ id: string; title: string; status: string; severity?: string }> }> = {};
          data.forEach(exec => {
            const caseDefects = allDefects.filter(d => d.case_id === exec.case_id && d.status !== 'closed');
            dMap[exec.id] = {
              count: caseDefects.length,
              defects: caseDefects.map(d => ({ id: d.id, title: d.title, status: d.status, severity: d.severity }))
            };
          });
          setDefectsMap(dMap);
        } catch (e) {
          console.warn('Erro ao carregar defeitos:', e);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar execuções:', error);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (value: string) => {
    const [by, dir] = value.split(':') as ['executed_at' | 'sequence', 'asc' | 'desc'];
    if (by) setSortBy(by);
    if (dir) setSortDir(dir);
  };

  const handleFilterStatusChange = (v: ExecStatus) => {
    setFilterStatus(v);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (v === 'all') params.delete('status'); else params.set('status', v);
    setSearchParams(params);
  };

  const handleSearchTermChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
    const params = new URLSearchParams(searchParams);
    if (!val) params.delete('q'); else params.set('q', val);
    setSearchParams(params);
  };

  const handleExecutionCreated = (newExecution: TestExecution) => {
    setExecutions(prev => [newExecution, ...prev]);
    setShowForm(false);
    toast({ title: 'Sucesso', description: 'Execução criada com sucesso!' });
  };

  const handleExecutionUpdated = (updated: TestExecution) => {
    setExecutions(prev => prev.map(e => e.id === updated.id ? updated : e));
    setShowEditForm(false);
    setSelectedExecution(null);
    toast({ title: 'Sucesso', description: 'Execução atualizada com sucesso!' });
  };

  const handleViewDetails = (execution: TestExecution) => {
    setSelectedExecution(execution);
    setShowDetailModal(true);
    const params = new URLSearchParams(searchParams);
    params.set('id', execution.id);
    setSearchParams(params);
  };

  const requestDelete = (id: string) => {
    setDeletingExecutionId(id);
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!deletingExecutionId) return;
    try {
      await deleteTestExecution(deletingExecutionId);
      setExecutions(prev => prev.filter(e => e.id !== deletingExecutionId));
      toast({ title: 'Execução excluída', description: 'A execução foi removida com sucesso.' });
    } catch (error: any) {
      toast({ title: 'Erro ao excluir', description: error.message || 'Falha ao remover a execução.', variant: 'destructive' });
    } finally {
      setConfirmDeleteOpen(false);
      setDeletingExecutionId(null);
    }
  };

  const exeLabel = (e: TestExecution) => (
    e.sequence != null ? `EXE-${String(e.sequence).padStart(3, '0')}` : `EXE-${e.id.slice(0, 4)}`
  );

  const planLabel = (planId?: string) => {
    if (!planId) return 'Sem plano';
    const p = planMap[planId];
    return p?.sequence != null ? `PT-${String(p.sequence).padStart(3, '0')}` : 'PT-001';
  };

  const caseLabel = (caseId?: string) => {
    if (!caseId) return 'Sem caso';
    const c = caseMap[caseId];
    return c?.sequence != null ? `CT-${String(c.sequence).padStart(3, '0')}` : 'CT-001';
  };

  const caseTitle = (caseId?: string) => {
    if (!caseId) return '';
    return caseMap[caseId]?.title || '';
  };

  // Exportação com os novos ícones e funções unificadas
  const handleExport = async (format: 'csv' | 'excel' | 'json' | 'pdf') => {
    try {
      if (sortedExecutions.length === 0) {
        toast({ title: 'Nada para exportar', description: 'A lista filtrada está vazia.', variant: 'destructive' });
        return;
      }
      
      const tableData = sortedExecutions.map(execution => ({
        ID: exeLabel(execution),
        Caso: `${caseLabel(execution.case_id)}: ${caseTitle(execution.case_id)}`,
        Plano: planLabel(execution.plan_id),
        Status: executionStatusLabel(execution.status as any),
        Executor: execution.executed_by || 'Não informado',
        Notas: execution.notes || 'Sem notas',
        Data: execution.executed_at ? formatLocalDate(execution.executed_at) : 'N/A'
      }));

      const { exportTableData } = await import('../utils/export');
      await exportTableData(tableData, format, `execucoes_teste_${new Date().toISOString().split('T')[0]}`);

      toast({
        title: 'Exportação realizada',
        description: `Execuções exportadas em formato ${format.toUpperCase()}`,
      });
    } catch (error: any) {
      console.error('Erro na exportação:', error);
      toast({
        title: 'Erro na exportação',
        description: error.message || `Erro ao exportar execuções em formato ${format}`,
        variant: 'destructive',
      });
    }
  };

  const handleCopy = async (format: 'txt' | 'md') => {
    try {
      if (sortedExecutions.length === 0) {
        toast({ title: 'Nada para copiar', description: 'A lista filtrada está vazia.', variant: 'destructive' });
        return;
      }
      const { copyTableData } = await import('../utils/export');
      
      const tableData = {
        headers: ['ID', 'Caso', 'Plano', 'Status', 'Executor', 'Data'],
        rows: sortedExecutions.map(execution => [
          exeLabel(execution),
          `${caseLabel(execution.case_id)}: ${caseTitle(execution.case_id)}`,
          planLabel(execution.plan_id),
          executionStatusLabel(execution.status as any),
          execution.executed_by || 'Não informado',
          execution.executed_at ? formatLocalDate(execution.executed_at) : 'N/A'
        ])
      };

      const success = await copyTableData(tableData, format, 'Execuções de Teste');
      if (success) {
        toast({
          title: 'Copiado!',
          description: `Execuções copiadas para a área de transferência em formato ${format.toUpperCase()}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao copiar',
        description: error.message || `Erro ao copiar execuções em formato ${format}`,
        variant: 'destructive',
      });
    }
  };

  const execToDelete = executions.find(e => e.id === deletingExecutionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-5 p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Execuções de Teste</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Acompanhe em tempo real os resultados, evidências, defeitos e histórico de execução dos testes
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-3 rounded-lg border-destructive/30 hover:border-destructive hover:bg-destructive/10 text-destructive text-xs font-semibold shadow-2xs transition-all"
            title="Reportar Defeito Geral"
            disabled={!currentProject || isProjectInactive}
            onClick={() => {
              setExecutionToReport(null);
              setBugTitle('');
              setBugDescription('');
              setBugSeverity('medium');
              setBugStakeholder('');
              setSelectedCaseId('');
              setSelectedExecutionId('');
              setShowReportBugModal(true);
            }}
          >
            <BugIcon className="h-4 w-4 shrink-0" />
            <span>Reportar Defeito</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-3 rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 text-xs font-semibold shadow-2xs transition-all"
            disabled={!currentProject || currentProject.status !== 'active'}
            onClick={() => setShowAIModal(true)}
          >
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>Gerar com IA</span>
          </Button>

          <StandardButton 
            variant="brand"
            size="sm"
            onClick={() => setShowForm(true)}
            disabled={!currentProject || currentProject.status !== 'active'}
            className="h-9 gap-1.5 px-3.5 rounded-lg text-xs font-semibold shadow-xs"
            title={!currentProject ? 'Selecione um projeto ativo para criar execuções' : (currentProject.status !== 'active' ? 'Projeto não ativo — criação desabilitada' : undefined)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova Execução
          </StandardButton>
        </div>
      </div>

      {/* Market Leader KPI Bar */}
      {executions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="rounded-xl border border-border/70 bg-card/60 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-foreground">{stats.total}</span>
              <PlayCircle className="h-4 w-4 text-muted-foreground/60" />
            </div>
          </div>

          <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-brand uppercase tracking-wider">Aprovação</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-brand">{stats.passRate}%</span>
              <Percent className="h-4 w-4 text-brand/60" />
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Aprovados</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-emerald-500">{stats.passed}</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500/60" />
            </div>
          </div>

          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Falhas</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-rose-500">{stats.failed}</span>
              <XCircle className="h-4 w-4 text-rose-500/60" />
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Bloqueados</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-amber-500">{stats.blocked}</span>
              <AlertOctagon className="h-4 w-4 text-amber-500/60" />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Não Testados</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-muted-foreground">{stats.notTested}</span>
              <HelpCircle className="h-4 w-4 text-muted-foreground/60" />
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => handleSearchTermChange(e.target.value)}
            placeholder="Buscar por código (#12, EXE-001), caso, executor ou notas..."
            className="pl-9 h-8.5 text-xs bg-card/60 border-border/70 rounded-lg placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-brand"
          />
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />

          {/* Sort Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8.5 gap-1.5 px-3 rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 text-xs font-semibold shadow-2xs">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>Ordenar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs rounded-xl border-border/70 shadow-lg">
              <DropdownMenuItem onClick={() => handleSortChange('sequence:desc')}>ID (maior primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('sequence:asc')}>ID (menor primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('executed_at:desc')}>Data (mais recente)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSortChange('executed_at:asc')}>Data (mais antiga)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn(
                "h-8.5 gap-1.5 px-3 rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 text-xs font-semibold shadow-2xs",
                filterStatus !== 'all' && "border-brand/40 text-brand bg-brand/5"
              )}>
                <ListFilter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{filterStatus === 'all' ? 'Status: Todos' : `Status: ${executionStatusLabel(filterStatus as any)}`}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs rounded-xl border-border/70 shadow-lg">
              <DropdownMenuItem onClick={() => handleFilterStatusChange('all')}>Todos os Status</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleFilterStatusChange('passed')}>Aprovado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterStatusChange('failed')}>Reprovado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterStatusChange('blocked')}>Bloqueado</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleFilterStatusChange('not_tested')}>Não Testado</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Menu with System Lucide Icons */}
          {executions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8.5 gap-1.5 px-3 rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 text-xs font-semibold shadow-2xs">
                  <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span>Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs rounded-xl border-border/70 shadow-lg p-1.5 space-y-0.5">
                <DropdownMenuItem onClick={() => handleExport('csv')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
                  <Table className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span className="font-medium text-foreground">Exportar CSV (.csv)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('excel')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="font-medium text-foreground">Exportar Excel (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
                  <FileCode2 className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="font-medium text-foreground">Exportar JSON (.json)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
                  <FileText className="h-4 w-4 text-rose-400 shrink-0" />
                  <span className="font-medium text-foreground">Imprimir / PDF (.pdf)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 border-border/40" />
                <DropdownMenuItem onClick={() => handleCopy('txt')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
                  <Copy className="h-4 w-4 text-brand shrink-0" />
                  <span className="font-medium text-foreground">Copiar em Texto</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCopy('md')} className="flex items-center gap-2.5 cursor-pointer py-1.5 px-2.5 rounded-lg">
                  <FileCheck2 className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span className="font-medium text-foreground">Copiar em Markdown</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {executions.length > 0 ? (
          viewMode === 'cards' ? (
            <div ref={listCardRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
              {sortedExecutions.length > 0 ? (
                paginatedExecutions.map((execution) => (
                  <Card
                    key={execution.id}
                    className="rounded-xl border border-border/70 bg-card/60 hover:border-brand/40 hover:shadow-md transition-all cursor-pointer flex flex-col p-4 space-y-3"
                    onClick={() => handleViewDetails(execution)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-mono font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-md flex-shrink-0">
                          {exeLabel(execution)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] text-muted-foreground block truncate">
                            {caseLabel(execution.case_id)} • {planLabel(execution.plan_id)}
                          </span>
                          <span className="text-xs font-semibold text-foreground block truncate mt-0.5" title={caseTitle(execution.case_id)}>
                            {caseTitle(execution.case_id) || 'Caso sem título'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <StatusDot status={execution.status} label={executionStatusLabel(execution.status as any)} />
                      
                      {defectsMap[execution.id]?.count > 0 && (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
                          <BugIcon className="h-3 w-3" />
                          <span>{defectsMap[execution.id].count} bug(s)</span>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {execution.notes || execution.actual_result || 'Sem observações cadastradas'}
                    </p>

                    <div className="mt-auto pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span>{execution.executed_at ? formatLocalDate(execution.executed_at) : 'N/A'}</span>
                      </div>
                      <UserAvatar userId={execution.user_id} name={execution.executed_by} />
                    </div>
                  </Card>
                ))
              ) : (
                <div className="col-span-full text-center py-12 rounded-xl border border-border/60 bg-card/30">
                  <p className="text-xs text-muted-foreground">Nenhum resultado encontrado para os filtros selecionados.</p>
                </div>
              )}
            </div>
          ) : (
            // Lista em formato Tabela Executiva
            <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden shadow-xs">
              {/* Header da Tabela */}
              <div className="grid grid-cols-[85px_110px_90px_130px_3.5fr_100px_110px_100px] items-center gap-3 px-4 py-2.5 bg-muted/40 border-b border-border/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div>ID</div>
                <div>Caso</div>
                <div>Plano</div>
                <div>Status</div>
                <div>Contexto / Notas</div>
                <div className="text-center">Executor</div>
                <div>Data</div>
                <div className="text-right">Ações</div>
              </div>

              {/* Linhas da Tabela */}
              <div className="divide-y divide-border/40">
                {sortedExecutions.length > 0 ? (
                  paginatedExecutions.map((execution) => (
                    <div
                      key={execution.id}
                      className="grid grid-cols-[85px_110px_90px_130px_3.5fr_100px_110px_100px] items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group"
                      onClick={() => handleViewDetails(execution)}
                    >
                      {/* ID Execução */}
                      <div>
                        <span className="text-xs font-mono font-bold bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-md">
                          {exeLabel(execution)}
                        </span>
                      </div>

                      {/* Caso */}
                      <div>
                        <span className="text-xs font-mono font-medium bg-muted/60 text-muted-foreground border border-border/60 px-2 py-0.5 rounded-md">
                          {caseLabel(execution.case_id)}
                        </span>
                      </div>

                      {/* Plano */}
                      <div>
                        <span className="text-xs font-mono font-medium bg-muted/60 text-muted-foreground border border-border/60 px-2 py-0.5 rounded-md truncate block">
                          {planLabel(execution.plan_id)}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        <StatusDot status={execution.status} label={executionStatusLabel(execution.status as any)} />
                      </div>

                      {/* Caso / Contexto */}
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground group-hover:text-brand transition-colors truncate" title={caseTitle(execution.case_id)}>
                            {caseTitle(execution.case_id) || 'Caso sem título'}
                          </span>
                          {defectsMap[execution.id]?.count > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.2 rounded-md shrink-0">
                              <BugIcon className="h-2.5 w-2.5" />
                              {defectsMap[execution.id].count}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {execution.notes || execution.actual_result || '— sem observações adicionais —'}
                        </div>
                      </div>

                      {/* Executor */}
                      <div className="flex justify-center">
                        <UserAvatar userId={execution.user_id} name={execution.executed_by} />
                      </div>

                      {/* Data */}
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {execution.executed_at ? formatLocalDate(execution.executed_at) : 'N/A'}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setExecutionToReport(execution);
                            setShowReportBugModal(true);
                          }}
                          title="Reportar defeito para esta execução"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-md"
                        >
                          <BugIcon className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedExecution(execution);
                            setShowEditForm(true);
                          }}
                          disabled={!currentProject || currentProject.status !== 'active'}
                          title="Editar execução"
                          className="h-7 w-7 text-muted-foreground hover:text-brand hover:bg-brand/10 rounded-md"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => requestDelete(execution.id)}
                          disabled={!currentProject || isProjectInactive}
                          title="Excluir execução"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-xs text-muted-foreground">Nenhuma execução encontrada para os filtros atuais.</p>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          /* Empty State */
          <div className="text-center py-16 rounded-xl border border-dashed border-border/80 bg-card/30">
            <PlayCircle className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Nenhuma execução de teste registrada</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
              Registre a execução de casos de teste, documente evidências e resultados de validação em produção ou staging.
            </p>
            <StandardButton
              variant="brand"
              size="sm"
              onClick={() => {
                setShowForm(true);
                const params = new URLSearchParams(searchParams);
                params.set('modal', 'exec:new');
                params.delete('id');
                setSearchParams(params);
              }}
              disabled={!currentProject || currentProject.status !== 'active'}
              className="h-8.5 rounded-lg text-xs font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Criar Primeira Execução
            </StandardButton>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {sortedExecutions.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-muted-foreground font-medium">
            Mostrando {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalItems)} de {totalItems} execução(ões)
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Itens por página:</span>
              <select 
                value={pageSize} 
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10) || 9;
                  setPageSize(next);
                  setPage(1);
                }}
                className="h-8 px-2 text-xs border border-border/70 rounded-lg bg-card/60 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value={5}>5</option>
                <option value={9}>9</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(1, currentPage - 1))}
                disabled={currentPage <= 1}
                className="h-8 text-xs font-semibold rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 px-3"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 text-xs font-semibold rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 px-3"
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação */}
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        const params = new URLSearchParams(searchParams);
        if (open) {
          params.set('modal', 'exec:new');
          params.delete('id');
        } else {
          params.delete('modal');
        }
        setSearchParams(params);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-auto-hide rounded-xl bg-card border border-border/80 shadow-xl p-6">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="text-base font-bold text-foreground">Nova Execução de Teste</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Preencha os dados e resultados da execução do teste</DialogDescription>
          </DialogHeader>
          <TestExecutionForm 
            onSuccess={handleExecutionCreated}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={showEditForm} onOpenChange={(open) => {
        setShowEditForm(open);
        const params = new URLSearchParams(searchParams);
        if (open) {
          params.set('modal', 'exec:edit');
          if (selectedExecution) params.set('id', selectedExecution.id);
        } else {
          params.delete('modal');
        }
        setSearchParams(params);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-auto-hide rounded-xl bg-card border border-border/80 shadow-xl p-6">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="text-base font-bold text-foreground">
              {selectedExecution ? `Editar Execução #${selectedExecution.sequence ?? selectedExecution.id.slice(0, 8)}` : 'Editar Execução'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Atualize os dados e evidências da execução de teste</DialogDescription>
          </DialogHeader>
          {selectedExecution && (
            <TestExecutionForm
              execution={selectedExecution}
              planId={selectedExecution.plan_id}
              caseId={selectedExecution.case_id}
              onSuccess={handleExecutionUpdated}
              onCancel={() => setShowEditForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      <DetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedExecution(null);
          if (searchParams.get('id')) {
            const params = new URLSearchParams(searchParams);
            params.delete('id');
            setSearchParams(params);
          }
        }}
        item={selectedExecution}
        type="execution"
        onEdit={(item) => {
          setSelectedExecution(item as TestExecution);
          setShowDetailModal(false);
          setShowEditForm(true);
          const params = new URLSearchParams(searchParams);
          params.set('modal', 'exec:edit');
          params.set('id', (item as TestExecution).id);
          setSearchParams(params);
        }}
        onDelete={async (id: string) => {
          try {
            await deleteTestExecution(id);
            setExecutions(prev => prev.filter(ex => ex.id !== id));
            toast({
              title: 'Execução excluída',
              description: 'A execução foi removida com sucesso.'
            });
          } catch (error: any) {
            toast({
              title: 'Erro ao excluir',
              description: error.message || 'Não foi possível excluir a execução.',
              variant: 'destructive'
            });
          } finally {
            setShowDetailModal(false);
          }
        }}
      />

      {/* Confirm Delete Modal */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scrollbar-auto-hide rounded-xl bg-card border border-border/80 p-6 shadow-xl space-y-4">
          <AlertDialogHeader className="pb-3 border-b border-border/40 text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle className="text-base font-bold text-foreground tracking-tight">
                  Excluir Execução?
                </AlertDialogTitle>
                {execToDelete && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {exeLabel(execToDelete)} • {caseTitle(execToDelete.case_id)}
                  </p>
                )}
              </div>
            </div>
          </AlertDialogHeader>

          <div className="text-xs text-muted-foreground leading-relaxed">
            Esta ação não pode ser desfeita. O registro da execução será removido permanentemente e as métricas do projeto serão recalculadas.
          </div>

          <AlertDialogFooter className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
            <AlertDialogCancel onClick={() => setDeletingExecutionId(null)} className="text-xs h-8.5 px-4 rounded-md border-border/70 font-medium hover:bg-muted/60 m-0">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={performDelete} className="text-xs h-8.5 px-4 rounded-md bg-destructive hover:bg-destructive/90 text-white font-semibold shadow-xs">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal IA para gerar execução */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="max-w-3xl overflow-x-hidden rounded-xl bg-card border border-border/80 shadow-xl p-6">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Gerar Execução com IA
            </DialogTitle>
            <DialogDescription className="sr-only">Gerar execução de teste com inteligência artificial</DialogDescription>
          </DialogHeader>
          <AIGeneratorForm initialType="execution" hideTypeSelector={true} onSuccess={() => { setShowAIModal(false); loadExecutions(); }} />
        </DialogContent>
      </Dialog>

      {/* Modal de Reportar Bug */}
      <Dialog open={showReportBugModal} onOpenChange={(open) => {
        setShowReportBugModal(open);
        if (open && projectUsers.length === 0 && !loadingUsers) {
          setLoadingUsers(true);
          apiClient.from('profiles' as any).select('id, display_name, email').order('display_name')
            .then(({ data }) => {
              setProjectUsers((data || []) as Array<{ id: string; display_name: string | null; email: string }>);
              setLoadingUsers(false);
            });
        }
        if (!open) {
          setBugStakeholder('');
          setSelectedCaseId('');
          setSelectedExecutionId('');
        }
      }}>
        <DialogContent className="max-w-lg rounded-xl bg-card border border-border/80 shadow-xl p-6">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <BugIcon className="h-5 w-5 text-destructive" />
              Reportar Defeito (Bug)
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {executionToReport ? (
                <span>
                  Criar defeito vinculado ao caso <strong className="text-foreground">{caseLabel(executionToReport.case_id)} - {caseTitle(executionToReport.case_id)}</strong>.
                </span>
              ) : (
                <span>Criar um defeito geral para este projeto. Opcionalmente vincule a um caso e execução abaixo.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Título do Defeito</label>
              <Input
                value={bugTitle}
                onChange={(e) => setBugTitle(e.target.value)}
                placeholder="Ex: Falha na validação do formulário de login"
                className="h-8.5 text-xs bg-background border-border/70 rounded-lg placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-destructive"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Descrição</label>
              <textarea
                value={bugDescription}
                onChange={(e) => setBugDescription(e.target.value)}
                placeholder="Descreva detalhadamente o problema, passos para reproduzir, comportamento esperado..."
                className="w-full min-h-[90px] rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-destructive transition-all"
              />
            </div>

            {/* Seletores manuais quando o bug é geral */}
            {!executionToReport && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Caso Relacionado</label>
                  <select
                    value={selectedCaseId}
                    onChange={(e) => {
                      setSelectedCaseId(e.target.value);
                      setSelectedExecutionId('');
                    }}
                    className="w-full h-8.5 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive"
                  >
                    <option value="">Nenhum</option>
                    {allProjectCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sequence != null ? `CT-${String(c.sequence).padStart(3, '0')}` : ''} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Execução Vinculada</label>
                  <select
                    value={selectedExecutionId}
                    onChange={(e) => setSelectedExecutionId(e.target.value)}
                    disabled={!selectedCaseId}
                    className="w-full h-8.5 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Nenhuma</option>
                    {currentCaseExecutions.map((e) => (
                      <option key={e.id} value={e.id}>
                        {exeLabel(e)} ({e.executed_at ? formatLocalDate(e.executed_at) : ''}) - {executionStatusLabel(e.status as any)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Interessado</label>
              <select
                value={bugStakeholder}
                onChange={(e) => setBugStakeholder(e.target.value)}
                disabled={loadingUsers}
                className="w-full h-8.5 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-destructive"
              >
                <option value="">Selecionar interessado (opcional)</option>
                {projectUsers
                  .filter(u => u.id !== user?.id)
                  .map(u => (
                    <option key={u.id} value={u.id}>
                      {u.display_name || u.email}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Severidade</label>
              <div className="grid grid-cols-4 gap-2">
                {(['low', 'medium', 'high', 'critical'] as const).map((sev) => {
                  const isSelected = bugSeverity === sev;
                  let colorClass = '';
                  if (sev === 'low') {
                    colorClass = isSelected 
                      ? 'bg-emerald-500 text-white border-emerald-600' 
                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 dark:text-emerald-400';
                  } else if (sev === 'medium') {
                    colorClass = isSelected 
                      ? 'bg-amber-500 text-white border-amber-600' 
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20 dark:text-amber-400';
                  } else if (sev === 'high') {
                    colorClass = isSelected 
                      ? 'bg-orange-500 text-white border-orange-600' 
                      : 'bg-orange-500/10 text-orange-600 border-orange-500/20 hover:bg-orange-500/20 dark:text-orange-400';
                  } else if (sev === 'critical') {
                    colorClass = isSelected 
                      ? 'bg-rose-500 text-white border-rose-600' 
                      : 'bg-rose-500/10 text-rose-600 border-rose-500/20 hover:bg-rose-500/20 dark:text-red-400';
                  }
                  
                  return (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setBugSeverity(sev)}
                      className={cn("py-1.5 text-xs font-semibold rounded-md border text-center transition-all cursor-pointer", colorClass)}
                    >
                      {sev === 'low' && 'Baixa'}
                      {sev === 'medium' && 'Média'}
                      {sev === 'high' && 'Alta'}
                      {sev === 'critical' && 'Crítica'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-3">
            <Button variant="outline" size="sm" onClick={() => setShowReportBugModal(false)} className="text-xs h-8.5 px-4 rounded-md border-border/70 hover:bg-muted/60">
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!user || !bugTitle.trim()) return;
                const finalPlanId = executionToReport 
                  ? executionToReport.plan_id 
                  : (selectedCaseId ? allProjectCases.find(c => c.id === selectedCaseId)?.plan_id : null);
                const finalCaseId = executionToReport ? executionToReport.case_id : (selectedCaseId || null);
                const finalExecutionId = executionToReport ? executionToReport.id : (selectedExecutionId || null);

                try {
                  await createDefect({
                    title: bugTitle.trim(),
                    description: bugDescription.trim(),
                    severity: bugSeverity,
                    status: 'open',
                    project_id: currentProject?.id || '',
                    plan_id: finalPlanId || undefined,
                    case_id: finalCaseId || undefined,
                    execution_id: finalExecutionId || undefined,
                    user_id: user.id,
                  });
                  if (bugStakeholder) {
                    const reporterName = user.user_metadata?.full_name || user.email || 'Alguém';
                    const linkLabel = finalCaseId ? ` ao caso ${caseLabel(finalCaseId)}` : '';
                    await apiClient.from('notifications' as any).insert({
                      id: crypto.randomUUID(),
                      user_id: bugStakeholder,
                      title: 'Novo defeito reportado',
                      body: `${reporterName} reportou um defeito: "${bugTitle.trim()}" (${bugSeverity === 'critical' ? 'Crítica' : bugSeverity === 'high' ? 'Alta' : bugSeverity === 'medium' ? 'Média' : 'Baixa'})${linkLabel}.`,
                    });
                  }
                  toast({
                    title: 'Defeito criado',
                    description: bugStakeholder
                      ? 'Defeito reportado e notificação enviada ao interessado.'
                      : 'O defeito foi reportado com sucesso.',
                  });
                  setShowReportBugModal(false);
                  setBugTitle('');
                  setBugDescription('');
                  setBugSeverity('medium');
                  setBugStakeholder('');
                  setSelectedCaseId('');
                  setSelectedExecutionId('');
                  loadExecutions();
                } catch (error: any) {
                  toast({
                    title: 'Erro ao criar defeito',
                    description: error.message || 'Não foi possível reportar o defeito.',
                    variant: 'destructive'
                  });
                }
              }}
              disabled={!bugTitle.trim()}
              className="text-xs h-8.5 px-4 rounded-md bg-destructive text-white hover:bg-destructive/90 font-semibold shadow-xs"
            >
              Reportar Defeito
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
