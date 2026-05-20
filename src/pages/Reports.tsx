import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TrendingUp, ClipboardCheck, Play, Bug, Link2,
  Download, Loader2, CheckCircle, XCircle, AlertCircle, Clock,
  Sparkles, FileText, Users, FolderKanban, Copy, RefreshCcw, Calendar, Search
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { exportToPDF, exportToCSV, exportToExcel, copyToClipboard } from '@/utils/export';

// --- Types --------------------------------------------------------------------

interface RawPlan {
  id: string;
  title: string;
  generated_by_ai: boolean;
  created_at: string;
}

interface RawCase {
  id: string;
  title: string;
  plan_id: string;
  generated_by_ai: boolean;
  created_at: string;
}

interface RawExecution {
  id: string;
  status: string;
  plan_id: string | null;
  case_id: string;
  run_id: string | null;
  executed_by: string;
  user_id: string | null;
  notes: string | null;
  executed_at: string;
  created_at: string;
}

interface RawRequirement {
  id: string;
  title: string;
  created_at: string;
}

interface RawDefect {
  id: string;
  title: string;
  status: string;
  severity: string;
  plan_id: string | null;
  case_id: string | null;
  execution_id: string | null;
  user_id: string | null;
  created_at: string;
}

interface RawRequirementCase {
  requirement_id: string;
  case_id: string;
}

interface RawRun {
  id: string;
  title: string;
  sequence: number;
}

interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

// --- Helpers -----------------------------------------------------------------

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

const StatCard = ({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; accent?: string;
}) => (
  <div className="border border-border/50 rounded-lg p-4 bg-card/60 backdrop-blur-sm flex items-start gap-3 card-hover transition-all duration-200">
    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${accent ?? 'bg-brand/10 text-brand'}`}>
      <Icon className="h-4.5 w-4.5" />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground leading-tight mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground/60 mt-1">{sub}</div>}
    </div>
  </div>
);

const BarRow = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const w = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-muted-foreground truncate shrink-0">{label}</div>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
      </div>
      <div className="text-xs font-semibold w-8 text-right text-foreground">{value} ({w}%)</div>
    </div>
  );
};

// --- Main Component -----------------------------------------------------------

export const Reports = () => {
  const { currentProject } = useProject();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();

  // Raw Database Data
  const [rawPlans, setRawPlans] = useState<RawPlan[]>([]);
  const [rawCases, setRawCases] = useState<RawCase[]>([]);
  const [rawExecutions, setRawExecutions] = useState<RawExecution[]>([]);
  const [rawRequirements, setRawRequirements] = useState<RawRequirement[]>([]);
  const [rawDefects, setRawDefects] = useState<RawDefect[]>([]);
  const [rawLinks, setRawLinks] = useState<RawRequirementCase[]>([]);
  const [rawRuns, setRawRuns] = useState<RawRun[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  // Filter States
  const [selectedPlan, setSelectedPlan] = useState<string>('all');
  const [selectedRun, setSelectedRun] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load All Data
  const load = useCallback(async () => {
    const projectId = currentProject?.id;
    if (!projectId) {
      // Clear data
      setRawPlans([]);
      setRawCases([]);
      setRawExecutions([]);
      setRawRequirements([]);
      setRawDefects([]);
      setRawLinks([]);
      setRawRuns([]);
      return;
    }

    setLoading(true);
    try {
      const [
        plansRes,
        casesRes,
        execsRes,
        reqsRes,
        defectsRes,
        profilesRes,
        runsRes,
        linksRes
      ] = await Promise.all([
        apiClient.from('test_plans').select('id, title, generated_by_ai, created_at').eq('project_id', projectId),
        apiClient.from('test_cases').select('id, title, plan_id, generated_by_ai, created_at').eq('project_id', projectId),
        apiClient.from('test_executions').select('id, status, plan_id, case_id, run_id, executed_by, user_id, notes, executed_at, created_at').eq('project_id', projectId),
        apiClient.from('requirements').select('id, title, created_at').eq('project_id', projectId),
        apiClient.from('defects').select('id, title, status, severity, plan_id, case_id, execution_id, user_id, created_at').eq('project_id', projectId),
        apiClient.from('profiles').select('id, display_name, email'),
        apiClient.from('test_runs').select('id, title, sequence').eq('project_id', projectId),
        apiClient.from('requirement_cases').select('requirement_id, case_id')
      ]);

      setRawPlans((plansRes.data as RawPlan[]) || []);
      setRawCases((casesRes.data as RawCase[]) || []);
      setRawExecutions((execsRes.data as RawExecution[]) || []);
      setRawRequirements((reqsRes.data as RawRequirement[]) || []);
      setRawDefects((defectsRes.data as RawDefect[]) || []);
      setProfiles((profilesRes.data as Profile[]) || []);
      setRawRuns((runsRes.data as RawRun[]) || []);
      setRawLinks((linksRes.data as RawRequirementCase[]) || []);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao carregar relatório', description: e.message || 'Erro de conexão.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Clean Filters
  const handleClearFilters = () => {
    setSelectedPlan('all');
    setSelectedRun('all');
    setSelectedUser('all');
    setStartDate('');
    setEndDate('');
  };

  // Filtered Arrays
  const filteredExecutions = useMemo(() => {
    let list = rawExecutions;
    if (selectedPlan !== 'all') {
      list = list.filter(e => e.plan_id === selectedPlan);
    }
    if (selectedRun !== 'all') {
      list = list.filter(e => e.run_id === selectedRun);
    }
    if (selectedUser !== 'all') {
      list = list.filter(e => e.user_id === selectedUser);
    }
    if (startDate) {
      list = list.filter(e => new Date(e.executed_at || e.created_at) >= new Date(startDate));
    }
    if (endDate) {
      const endLimit = new Date(endDate);
      endLimit.setHours(23, 59, 59, 999);
      list = list.filter(e => new Date(e.executed_at || e.created_at) <= endLimit);
    }
    return list;
  }, [rawExecutions, selectedPlan, selectedRun, selectedUser, startDate, endDate]);

  const filteredCases = useMemo(() => {
    let list = rawCases;
    if (selectedPlan !== 'all') {
      list = list.filter(c => c.plan_id === selectedPlan);
    }
    return list;
  }, [rawCases, selectedPlan]);

  const filteredDefects = useMemo(() => {
    let list = rawDefects;
    if (selectedPlan !== 'all') {
      list = list.filter(d => d.plan_id === selectedPlan);
    }
    if (selectedUser !== 'all') {
      list = list.filter(d => d.user_id === selectedUser);
    }
    if (startDate) {
      list = list.filter(d => new Date(d.created_at) >= new Date(startDate));
    }
    if (endDate) {
      const endLimit = new Date(endDate);
      endLimit.setHours(23, 59, 59, 999);
      list = list.filter(d => new Date(d.created_at) <= endLimit);
    }
    return list;
  }, [rawDefects, selectedPlan, selectedUser, startDate, endDate]);

  // Derived Metrics
  const metrics = useMemo(() => {
    const totalPlans = selectedPlan !== 'all' ? 1 : rawPlans.length;
    const totalCases = filteredCases.length;
    const totalExecutions = filteredExecutions.length;
    const totalRequirements = rawRequirements.length;
    const totalDefects = filteredDefects.length;

    const aiCases = filteredCases.filter(c => c.generated_by_ai).length;
    const aiPlans = rawPlans.filter(p => p.generated_by_ai).length;

    // Executions Status
    const passed = filteredExecutions.filter(e => e.status === 'passed').length;
    const failed = filteredExecutions.filter(e => e.status === 'failed').length;
    const blocked = filteredExecutions.filter(e => e.status === 'blocked').length;
    const notTested = filteredExecutions.filter(e => e.status === 'not_tested').length;
    const passRate = pct(passed, totalExecutions);

    // Requirements Coverage
    const activeCaseIds = new Set(filteredCases.map(c => c.id));
    const coveredReqIds = new Set(
      rawLinks
        .filter(link => activeCaseIds.has(link.case_id))
        .map(link => link.requirement_id)
    );
    const coveredReqs = rawRequirements.filter(r => coveredReqIds.has(r.id)).length;
    const coverageRate = pct(coveredReqs, totalRequirements);

    // Defects Severity
    const openDefects = filteredDefects.filter(d => d.status === 'open').length;
    const closedDefects = filteredDefects.filter(d => d.status === 'closed').length;
    const criticalDefects = filteredDefects.filter(d => d.severity === 'critical').length;
    const highDefects = filteredDefects.filter(d => d.severity === 'high').length;
    const mediumDefects = filteredDefects.filter(d => d.severity === 'medium').length;
    const lowDefects = filteredDefects.filter(d => d.severity === 'low').length;

    // Recent activities
    const lastExecution = filteredExecutions.sort((a, b) => b.created_at > a.created_at ? 1 : -1)[0]?.created_at;
    const lastCase = filteredCases.sort((a, b) => b.created_at > a.created_at ? 1 : -1)[0]?.created_at;
    const lastPlan = rawPlans.sort((a, b) => b.created_at > a.created_at ? 1 : -1)[0]?.created_at;

    return {
      overview: {
        totalPlans,
        totalCases,
        totalExecutions,
        totalRequirements,
        totalDefects,
        aiCases,
        aiPlans,
      },
      executions: {
        passed, failed, blocked, notTested, passRate
      },
      coverage: {
        covered: coveredReqs,
        total: totalRequirements,
        coverageRate
      },
      defects: {
        open: openDefects,
        closed: closedDefects,
        critical: criticalDefects,
        high: highDefects,
        medium: mediumDefects,
        low: lowDefects
      },
      recentActivity: {
        lastExecution, lastCase, lastPlan
      }
    };
  }, [rawPlans, filteredCases, filteredExecutions, rawRequirements, filteredDefects, rawLinks]);

  // Plan Breakdown List
  const planBreakdown = useMemo(() => {
    return rawPlans.map(plan => {
      const planCases = rawCases.filter(c => c.plan_id === plan.id);
      const planCaseIds = new Set(planCases.map(c => c.id));
      const planExecs = rawExecutions.filter(e => planCaseIds.has(e.case_id));

      const passed = planExecs.filter(e => e.status === 'passed').length;
      const failed = planExecs.filter(e => e.status === 'failed').length;
      const blocked = planExecs.filter(e => e.status === 'blocked').length;
      const notTested = planExecs.filter(e => e.status === 'not_tested').length;

      const total = planExecs.length;
      const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

      return {
        id: plan.id,
        title: plan.title,
        casesCount: planCases.length,
        execsCount: total,
        passed,
        failed,
        blocked,
        notTested,
        passRate,
      };
    });
  }, [rawPlans, rawCases, rawExecutions]);

  // Format Helper for Exporting
  const getConsolidatedExportData = () => {
    const headers = ['Métrica', 'Valor'];
    const rows = [
      ['Planos de Teste', metrics.overview.totalPlans],
      ['Casos de Teste', metrics.overview.totalCases],
      ['Execuções de Teste', metrics.overview.totalExecutions],
      ['Requisitos', metrics.overview.totalRequirements],
      ['Defeitos Totais', metrics.overview.totalDefects],
      ['Taxa de Aprovação (%)', metrics.executions.passRate],
      ['Cobertura de Requisitos (%)', metrics.coverage.coverageRate],
      ['Defeitos Abertos', metrics.defects.open],
      ['Defeitos Fechados', metrics.defects.closed],
      ['Defeitos Críticos', metrics.defects.critical],
      ['Defeitos de Severidade Alta', metrics.defects.high],
      ['Casos Gerados por IA', metrics.overview.aiCases],
    ];
    return { headers, rows, title: `Relatório Consolidado — ${currentProject?.name || 'Todos os Projetos'}` };
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!hasPermission('can_export')) {
      toast({ title: 'Sem permissão para exportar', variant: 'destructive' });
      return;
    }
    const data = getConsolidatedExportData();
    exportToCSV(data, `relatorio_consolidado_${currentProject?.name || 'nexus'}`);
    toast({ title: 'CSV exportado com sucesso!' });
  };

  // Copy Markdown
  const handleCopyMarkdown = async () => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const projectName = currentProject?.name || 'Todos os Projetos';

    let md = `# 📊 Relatório Consolidado de Testes — Nexus Testing\n\n`;
    md += `* **Projeto:** ${projectName}\n`;
    md += `* **Data de Emissão:** ${timestamp}\n`;
    md += `* **Filtros Aplicados:**\n`;
    md += `  * Plano de Teste: ${selectedPlan === 'all' ? 'Todos' : rawPlans.find(p => p.id === selectedPlan)?.title || '—'}\n`;
    md += `  * Ciclo de Execução: ${selectedRun === 'all' ? 'Todos' : rawRuns.find(r => r.id === selectedRun)?.title || '—'}\n`;
    md += `  * Responsável: ${selectedUser === 'all' ? 'Todos' : profiles.find(p => p.id === selectedUser)?.display_name || '—'}\n`;
    md += `  * Período: ${startDate || 'Início'} até ${endDate || 'Fim'}\n\n`;

    md += `## 📈 Métricas Gerais\n\n`;
    md += `| Métrica | Quantidade / Taxa |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Planos de Teste** | ${metrics.overview.totalPlans} |\n`;
    md += `| **Casos de Teste** | ${metrics.overview.totalCases} |\n`;
    md += `| **Execuções Realizadas** | ${metrics.overview.totalExecutions} |\n`;
    md += `| **Requisitos Mapeados** | ${metrics.overview.totalRequirements} |\n`;
    md += `| **Defeitos Encontrados** | ${metrics.overview.totalDefects} |\n`;
    md += `| **Taxa de Aprovação** | **${metrics.executions.passRate}%** |\n`;
    md += `| **Cobertura de Requisitos** | **${metrics.coverage.coverageRate}%** |\n\n`;

    md += `## 🚀 Status das Execuções\n\n`;
    md += `* **Aprovados:** ${metrics.executions.passed}\n`;
    md += `* **Falhos:** ${metrics.executions.failed}\n`;
    md += `* **Bloqueados:** ${metrics.executions.blocked}\n`;
    md += `* **Não Testados:** ${metrics.executions.notTested}\n\n`;

    md += `## 🐛 Gravidade dos Defeitos\n\n`;
    md += `* **Críticos:** ${metrics.defects.critical}\n`;
    md += `* **Severidade Alta:** ${metrics.defects.high}\n`;
    md += `* **Severidade Média:** ${metrics.defects.medium}\n`;
    md += `* **Severidade Baixa:** ${metrics.defects.low}\n`;
    md += `* **Status:** ${metrics.defects.open} abertos / ${metrics.defects.closed} fechados\n\n`;

    md += `## 📋 Detalhe por Plano de Teste\n\n`;
    md += `| Plano de Teste | Casos | Execuções | Aprovados | Falhos | Taxa |\n`;
    md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;
    planBreakdown.forEach(p => {
      md += `| ${p.title} | ${p.casesCount} | ${p.execsCount} | ${p.passed} | ${p.failed} | ${p.passRate}% |\n`;
    });

    const success = await copyToClipboard(md, 'md');
    if (success) {
      toast({ title: 'Markdown copiado!', description: 'O relatório foi copiado para a área de transferência.' });
    } else {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  // Copy Plain Text
  const handleCopyText = async () => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const projectName = currentProject?.name || 'Todos os Projetos';

    let txt = `========================================================\n`;
    txt += `       RELATÓRIO CONSOLIDADO DE TESTES — NEXUS\n`;
    txt += `========================================================\n`;
    txt += `Projeto: ${projectName}\n`;
    txt += `Gerado em: ${timestamp}\n\n`;
    txt += `FILTROS:\n`;
    txt += `- Plano: ${selectedPlan === 'all' ? 'Todos' : rawPlans.find(p => p.id === selectedPlan)?.title || '—'}\n`;
    txt += `- Ciclo: ${selectedRun === 'all' ? 'Todos' : rawRuns.find(r => r.id === selectedRun)?.title || '—'}\n`;
    txt += `- Responsável: ${selectedUser === 'all' ? 'Todos' : profiles.find(p => p.id === selectedUser)?.display_name || '—'}\n`;
    txt += `- Período: ${startDate || 'Início'} - ${endDate || 'Fim'}\n\n`;

    txt += `MÉTRICAS GERAIS:\n`;
    txt += `- Planos de Teste: ${metrics.overview.totalPlans}\n`;
    txt += `- Casos de Teste: ${metrics.overview.totalCases}\n`;
    txt += `- Execuções: ${metrics.overview.totalExecutions}\n`;
    txt += `- Requisitos: ${metrics.overview.totalRequirements}\n`;
    txt += `- Defeitos Totais: ${metrics.overview.totalDefects}\n`;
    txt += `- Taxa de Aprovação: ${metrics.executions.passRate}%\n`;
    txt += `- Cobertura de Requisitos: ${metrics.coverage.coverageRate}%\n\n`;

    txt += `STATUS DAS EXECUÇÕES:\n`;
    txt += `- Aprovados: ${metrics.executions.passed}\n`;
    txt += `- Falhos: ${metrics.executions.failed}\n`;
    txt += `- Bloqueados: ${metrics.executions.blocked}\n`;
    txt += `- Não Testados: ${metrics.executions.notTested}\n\n`;

    txt += `DEFEITOS:\n`;
    txt += `- Críticos: ${metrics.defects.critical}\n`;
    txt += `- Alta: ${metrics.defects.high}\n`;
    txt += `- Média: ${metrics.defects.medium}\n`;
    txt += `- Baixa: ${metrics.defects.low}\n`;
    txt += `- Status: ${metrics.defects.open} ativos / ${metrics.defects.closed} resolvidos\n\n`;

    txt += `========================================================\n`;

    const success = await copyToClipboard(txt, 'txt');
    if (success) {
      toast({ title: 'Relatório TXT copiado!', description: 'Texto puro formatado copiado com sucesso.' });
    } else {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Relatórios</h1>
          <p className="text-sm text-muted-foreground">
            {currentProject ? currentProject.name : 'Todos os projetos'} — visão consolidada e exportação.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleClearFilters} className="h-8 text-xs">
            <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Limpar Filtros
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopyMarkdown} className="h-8 text-xs">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar MD
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopyText} className="h-8 text-xs">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Copiar TXT
          </Button>
          {hasPermission('can_export') && (
            <Button size="sm" variant="brand" onClick={handleExportCSV} disabled={exporting || loading} className="h-8 text-xs">
              <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
            </Button>
          )}
        </div>
      </div>

      {/* --- Filtros Avançados --- */}
      <div className="border border-border/50 rounded-lg p-4 bg-card/40 backdrop-blur-sm space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5" /> Filtros Precisos
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Filtro: Plano */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Plano de Teste</Label>
            <select
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border/60 bg-muted/20 px-2 text-foreground focus:outline-none focus:border-brand/50"
            >
              <option value="all">Todos os Planos</option>
              {rawPlans.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Ciclo */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Ciclo (Run)</Label>
            <select
              value={selectedRun}
              onChange={e => setSelectedRun(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border/60 bg-muted/20 px-2 text-foreground focus:outline-none focus:border-brand/50"
            >
              <option value="all">Todos os Ciclos</option>
              {rawRuns.map(r => (
                <option key={r.id} value={r.id}>RUN-{String(r.sequence).padStart(3, '0')} • {r.title}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Responsável */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Responsável</Label>
            <select
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border/60 bg-muted/20 px-2 text-foreground focus:outline-none focus:border-brand/50"
            >
              <option value="all">Todos os Usuários</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
              ))}
            </select>
          </div>

          {/* Filtro: Data Inicial */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Data Inicial</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="h-8 text-xs bg-muted/20 border-border/60 focus:border-brand/50"
            />
          </div>

          {/* Filtro: Data Final */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Data Final</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-8 text-xs bg-muted/20 border-border/60 focus:border-brand/50"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando dados estruturados...</span>
        </div>
      ) : !currentProject ? (
        <div className="border border-border/50 rounded-lg p-12 text-center text-muted-foreground bg-card/30">
          Selecione um projeto ativo no painel superior para extrair métricas de relatórios.
        </div>
      ) : (
        <div className="space-y-6">

          {/* -- Visão Geral -- */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Visão Geral</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatCard label="Planos de Teste" value={metrics.overview.totalPlans} icon={FileText} />
              <StatCard label="Casos de Teste" value={metrics.overview.totalCases} icon={ClipboardCheck} />
              <StatCard label="Execuções" value={metrics.overview.totalExecutions} icon={Play} />
              <StatCard label="Requisitos" value={metrics.overview.totalRequirements} icon={Link2} />
              <StatCard label="Defeitos" value={metrics.overview.totalDefects} icon={Bug} />
              <StatCard
                label="Gerados por IA"
                value={metrics.overview.aiCases + metrics.overview.aiPlans}
                sub={`${metrics.overview.aiPlans} planos • ${metrics.overview.aiCases} casos`}
                icon={Sparkles}
                accent="bg-amber-500/10 text-amber-400 border border-amber-500/20"
              />
            </div>
          </section>

          {/* -- Execuções + Cobertura -- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Execuções */}
            <div className="border border-border/50 rounded-lg p-4 bg-card/60 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Resultado das Execuções</h2>
                <div className="flex items-center gap-1.5">
                  <span className={`text-lg font-bold ${metrics.executions.passRate >= 80 ? 'text-emerald-400' : metrics.executions.passRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {metrics.executions.passRate}%
                  </span>
                  <span className="text-xs text-muted-foreground">de aprovação</span>
                </div>
              </div>
              <div className="space-y-2.5">
                <BarRow label="Aprovado" value={metrics.executions.passed} max={metrics.overview.totalExecutions} color="bg-emerald-500" />
                <BarRow label="Falhou" value={metrics.executions.failed} max={metrics.overview.totalExecutions} color="bg-red-500" />
                <BarRow label="Bloqueado" value={metrics.executions.blocked} max={metrics.overview.totalExecutions} color="bg-amber-500" />
                <BarRow label="Não testado" value={metrics.executions.notTested} max={metrics.overview.totalExecutions} color="bg-muted-foreground/30" />
              </div>
            </div>

            {/* Cobertura de requisitos */}
            <div className="border border-border/50 rounded-lg p-4 bg-card/60 backdrop-blur-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Cobertura de Requisitos</h2>
                <div className="flex items-center gap-1.5">
                  <span className={`text-lg font-bold ${metrics.coverage.coverageRate >= 80 ? 'text-emerald-400' : metrics.coverage.coverageRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {metrics.coverage.coverageRate}%
                  </span>
                  <span className="text-xs text-muted-foreground">cobertos</span>
                </div>
              </div>
              <div className="flex items-end gap-4">
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${metrics.coverage.coverageRate >= 80 ? 'bg-emerald-500' : metrics.coverage.coverageRate >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${metrics.coverage.coverageRate}%` }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md bg-muted/40 p-2.5">
                  <div className="text-xs text-muted-foreground">Com casos vinculados</div>
                  <div className="font-semibold text-emerald-400 mt-1">{metrics.coverage.covered}</div>
                </div>
                <div className="rounded-md bg-muted/40 p-2.5">
                  <div className="text-xs text-muted-foreground">Sem cobertura</div>
                  <div className="font-semibold text-muted-foreground mt-1">
                    {metrics.coverage.total - metrics.coverage.covered}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* -- Defeitos + Atividade Recente -- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Defeitos */}
            <div className="border border-border/50 rounded-lg p-4 bg-card/60 backdrop-blur-sm space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Defeitos por Gravidade</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-md bg-red-950/20 border border-red-500/10 p-2.5">
                  <div className="text-xs text-red-400 font-semibold uppercase tracking-wider">Críticos</div>
                  <div className="text-xl font-bold text-red-500 mt-1">{metrics.defects.critical}</div>
                </div>
                <div className="rounded-md bg-orange-950/20 border border-orange-500/10 p-2.5">
                  <div className="text-xs text-orange-400 font-semibold uppercase tracking-wider">Altos</div>
                  <div className="text-xl font-bold text-orange-500 mt-1">{metrics.defects.high}</div>
                </div>
                <div className="rounded-md bg-amber-950/20 border border-amber-500/10 p-2.5">
                  <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Médios</div>
                  <div className="text-xl font-bold text-amber-500 mt-1">{metrics.defects.medium}</div>
                </div>
                <div className="rounded-md bg-blue-950/20 border border-blue-500/10 p-2.5">
                  <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Baixos</div>
                  <div className="text-xl font-bold text-blue-500 mt-1">{metrics.defects.low}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="text-xs text-muted-foreground flex justify-between bg-muted/20 px-2.5 py-1.5 rounded-md">
                  <span>Defeitos Abertos</span>
                  <span className="font-bold text-red-400">{metrics.defects.open}</span>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between bg-muted/20 px-2.5 py-1.5 rounded-md">
                  <span>Defeitos Fechados</span>
                  <span className="font-bold text-emerald-400">{metrics.defects.closed}</span>
                </div>
              </div>
            </div>

            {/* Atividade recente */}
            <div className="border border-border/50 rounded-lg p-4 bg-card/60 backdrop-blur-sm space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Última Atividade</h2>
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Play className="h-3.5 w-3.5 text-muted-foreground/60" />
                    Última execução
                  </div>
                  <span className="text-xs font-semibold text-foreground">{fmt(metrics.recentActivity.lastExecution)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
                    Último caso criado
                  </div>
                  <span className="text-xs font-semibold text-foreground">{fmt(metrics.recentActivity.lastCase)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground/60" />
                    Último plano criado
                  </div>
                  <span className="text-xs font-semibold text-foreground">{fmt(metrics.recentActivity.lastPlan)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* -- Detalhamento por Planos de Teste -- */}
          <div className="border border-border/50 rounded-lg overflow-hidden bg-card/60 backdrop-blur-sm">
            <div className="px-4 py-3 bg-muted/40 border-b border-border flex justify-between items-center">
              <h2 className="text-sm font-semibold text-foreground">Desempenho por Plano de Teste</h2>
              <span className="text-xs text-muted-foreground font-medium">{planBreakdown.length} planos cadastrados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-2.5">Plano de Teste</th>
                    <th className="px-4 py-2.5 text-center">Casos</th>
                    <th className="px-4 py-2.5 text-center">Execuções</th>
                    <th className="px-4 py-2.5 text-center text-emerald-400">Aprovados</th>
                    <th className="px-4 py-2.5 text-center text-red-400">Falhos</th>
                    <th className="px-4 py-2.5 text-right">Aprovação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {planBreakdown.map(p => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-xs">{p.title}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{p.casesCount}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{p.execsCount}</td>
                      <td className="px-4 py-3 text-center font-medium text-emerald-500">{p.passed}</td>
                      <td className="px-4 py-3 text-center font-medium text-red-500">{p.failed}</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground">
                        <span className={p.passRate >= 80 ? 'text-emerald-400' : p.passRate >= 50 ? 'text-amber-400' : 'text-red-400'}>
                          {p.passRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  {planBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        Nenhum plano de teste associado a este projeto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* -- Defeitos Registrados (Top 10) -- */}
          <div className="border border-border/50 rounded-lg overflow-hidden bg-card/60 backdrop-blur-sm">
            <div className="px-4 py-3 bg-muted/40 border-b border-border flex justify-between items-center">
              <h2 className="text-sm font-semibold text-foreground">Defeitos do Período</h2>
              <span className="text-xs text-muted-foreground font-medium">{filteredDefects.length} defeitos filtrados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
                    <th className="px-4 py-2.5">Título</th>
                    <th className="px-4 py-2.5 text-center">Severidade</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Data de Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {filteredDefects.slice(0, 10).map(d => (
                    <tr key={d.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-sm">{d.title}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            d.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20 text-[10px] uppercase font-bold py-0 h-5' :
                            d.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 text-[10px] uppercase font-bold py-0 h-5' :
                            d.severity === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] uppercase font-bold py-0 h-5' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] uppercase font-bold py-0 h-5'
                          }
                        >
                          {d.severity === 'critical' ? 'Crítico' : d.severity === 'high' ? 'Alto' : d.severity === 'medium' ? 'Médio' : 'Baixo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={d.status === 'open' ? 'bg-red-500/10 text-red-400 border-red-500/20 text-[10px]' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]'}
                        >
                          {d.status === 'open' ? 'Aberto' : 'Resolvido'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{fmt(d.created_at)}</td>
                    </tr>
                  ))}
                  {filteredDefects.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        Nenhum defeito encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default Reports;
