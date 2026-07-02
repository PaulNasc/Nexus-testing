import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  FileText, TestTube, PlayCircle, Bug, Plus, Sparkles,
  ClipboardCheck, Link2, BarChart3, Download, Loader2,
  TrendingUp, CheckCircle, XCircle, MinusCircle, Clock,
  ChevronRight, Rocket, FolderPlus
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  getTestPlans, getTestCases, getTestExecutions, getDefects, getRequirements,
  getTestCasesByProject, getTestExecutionsByProject, getDefectsByProject, getRequirementsByProject,
  getPlanLinkedCounts, getDashboardStats,
} from '@/services/apiClientService';
import { TestPlan, TestCase, TestExecution, Defect, Requirement } from '@/types';
import { useDashboardSettings } from '@/hooks/useDashboardSettings';
import { TestPlanForm } from '@/components/forms/TestPlanForm';
import { TestCaseForm } from '@/components/forms/TestCaseForm';
import { TestExecutionForm } from '@/components/forms/TestExecutionForm';
import { DetailModal } from '@/components/DetailModal';
import { StandardButton } from '@/components/StandardButton';
import { UnifiedTestCreation } from '@/components/UnifiedTestCreation';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createProject, generateSlug, checkSlugExists } from '@/services/projectService';
import { toast } from '@/components/ui/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecentItem {
  id: string;
  type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect';
  title: string;
  updated_at: Date;
  generated_by_ai?: boolean;
  data: TestPlan | TestCase | TestExecution | Requirement | Defect;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

const relativeTime = (date: Date) => {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 172800) return 'ontem';
  if (diff < 604800) return `${Math.floor(diff / 86400)} dias atrás`;
  return date.toLocaleDateString('pt-BR');
};

const TYPE_ICON_MAP: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  plan:        { icon: FileText,      color: 'text-brand',       bg: 'bg-brand/15' },
  case:        { icon: TestTube,      color: 'text-info',        bg: 'bg-info/15' },
  execution:   { icon: PlayCircle,    color: 'text-success',     bg: 'bg-success/15' },
  requirement: { icon: Link2,         color: 'text-purple-400',  bg: 'bg-purple-500/15' },
  defect:      { icon: Bug,           color: 'text-destructive', bg: 'bg-destructive/15' },
};

const TYPE_LABEL: Record<string, string> = {
  plan: 'Plano', case: 'Caso', execution: 'Execução', requirement: 'Requisito', defect: 'Defeito',
};

const BarRow = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const w = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-muted-foreground truncate shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
      </div>
      <div className="text-xs font-medium w-8 text-right shrink-0">{value}</div>
    </div>
  );
};

const StatCard = ({
  label, value, sub, icon: Icon, iconBg, iconColor, onClick,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconBg: string; iconColor: string;
  onClick?: () => void;
}) => (
  <div
    className={`border border-border rounded-lg p-4 bg-card flex items-start gap-3 ${onClick ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
    onClick={onClick}
  >
    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
      <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const Dashboard = () => {
  const SINGLE_TENANT = String((import.meta as any).env?.VITE_SINGLE_TENANT ?? 'true') === 'true';
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { settings } = useDashboardSettings();
  const { currentProject, projects, setCurrentProject, refreshProjects } = useProject();
  const navigate = useNavigate();

  const [welcomeName, setWelcomeName] = useState('Usuário');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // ── Onboarding / Welcome States ──
  const [showWelcomeCreate, setShowWelcomeCreate] = useState(false);
  const [welcomeCreating, setWelcomeCreating] = useState(false);
  const [welcomeForm, setWelcomeForm] = useState({ name: '', description: '', color: '#3b82f6' });

  const createNewWelcomeProject = async () => {
    if (!user || !welcomeForm.name.trim()) return;
    try {
      setWelcomeCreating(true);
      let slug = generateSlug(welcomeForm.name);
      let counter = 1;
      while (await checkSlugExists(slug)) {
        slug = `${generateSlug(welcomeForm.name)}-${counter++}`;
      }
      const proj = await createProject({
        name: welcomeForm.name.trim(),
        slug,
        description: welcomeForm.description.trim() || undefined,
        color: welcomeForm.color,
        created_by: user.id,
      });
      await refreshProjects();
      setCurrentProject(proj);
      toast({ title: 'Projeto criado', description: `"${proj.name}" criado com sucesso.` });
      setShowWelcomeCreate(false);
      setWelcomeForm({ name: '', description: '', color: '#3b82f6' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível criar o projeto.', variant: 'destructive' });
    } finally {
      setWelcomeCreating(false);
    }
  };

  // ── Stats ──
  const [overview, setOverview] = useState({
    totalPlans: 0, totalCases: 0, totalExecutions: 0,
    totalRequirements: 0, totalDefects: 0, aiGenerated: 0,
  });
  const [execStats, setExecStats] = useState({ passed: 0, failed: 0, blocked: 0, not_tested: 0 });
  const [coverage, setCoverage] = useState({ covered: 0, total: 0 });
  const [defectStats, setDefectStats] = useState({ open: 0, critical: 0, high: 0 });
  const [progressRows, setProgressRows] = useState<{ planId: string; title: string; percent: number; total: number; sequence?: number; plan: TestPlan }[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // ── Detail modal ──
  const [selectedItem, setSelectedItem] = useState<{ item: TestPlan | TestCase | TestExecution | Requirement | Defect; type: 'plan' | 'case' | 'execution' | 'requirement' | 'defect' } | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Resolve nome (se mantem igual)
      if (SINGLE_TENANT) {
        setWelcomeName((user.user_metadata as any)?.full_name || user.email || 'Usuário');
      } else {
        const { data } = await supabase.from('profiles' as any).select('display_name').eq('id', user.id).maybeSingle();
        setWelcomeName((data as any)?.display_name || user.email || 'Usuário');
      }

      // 2. Fetch dados agregados (Otimização T02)
      const { data: stats, error } = await getDashboardStats(currentProject?.id);
      
      if (error || !stats) {
        console.error('Dashboard load error:', error);
        return;
      }

      // ── Overview ──
      setOverview(stats.overview);

      // ── Execuções ──
      const es = stats.execStats || [];
      setExecStats({
        passed: es.find((s: any) => s.status === 'passed')?.count || 0,
        failed: es.find((s: any) => s.status === 'failed')?.count || 0,
        blocked: es.find((s: any) => s.status === 'blocked')?.count || 0,
        not_tested: es.find((s: any) => s.status === 'not_tested')?.count || 0,
      });

      // ── Cobertura ── (Isolado pois exige lógica de contagem específica por enquanto)
      // TODO: Integrar no aggregate no futuro se necessário
      const { data: requirements } = currentProject?.id 
        ? await getRequirementsByProject(user.id, currentProject.id)
        : await getRequirements(user.id);
      
      const reqIds = (requirements || []).map(r => r.id);
      let covered = 0;
      if (reqIds.length > 0) {
        const { data: links } = await supabase
          .from('requirements_cases')
          .select('requirement_id')
          .in('requirement_id', reqIds);
        covered = new Set((links ?? []).map((l: any) => l.requirement_id)).size;
      }
      setCoverage({ covered, total: (requirements || []).length });

      // ── Defeitos ──
      const ds = stats.defectStats || [];
      setDefectStats({
        open: ds.filter((s: any) => s.status === 'open').reduce((acc: number, s: any) => acc + s.count, 0),
        critical: ds.filter((s: any) => s.severity === 'critical').reduce((acc: number, s: any) => acc + s.count, 0),
        high: ds.filter((s: any) => s.severity === 'high').reduce((acc: number, s: any) => acc + s.count, 0),
      });

      // ── Progresso por plano ──
      setProgressRows((stats.planProgress || []).map((p: any) => ({
        planId: p.id,
        title: p.title,
        percent: p.case_count === 0 ? 0 : Math.min(100, Math.round((p.exec_count / p.case_count) * 100)),
        total: p.case_count,
        sequence: p.sequence,
        plan: p
      })));

      // ── Atividade recente ──
      setRecentItems((stats.recent || []).map((r: any) => ({
        ...r,
        updated_at: new Date(r.updated_at),
        data: r // Simplificado: o modal de detalhes vai buscar o item completo se necessário
      })));

    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, currentProject?.id, projects, SINGLE_TENANT]);

  useEffect(() => { load(); }, [load]);

  // ── Quick action ──────────────────────────────────────────────────────────

  const quickAction = (() => {
    switch (settings.quickActionType) {
      case 'case': return { label: 'Novo Caso', component: TestCaseForm };
      case 'execution': return { label: 'Nova Execução', component: TestExecutionForm };
      case 'unified': return { label: 'Fluxo Unificado', component: UnifiedTestCreation };
      default: return { label: 'Criação Rápida', component: UnifiedTestCreation };
    }
  })();
  const FormComponent = quickAction.component;

  const passRate = pct(execStats.passed, overview.totalExecutions);
  const coverageRate = pct(coverage.covered, coverage.total);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Carregando...</span>
      </div>
    );
  }

  if (projects.length === 0) {
    const canCreateProject = hasPermission('can_manage_projects') || user?.role === 'master' || user?.role === 'admin';

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-12 animate-fade-in">
        <div className="max-w-md w-full bg-card/45 border border-border/85 rounded-xl p-8 backdrop-blur-md shadow-2xl relative overflow-hidden bg-gradient-to-br from-brand/5 via-transparent to-info/5 flex flex-col items-center text-center space-y-6 transition-all duration-300 hover:border-border/100">
          {/* Glowing blob background */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-brand/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-info/10 rounded-full blur-3xl pointer-events-none" />

          {/* Rocket icon indicator */}
          <div className="h-16 w-16 bg-brand/15 text-brand rounded-2xl flex items-center justify-center shadow-lg border border-brand/20 animate-pulse">
            <Rocket className="h-8 w-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Bem-vindo, {welcomeName}! 👋</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Você acabou de entrar no Nexus Testing. Para começar a gerenciar seus testes, requisitos e defeitos, você precisa de um projeto ativo.
            </p>
          </div>

          <div className="border border-border/50 bg-muted/20 rounded-lg p-4 w-full text-center">
            <p className="text-sm font-medium text-brand-foreground/95 flex items-center justify-center gap-1.5">
              <span>🚀</span> Crie seu primeiro projeto para começar
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Defina um nome, uma cor de identificação e uma descrição para o seu espaço de trabalho.
            </p>
          </div>

          {canCreateProject ? (
            <Dialog open={showWelcomeCreate} onOpenChange={setShowWelcomeCreate}>
              <DialogTrigger asChild>
                <Button className="w-full accent-gradient-bg text-brand-foreground border-0 hover:opacity-95 shadow-md flex items-center justify-center gap-2 py-5 font-semibold text-sm rounded-lg transition-transform active:scale-[0.98]">
                  <FolderPlus className="h-4 w-4" /> Crie seu Primeiro Projeto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Criar Novo Projeto</DialogTitle>
                  <DialogDescription>
                    Preencha os dados abaixo para iniciar seu primeiro espaço de trabalho no Nexus.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="wpname">Nome do Projeto</Label>
                    <Input
                      id="wpname"
                      placeholder="Ex: App Web - Vendas"
                      value={welcomeForm.name}
                      onChange={(e) => setWelcomeForm((s) => ({ ...s, name: e.target.value }))}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wpdesc">Descrição (opcional)</Label>
                    <Textarea
                      id="wpdesc"
                      placeholder="Breve descrição sobre o que este projeto irá testar..."
                      rows={3}
                      value={welcomeForm.description}
                      onChange={(e) => setWelcomeForm((s) => ({ ...s, description: e.target.value }))}
                      maxLength={500}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wpcolor">Cor de Destaque</Label>
                    <div className="flex items-center gap-3">
                      <input
                        id="wpcolor"
                        type="color"
                        className="w-12 h-10 rounded border cursor-pointer bg-transparent"
                        value={welcomeForm.color}
                        onChange={(e) => setWelcomeForm((s) => ({ ...s, color: e.target.value }))}
                      />
                      <span className="text-sm font-mono text-muted-foreground">{welcomeForm.color}</span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => setShowWelcomeCreate(false)}
                      disabled={welcomeCreating}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      onClick={createNewWelcomeProject}
                      disabled={welcomeCreating || !welcomeForm.name.trim()}
                      className="bg-brand text-brand-foreground hover:bg-brand/90"
                    >
                      {welcomeCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        'Criar Projeto'
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="text-xs text-amber-400 border border-amber-500/20 bg-amber-500/5 rounded-lg p-3 text-left w-full flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <span>
                <strong>Acesso limitado:</strong> Você ainda não possui nenhum projeto associado. Solicite a um administrador do sistema que crie um projeto e vincule seu usuário.
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-3 sm:px-5 lg:px-6 xl:px-8 2xl:px-16">

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bem-vindo, {welcomeName}!</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentProject ? currentProject.name : 'Todos os projetos ativos'} — visão geral
          </p>
        </div>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <StandardButton
              icon={Plus}
              variant="brand"
              disabled={!currentProject || currentProject.status !== 'active'}
              title={!currentProject ? 'Selecione um projeto ativo' : currentProject.status !== 'active' ? 'Projeto não ativo' : undefined}
            >
              {quickAction.label}
            </StandardButton>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <FormComponent onSuccess={() => { load(); setShowForm(false); }} onCancel={() => setShowForm(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Visão Geral — 6 cards ── */}
      <section>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Visão Geral</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Planos" value={overview.totalPlans} icon={FileText} iconBg="bg-brand/15" iconColor="text-brand" onClick={() => navigate('/plans')} />
          <StatCard label="Casos" value={overview.totalCases} icon={TestTube} iconBg="bg-info/15" iconColor="text-info" onClick={() => navigate('/cases')} />
          <StatCard label="Execuções" value={overview.totalExecutions} icon={PlayCircle} iconBg="bg-success/15" iconColor="text-success" onClick={() => navigate('/executions')} />
          <StatCard label="Requisitos" value={overview.totalRequirements} icon={Link2} iconBg="bg-purple-500/15" iconColor="text-purple-400" onClick={() => navigate('/management?tab=requirements')} />
          <StatCard label="Defeitos abertos" value={overview.totalDefects} icon={Bug} iconBg="bg-destructive/15" iconColor="text-destructive" onClick={() => navigate('/management?tab=defects')} />
          <StatCard label="Gerados por IA" value={overview.aiGenerated} sub="planos + casos" icon={Sparkles} iconBg="bg-pink-500/15" iconColor="text-pink-400" />
        </div>
      </section>

      {/* ── Execuções + Cobertura ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Execuções */}
        <div className="border border-border rounded-lg p-4 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Resultado das Execuções</p>
            <div className="flex items-center gap-1.5">
              <span className={`text-lg font-bold ${passRate >= 80 ? 'text-emerald-400' : passRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {passRate}%
              </span>
              <span className="text-xs text-muted-foreground">aprovação</span>
            </div>
          </div>
          <div className="space-y-2">
            <BarRow label="Aprovado" value={execStats.passed} max={overview.totalExecutions} color="bg-emerald-500" />
            <BarRow label="Falhou" value={execStats.failed} max={overview.totalExecutions} color="bg-red-500" />
            <BarRow label="Bloqueado" value={execStats.blocked} max={overview.totalExecutions} color="bg-amber-500" />
            <BarRow label="Não testado" value={execStats.not_tested} max={overview.totalExecutions} color="bg-muted-foreground/30" />
          </div>
          <button
            className="text-xs text-brand hover:underline flex items-center gap-0.5 mt-1"
            onClick={() => navigate('/executions')}
          >
            Ver todas as execuções <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Cobertura + Defeitos */}
        <div className="space-y-3">
          {/* Cobertura */}
          <div className="border border-border rounded-lg p-4 bg-card space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Cobertura de Requisitos</p>
              <span className={`text-base font-bold ${coverageRate >= 80 ? 'text-emerald-400' : coverageRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                {coverageRate}%
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${coverageRate >= 80 ? 'bg-emerald-500' : coverageRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${coverageRate}%` }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span><span className="font-medium text-emerald-400">{coverage.covered}</span> cobertos</span>
              <span><span className="font-medium text-muted-foreground">{coverage.total - coverage.covered}</span> sem cobertura</span>
            </div>
          </div>

          {/* Defeitos */}
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Defeitos</p>
              <button className="text-xs text-brand hover:underline flex items-center gap-0.5" onClick={() => navigate('/management?tab=defects')}>
                Ver todos <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-muted/40 p-2.5 text-center">
                <div className="text-xl font-bold text-red-400">{defectStats.open}</div>
                <div className="text-[11px] text-muted-foreground">Abertos</div>
              </div>
              <div className="rounded-md bg-muted/40 p-2.5 text-center">
                <div className="text-xl font-bold text-orange-400">{defectStats.critical}</div>
                <div className="text-[11px] text-muted-foreground">Críticos</div>
              </div>
              <div className="rounded-md bg-muted/40 p-2.5 text-center">
                <div className="text-xl font-bold text-amber-400">{defectStats.high}</div>
                <div className="text-[11px] text-muted-foreground">Alta sev.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Progresso de Planos + Atividade Recente ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-0">

        {/* Progresso */}
        <div className="lg:col-span-3 border border-border rounded-lg p-4 bg-card flex flex-col" style={{ height: 'fit-content', maxHeight: '380px' }}>
          <div className="flex items-center justify-between shrink-0 mb-3">
            <p className="text-sm font-semibold">Progresso por Plano</p>
            <button className="text-xs text-brand hover:underline flex items-center gap-0.5" onClick={() => navigate('/plans')}>
              Ver todos <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          {progressRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum plano com dados ainda.</p>
          ) : (
            <div className="space-y-3 overflow-hidden">
              {progressRows.map(row => (
                <div
                  key={row.planId}
                  className="space-y-1 cursor-pointer hover:bg-muted/20 rounded-lg p-1.5 -mx-1.5 transition-colors"
                  onClick={() => { setSelectedItem({ item: row.plan, type: 'plan' }); setShowDetailModal(true); }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate pr-2 flex-1">
                      {row.sequence ? `PT-${String(row.sequence).padStart(3, '0')} — ` : ''}{row.title}
                    </span>
                    <span className="text-brand font-semibold shrink-0">{row.percent}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${row.percent}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">{row.total} casos vinculados</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atividade Recente */}
        <div className="lg:col-span-2 border border-border rounded-lg p-4 bg-card flex flex-col" style={{ height: 'fit-content', maxHeight: '340px' }}>
          <p className="text-sm font-semibold mb-2 shrink-0">Atividade Recente</p>
          {recentItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhuma atividade recente.</p>
          ) : (
            <div className="divide-y divide-border overflow-y-auto scrollbar-auto-hide pr-1">
              {recentItems.map(item => {
                const conf = TYPE_ICON_MAP[item.type];
                const Icon = conf.icon;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center gap-2.5 py-2 cursor-pointer hover:bg-muted/20 rounded-md px-1.5 -mx-1.5 transition-colors"
                    onClick={() => { setSelectedItem({ item: item.data, type: item.type }); setShowDetailModal(true); }}
                  >
                    <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${conf.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${conf.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{item.title}</div>
                      <div className="text-[11px] text-muted-foreground">{TYPE_LABEL[item.type]} · {relativeTime(item.updated_at)}</div>
                    </div>
                    {Boolean(item.generated_by_ai) && (
                      <Sparkles className="h-3 w-3 text-pink-400 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DetailModal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        item={selectedItem?.item || null}
        type={selectedItem?.type || 'plan'}
        onEdit={() => setShowDetailModal(false)}
        onDelete={() => { setShowDetailModal(false); load(); }}
      />
    </div>
  );
};
