/**
 * Nexus Modular Architecture & Feature Catalog
 * Permite ligar/desligar módulos por projeto, organização ou plano de assinatura.
 */

export type ModuleKey =
  | 'core_testing'
  | 'quality_management'
  | 'ai_assistant'
  | 'advanced_analytics'
  | 'audit_history'
  | 'error_reporting';

export interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  description: string;
  category: 'core' | 'qa' | 'ai' | 'analytics' | 'governance' | 'observability';
  icon: string;
  defaultEnabled: boolean;
  requires?: ModuleKey[];
  paths: string[];
}

export const MODULE_CATALOG: Record<ModuleKey, ModuleDefinition> = {
  core_testing: {
    key: 'core_testing',
    name: 'Gestão de Testes Central',
    description: 'Gerenciamento estruturado de Planos, Casos, Execuções e Ciclos de Teste.',
    category: 'core',
    icon: 'FileCheck',
    defaultEnabled: true,
    paths: ['/plans', '/cases', '/executions', '/runs'],
  },
  quality_management: {
    key: 'quality_management',
    name: 'Gestão da Qualidade & Rastreabilidade',
    description: 'Gestão de Requisitos, Matriz de Rastreabilidade bidirecional e Defeitos.',
    category: 'qa',
    icon: 'Link2',
    defaultEnabled: true,
    requires: ['core_testing'],
    paths: ['/management', '/requirements', '/defects', '/traceability', '/coverage'],
  },
  ai_assistant: {
    key: 'ai_assistant',
    name: 'Inteligência Artificial & Model Control',
    description: 'Geração automatizada de testes com múltiplos provedores de LLM e painel de modelos.',
    category: 'ai',
    icon: 'Sparkles',
    defaultEnabled: true,
    requires: ['core_testing'],
    paths: ['/ai-generator', '/model-control'],
  },
  advanced_analytics: {
    key: 'advanced_analytics',
    name: 'Relatórios & Métricas Avançadas',
    description: 'Analytics de qualidade, taxas de aprovação e exportações multi-formato (PDF, XLSX, DOC).',
    category: 'analytics',
    icon: 'BarChart3',
    defaultEnabled: true,
    requires: ['core_testing'],
    paths: ['/reports'],
  },
  audit_history: {
    key: 'audit_history',
    name: 'Histórico & Auditoria de Atividades',
    description: 'Rastreabilidade de todas as alterações, criações e execuções realizadas no sistema.',
    category: 'governance',
    icon: 'Clock',
    defaultEnabled: true,
    paths: ['/history'],
  },
  error_reporting: {
    key: 'error_reporting',
    name: 'Error Reporting & Telemetria em Tempo Real',
    description: 'Widget de reporte de erros e feedback com captura instantânea de logs e tela.',
    category: 'observability',
    icon: 'Bug',
    defaultEnabled: true,
    paths: [],
  },
};

export type PlanTier = 'starter' | 'pro' | 'enterprise';

export const TIER_MODULE_PRESETS: Record<PlanTier, Record<ModuleKey, boolean>> = {
  starter: {
    core_testing: true,
    quality_management: false,
    ai_assistant: false,
    advanced_analytics: false,
    audit_history: true,
    error_reporting: true,
  },
  pro: {
    core_testing: true,
    quality_management: true,
    ai_assistant: true,
    advanced_analytics: true,
    audit_history: true,
    error_reporting: true,
  },
  enterprise: {
    core_testing: true,
    quality_management: true,
    ai_assistant: true,
    advanced_analytics: true,
    audit_history: true,
    error_reporting: true,
  },
};
