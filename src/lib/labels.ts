export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type RequirementStatus = 'open' | 'in_progress' | 'approved' | 'deprecated';
export type DefectStatus = 'open' | 'in_analysis' | 'fixed' | 'validated' | 'closed';
export type ExecutionStatus = 'passed' | 'failed' | 'blocked' | 'not_tested';
export type TestCaseType = 'functional' | 'integration' | 'performance' | 'security' | 'usability';

export const priorityLabel = (p: Priority) => ({
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
}[p] || p);

export const priorityBadgeClass = (p: Priority) => ({
  low: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  high: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
  critical: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
}[p] || 'bg-muted/50 text-muted-foreground border border-border/50');

export const severityLabel = priorityLabel;
export const severityBadgeClass = priorityBadgeClass;

export const requirementStatusLabel = (s: RequirementStatus) => ({
  open: 'Aberto',
  in_progress: 'Em andamento',
  approved: 'Aprovado',
  deprecated: 'Obsoleto',
}[s] || s);

export const requirementStatusBadgeClass = (s: RequirementStatus) => ({
  open: 'bg-muted/50 text-muted-foreground border border-border/50',
  in_progress: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  deprecated: 'bg-slate-500/10 text-slate-500 border border-slate-500/20',
}[s] || 'bg-muted/50 text-muted-foreground border border-border/50');

export const defectStatusLabel = (s: DefectStatus) => ({
  open: 'Aberto',
  in_analysis: 'Em análise',
  fixed: 'Corrigido',
  validated: 'Validado',
  closed: 'Fechado',
}[s] || s);

export const defectStatusBadgeClass = (s: DefectStatus) => ({
  open: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  in_analysis: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  fixed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  validated: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  closed: 'bg-muted/50 text-muted-foreground border border-border/50',
}[s] || 'bg-muted/50 text-muted-foreground border border-border/50');

export const testCaseTypeLabel = (t: TestCaseType) => ({
  functional: 'Funcional',
  integration: 'Integração',
  performance: 'Desempenho',
  security: 'Segurança',
  usability: 'Usabilidade',
}[t] || (t as string));

export const testCaseTypeBadgeClass = (t: TestCaseType) => ({
  functional: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20',
  integration: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  performance: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  security: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  usability: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20',
}[t] || 'bg-muted/50 text-muted-foreground border border-border/50');

// Execuções de Teste
export const executionStatusLabel = (s: ExecutionStatus) => ({
  passed: 'Aprovado',
  failed: 'Reprovado',
  blocked: 'Bloqueado',
  not_tested: 'Não Testado',
}[s] || (s as string));

export const executionStatusBadgeClass = (s: ExecutionStatus) => ({
  passed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  blocked: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  not_tested: 'bg-muted/50 text-muted-foreground border border-border/50',
}[s] || 'bg-muted/50 text-muted-foreground border border-border/50');
