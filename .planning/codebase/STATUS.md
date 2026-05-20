# Nexus TCMS — Status de Implementação

## Funcionalidades completas

### Core (pré-existente)
- [x] Autenticação JWT local (login, register, reset-password)
- [x] Gestão de projetos (CRUD, status, color, icon)
- [x] Planos de teste (CRUD, status dinâmico, AI, PDF export)
- [x] Casos de teste (CRUD, steps, prioridade, tipo, AI)
- [x] Execuções de teste (CRUD, status, AI)
- [x] Defeitos (CRUD, state machine, assigned_to, notificação)
- [x] Requisitos (CRUD, state machine, vínculos com casos)
- [x] Cobertura (matriz de rastreabilidade)
- [x] Relatórios (trend analysis, failure analysis, etc.)
- [x] Histórico de atividades
- [x] Gestão de usuários e permissões
- [x] Model Control Panel (multi-provider AI)
- [x] Geração em lote com IA (AIBatchGeneratorForm)
- [x] Sidebar com ícones e permissões

### Fase TestRuns (implementada na sessão anterior)
- [x] Schema `test_runs` (BD + migrations idempotentes)
- [x] Campos `assigned_to` em `test_cases` e `test_executions` (BD + migrations)
- [x] Campo `run_id` em `test_executions` (schema original já tinha)
- [x] Tipos TS: `TestRun`, `TestRunProgress`, `TestRunStatus`
- [x] Tipos TS: `assigned_to` em `TestCase`, `TestExecution`
- [x] Zod schema: `TestRunInputSchema`, `TestRunStatusEnum`
- [x] State machine frontend: `canTransitionRun()`
- [x] State machine backend: `canTransitionRun()` em `validation.js`
- [x] State machine backend: aplicado no UPDATE de `test_runs`
- [x] Serviço `testRunsService.ts` (list, get, create, update, delete, progress)
- [x] Endpoint `GET /api/runs/:id/progress`
- [x] Página `TestRuns.tsx` (cards + lista + form + delete confirm)
- [x] Rota `/runs` em `App.tsx` (lazy, PermissionGuard can_manage_executions)
- [x] Sidebar: item "Ciclos" com ícone `Repeat` (amber-400)
- [x] `StatusDot`: mapped `planned` e `aborted`
- [x] Hook `useProjectUsers` (cache singleton, "(Eu)" no topo)
- [x] `TestExecutionForm`: campos `run_id` + `assigned_to` + notificação
- [x] `TestCaseForm`: campo `assigned_to` + notificação
- [x] `AIGeneratorForm`: campos `runId` + `assignedTo` + notificação

## Bugs conhecidos / pontos de atenção
- Erros TypeScript pré-existentes em `ActivityLogPanel.tsx`, `History.tsx`,
  `TraceabilityMatrix.tsx`, `databaseSetupService.ts` (não introduzidos por esta fase)
- `getTestPlans(userId, projectId)` — o `userId` pode ser `undefined` em alguns calls;
  função aceita graciosamente via `withUserScope()`
- `supabase.from('test_runs' as any)` — cast necessário pois o tipo gerado do
  QueryBuilder não conhece a tabela (client é local, não gerado pelo Supabase CLI)

## Próximos passos sugeridos
- Validação funcional completa (restart backend, testar ciclo end-to-end)
- Exportação de ciclos em PDF/ZIP (padrão dos planos)
- Dashboard: cards de resumo de ciclos (runs ativos, taxa de aprovação)
- TestExecutions: filtro por run_id para ver execuções de um ciclo
- Notificações: UI de listagem de notificações (sino no header)
- DetailModal: suporte a TestRun (visualização detalhada com progresso)
