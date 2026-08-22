import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  TrendingUp, ClipboardCheck, Play, Bug, Link2,
  Download, Loader2, CheckCircle2, XCircle, AlertCircle, Clock,
  Sparkles, FileText, Users, FolderKanban, Copy, RefreshCcw, Calendar, 
  Search, BarChart3, ShieldCheck, FileSpreadsheet, Layers, FileCode2
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { exportToPDF, exportToCSV, exportToExcel, copyToClipboard } from '@/utils/export';

// --- Types --------------------------------------------------------------------

interface RawPlan {
  id: string;
  title: string;
  sequence?: number;
  generated_by_ai: boolean;
  created_at: string;
}

interface RawCase {
  id: string;
  title: string;
  sequence?: number;
  plan_id: string;
  generated_by_ai: boolean;
  created_at: string;
}

interface RawExecution {
  id: string;
  status: string;
  sequence?: number;
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
  sequence?: number;
  created_at: string;
}

interface RawDefect {
  id: string;
  title: string;
  sequence?: number;
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
  <div className="border border-border/70 rounded-xl p-4 bg-card/60 backdrop-blur-sm flex items-start gap-3.5 card-hover transition-all duration-200 shadow-xs">
    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent ?? 'bg-brand/10 text-brand border border-brand/20'}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0">
      <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="text-xs font-medium text-muted-foreground leading-tight mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground/70 mt-1">{sub}</div>}
    </div>
  </div>
);

const BarRow = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const w = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs font-medium text-muted-foreground truncate shrink-0">{label}</div>
      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${w}%` }} />
      </div>
      <div className="text-xs font-semibold w-16 text-right text-foreground">{value} <span className="text-muted-foreground font-normal">({w}%)</span></div>
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
      setRawPlans([]);
      setRawCases([]);
      setRawExecutions([]);
      setRawRequirements([]);
      setRawDefects([]);
      setRawLinks([]);
      setRawRuns([]);
      setProfiles([]);
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
        linksRes,
        runsRes,
        profilesRes,
      ] = await Promise.all([
        apiClient.get(`/test-plans?project_id=${projectId}`),
        apiClient.get(`/test-cases?project_id=${projectId}`),
        apiClient.get(`/test-executions?project_id=${projectId}`),
        apiClient.get(`/requirements?project_id=${projectId}`),
        apiClient.get(`/defects?project_id=${projectId}`),
        apiClient.get(`/requirement-test-cases?project_id=${projectId}`).catch(() => ({ data: [] })),
        apiClient.get(`/test-runs?project_id=${projectId}`).catch(() => ({ data: [] })),
        apiClient.get(`/profiles?project_id=${projectId}`).catch(() => ({ data: [] })),
      ]);

      setRawPlans(plansRes.data || []);
      setRawCases(casesRes.data || []);
      setRawExecutions(execsRes.data || []);
      setRawRequirements(reqsRes.data || []);
      setRawDefects(defectsRes.data || []);
      setRawLinks(linksRes.data || []);
      setRawRuns(runsRes.data || []);
      setProfiles(profilesRes.data || []);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar dados do relatório', description: e?.message || '', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset Filters
  const handleClearFilters = () => {
    setSelectedPlan('all');
    setSelectedRun('all');
    setSelectedUser('all');
    setStartDate('');
    setEndDate('');
  };

  // Filtered Test Cases
  const filteredCases = useMemo(() => {
    let list = rawCases;
    if (selectedPlan !== 'all') {
      list = list.filter(c => c.plan_id === selectedPlan);
    }
    return list;
  }, [rawCases, selectedPlan]);

  // Filtered Executions
  const filteredExecutions = useMemo(() => {
    let list = rawExecutions;
    if (selectedPlan !== 'all') {
      const caseIds = new Set(rawCases.filter(c => c.plan_id === selectedPlan).map(c => c.id));
      list = list.filter(e => e.plan_id === selectedPlan || caseIds.has(e.case_id));
    }
    if (selectedRun !== 'all') {
      list = list.filter(e => e.run_id === selectedRun);
    }
    if (selectedUser !== 'all') {
      list = list.filter(e => e.user_id === selectedUser || e.executed_by === selectedUser);
    }
    if (startDate) {
      list = list.filter(e => new Date(e.created_at || e.executed_at) >= new Date(startDate));
    }
    if (endDate) {
      const endLimit = new Date(endDate);
      endLimit.setHours(23, 59, 59, 999);
      list = list.filter(e => new Date(e.created_at || e.executed_at) <= endLimit);
    }
    return list;
  }, [rawExecutions, rawCases, selectedPlan, selectedRun, selectedUser, startDate, endDate]);

  // Filtered Defects
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
    const closedDefects = filteredDefects.filter(d => d.status === 'closed' || d.status === 'resolved').length;
    const criticalDefects = filteredDefects.filter(d => d.severity === 'critical').length;
    const highDefects = filteredDefects.filter(d => d.severity === 'high').length;
    const mediumDefects = filteredDefects.filter(d => d.severity === 'medium').length;
    const lowDefects = filteredDefects.filter(d => d.severity === 'low').length;

    // Recent activities
    const lastExecution = filteredExecutions.sort((a, b) => (b.created_at > a.created_at ? 1 : -1))[0]?.created_at;
    const lastCase = filteredCases.sort((a, b) => (b.created_at > a.created_at ? 1 : -1))[0]?.created_at;
    const lastPlan = rawPlans.sort((a, b) => (b.created_at > a.created_at ? 1 : -1))[0]?.created_at;

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
  }, [rawPlans, filteredCases, filteredExecutions, rawRequirements, filteredDefects, rawLinks, selectedPlan]);

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
        sequence: plan.sequence,
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
      ['Requisitos Mapeados', metrics.overview.totalRequirements],
      ['Defeitos Totais', metrics.overview.totalDefects],
      ['Taxa de Aprovação (%)', `${metrics.executions.passRate}%`],
      ['Cobertura de Requisitos (%)', `${metrics.coverage.coverageRate}%`],
      ['Defeitos Abertos', metrics.defects.open],
      ['Defeitos Fechados', metrics.defects.closed],
      ['Defeitos Críticos', metrics.defects.critical],
      ['Defeitos de Severidade Alta', metrics.defects.high],
      ['Casos Gerados por IA', metrics.overview.aiCases],
    ];
    return { headers, rows, title: `Relatório Consolidado — ${currentProject?.name || 'Nexus TCMS'}` };
  };

  // Export Handlers
  const handleExportCSV = () => {
    if (!hasPermission('can_export')) {
      toast({ title: 'Sem permissão para exportar', variant: 'destructive' });
      return;
    }
    const data = getConsolidatedExportData();
    exportToCSV(data, `relatorio_consolidado_${currentProject?.name || 'nexus'}`);
    toast({ title: 'CSV exportado com sucesso!' });
  };

  const handleExportExcel = () => {
    if (!hasPermission('can_export')) {
      toast({ title: 'Sem permissão para exportar', variant: 'destructive' });
      return;
    }
    const data = getConsolidatedExportData();
    exportToExcel(data, `relatorio_consolidado_${currentProject?.name || 'nexus'}`);
    toast({ title: 'Excel exportado com sucesso!' });
  };

  const handleExportPDF = async () => {
    if (!hasPermission('can_export')) {
      toast({ title: 'Sem permissão para exportar', variant: 'destructive' });
      return;
    }
    setExporting(true);
    try {
      const data = getConsolidatedExportData();
      await exportToPDF(data, `relatorio_consolidado_${currentProject?.name || 'nexus'}`);
      toast({ title: 'PDF gerado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleCopyMarkdown = async () => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const projectName = currentProject?.name || 'Todos os Projetos';

    let md = `# 📊 Relatório Executivo de Qualidade — Nexus TCMS\n\n`;
    md += `* **Projeto:** ${projectName}\n`;
    md += `* **Data de Emissão:** ${timestamp}\n`;
    md += `* **Taxa de Aprovação:** **${metrics.executions.passRate}%**\n`;
    md += `* **Cobertura de Requisitos:** **${metrics.coverage.coverageRate}%**\n\n`;

    md += `## 📈 Métricas Gerais\n\n`;
    md += `| Métrica | Quantidade |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Planos de Teste** | ${metrics.overview.totalPlans} |\n`;
    md += `| **Casos de Teste** | ${metrics.overview.totalCases} |\n`;
    md += `| **Execuções Realizadas** | ${metrics.overview.totalExecutions} |\n`;
    md += `| **Requisitos Mapeados** | ${metrics.overview.totalRequirements} |\n`;
    md += `| **Defeitos Encontrados** | ${metrics.overview.totalDefects} |\n\n`;

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

    md += `## 📋 Desempenho por Plano de Teste\n\n`;
    md += `| Plano | Casos | Execuções | Aprovados | Falhos | Taxa |\n`;
    md += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;
    planBreakdown.forEach(p => {
      const pCode = p.sequence != null ? `PT-${String(p.sequence).padStart(3, '0')}` : 'PT-001';
      md += `| ${pCode} — ${p.title} | ${p.casesCount} | ${p.execsCount} | ${p.passed} | ${p.failed} | ${p.passRate}% |\n`;
    });

    const success = await copyToClipboard(md, 'md');
    if (success) {
      toast({ title: 'Markdown copiado!', description: 'O relatório executivo foi copiado para a área de transferência.' });
    } else {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleCopyText = async () => {
    const timestamp = new Date().toLocaleString('pt-BR');
    const projectName = currentProject?.name || 'Todos os Projetos';

    let txt = `RELATÓRIO CONSOLIDADO DE QUALIDADE — NEXUS TCMS\n`;
    txt += `==============================================\n`;
    txt += `Projeto: ${projectName}\n`;
    txt += `Data: ${timestamp}\n`;
    txt += `Taxa de Aprovação: ${metrics.executions.passRate}%\n`;
    txt += `Cobertura de Requisitos: ${metrics.coverage.coverageRate}%\n\n`;
    txt += `MÉTRICAS GERAIS:\n`;
    txt += `- Planos de Teste: ${metrics.overview.totalPlans}\n`;
    txt += `- Casos de Teste: ${metrics.overview.totalCases}\n`;
    txt += `- Execuções: ${metrics.overview.totalExecutions} (Aprovados: ${metrics.executions.passed}, Falhos: ${metrics.executions.failed})\n`;
    txt += `- Defeitos: ${metrics.overview.totalDefects} (Abertos: ${metrics.defects.open}, Fechados: ${metrics.defects.closed})\n`;

    const success = await copyToClipboard(txt, 'txt');
    if (success) {
      toast({ title: 'Texto copiado!', description: 'O resumo foi copiado para a área de transferência.' });
    } else {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');

  return (
    <div className="flex-1 space-y-6 p-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-brand" />
            Relatórios e Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentProject ? currentProject.name : 'Todos os projetos'} — visão executiva, métricas de qualidade e exportações.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleClearFilters} className="h-9 text-xs border-border/70">
            <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Limpar Filtros
          </Button>

          <Button size="sm" variant="outline" onClick={handleCopyMarkdown} className="h-9 text-xs border-border/70">
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar MD
          </Button>

          <Button size="sm" variant="outline" onClick={handleCopyText} className="h-9 text-xs border-border/70">
            <FileText className="h-3.5 w-3.5 mr-1.5" /> Copiar TXT
          </Button>

          {hasPermission('can_export') && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="brand" disabled={exporting || loading} className="h-9 text-xs">
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar Relatório
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportCSV} className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                  <span>Exportar CSV</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-green-600" />
                  <span>Exportar Excel (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleExportPDF} className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-red-500" />
                  <span>Exportar PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Filtros Precisos */}
      <div className="border border-border/70 rounded-xl p-4 bg-card/60 backdrop-blur-sm space-y-3 shadow-xs">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Search className="h-3.5 w-3.5" /> Filtros Operacionais
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Filtro: Plano */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Plano de Teste</Label>
            <select
              value={selectedPlan}
              onChange={e => setSelectedPlan(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border/70 bg-muted/20 px-2 text-foreground focus:outline-none focus:border-brand/50"
            >
              <option value="all">Todos os Planos</option>
              {rawPlans.map(p => (
                <option key={p.id} value={p.id}>
                  {p.sequence != null ? `PT-${String(p.sequence).padStart(3, '0')} — ` : ''}{p.title}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro: Ciclo */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Ciclo de Teste</Label>
            <select
              value={selectedRun}
              onChange={e => setSelectedRun(e.target.value)}
              className="w-full h-8 text-xs rounded-md border border-border/70 bg-muted/20 px-2 text-foreground focus:outline-none focus:border-brand/50"
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
              className="w-full h-8 text-xs rounded-md border border-border/70 bg-muted/20 px-2 text-foreground focus:outline-none focus:border-brand/50"
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
              className="h-8 text-xs bg-muted/20 border-border/70 focus:border-brand/50"
            />
          </div>

          {/* Filtro: Data Final */}
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Data Final</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="h-8 text-xs bg-muted/20 border-border/70 focus:border-brand/50"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          <span className="text-sm">Carregando métricas e dados analíticos...</span>
        </div>
      ) : !currentProject ? (
        <div className="border border-border/60 rounded-xl p-12 text-center text-muted-foreground bg-card/30">
          Selecione um projeto ativo para extrair relatórios executivos.
        </div>
      ) : (
        <div className="space-y-6">

          {/* -- Visão Geral KPI Cards -- */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Métricas Principais
            </h2>
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
            <div className="border border-border/70 rounded-xl p-4 bg-card/60 backdrop-blur-sm space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Resultado das Execuções</h2>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xl font-bold ${metrics.executions.passRate >= 80 ? 'text-emerald-400' : metrics.executions.passRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
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
            <div className="border border-border/70 rounded-xl p-4 bg-card/60 backdrop-blur-sm space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Cobertura de Requisitos</h2>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xl font-bold ${metrics.coverage.coverageRate >= 80 ? 'text-emerald-400' : metrics.coverage.coverageRate >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
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
                <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
                  <div className="text-xs text-muted-foreground font-medium">Com casos vinculados</div>
                  <div className="font-bold text-emerald-400 text-lg mt-0.5">{metrics.coverage.covered}</div>
                </div>
                <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
                  <div className="text-xs text-muted-foreground font-medium">Sem cobertura</div>
                  <div className="font-bold text-muted-foreground text-lg mt-0.5">
                    {metrics.coverage.total - metrics.coverage.covered}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* -- Defeitos + Atividade Recente -- */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Defeitos */}
            <div className="border border-border/70 rounded-xl p-4 bg-card/60 backdrop-blur-sm space-y-3 shadow-xs">
              <h2 className="text-sm font-semibold text-foreground">Defeitos por Gravidade</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-lg bg-red-950/20 border border-red-500/20 p-2.5">
                  <div className="text-xs text-red-400 font-semibold uppercase tracking-wider">Críticos</div>
                  <div className="text-xl font-bold text-red-500 mt-1">{metrics.defects.critical}</div>
                </div>
                <div className="rounded-lg bg-orange-950/20 border border-orange-500/20 p-2.5">
                  <div className="text-xs text-orange-400 font-semibold uppercase tracking-wider">Altos</div>
                  <div className="text-xl font-bold text-orange-500 mt-1">{metrics.defects.high}</div>
                </div>
                <div className="rounded-lg bg-amber-950/20 border border-amber-500/20 p-2.5">
                  <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Médios</div>
                  <div className="text-xl font-bold text-amber-500 mt-1">{metrics.defects.medium}</div>
                </div>
                <div className="rounded-lg bg-blue-950/20 border border-blue-500/20 p-2.5">
                  <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">Baixos</div>
                  <div className="text-xl font-bold text-blue-500 mt-1">{metrics.defects.low}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="text-xs text-muted-foreground flex justify-between bg-muted/20 border border-border/40 px-3 py-2 rounded-lg">
                  <span>Defeitos Abertos</span>
                  <span className="font-bold text-red-400">{metrics.defects.open}</span>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between bg-muted/20 border border-border/40 px-3 py-2 rounded-lg">
                  <span>Defeitos Fechados</span>
                  <span className="font-bold text-emerald-400">{metrics.defects.closed}</span>
                </div>
              </div>
            </div>

            {/* Atividade recente */}
            <div className="border border-border/70 rounded-xl p-4 bg-card/60 backdrop-blur-sm space-y-3 shadow-xs">
              <h2 className="text-sm font-semibold text-foreground">Última Atividade Registrada</h2>
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Play className="h-3.5 w-3.5 text-brand" />
                    Última execução
                  </div>
                  <span className="text-xs font-semibold text-foreground">{fmt(metrics.recentActivity.lastExecution)}</span>
                </div>
                <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ClipboardCheck className="h-3.5 w-3.5 text-brand" />
                    Último caso cadastrado
                  </div>
                  <span className="text-xs font-semibold text-foreground">{fmt(metrics.recentActivity.lastCase)}</span>
                </div>
                <div className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/20 border border-border/40">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5 text-brand" />
                    Último plano cadastrado
                  </div>
                  <span className="text-xs font-semibold text-foreground">{fmt(metrics.recentActivity.lastPlan)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* -- Detalhamento por Planos de Teste -- */}
          <div className="border border-border/70 rounded-xl overflow-hidden bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="px-4 py-3 bg-muted/40 border-b border-border/70 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-foreground">Desempenho por Plano de Teste</h2>
              <span className="text-xs text-muted-foreground font-medium">{planBreakdown.length} planos cadastrados</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                    <th className="px-4 py-2.5">Plano de Teste</th>
                    <th className="px-4 py-2.5 text-center">Casos</th>
                    <th className="px-4 py-2.5 text-center">Execuções</th>
                    <th className="px-4 py-2.5 text-center text-emerald-400">Aprovados</th>
                    <th className="px-4 py-2.5 text-center text-red-400">Falhos</th>
                    <th className="px-4 py-2.5 text-right">Taxa de Aprovação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-sm">
                  {planBreakdown.map(p => (
                    <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-md">
                            {p.sequence != null ? `PT-${String(p.sequence).padStart(3, '0')}` : 'PT-001'}
                          </span>
                          <span className="truncate">{p.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{p.casesCount}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{p.execsCount}</td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-500">{p.passed}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-500">{p.failed}</td>
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

          {/* -- Defeitos do Período -- */}
          <div className="border border-border/70 rounded-xl overflow-hidden bg-card/60 backdrop-blur-sm shadow-xs">
            <div className="px-4 py-3 bg-muted/40 border-b border-border/70 flex justify-between items-center">
              <h2 className="text-sm font-semibold text-foreground">Defeitos Registrados</h2>
              <span className="text-xs text-muted-foreground font-medium">{filteredDefects.length} defeitos no período</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                    <th className="px-4 py-2.5">Título / Defeito</th>
                    <th className="px-4 py-2.5 text-center">Severidade</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                    <th className="px-4 py-2.5 text-right">Data de Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-sm">
                  {filteredDefects.slice(0, 10).map(d => (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground truncate max-w-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-md">
                            {d.sequence != null ? `DEF-${String(d.sequence).padStart(3, '0')}` : 'DEF-001'}
                          </span>
                          <span className="truncate">{d.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={
                            d.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20 text-[11px] font-semibold py-0.5' :
                            d.severity === 'high' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20 text-[11px] font-semibold py-0.5' :
                            d.severity === 'medium' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px] font-semibold py-0.5' :
                            'bg-blue-500/10 text-blue-400 border-blue-500/20 text-[11px] font-semibold py-0.5'
                          }
                        >
                          {d.severity === 'critical' ? 'Crítico' : d.severity === 'high' ? 'Alto' : d.severity === 'medium' ? 'Médio' : 'Baixo'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={d.status === 'open' ? 'bg-red-500/10 text-red-400 border-red-500/20 text-[11px] font-semibold' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] font-semibold'}
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
