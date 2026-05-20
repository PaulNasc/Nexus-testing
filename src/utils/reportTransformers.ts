import { ExportData } from './export';
import {
  Priority,
  TestCaseType,
  ExecutionStatus,
  priorityLabel,
  testCaseTypeLabel,
  executionStatusLabel,
} from '@/lib/labels';

export type TransformFormat = 'csv' | 'excel' | 'json';

// Tipos mínimos necessários para transformação
export interface TestCaseMinimal {
  id: string;
  title?: string;
  priority?: Priority | null;
  type?: TestCaseType | null;
  created_at?: string | null;
  updated_at?: string | null;
  user_id?: string | null;
}

export interface TestPlanMinimal {
  id: string;
  title?: string;
}

export interface ExecutionMinimal {
  case_id: string | null;
  plan_id: string | null;
  status: ExecutionStatus;
  executed_at?: string | null;
  executed_by?: string | null;
  notes?: string | null;
}

export interface TrendSeries {
  bucket: string;
  passed: number;
  failed: number;
  blocked: number;
  not_tested: number;
  total: number;
}

export interface TrendAnalysisData {
  series?: TrendSeries[];
  totals?: {
    passed?: number;
    failed?: number;
    blocked?: number;
    not_tested?: number;
    total?: number;
  };
  granularity?: string;
}

export interface FailureCase { id: string; title?: string; count?: number; }
export interface FailurePlan { id: string; title?: string; count?: number; }
export interface FailureAnalysisData {
  totals?: {
    totalExecutions?: number;
    failedExecutions?: number;
    failureRate?: number;
    lastFailedAt?: string | null;
  };
  topCases?: FailureCase[];
  topPlans?: FailurePlan[];
}

export interface RequirementsDefectsData {
  totals?: { requirements?: number; defects?: number };
  requirementsByStatus?: Record<string, number>;
  requirementsByPriority?: Record<string, number>;
  defectsBySeverity?: Record<string, number>;
  defectsByStatus?: Record<string, number>;
}

export interface TransformContext {
  cases?: TestCaseMinimal[];
  plans?: TestPlanMinimal[];
  executions?: ExecutionMinimal[];
  userMap?: Record<string, string>;
}

// Type guards e conversores seguros para enums string
const isPriority = (v: unknown): v is Priority => typeof v === 'string' && ['low','medium','high','critical'].includes(v);
const toPriority = (v: unknown): Priority => (isPriority(v) ? v : 'low');

const isTestCaseType = (v: unknown): v is TestCaseType => typeof v === 'string' && [
  'functional','integration','performance','security','usability'
].includes(v);
const toTestCaseType = (v: unknown): TestCaseType => (isTestCaseType(v) ? v : 'functional');

const isExecutionStatus = (v: unknown): v is ExecutionStatus => typeof v === 'string' && [
  'passed','failed','blocked','not_tested'
].includes(v);
const toExecutionStatus = (v: unknown): ExecutionStatus => (isExecutionStatus(v) ? v : 'not_tested');

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('pt-BR');
};

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('pt-BR');
};

const getCaseTitle = (id: string | null | undefined, ctx?: TransformContext) => {
  if (!id) return '';
  const title = ctx?.cases?.find((c) => c.id === id)?.title;
  return title || `Caso ${String(id).slice(0, 8)}`;
};

const getPlanTitle = (id: string | null | undefined, ctx?: TransformContext) => {
  if (!id) return '';
  const title = ctx?.plans?.find((p) => p.id === id)?.title;
  return title || `Plano ${String(id).slice(0, 8)}`;
};

const mapUser = (id?: string | null, ctx?: TransformContext) => {
  if (!id) return '';
  const name = ctx?.userMap?.[id];
  // Retornar apenas o nome; se não houver mapeamento, vazio (não exibir ID nem prefixo)
  return name || '';
};

// Conversor genérico para formato tabular (CSV/Excel)
type TableLike = { headers: string[]; rows: unknown[][]; title?: string };
const isTableLike = (d: unknown): d is TableLike => {
  if (!d || typeof d !== 'object') return false;
  const obj = d as Record<string, unknown>;
  return Array.isArray(obj.headers) && Array.isArray(obj.rows);
};

const toTabular = (data: unknown, title: string = 'Exportação', ctx?: TransformContext): ExportData => {
  // Tradução de chaves para cabeçalhos PT-BR
  const keyMap: Record<string, string> = {
    id: 'ID',
    title: 'Título',
    priority: 'Prioridade',
    type: 'Tipo',
    status: 'Status',
    created_at: 'Criado em',
    updated_at: 'Atualizado em',
    executed_at: 'Executado em',
    executed_by: 'Executado por',
    notes: 'Observações',
    plan_id: 'Plano',
    case_id: 'Caso',
    user_id: 'Usuário',
    severity: 'Severidade',
    description: 'Descrição',
    generated_by_ai: 'Gerado por IA',
    granularity: 'Granularidade',
    passed: 'Aprovadas',
    failed: 'Reprovadas',
    blocked: 'Bloqueadas',
    not_tested: 'Não testadas',
    total: 'Total',
  };

  const translateKey = (k: string) => keyMap[k] || k;

  const formatValueByKey = (k: string, v: unknown) => {
    if (v === null || v === undefined) return '';
    // Mapeamentos específicos
    if (k === 'case_id') return getCaseTitle(v as string, ctx);
    if (k === 'plan_id') return getPlanTitle(v as string, ctx);
    if (k === 'user_id' || k === 'executed_by') return mapUser(v as string, ctx);
    if (k === 'priority') return priorityLabel(toPriority(v));
    if (k === 'type') return testCaseTypeLabel(toTestCaseType(v));
    if (k === 'status') return executionStatusLabel(toExecutionStatus(v));
    if (k === 'executed_at') return formatDateTime(String(v));
    if (k === 'created_at' || k === 'updated_at') return formatDate(String(v));
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  };

  // Caso seja uma tabela já pronta
  if (isTableLike(data)) {
    return { headers: data.headers, rows: data.rows as (string | number | boolean | null)[][], title: data.title || title };
  }

  // Array (objetos/valores) -> unifica chaves e insere coluna sequencial
  if (Array.isArray(data)) {
    const allKeys = Array.from(
      data.reduce<Set<string>>((set, item) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          Object.keys(item as Record<string, unknown>).forEach((k) => set.add(k));
        } else {
          set.add('valor');
        }
        return set;
      }, new Set())
    );

    // Preferência: remover ID técnico e usar coluna '#'
    const keys = allKeys.filter((k) => k !== 'id');

    // Cabeçalhos traduzidos com coluna '#'
    const headers = ['#', ...(keys.length ? keys.map(translateKey) : ['Valor'])];

    const rows = data.map((item, idx) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        const rowValues = keys.length
          ? keys.map((k) => formatValueByKey(k, obj[k]))
          : [String(item)];
        return [idx + 1, ...rowValues];
      }
      return [idx + 1, item];
    });
    return { headers, rows: rows as (string | number | boolean | null)[][], title };
  }

  // Objeto simples -> chave/valor (traduz chave e formata valor)
  if (data && typeof data === 'object') {
    const headers = ['Propriedade', 'Valor'];
    const rows: (string | number | boolean | null)[][] = Object
      .entries(data as Record<string, unknown>)
      .map(([k, v]) => [translateKey(k), formatValueByKey(k, v) as string | number | boolean | null]);
    return { headers, rows, title };
  }

  // Primitivo
  return { headers: ['Valor'], rows: [[String(data)]], title };
};

// Execução - Status
const transformExecutionStatus = (data: ExecutionMinimal[], ctx?: TransformContext): ExportData => {
  // Removida coluna "Observações" e garantido nome do usuário sem prefixos/IDs
  const headers = ['#', 'Caso', 'Plano', 'Status', 'Executado em', 'Executado por'];
  const rows = data.map((exec, idx) => [
    idx + 1,
    getCaseTitle(exec.case_id, ctx),
    getPlanTitle(exec.plan_id, ctx),
    executionStatusLabel(exec.status),
    formatDateTime(exec.executed_at || undefined),
    mapUser(exec.executed_by, ctx),
  ]);
  return { headers, rows, title: 'Status de Execuções' };
};

// Casos - Prioridade
const transformTestPriority = (data: TestCaseMinimal[], ctx?: TransformContext): ExportData => {
  const headers = ['#', 'Título', 'Prioridade', 'Tipo', 'Criado em', 'Atualizado em', 'Autor'];
  const rows = data.map((tc, idx) => [
    idx + 1,
    tc.title || '',
    priorityLabel(toPriority(tc.priority)),
    testCaseTypeLabel(toTestCaseType(tc.type)),
    formatDate(tc.created_at || undefined),
    formatDate(tc.updated_at || undefined),
    mapUser(tc.user_id || null, ctx),
  ]);
  return { headers, rows, title: 'Distribuição por Prioridade' };
};

// Análise de Tendências
const transformTrendAnalysisCSV = (data: TrendAnalysisData): ExportData => {
  const headers = ['Período', 'Aprovadas', 'Reprovadas', 'Bloqueadas', 'Não testadas', 'Total'];
  const series: TrendSeries[] = data?.series || [];
  const rows = series.map((s) => [s.bucket, s.passed, s.failed, s.blocked, s.not_tested, s.total]);
  return { headers, rows, title: 'Análise de Tendências' };
};

const transformTrendAnalysisJSON = (data: TrendAnalysisData) => {
  return {
    tipo: 'analise-de-tendencias',
    geradoEm: new Date().toISOString(),
    dados: {
      series: (data?.series || []).map((s) => ({
        periodo: s.bucket,
        aprovadas: s.passed,
        reprovadas: s.failed,
        bloqueadas: s.blocked,
        nao_testadas: s.not_tested,
        total: s.total,
      })),
      totais: {
        aprovadas: data?.totals?.passed ?? 0,
        reprovadas: data?.totals?.failed ?? 0,
        bloqueadas: data?.totals?.blocked ?? 0,
        nao_testadas: data?.totals?.not_tested ?? 0,
        total: data?.totals?.total ?? 0,
      },
      granularidade: data?.granularity,
    },
  };
};

// Análise de Falhas
const transformFailureAnalysisCSV = (data: FailureAnalysisData, ctx?: TransformContext): ExportData => {
  const headers = ['#', 'Caso', 'Falhas'];
  const topCases: Array<{ id: string; title?: string; count?: number }> = data?.topCases || [];
  const rows = topCases.map((c, idx) => [
    idx + 1,
    c.title || getCaseTitle(c.id, ctx),
    c.count ?? 0,
  ]);
  return { headers, rows, title: 'Análise de Falhas - Top Casos' };
};

const transformFailureAnalysisJSON = (data: FailureAnalysisData, ctx?: TransformContext) => {
  return {
    tipo: 'analise-de-falhas',
    geradoEm: new Date().toISOString(),
    dados: {
      totais: {
        total_execucoes: data?.totals?.totalExecutions ?? 0,
        execucoes_reprovadas: data?.totals?.failedExecutions ?? 0,
        taxa_falhas: data?.totals?.failureRate ?? 0,
        ultima_reprovada_em: data?.totals?.lastFailedAt || null,
      },
      top_casos: (data?.topCases || []).map((c) => ({
        id: c.id,
        titulo: c.title || getCaseTitle(c.id, ctx),
        falhas: c.count ?? 0,
      })),
      top_planos: (data?.topPlans || []).map((p) => ({
        id: p.id,
        titulo: p.title || getPlanTitle(p.id, ctx),
        falhas: p.count ?? 0,
      })),
    },
  };
};

// Requisitos e Defeitos
const transformRequirementsDefectsCSV = (data: RequirementsDefectsData): ExportData => {
  const headers = ['Categoria', 'Chave', 'Valor'];
  const rows: (string | number | boolean | null)[][] = [];

  const pushGroup = (categoria: string, obj: Record<string, number> | undefined | null) => {
    if (!obj) return;
    Object.entries(obj).forEach(([chave, valor]) => {
      rows.push([categoria, chave, valor]);
    });
  };

  pushGroup('Requisitos por Status', data?.requirementsByStatus);
  pushGroup('Requisitos por Prioridade', data?.requirementsByPriority);
  pushGroup('Defeitos por Severidade', data?.defectsBySeverity);
  pushGroup('Defeitos por Status', data?.defectsByStatus);

  return { headers, rows, title: 'Requisitos e Defeitos' };
};

const transformRequirementsDefectsJSON = (data: RequirementsDefectsData) => {
  return {
    tipo: 'requisitos-e-defeitos',
    geradoEm: new Date().toISOString(),
    dados: {
      totais: {
        requisitos: data?.totals?.requirements ?? 0,
        defeitos: data?.totals?.defects ?? 0,
      },
      requisitos_por_status: data?.requirementsByStatus || {},
      requisitos_por_prioridade: data?.requirementsByPriority || {},
      defeitos_por_severidade: data?.defectsBySeverity || {},
      defeitos_por_status: data?.defectsByStatus || {},
    },
  };
};

export function transformReportForExport(
  reportType: string,
  reportData: unknown,
  format: TransformFormat,
  ctx?: TransformContext,
): ExportData | unknown | null {
  switch (reportType) {
    case 'execution-status':
      if (format === 'json') {
        // JSON: exporta lista de execuções com campos traduzidos
        const table = transformExecutionStatus((reportData as ExecutionMinimal[]) || [], ctx);
        const [h, ...r] = [table.headers, ...table.rows];
        return { tipo: 'status-de-execucoes', geradoEm: new Date().toISOString(), cabecalhos: h, linhas: r };
      }
      return transformExecutionStatus((reportData as ExecutionMinimal[]) || [], ctx);

    case 'test-priority':
      if (format === 'json') {
        const table = transformTestPriority((reportData as TestCaseMinimal[]) || [], ctx);
        const [h, ...r] = [table.headers, ...table.rows];
        return { tipo: 'prioridade-de-testes', geradoEm: new Date().toISOString(), cabecalhos: h, linhas: r };
      }
      return transformTestPriority((reportData as TestCaseMinimal[]) || [], ctx);

    case 'trend-analysis':
      if (format === 'json') return transformTrendAnalysisJSON((reportData as TrendAnalysisData) || {});
      return transformTrendAnalysisCSV((reportData as TrendAnalysisData) || {});

    case 'failure-analysis':
      if (format === 'json') return transformFailureAnalysisJSON((reportData as FailureAnalysisData) || {}, ctx);
      return transformFailureAnalysisCSV((reportData as FailureAnalysisData) || {}, ctx);

    case 'requirements-defects':
      if (format === 'json') return transformRequirementsDefectsJSON((reportData as RequirementsDefectsData) || {});
      return transformRequirementsDefectsCSV((reportData as RequirementsDefectsData) || {});

    // Relatórios adicionais: usar transformação genérica
    case 'ai-generation': {
      if (format === 'json') {
        return {
          tipo: 'geracao-ia',
          geradoEm: new Date().toISOString(),
          dados: reportData,
        };
      }
      return toTabular(reportData, 'Geração por IA', ctx);
    }

    case 'raw-data-export': {
      if (format === 'json') {
        return {
          tipo: 'dados-brutos',
          geradoEm: new Date().toISOString(),
          dados: reportData,
        };
      }
      return toTabular(reportData, 'Dados Brutos', ctx);
    }

    case 'performance-metrics':
    case 'quality-metrics':
    case 'execution-details': {
      if (format === 'json') {
        return {
          tipo: reportType,
          geradoEm: new Date().toISOString(),
          dados: reportData,
        };
      }
      return toTabular(reportData, 'Relatório', ctx);
    }

    default:
      // Fallback seguro para formatos não mapeados
      if (format === 'json') {
        return {
          tipo: reportType,
          geradoEm: new Date().toISOString(),
          dados: reportData,
        };
      }
      return toTabular(reportData, 'Relatório', ctx);
  }
}
