import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePaginationUrlSync } from '@/hooks/usePaginationUrlSync';
import { useVirtualTableHeight } from '@/hooks/useVirtualTableHeight';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { 
  Plus, Search, ListFilter, ArrowUpDown, Edit, Trash2, 
  Sparkles, Download, Calendar, FileText, FileSpreadsheet, 
  FileCode2, Copy, FileCheck2, Table 
} from 'lucide-react';
import { StatusDot } from '@/components/ui/StatusDot';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn, formatLocalDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { getTestPlans, deleteTestPlan, getPlanLinkedCounts, getPlanLinkedDetails } from '@/services/apiClientService';
import { TestPlan } from '@/types';
import { TestPlanForm } from '@/components/forms/TestPlanForm';
import { AIGeneratorForm } from '@/components/forms/AIGeneratorForm';
import { UnifiedTestCreation } from '@/components/UnifiedTestCreation';
// Removido seletor de projeto local: o controle é feito globalmente no Dashboard
import { ProjectDisplayField } from '@/components/ProjectDisplayField';
import { StandardButton } from '@/components/StandardButton';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { useToast } from '@/hooks/use-toast';
import { DetailModal } from '@/components/DetailModal';
import { useProject } from '@/contexts/ProjectContext';
import { useStatusOptions } from '@/hooks/useStatusOptions';
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

export const TestPlans = () => {
  const { initFromSearchParams, writeFromState } = usePaginationUrlSync();
  const { user } = useAuth();
  const { currentProject, projects, refreshProjects } = useProject();
  const isProjectInactive = !!currentProject && currentProject.status !== 'active';
  const { getLabelFor, options } = useStatusOptions(currentProject?.id);
  const { toast } = useToast();
  
  // Refs para cálculo de altura virtual
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const listCardRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);
  const [rowSize, setRowSize] = useState<number>(72);
  const [plans, setPlans] = useState<TestPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TestPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<TestPlan | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    const savedMode = localStorage.getItem('testPlans_viewMode');
    return (savedMode as 'cards' | 'list') || 'list';
  });
  const [sortBy, setSortBy] = useState<'sequence' | 'created_at'>('sequence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchParams, setSearchParams] = useSearchParams();
  const [filterStatus, setFilterStatus] = useState<string | 'all'>('all');
  // Paginação via hook
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);
  const [searchTerm, setSearchTerm] = useState<string>('');
  // Estados para hook de paginação
  const [q, setQ] = useState('');
  const [dateStart, setDateStart] = useState<string>('');
  const [dateEnd, setDateEnd] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'plan' | 'case' | 'execution'>('all');
  const [applied, setApplied] = useState<{ q: string; dateStart?: string; dateEnd?: string; type: 'all' | 'plan' | 'case' | 'execution' }>({ q: '', type: 'all' });
  // Delete confirmation state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<TestPlan | null>(null);
  const [linkedCounts, setLinkedCounts] = useState<{ testCaseCount: number; executionCount: number; defectCount?: number } | null>(null);
  const [linkedDetails, setLinkedDetails] = useState<{
    testCases: Array<{ id: string; title: string; sequence?: number }>;
    executions: Array<{ id: string; status: string; sequence?: number }>;
    defects: Array<{ id: string; title: string; status: string; severity?: string }>;
  } | null>(null);
  const [planStats, setPlanStats] = useState<Record<string, { cases: number; execs: number }>>({});

  // Listener para broadcast de troca de projeto ou alterações nos planos/casos/execuções
  useEffect(() => {
    const handler = () => loadPlans();
    window.addEventListener('krg:project-changed', handler as EventListener);
    window.addEventListener('nexus:plans-changed', handler as EventListener);
    window.addEventListener('nexus:cases-changed', handler as EventListener);
    window.addEventListener('nexus:executions-changed', handler as EventListener);
    return () => {
      window.removeEventListener('krg:project-changed', handler as EventListener);
      window.removeEventListener('nexus:plans-changed', handler as EventListener);
      window.removeEventListener('nexus:cases-changed', handler as EventListener);
      window.removeEventListener('nexus:executions-changed', handler as EventListener);
    };
  }, []);
  
  // Carregar planos reais do Supabase
  const loadPlanStats = (plansData: TestPlan[]) => {
    if (!user || plansData.length === 0) return;
    Promise.all(
      plansData.map(p => getPlanLinkedCounts(user.id, p.id).then(c => ({ id: p.id, cases: c.testCaseCount, execs: c.executionCount })))
    ).then(results => {
      const map: Record<string, { cases: number; execs: number }> = {};
      results.forEach(r => { map[r.id] = { cases: r.cases, execs: r.execs }; });
      setPlanStats(map);
    }).catch(() => {});
  };

  const loadPlans = async () => {
    if (!user) return;
    try {
      setLoading(true);
      let data: TestPlan[];
      if (currentProject?.id) {
        data = await getTestPlans(user.id, currentProject.id);
      } else {
        const active = (projects || []).filter(p => p.status === 'active');
        if (active.length === 0) { setPlans([]); return; }
        const lists = await Promise.all(active.map(p => getTestPlans(user.id, p.id)));
        data = lists.flat();
      }
      setPlans(data);
      loadPlanStats(data);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar planos de teste.', variant: 'destructive' });
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadPlans();
    }
  }, [user, currentProject?.id, projects]);

  // Abrir modal de visualização automaticamente quando apropriado
  // Regras:
  // - Se houver ?modal=plan:edit ou ?modal=plan:new, NÃO abrir o DetailModal
  // - Abrir somente quando não houver ?modal, ou quando ?modal=plan:view
  useEffect(() => {
    const id = searchParams.get('id');
    const modal = searchParams.get('modal');
    if (!id) return;
    if (modal === 'plan:edit' || modal === 'plan:new') return;
    if (plans.length === 0) return;
    const found = plans.find(p => p.id === id);
    if (found) {
      setSelectedPlan(found);
      setShowDetailModal(true);
    }
  }, [plans, searchParams]);

  // Restaurar abertura de modais via URL (?modal=plan:new | plan:edit&id=...)
  useEffect(() => {
    const modal = searchParams.get('modal');
    if (modal === 'plan:new') {
      setShowForm(true);
      setEditingPlan(null);
    } else if (modal === 'plan:edit') {
      const id = searchParams.get('id');
      if (id && plans.length > 0) {
        const found = plans.find(p => p.id === id);
        if (found) {
          setEditingPlan(found);
          setShowForm(true);
        }
      }
    }
  }, [searchParams, plans]);

  // Inicializar filtros via hook
  useEffect(() => {
    initFromSearchParams({ setQ, setDateStart, setDateEnd, setTypeFilter, setApplied, setPage });
    // Sincronizar searchTerm com q
    setSearchTerm(q);
    // Manter compatibilidade com filterStatus
    const status = searchParams.get('status') || 'all';
    setFilterStatus(status);
  }, [initFromSearchParams, q, searchParams]);

  // Sincronizar applied com URL
  useEffect(() => {
    writeFromState(applied, page);
  }, [applied, page, writeFromState]);

  // Salvar preferência de visualização
  useEffect(() => {
    localStorage.setItem('testPlans_viewMode', viewMode);
  }, [viewMode]);

  // Filtro e ordenação combinados
  const filteredAndSortedPlans = useMemo(() => {
    let filtered = [...plans];
    
    // Aplicar filtros de status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => (p.status || '') === filterStatus);
    }
    
    // Aplicar busca por termo
    const raw = searchTerm.trim();
    const term = raw.toLowerCase();
    const numMatch = raw.match(/^#?\s*(\d+)\s*$/);
    
    if (term) {
      if (numMatch) {
        const qn = Number(numMatch[1]);
        filtered = filtered.filter((p) => {
          const seqValue = p.sequence ?? null;
          return seqValue != null && Number(seqValue) === qn;
        });
      } else {
        filtered = filtered.filter((p) => {
          const seqStr = (p.sequence ?? p.id).toString().toLowerCase();
          return (
            seqStr.includes(term) ||
            (p.title || '').toLowerCase().includes(term) ||
            (p.description || '').toLowerCase().includes(term)
          );
        });
      }
    }
    
    // Aplicar ordenação
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'sequence':
          aVal = a.sequence || 0;
          bVal = b.sequence || 0;
          break;
        case 'created_at':
        default:
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    
    return filtered;
  }, [plans, searchTerm, filterStatus, sortBy, sortOrder]);

  // IDs agora exibem apenas numeração (ex.: PT-001). Sem nomenclatura de projeto.

  // Classes de badge por status (conhecidos) com fallback
  const planProgress = (planId: string) => {
    const s = planStats[planId];
    if (!s || s.cases === 0) return 0;
    return Math.min(100, Math.round((s.execs / s.cases) * 100));
  };

  // Derived pagination data
  const totalItems = filteredAndSortedPlans.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedPlans = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedPlans.slice(start, start + pageSize);
  }, [filteredAndSortedPlans, currentPage, pageSize]);

  // Clamp page when data/pageSize changes
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Hook de altura virtual para lista
  const { listHeight } = useVirtualTableHeight({
    containerRef,
    listHeaderRef,
    listCardRef,
    paginationRef,
    rowSize,
    pageSize,
    totalItems,
    currentPage,
    minHeight: 240,
  });

  // Scroll to top when page or pageSize changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage, pageSize]);

  // Atualiza busca via hooks
  const handleSearchTermChange = (val: string) => {
    setSearchTerm(val);
    setQ(val);
    const nextApplied = { ...applied, q: val };
    setApplied(nextApplied);
    setPage(1);
    writeFromState(nextApplied, 1);
  };

  // Removido: manipulador de filtro de projeto local.

  const handlePlanCreated = (plan: TestPlan) => {
    // Garantir tipos de data e evitar duplicatas (upsert)
    const normalized: TestPlan = {
      ...plan,
      created_at: plan.created_at instanceof Date ? plan.created_at : new Date(plan.created_at),
      updated_at: plan.updated_at instanceof Date ? plan.updated_at : new Date(plan.updated_at),
    } as TestPlan;

    setPlans(prev => {
      const exists = prev.some(p => p.id === normalized.id);
      const next = exists ? prev.map(p => (p.id === normalized.id ? normalized : p)) : [normalized, ...prev];
      return next;
    });

    setShowForm(false);
    setEditingPlan(null);
    // clear modal params
    const params = new URLSearchParams(searchParams);
    params.delete('modal');
    params.delete('id');
    setSearchParams(params);
  };

  const handleViewDetails = (plan: TestPlan) => {
    setSelectedPlan(plan);
    setShowDetailModal(true);
    // Definir query param para deep-linking (usar modal=plan:view para evitar conflito com edição)
    const params = new URLSearchParams(searchParams);
    params.set('id', plan.id);
    params.set('modal', 'plan:view');
    setSearchParams(params);
  };

  const handleEdit = (plan: TestPlan) => {
    setEditingPlan(plan);
    setShowForm(true);
    setShowDetailModal(false);
    const params = new URLSearchParams(searchParams);
    params.set('modal', 'plan:edit');
    params.set('id', plan.id);
    setSearchParams(params);
  };

  const handleRequestDelete = async (plan: TestPlan) => {
    setPlanToDelete(plan);
    setConfirmDeleteOpen(true);
    setLinkedCounts(null);
    setLinkedDetails(null);
    try {
      if (user) {
        const [counts, details] = await Promise.all([
          getPlanLinkedCounts(user.id, plan.id),
          getPlanLinkedDetails(user.id, plan.id)
        ]);
        setLinkedCounts({ ...counts, defectCount: details.defectCount });
        setLinkedDetails({
          testCases: details.testCases,
          executions: details.executions,
          defects: details.defects
        });
      }
    } catch (err) {
      console.error('Erro ao checar vínculos do plano:', err);
      setLinkedCounts({ testCaseCount: 0, executionCount: 0, defectCount: 0 });
      setLinkedDetails({ testCases: [], executions: [], defects: [] });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (isProjectInactive) {
        toast({ title: 'Projeto não ativo', description: 'Exclusão desabilitada.', variant: 'destructive' });
        setConfirmDeleteOpen(false);
        setPlanToDelete(null);
        setLinkedCounts(null);
        return;
      }
      await deleteTestPlan(id);
      await loadPlans();
      // Se o plano deletado estava selecionado no DetailModal, fechar e limpar URL
      if (selectedPlan?.id === id) {
        setSelectedPlan(null);
        setShowDetailModal(false);
        const params = new URLSearchParams(searchParams);
        params.delete('id');
        if (params.get('modal') === 'plan:view') params.delete('modal');
        setSearchParams(params);
      }
      toast({ title: 'Sucesso', description: 'Plano excluído com sucesso!' });
    } catch (error) {
      console.error('Erro ao excluir plano:', error);
      toast({ title: 'Erro', description: 'Erro ao excluir plano', variant: 'destructive' });
    } finally {
      setConfirmDeleteOpen(false);
      setPlanToDelete(null);
      setLinkedCounts(null);
      setLinkedDetails(null);
    }
  };

  const handleExport = async (format: 'csv' | 'excel' | 'json' | 'pdf') => {
    try {
      if (filteredAndSortedPlans.length === 0) {
        toast({ title: 'Nada para exportar', description: 'A lista filtrada está vazia.', variant: 'destructive' });
        return;
      }

      // Formatar dados no formato de tabela sempre
      const getStatusLabel = (status: string) => getLabelFor(status);

      const getProjectLabel = (projectId: string) => {
        const proj = projects.find(p => p.id === projectId);
        return proj?.name || projectId || 'Sem Projeto';
      };

      const tableData = filteredAndSortedPlans.map(plan => ({
        ID: `PT-${String(plan.sequence ?? '001').padStart(3, '0')}`,
        Título: plan.title,
        Projeto: getProjectLabel(plan.project_id),
        Status: getStatusLabel(plan.status),
        Criação: formatLocalDate(plan.created_at)
      }));

      const { exportTableData } = await import('../utils/export');
      await exportTableData(tableData, format, `planos_teste_${new Date().toISOString().split('T')[0]}`);

      toast({
        title: 'Exportação realizada',
        description: `Planos exportados em formato ${format.toUpperCase()}`,
      });
    } catch (error: any) {
      console.error('Erro na exportação:', error);
      toast({
        title: 'Erro na exportação',
        description: error.message || `Erro ao exportar planos em formato ${format}`,
        variant: 'destructive',
      });
    }
  };

  const handleCopy = async (format: 'txt' | 'md') => {
    try {
      if (filteredAndSortedPlans.length === 0) {
        toast({ title: 'Nada para copiar', description: 'A lista filtrada está vazia.', variant: 'destructive' });
        return;
      }
      const { copyTableData } = await import('../utils/export');

      // Usar labels dinâmicos
      const getStatusLabel = (status: string) => getLabelFor(status);

      const getProjectLabel = (projectId: string) => {
        const proj = projects.find(p => p.id === projectId);
        return proj?.name || projectId || 'Sem Projeto';
      };

      const tableData = {
        headers: ['ID', 'Título', 'Projeto', 'Status', 'Criação'],
        rows: filteredAndSortedPlans.map(plan => [
          `PT-${String(plan.sequence ?? '001').padStart(3, '0')}`,
          plan.title,
          getProjectLabel(plan.project_id),
          getStatusLabel(plan.status),
          formatLocalDate(plan.created_at)
        ])
      };

      const success = await copyTableData(tableData, format, 'Planos de Teste');
      if (success) {
        toast({
          title: 'Copiado!',
          description: `Planos copiados para a área de transferência em formato ${format.toUpperCase()}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao copiar',
        description: error.message || `Erro ao copiar planos em formato ${format}`,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 space-y-5 p-6 animate-page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Planos de Teste</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gerencie seus planos de teste, escopos e estratégias de validação</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-3 rounded-lg border-brand/30 bg-brand/5 hover:bg-brand/10 text-brand font-semibold text-xs gap-1.5 shadow-2xs"
            title="Gerar Plano com IA"
            disabled={!currentProject || currentProject.status !== 'active'}
            onClick={() => setShowAIModal(true)}
          >
            <Sparkles className="h-3.5 w-3.5 text-brand" />
            <span className="hidden sm:inline">Gerar com IA</span>
          </Button>
          
          <Button
            size="sm"
            className="h-9 px-4 rounded-lg bg-brand hover:bg-brand/90 text-white font-semibold text-xs gap-1.5 shadow-xs transition-all active:scale-[0.98]"
            onClick={() => {
              setShowForm(true);
              setEditingPlan(null);
              const params = new URLSearchParams(searchParams);
              params.set('modal', 'plan:new');
              params.delete('id');
              setSearchParams(params);
            }}
            disabled={!currentProject || currentProject.status !== 'active'}
            title={!currentProject ? 'Selecione um projeto ativo para criar planos' : (currentProject.status !== 'active' ? 'Projeto não ativo — criação desabilitada' : undefined)}
          >
            <Plus className="h-4 w-4" />
            <span>Novo Plano de Teste</span>
          </Button>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => handleSearchTermChange(e.target.value)}
            placeholder="Buscar por número, título ou escopo..."
            className="pl-9 h-8.5 text-xs bg-card/60 border-border/70 rounded-lg focus:bg-background focus:border-brand/40 shadow-2xs transition-all"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-1 sm:pb-0">
          <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8.5 gap-1.5 px-3 rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 text-xs font-semibold shadow-2xs">
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>Ordenar</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs rounded-xl border-border/70 shadow-lg">
              <DropdownMenuItem onClick={() => { setSortBy('sequence'); setSortOrder('desc'); }}>ID (maior primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('sequence'); setSortOrder('asc'); }}>ID (menor primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('created_at'); setSortOrder('desc'); }}>Data (mais recente)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('created_at'); setSortOrder('asc'); }}>Data (mais antiga)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn(
                "h-8.5 gap-1.5 px-3 rounded-lg border text-xs font-semibold shadow-2xs transition-colors",
                filterStatus !== 'all'
                  ? 'border-brand/40 text-brand bg-brand/5 hover:bg-brand/10'
                  : 'border-border/70 bg-card/60 hover:bg-muted/60 text-foreground'
              )}>
                <ListFilter className="h-3.5 w-3.5 shrink-0" />
                <span>{filterStatus === 'all' ? 'Status: Todos' : getLabelFor(filterStatus)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs rounded-xl border-border/70 shadow-lg">
              <DropdownMenuItem onClick={() => setFilterStatus('all')}>Todos</DropdownMenuItem>
              <DropdownMenuSeparator />
              {options.map(opt => (
                <DropdownMenuItem key={opt.value} onClick={() => setFilterStatus(opt.value)}>{opt.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {plans.length > 0 && (
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
        {plans.length > 0 ? (
          viewMode === 'cards' ? (
            <div ref={listCardRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAndSortedPlans.length > 0 ? paginatedPlans.map((plan) => {
                const pct = planProgress(plan.id);
                const stats = planStats[plan.id];
                return (
                <Card
                  key={plan.id}
                  className="rounded-xl border border-border/70 bg-card/60 hover:border-brand/40 hover:shadow-md transition-all cursor-pointer flex flex-col p-4 space-y-3"
                  onClick={() => handleViewDetails(plan)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-mono font-bold bg-brand/10 text-brand px-2 py-0.5 rounded-md border border-brand/20 shrink-0">
                        {`PT-${String(plan.sequence ?? '').padStart(3, '0')}`}
                      </span>
                      <h3 className="text-xs font-bold text-foreground truncate leading-snug">
                        {plan.title}
                      </h3>
                    </div>
                    {Boolean(plan.generated_by_ai) && (
                      <span title="Gerado por IA"><Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" /></span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <StatusDot status={plan.status} label={getLabelFor(plan.status)} />
                    <ProjectDisplayField projectId={plan.project_id} />
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                    {plan.description || 'Sem descrição cadastrada.'}
                  </p>

                  {/* Progress bar */}
                  <div className="space-y-1 pt-1 border-t border-border/40">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-medium">Progresso</span>
                      <span className="font-semibold">{stats ? `${stats.execs}/${stats.cases} casos (${pct}%)` : '—'}</span>
                    </div>
                    <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: pct > 0 ? (currentProject?.color || 'hsl(var(--brand))') : undefined }}
                      />
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                      <Calendar className="h-3 w-3" />
                      {formatLocalDate(plan.created_at)}
                    </div>
                    <UserAvatar userId={plan.user_id} />
                  </div>
                </Card>
              );
              }) : (
                <div className="col-span-full text-center py-12 border border-dashed border-border/70 rounded-xl bg-card/30">
                  <p className="text-xs font-medium text-muted-foreground">Nenhum plano encontrado com os filtros selecionados.</p>
                </div>
              )}
            </div>
          ) : (
            // Lista em formato tabela executiva
            <div className="space-y-2">
              {filteredAndSortedPlans.length > 0 ? (
                <div ref={listCardRef} className="bg-card/40 border border-border/70 rounded-xl overflow-hidden shadow-2xs">
                  {/* Header da tabela */}
                  <div ref={listHeaderRef} className="grid grid-cols-[84px_4fr_2fr_1.8fr_2fr_88px_110px_72px] items-center gap-3 px-4 py-3 bg-muted/40 border-b border-border/70 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div>ID</div>
                    <div>Título & Contexto</div>
                    <div>Projeto</div>
                    <div>Status</div>
                    <div>Progresso</div>
                    <div className="text-center">Criado por</div>
                    <div>Criado em</div>
                    <div className="flex justify-end">Ações</div>
                  </div>

                  {/* Linhas da tabela */}
                  <div className="divide-y divide-border/40">
                    {paginatedPlans.map((plan) => {
                      const pct = planProgress(plan.id);
                      const stats = planStats[plan.id];
                      return (
                        <div
                          key={plan.id}
                          className="grid grid-cols-[84px_4fr_2fr_1.8fr_2fr_88px_110px_72px] items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => handleViewDetails(plan)}
                        >
                          {/* ID */}
                          <div>
                            <span className="text-[11px] font-mono font-bold bg-brand/10 text-brand px-2 py-0.5 rounded-md border border-brand/20 inline-block">
                              {`PT-${String(plan.sequence ?? '').padStart(3, '0')}`}
                            </span>
                          </div>

                          {/* Título + desc */}
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-xs font-bold text-foreground group-hover:text-brand transition-colors truncate leading-tight">
                                {plan.title}
                              </span>
                              {Boolean(plan.generated_by_ai) && (
                                <span title="Gerado por IA"><Sparkles className="h-3 w-3 text-amber-400 shrink-0" /></span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground truncate mt-0.5 leading-normal">
                              {plan.description || 'Sem descrição'}
                            </div>
                          </div>

                          {/* Projeto */}
                          <div>
                            <ProjectDisplayField projectId={plan.project_id} />
                          </div>

                          {/* Status */}
                          <div>
                            <StatusDot status={plan.status} label={getLabelFor(plan.status)} />
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1 pr-2">
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                              <span>{stats ? `${stats.execs}/${stats.cases}` : '—'}</span>
                              <span className="font-semibold">{stats ? `${pct}%` : ''}</span>
                            </div>
                            <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: pct > 0 ? (currentProject?.color || 'hsl(var(--brand))') : undefined }}
                              />
                            </div>
                          </div>

                          {/* Creator avatar */}
                          <div className="flex justify-center">
                            <UserAvatar userId={plan.user_id} />
                          </div>

                          {/* Data */}
                          <div className="text-xs text-muted-foreground font-medium">
                            {formatLocalDate(plan.created_at)}
                          </div>

                          {/* Ações */}
                          <div className="flex items-center gap-1 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7.5 w-7.5 p-0 rounded-md hover:bg-muted/60"
                              onClick={(e) => { e.stopPropagation(); handleEdit(plan); }}
                              disabled={!currentProject || currentProject.status !== 'active'}
                              title={!currentProject ? 'Selecione um projeto ativo para editar planos' : (currentProject.status !== 'active' ? 'Projeto não ativo — edição desabilitada' : undefined)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7.5 w-7.5 p-0 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); handleRequestDelete(plan); }}
                              disabled={!currentProject || isProjectInactive}
                              title={!currentProject ? 'Selecione um projeto ativo para excluir planos' : (isProjectInactive ? 'Projeto não ativo — exclusão desabilitada' : undefined)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-border/70 rounded-xl bg-card/30">
                  <p className="text-xs font-medium text-muted-foreground">Nenhum resultado encontrado com os filtros atuais.</p>
                </div>
              )}
            </div>
          )
        ) : (
          <div className="text-center py-16 px-6 border-2 border-dashed border-border/70 rounded-2xl bg-card/30 max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-xl bg-muted/40 flex items-center justify-center mx-auto text-muted-foreground">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Nenhum plano de teste cadastrado</h3>
              <p className="text-xs text-muted-foreground mt-1">Comece criando seu primeiro plano para estruturar sua suíte de testes.</p>
            </div>
            <Button 
              className="h-9 px-5 rounded-lg bg-brand hover:bg-brand/90 text-white font-semibold text-xs gap-1.5 shadow-xs"
              onClick={() => {
                setShowForm(true);
                const params = new URLSearchParams(searchParams);
                params.set('modal', 'plan:new');
                params.delete('id');
                setSearchParams(params);
              }}
              disabled={!currentProject || currentProject.status !== 'active'}
              title={!currentProject ? 'Selecione um projeto ativo para criar planos' : (currentProject.status !== 'active' ? 'Projeto não ativo — criação desabilitada' : undefined)}
            >
              <Plus className="h-4 w-4" />
              <span>Criar Primeiro Plano</span>
            </Button>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      {plans.length > 0 && (
        <div ref={paginationRef} className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/40">
          <div className="text-xs font-medium text-muted-foreground">
            {(() => {
              const start = (currentPage - 1) * pageSize + 1;
              const end = Math.min(currentPage * pageSize, totalItems);
              return `Mostrando ${start}–${end} de ${totalItems} plano(s)`;
            })()}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Itens por página:</label>
              <select
                className="h-8 text-xs rounded-lg border border-border/70 bg-card/60 px-2 font-semibold focus:outline-none"
                value={pageSize}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10) || 9;
                  setPageSize(next);
                  setPage(1);
                }}
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

      {/* Modal do Formulário */}
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        const params = new URLSearchParams(searchParams);
        if (open) {
          if (editingPlan) {
            params.set('modal', 'plan:edit');
            params.set('id', editingPlan.id);
          } else {
            params.set('modal', 'plan:new');
            params.delete('id');
          }
        } else {
          params.delete('modal');
          params.delete('id');
          setEditingPlan(null);
        }
        setSearchParams(params);
      }}>
        <DialogContent className={cn(editingPlan ? "max-w-2xl" : "max-w-4xl", "max-h-[90vh] overflow-hidden flex flex-col rounded-xl bg-card border border-border/80 p-0 shadow-xl scrollbar-auto-hide")}>
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b border-border/40">
            <DialogTitle className="text-base font-bold text-foreground">
              {editingPlan ? 'Editar Plano de Teste' : 'Novo Plano de Teste'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingPlan ? 'Ajuste as informações do plano selecionado.' : 'Defina os dados do plano e adicione casos de teste vinculados se desejar.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto scrollbar-auto-hide px-6 py-4">
            {editingPlan ? (
              <TestPlanForm
                initialData={editingPlan}
                onSuccess={(p) => handlePlanCreated(p)}
                onCancel={() => { setShowForm(false); setEditingPlan(null); }}
              />
            ) : (
              <UnifiedTestCreation
                onSuccess={() => { loadPlans(); setShowForm(false); }}
                onCancel={() => setShowForm(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedPlan(null);
          // Limpar parâmetros ao fechar
          const params = new URLSearchParams(searchParams);
          if (params.has('id')) params.delete('id');
          if (params.get('modal') === 'plan:view') params.delete('modal');
          setSearchParams(params);
        }}
        item={selectedPlan}
        type="plan"
        onEdit={handleEdit}
        onDelete={(id) => {
          const plan = plans.find(p => p.id === id);
          if (plan) handleRequestDelete(plan);
        }}
      />

      {/* Modal IA para gerar plano */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="max-w-3xl overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Gerar Plano de Teste com IA
            </DialogTitle>
            <DialogDescription className="sr-only">Gerar plano de teste com inteligência artificial</DialogDescription>
          </DialogHeader>
          <AIGeneratorForm initialType="plan" hideTypeSelector={true} onSuccess={() => { setShowAIModal(false); loadPlans(); }} />
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Modal */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={(open) => {
        setConfirmDeleteOpen(open);
        if (!open) {
          setPlanToDelete(null);
          setLinkedCounts(null);
          setLinkedDetails(null);
        }
      }}>
        <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-auto-hide">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano de teste?</AlertDialogTitle>
          </AlertDialogHeader>

          {/* Conteúdo em div ao invés de AlertDialogDescription para evitar nesting inválido */}
          <div className="text-sm text-muted-foreground space-y-3 min-w-0">
            {linkedCounts == null && <span>Verificando dependências...</span>}

            {linkedCounts && (linkedCounts.testCaseCount > 0 || linkedCounts.executionCount > 0 || (linkedCounts.defectCount || 0) > 0) && (
              <div className="space-y-3">
                <div className="text-sm font-medium text-amber-600">
                  ⚠️ Este plano possui vínculos que impedem a exclusão:
                </div>

                {/* Resumo das contagens */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {linkedCounts.testCaseCount > 0 && (
                    <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                      {linkedCounts.testCaseCount} caso(s)
                    </Badge>
                  )}
                  {linkedCounts.executionCount > 0 && (
                    <Badge variant="secondary" className="bg-green-50 text-green-700">
                      {linkedCounts.executionCount} execução(ões)
                    </Badge>
                  )}
                  {(linkedCounts.defectCount || 0) > 0 && (
                    <Badge variant="secondary" className="bg-red-50 text-red-700">
                      {linkedCounts.defectCount} defeito(s)
                    </Badge>
                  )}
                </div>

                {/* Lista de Casos de Teste */}
                {linkedDetails && linkedDetails.testCases.length > 0 && (
                  <div className="border rounded p-2 bg-muted/30 w-full overflow-hidden">
                    <div className="text-xs font-medium mb-1 text-blue-700">Casos de Teste:</div>
                    <div className="text-xs space-y-0.5 max-h-20 overflow-y-auto">
                      {linkedDetails.testCases.map(tc => (
                        <div key={tc.id} className="truncate">
                          • CT-{String(tc.sequence || 0).padStart(3, '0')}: {tc.title}
                        </div>
                      ))}
                      {linkedCounts.testCaseCount > linkedDetails.testCases.length && (
                        <div className="text-muted-foreground italic">
                          ... e mais {linkedCounts.testCaseCount - linkedDetails.testCases.length} caso(s)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lista de Execuções */}
                {linkedDetails && linkedDetails.executions.length > 0 && (
                  <div className="border rounded p-2 bg-muted/30 w-full overflow-hidden">
                    <div className="text-xs font-medium mb-1 text-green-700">Execuções:</div>
                    <div className="text-xs space-y-0.5 max-h-20 overflow-y-auto">
                      {linkedDetails.executions.map(ex => (
                        <div key={ex.id} className="truncate">
                          • EXE-{String(ex.sequence || 0).padStart(3, '0')}: {ex.status}
                        </div>
                      ))}
                      {linkedCounts.executionCount > linkedDetails.executions.length && (
                        <div className="text-muted-foreground italic">
                          ... e mais {linkedCounts.executionCount - linkedDetails.executions.length} execução(ões)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Lista de Defeitos */}
                {linkedDetails && linkedDetails.defects.length > 0 && (
                  <div className="border rounded p-2 bg-muted/30 w-full overflow-hidden">
                    <div className="text-xs font-medium mb-1 text-red-700">Defeitos:</div>
                    <div className="text-xs space-y-0.5 max-h-20 overflow-y-auto">
                      {linkedDetails.defects.map(d => (
                        <div key={d.id} className="truncate">
                          • {d.title} ({d.status}{d.severity ? `, ${d.severity}` : ''})
                        </div>
                      ))}
                      {(linkedCounts.defectCount || 0) > linkedDetails.defects.length && (
                        <div className="text-muted-foreground italic">
                          ... e mais {(linkedCounts.defectCount || 0) - linkedDetails.defects.length} defeito(s)
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground border-t pt-2">
                  Remova todos os vínculos acima antes de excluir o plano para manter a integridade dos dados.
                </div>
              </div>
            )}

            {linkedCounts && linkedCounts.testCaseCount === 0 && linkedCounts.executionCount === 0 && (linkedCounts.defectCount || 0) === 0 && (
              <div>Esta ação não pode ser desfeita. O plano será removido permanentemente. O código {planToDelete?.sequence ? `PT-${String(planToDelete.sequence).padStart(3, '0')}` : 'deste plano'} poderá ser reutilizado.</div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {linkedCounts && linkedCounts.testCaseCount === 0 && linkedCounts.executionCount === 0 && (linkedCounts.defectCount || 0) === 0 && planToDelete && (
              <AlertDialogAction
                onClick={() => handleDelete(planToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
