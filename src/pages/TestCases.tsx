import { useState, useEffect, useMemo, useRef } from 'react';
import { usePaginationUrlSync } from '@/hooks/usePaginationUrlSync';
import { useVirtualTableHeight } from '@/hooks/useVirtualTableHeight';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  Plus, Edit, Trash2, Search, ArrowUpDown, ListFilter, Download, 
  FileText, Calendar, Sparkles, FileSpreadsheet, FileCode2, Copy, 
  FileCheck2, Table, AlertTriangle, PlayCircle, Eye, Bug, ShieldAlert, 
  Layers, FlaskConical 
} from 'lucide-react';
import { PriorityTag } from '@/components/ui/PriorityTag';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/hooks/useAuth';
import { getTestCases, getTestCasesByProject, deleteTestCase, getTestPlans, getCaseLinkedCounts } from '@/services/apiClientService';
import { TestCase } from '@/types';
import { TestCaseForm } from '@/components/forms/TestCaseForm';
import { DetailModal } from '@/components/DetailModal';
import { StandardButton } from '@/components/StandardButton';
import { AIGeneratorForm } from '@/components/forms/AIGeneratorForm';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { cn, formatLocalDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { priorityBadgeClass, priorityLabel, testCaseTypeBadgeClass, testCaseTypeLabel } from '@/lib/labels';
import { useProject } from '@/contexts/ProjectContext';
import { ProjectDisplayField } from '@/components/ProjectDisplayField';
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

export const TestCases = () => {
  const { initFromSearchParams, writeFromState } = usePaginationUrlSync();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Refs para altura virtual
  const containerRef = useRef<HTMLDivElement | null>(null);
  const listHeaderRef = useRef<HTMLDivElement | null>(null);
  const listCardRef = useRef<HTMLDivElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);
  const [rowSize, setRowSize] = useState<number>(72);
  const { toast } = useToast();
  const { currentProject, projects } = useProject();
  const isProjectInactive = !!currentProject && currentProject.status !== 'active';
  
  // Estados principais
  const [cases, setCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  
  // UI Estados
  const [viewMode, setViewMode] = useState<'cards' | 'list'>(() => {
    const savedMode = localStorage.getItem('testCases_viewMode');
    return (savedMode as 'cards' | 'list') || 'list';
  });
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'sequence' | 'created_at'>('sequence');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [planProjectMap, setPlanProjectMap] = useState<Record<string, string>>({});
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);
  const [caseLinkedCounts, setCaseLinkedCounts] = useState<{ executionCount: number; defectCount: number } | null>(null);

  // Carregar casos com base no filtro de projeto
  const loadCases = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      let data: TestCase[] = [];

      if (currentProject?.id) {
        data = await getTestCasesByProject(user.id, currentProject.id);
        const plans = await getTestPlans(user.id, currentProject.id);
        const map: Record<string, string> = {};
        plans.forEach((p) => { map[p.id] = p.project_id; });
        setPlanProjectMap(map);
      } else {
        // Agregar APENAS projetos ATIVOS ao usar "Todos"
        const active = (projects || []).filter(p => p.status === 'active');
        if (active.length > 0) {
          const [casesLists, plansLists] = await Promise.all([
            Promise.all(active.map(p => getTestCasesByProject(user.id, p.id))),
            Promise.all(active.map(p => getTestPlans(user.id, p.id)))
          ]);
          data = casesLists.flat();
          const plans = plansLists.flat();
          const map: Record<string, string> = {};
          plans.forEach((p) => { map[p.id] = p.project_id; });
          setPlanProjectMap(map);
        } else {
          data = [];
          setPlanProjectMap({});
        }
      }

      setCases(data);
    } catch (error) {
      console.error('Erro ao carregar casos:', error);
      toast({ 
        title: 'Erro', 
        description: 'Falha ao carregar casos de teste.', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Efeito para carregar casos quando projeto muda
  useEffect(() => {
    loadCases();
  }, [user, currentProject?.id, projects]);

  // Salvar modo de visualização
  useEffect(() => {
    localStorage.setItem('testCases_viewMode', viewMode);
  }, [viewMode]);

  // Listener para broadcast de troca de projeto ou alteração nos casos
  useEffect(() => {
    const handler = () => loadCases();
    window.addEventListener('krg:project-changed', handler as EventListener);
    window.addEventListener('nexus:cases-changed', handler as EventListener);
    return () => {
      window.removeEventListener('krg:project-changed', handler as EventListener);
      window.removeEventListener('nexus:cases-changed', handler as EventListener);
    };
  }, []);

  // Sincronizar modal de detalhes com a URL (?id=...&modal=case:view)
  useEffect(() => {
    const id = searchParams.get('id');
    const modal = searchParams.get('modal');
    if (id && (modal === 'case:view' || !modal)) {
      const found = cases.find(c => c.id === id);
      if (found) {
        setSelectedCase(found);
        setShowDetailModal(true);
      }
    }
  }, [cases, searchParams]);

  // Métricas rápidas estilo líderes de mercado
  const stats = useMemo(() => {
    const total = cases.length;
    const critical = cases.filter(c => c.priority === 'critical').length;
    const high = cases.filter(c => c.priority === 'high').length;
    const medium = cases.filter(c => c.priority === 'medium').length;
    const low = cases.filter(c => c.priority === 'low').length;
    return { total, critical, high, medium, low };
  }, [cases]);

  // Casos filtrados e ordenados
  const filteredCases = useMemo(() => {
    const filtered = cases.filter(testCase => {
      const seqStr = `ct-${String(testCase.sequence ?? '').padStart(3, '0')}`;
      const matchesSearch = searchTerm === '' || 
        testCase.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        testCase.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        testCase.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        seqStr.includes(searchTerm.toLowerCase());
      
      const matchesPriority = filterStatus === 'all' || testCase.priority === filterStatus;
      const matchesType = filterType === 'all' || testCase.type === filterType;
      
      return matchesSearch && matchesPriority && matchesType;
    });

    // Ordenação
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'sequence':
          comparison = (a.sequence || 0) - (b.sequence || 0);
          break;
        case 'created_at':
        default:
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [cases, searchTerm, filterStatus, filterType, sortBy, sortOrder]);

  // Paginação
  const totalItems = filteredCases.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, currentPage, pageSize]);

  // Reset página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterType, sortBy, sortOrder]);

  // Handlers para filtros
  const handleSearchTermChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Handlers de dados
  const handleCaseCreated = (testCase: TestCase) => {
    setCases(prev => [testCase, ...prev]);
    setShowForm(false);
    setEditingCase(null);
    toast({ title: 'Sucesso', description: 'Caso de teste criado com sucesso!' });
  };

  const handleCaseUpdated = (updated: TestCase) => {
    setCases(prev => prev.map(c => c.id === updated.id ? updated : c));
    setShowForm(false);
    setEditingCase(null);
    toast({ title: 'Sucesso', description: 'Caso de teste atualizado com sucesso!' });
  };

  const handleEdit = (testCase: TestCase) => {
    setEditingCase(testCase);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingCaseId(id);
    setConfirmDeleteOpen(true);
    setCaseLinkedCounts(null);
    try {
      if (user) {
        const counts = await getCaseLinkedCounts(user.id, id);
        setCaseLinkedCounts(counts);
      }
    } catch (error) {
      console.error('Erro ao verificar vínculos do caso:', error);
      setCaseLinkedCounts({ executionCount: 0, defectCount: 0 });
    }
  };

  const performDeleteCase = async () => {
    if (!deletingCaseId) return;
    if (isProjectInactive) {
      toast({ title: 'Projeto não ativo', description: 'Exclusão desabilitada.', variant: 'destructive' });
      setConfirmDeleteOpen(false);
      setDeletingCaseId(null);
      setCaseLinkedCounts(null);
      return;
    }
    try {
      if (caseLinkedCounts && (caseLinkedCounts.executionCount > 0 || caseLinkedCounts.defectCount > 0)) {
        toast({
          title: 'Exclusão bloqueada',
          description: 'Este caso possui execuções e/ou defeitos vinculados. Remova as dependências antes de excluir.',
          variant: 'destructive'
        });
        setConfirmDeleteOpen(false);
        setDeletingCaseId(null);
        return;
      }
      await deleteTestCase(deletingCaseId);
      setCases(prev => prev.filter(c => c.id !== deletingCaseId));
      toast({ title: 'Sucesso', description: 'Caso de teste excluído com sucesso!' });
      if (selectedCase?.id === deletingCaseId) {
        setSelectedCase(null);
        setShowDetailModal(false);
        setSearchParams(prev => {
          const np = new URLSearchParams(prev);
          np.delete('id');
          np.delete('modal');
          return np;
        });
      }
    } catch (error) {
      toast({ 
        title: 'Erro', 
        description: 'Erro ao excluir caso de teste', 
        variant: 'destructive' 
      });
    } finally {
      setConfirmDeleteOpen(false);
      setDeletingCaseId(null);
      setCaseLinkedCounts(null);
    }
  };

  const handleViewDetails = (testCase: TestCase) => {
    setSelectedCase(testCase);
    setShowDetailModal(true);
    setSearchParams(prev => {
      const np = new URLSearchParams(prev);
      np.set('id', testCase.id);
      np.set('modal', 'case:view');
      return np;
    });
  };

  // Exportação com os ícones e utilitários do sistema
  const handleExport = async (format: 'csv' | 'excel' | 'json' | 'pdf') => {
    try {
      if (filteredCases.length === 0) {
        toast({ title: 'Nada para exportar', description: 'A lista filtrada está vazia.', variant: 'destructive' });
        return;
      }
      
      const getProjectLabel = (planId: string) => {
        const projectId = planProjectMap[planId];
        const proj = projects.find(p => p.id === projectId);
        return proj?.name || projectId || 'Sem Projeto';
      };

      const tableData = filteredCases.map(tc => ({
        ID: `CT-${String(tc.sequence ?? '001').padStart(3, '0')}`,
        Título: tc.title,
        Projeto: getProjectLabel(tc.plan_id),
        Prioridade: priorityLabel(tc.priority),
        Tipo: testCaseTypeLabel(tc.type),
        Criação: tc.created_at ? formatLocalDate(tc.created_at) : 'N/A'
      }));

      const { exportTableData } = await import('../utils/export');
      await exportTableData(tableData, format, `casos_teste_${new Date().toISOString().split('T')[0]}`);

      toast({
        title: 'Exportação realizada',
        description: `Casos exportados em formato ${format.toUpperCase()}`,
      });
    } catch (error: any) {
      console.error('Erro na exportação:', error);
      toast({
        title: 'Erro na exportação',
        description: error.message || `Erro ao exportar casos em formato ${format}`,
        variant: 'destructive',
      });
    }
  };

  const handleCopy = async (format: 'txt' | 'md') => {
    try {
      if (filteredCases.length === 0) {
        toast({ title: 'Nada para copiar', description: 'A lista filtrada está vazia.', variant: 'destructive' });
        return;
      }
      const { copyTableData } = await import('../utils/export');

      const getProjectLabel = (planId: string) => {
        const projectId = planProjectMap[planId];
        const proj = projects.find(p => p.id === projectId);
        return proj?.name || projectId || 'Sem Projeto';
      };

      const tableData = {
        headers: ['ID', 'Título', 'Projeto', 'Prioridade', 'Tipo', 'Criação'],
        rows: filteredCases.map(tc => [
          `CT-${String(tc.sequence ?? '001').padStart(3, '0')}`,
          tc.title,
          getProjectLabel(tc.plan_id),
          priorityLabel(tc.priority),
          testCaseTypeLabel(tc.type),
          tc.created_at ? formatLocalDate(tc.created_at) : 'N/A'
        ])
      };

      const success = await copyTableData(tableData, format, 'Casos de Teste');
      if (success) {
        toast({
          title: 'Copiado!',
          description: `Casos copiados para a área de transferência em formato ${format.toUpperCase()}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao copiar',
        description: error.message || `Erro ao copiar casos em formato ${format}`,
        variant: 'destructive',
      });
    }
  };

  const caseToDelete = cases.find(c => c.id === deletingCaseId);

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
          <h1 className="text-xl font-bold tracking-tight text-foreground">Casos de Teste</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie, estruture e rastreie os cenários de validação e critérios de aceitação do sistema
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
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
            title={!currentProject ? 'Selecione um projeto ativo para criar casos' : (currentProject.status !== 'active' ? 'Projeto não ativo — criação desabilitada' : undefined)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Novo Caso de Teste
          </StandardButton>
        </div>
      </div>

      {/* Market Leader KPI Bar */}
      {cases.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-xl border border-border/70 bg-card/60 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total de Casos</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-foreground">{stats.total}</span>
              <FlaskConical className="h-4 w-4 text-muted-foreground/60" />
            </div>
          </div>
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-rose-500 uppercase tracking-wider">Críticos</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-rose-500">{stats.critical}</span>
              <span className="text-[11px] font-medium text-rose-500/70">{stats.total > 0 ? Math.round((stats.critical / stats.total) * 100) : 0}%</span>
            </div>
          </div>
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-orange-500 uppercase tracking-wider">Alta Prioridade</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-orange-500">{stats.high}</span>
              <span className="text-[11px] font-medium text-orange-500/70">{stats.total > 0 ? Math.round((stats.high / stats.total) * 100) : 0}%</span>
            </div>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">Média</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-amber-500">{stats.medium}</span>
              <span className="text-[11px] font-medium text-amber-500/70">{stats.total > 0 ? Math.round((stats.medium / stats.total) * 100) : 0}%</span>
            </div>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col justify-between shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">Baixa</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-bold text-emerald-500">{stats.low}</span>
              <span className="text-[11px] font-medium text-emerald-500/70">{stats.total > 0 ? Math.round((stats.low / stats.total) * 100) : 0}%</span>
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
            placeholder="Buscar por código (CT-001), título ou descrição..."
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
              <DropdownMenuItem onClick={() => { setSortBy('sequence'); setSortOrder('desc'); }}>ID (maior primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('sequence'); setSortOrder('asc'); }}>ID (menor primeiro)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('created_at'); setSortOrder('desc'); }}>Data (mais recente)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setSortBy('created_at'); setSortOrder('asc'); }}>Data (mais antiga)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Priority Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn(
                "h-8.5 gap-1.5 px-3 rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 text-xs font-semibold shadow-2xs",
                filterStatus !== 'all' && "border-brand/40 text-brand bg-brand/5"
              )}>
                <ListFilter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{filterStatus === 'all' ? 'Prioridade: Todas' : `Prioridade: ${priorityLabel(filterStatus as any)}`}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs rounded-xl border-border/70 shadow-lg">
              <DropdownMenuItem onClick={() => setFilterStatus('all')}>Todas as Prioridades</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterStatus('critical')}>Crítica</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('high')}>Alta</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('medium')}>Média</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus('low')}>Baixa</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={cn(
                "h-8.5 gap-1.5 px-3 rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 text-xs font-semibold shadow-2xs",
                filterType !== 'all' && "border-brand/40 text-brand bg-brand/5"
              )}>
                <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span>{filterType === 'all' ? 'Tipo: Todos' : `Tipo: ${testCaseTypeLabel(filterType as any)}`}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs rounded-xl border-border/70 shadow-lg">
              <DropdownMenuItem onClick={() => setFilterType('all')}>Todos os Tipos</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilterType('functional')}>Funcional</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('integration')}>Integração</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('performance')}>Desempenho</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('security')}>Segurança</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterType('usability')}>Usabilidade</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export Menu with System Lucide Icons */}
          {cases.length > 0 && (
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
        {cases.length > 0 ? (
          viewMode === 'cards' ? (
            <div ref={listCardRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCases.length > 0 ? paginatedCases.map((testCase) => (
                <Card
                  key={testCase.id}
                  className="rounded-xl border border-border/70 bg-card/60 hover:border-brand/40 hover:shadow-md transition-all cursor-pointer flex flex-col p-4 space-y-3"
                  onClick={() => handleViewDetails(testCase)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono font-bold text-brand bg-brand/10 border border-brand/20 px-2 py-0.5 rounded-md flex-shrink-0">
                        {`CT-${testCase.sequence ? String(testCase.sequence).padStart(3, '0') : (testCase.id?.slice(0, 4) || '----')}`}
                      </span>
                      <span className="text-sm font-semibold text-foreground truncate group-hover:text-brand transition-colors">
                        {testCase.title}
                      </span>
                    </div>
                    {Boolean(testCase.generated_by_ai) && (
                      <span title="Gerado com Inteligência Artificial" className="shrink-0">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <PriorityTag priority={testCase.priority} />
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md", testCaseTypeBadgeClass(testCase.type))}>
                      {testCaseTypeLabel(testCase.type)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {testCase.description || 'Sem descrição cadastrada'}
                  </p>

                  <div className="mt-auto pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                      <span>{testCase.created_at ? formatLocalDate(testCase.created_at) : 'N/A'}</span>
                    </div>
                    <UserAvatar userId={testCase.user_id} />
                  </div>
                </Card>
              )) : (
                <div className="col-span-full text-center py-12 rounded-xl border border-border/60 bg-card/30">
                  <p className="text-xs text-muted-foreground">Nenhum caso encontrado com os filtros selecionados.</p>
                </div>
              )}
            </div>
          ) : (
            // Lista em formato Tabela Executiva
            <div className="rounded-xl border border-border/60 bg-card/40 overflow-hidden shadow-xs">
              {/* Header da Tabela */}
              <div className="grid grid-cols-[85px_3.5fr_2fr_1.5fr_1.5fr_90px_100px_90px] items-center gap-3 px-4 py-2.5 bg-muted/40 border-b border-border/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div>ID</div>
                <div>Título & Contexto</div>
                <div>Projeto</div>
                <div>Prioridade</div>
                <div>Tipo</div>
                <div className="text-center">Autor</div>
                <div>Criado em</div>
                <div className="text-right">Ações</div>
              </div>

              {/* Linhas da Tabela */}
              <div className="divide-y divide-border/40">
                {filteredCases.length > 0 ? paginatedCases.map((testCase) => (
                  <div
                    key={testCase.id}
                    className="grid grid-cols-[85px_3.5fr_2fr_1.5fr_1.5fr_90px_100px_90px] items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => handleViewDetails(testCase)}
                  >
                    {/* ID */}
                    <div>
                      <span className="text-xs font-mono font-bold bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-md">
                        {`CT-${testCase.sequence ? String(testCase.sequence).padStart(3, '0') : (testCase.id?.slice(0, 4) || '----')}`}
                      </span>
                    </div>

                    {/* Título & Descrição */}
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold text-foreground group-hover:text-brand transition-colors truncate">
                          {testCase.title}
                        </span>
                        {Boolean(testCase.generated_by_ai) && (
                          <Sparkles className="h-3 w-3 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {testCase.description || 'Sem descrição'}
                      </div>
                    </div>

                    {/* Projeto */}
                    <div className="min-w-0 truncate text-xs">
                      <ProjectDisplayField projectId={planProjectMap[testCase.plan_id] || ''} />
                    </div>

                    {/* Prioridade */}
                    <div>
                      <PriorityTag priority={testCase.priority} />
                    </div>

                    {/* Tipo */}
                    <div>
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md", testCaseTypeBadgeClass(testCase.type))}>
                        {testCaseTypeLabel(testCase.type)}
                      </span>
                    </div>

                    {/* Autor */}
                    <div className="flex justify-center">
                      <UserAvatar userId={testCase.user_id} />
                    </div>

                    {/* Data */}
                    <div className="text-xs text-muted-foreground">
                      {testCase.created_at ? formatLocalDate(testCase.created_at) : 'N/A'}
                    </div>

                    {/* Ações */}
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/executions?modal=exec:new&caseId=${testCase.id}`)}
                        title="Executar este caso de teste"
                        className="h-7 w-7 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-md"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(testCase)}
                        disabled={!currentProject || currentProject.status !== 'active'}
                        title="Editar caso de teste"
                        className="h-7 w-7 text-muted-foreground hover:text-brand hover:bg-brand/10 rounded-md"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(testCase.id)}
                        disabled={!currentProject || isProjectInactive}
                        title="Excluir caso de teste"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12">
                    <p className="text-xs text-muted-foreground">Nenhum caso de teste encontrado para os filtros atuais.</p>
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          /* Empty State */
          <div className="text-center py-16 rounded-xl border border-dashed border-border/80 bg-card/30">
            <FlaskConical className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">Nenhum caso de teste cadastrado</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
              Crie seu primeiro caso de teste manualmente ou utilize a inteligência artificial para gerar cenários automaticamente.
            </p>
            <StandardButton
              variant="brand"
              size="sm"
              onClick={() => setShowForm(true)}
              disabled={!currentProject || currentProject.status !== 'active'}
              className="h-8.5 rounded-lg text-xs font-semibold shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Criar Primeiro Caso
            </StandardButton>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="text-xs text-muted-foreground font-medium">
            Mostrando {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalItems)} de {totalItems} caso(s)
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Itens por página:</span>
              <select 
                value={pageSize} 
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-8 px-2 text-xs border border-border/70 rounded-lg bg-card/60 text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value={9}>9</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 text-xs font-semibold rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 px-3"
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="h-8 text-xs font-semibold rounded-lg border-border/70 bg-card/60 hover:bg-muted/60 px-3"
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação/Edição */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto scrollbar-auto-hide rounded-xl bg-card border border-border/80 shadow-xl p-6">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="text-base font-bold text-foreground">
              {editingCase ? 'Editar Caso de Teste' : 'Novo Caso de Teste'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Preencha os campos para {editingCase ? 'atualizar' : 'criar'} um cenário de validação.
            </DialogDescription>
          </DialogHeader>
          <TestCaseForm 
            initialData={editingCase}
            onSuccess={editingCase ? handleCaseUpdated : handleCaseCreated}
            onCancel={() => {
              setShowForm(false);
              setEditingCase(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      <DetailModal
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedCase(null);
          setSearchParams(prev => {
            const np = new URLSearchParams(prev);
            np.delete('id');
            np.delete('modal');
            return np;
          });
        }}
        item={selectedCase}
        type="case"
        onEdit={handleEdit}
        onDelete={(id) => handleDelete(id)}
      />

      {/* Confirm Delete Modal */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={(open) => {
        setConfirmDeleteOpen(open);
        if (!open) {
          setDeletingCaseId(null);
          setCaseLinkedCounts(null);
        }
      }}>
        <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scrollbar-auto-hide rounded-xl bg-card border border-border/80 p-6 shadow-xl space-y-4">
          <AlertDialogHeader className="pb-3 border-b border-border/40 text-left">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <AlertDialogTitle className="text-base font-bold text-foreground tracking-tight">
                  Excluir Caso de Teste?
                </AlertDialogTitle>
                {caseToDelete && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    CT-{String(caseToDelete.sequence || 0).padStart(3, '0')} • {caseToDelete.title}
                  </p>
                )}
              </div>
            </div>
          </AlertDialogHeader>

          <div className="text-xs text-muted-foreground space-y-3">
            {caseLinkedCounts == null && <span>Verificando dependências no banco de dados...</span>}

            {caseLinkedCounts && (caseLinkedCounts.executionCount > 0 || caseLinkedCounts.defectCount > 0) && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Este caso possui vínculos que impedem a exclusão:</span>
                </div>

                <div className="flex flex-wrap gap-2 pt-0.5">
                  {caseLinkedCounts.executionCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>{caseLinkedCounts.executionCount} execução(ões)</span>
                    </div>
                  )}
                  {caseLinkedCounts.defectCount > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                      <Bug className="h-3.5 w-3.5" />
                      <span>{caseLinkedCounts.defectCount} defeito(s)</span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Remova ou desvincule as execuções e defeitos antes de excluir este caso para manter a integridade dos relatórios e métricas de qualidade.
                </p>
              </div>
            )}

            {caseLinkedCounts && caseLinkedCounts.executionCount === 0 && caseLinkedCounts.defectCount === 0 && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3.5 text-xs text-muted-foreground leading-relaxed">
                Esta ação é irreversível. O caso de teste será permanentemente excluído do projeto e seu identificador {caseToDelete?.sequence ? `CT-${String(caseToDelete.sequence).padStart(3, '0')}` : ''} ficará liberado.
              </div>
            )}
          </div>

          <AlertDialogFooter className="pt-3 border-t border-border/40 flex items-center justify-end gap-2">
            <AlertDialogCancel className="text-xs h-8.5 px-4 rounded-md border-border/70 font-medium hover:bg-muted/60 m-0">
              Cancelar
            </AlertDialogCancel>
            {caseLinkedCounts && caseLinkedCounts.executionCount === 0 && caseLinkedCounts.defectCount === 0 && (
              <AlertDialogAction 
                onClick={performDeleteCase} 
                className="text-xs h-8.5 px-4 rounded-md bg-destructive hover:bg-destructive/90 text-white font-semibold shadow-xs"
              >
                Confirmar Exclusão
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal IA para gerar caso */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="max-w-3xl overflow-x-hidden rounded-xl bg-card border border-border/80 shadow-xl p-6">
          <DialogHeader className="pb-3 border-b border-border/40">
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Sparkles className="h-5 w-5 text-amber-400" />
              Gerar Caso de Teste com IA
            </DialogTitle>
            <DialogDescription className="sr-only">Gerar caso de teste com inteligência artificial</DialogDescription>
          </DialogHeader>
          <AIGeneratorForm initialType="case" hideTypeSelector={true} onSuccess={() => { setShowAIModal(false); loadCases(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
