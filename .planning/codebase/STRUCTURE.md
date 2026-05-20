# Nexus TCMS — Estrutura da Codebase

## Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui (Radix UI) + React Query
- **Backend**: Express (Node.js ESM) + better-sqlite3 (SQLite WAL)
- **Auth**: JWT local via `krg_local_auth_token` em localStorage
- **State global**: `AuthContext`, `ProjectContext`, `PermissionsContext`
- **Alias TS**: `@/` → `src/`
- **Dev servers**: Vite (5173) + Express (4000), proxy `/api` e `/uploads`

## Raiz
```
Krigzis-TCMS/
├── server/          # Backend Express + SQLite
├── src/             # Frontend React
├── public/          # Estáticos + uploads
├── scripts/         # Scripts auxiliares
├── docs/            # Documentação
├── .planning/       # Artefatos de planejamento
└── .windsurf/       # Workflows e regras Windsurf
```

## Backend (`server/`)
```
server/
├── index.js         # Entrada: rotas, migrations, middlewares (909 linhas)
├── db.js            # Wrapper better-sqlite3: getClient(), db, query()
├── schema.sql       # Schema canônico (referência — não aplicado em runtime)
└── lib/
    ├── validation.js # validateRow(), state machines, canTransition*()
    ├── crypto.js     # encrypt/decrypt AES-256-GCM para api_keys
    └── logger.js     # Logger leve
```

### Rotas Express principais
| Método | Path | Descrição |
|--------|------|-----------|
| POST | `/api/auth/login` | Login JWT |
| POST | `/api/auth/register` | Cadastro |
| GET | `/api/auth/session` | Sessão atual |
| POST | `/api/db/query` | SELECT genérico via QueryBuilder |
| POST | `/api/db/mutate` | INSERT/UPDATE/DELETE via QueryBuilder |
| GET | `/api/runs/:id/progress` | Progresso agregado de um TestRun |
| POST | `/api/rpc/:name` | RPC (list_all_users, sync_profiles_from_auth) |
| POST | `/api/reports/aggregate` | Relatórios agregados |
| POST | `/api/storage/upload` | Upload de arquivos |

### Migrations (idempotentes, em `index.js` ~linha 273)
`ALTER TABLE ... ADD COLUMN` para colunas adicionadas após deploy inicial.
Tabelas criadas via `CREATE TABLE IF NOT EXISTS` em runtime se faltarem.

### `filterToTableCols(table, obj)`
Filtra automaticamente campos via `PRAGMA table_info` — qualquer campo presente na tabela é aceito sem código extra.

### State machines backend
- `canTransitionDefect(from, to)` — defects
- `canTransitionRequirement(from, to)` — requirements
- `canTransitionRun(from, to)` — test_runs

## Frontend (`src/`)

### Entrypoint
- `main.tsx` → `App.tsx` → `AppRouter` (Routes)

### `src/types/index.ts` — Tipos principais
| Interface | Campos-chave |
|-----------|-------------|
| `TestPlan` | id, title, status, project_id, sequence?, generated_by_ai |
| `TestCase` | id, plan_id, project_id?, title, priority, type, steps[], assigned_to?, sequence? |
| `TestExecution` | id, case_id, plan_id, run_id?, status, assigned_to?, sequence? |
| `TestRun` | id, title, status, project_id, plan_id?, assigned_to?, starts_at?, ends_at?, sequence? |
| `TestRunProgress` | run, totals{passed,failed,blocked,not_tested,total}, completionRate, passRate |
| `Defect` | id, title, status, severity, assigned_to?, sequence? |
| `Requirement` | id, title, status, priority, sequence? |
| `Project` | id, name, slug, status, color |

### `src/lib/schemas.ts` — Zod + State machines frontend
Enums: `PriorityEnum`, `ExecutionStatusEnum`, `DefectStatusEnum`, `RequirementStatusEnum`, `TestRunStatusEnum`
Schemas: `TestPlanInputSchema`, `TestCaseInputSchema`, `TestExecutionInputSchema`, `DefectInputSchema`, `RequirementInputSchema`, `TestRunInputSchema`
Helpers: `canTransitionDefect()`, `canTransitionRequirement()`, `canTransitionRun()`, `formatZodError()`

### `src/services/`
| Arquivo | Responsabilidade |
|---------|-----------------|
| `supabaseService.ts` | CRUD de plans, cases, executions, defects, requirements, profiles, logs |
| `testRunsService.ts` | CRUD de test_runs + `getRunProgress()` |
| `projectService.ts` | Projetos (getActiveProjects, getById) |
| `apiKeysService.ts` | Chaves de API criptografadas |
| `modelControlService.ts` | Modelos de IA, prompts, geração |
| `reportsService.ts` | Agregação de relatórios |

### `src/integrations/supabase/client.ts`
Implementa o client `supabase` localmente (sem Supabase cloud):
- `supabase.from(table)` → `QueryBuilder` (proxy para `/api/db/query` e `/api/db/mutate`)
- `supabase.auth.*` → endpoints `/api/auth/*`
- `supabase.functions.invoke()` → `/api/reports/aggregate`
- `supabase.storage.from()` → `/api/storage/upload`
- `supabase.rpc(name, params)` → `/api/rpc/:name`

### `src/hooks/`
| Hook | Descrição |
|------|-----------|
| `useAuth` | Usuário logado, signIn/signOut |
| `usePermissions` | Permissões e role (master/admin/manager/tester/viewer) |
| `useProject` | Projeto atual via `ProjectContext` |
| `useProjectUsers` | Lista de perfis para selects de "Interessado" (cache singleton) |
| `useStatusOptions` | Status dinâmicos por projeto |
| `usePaginationUrlSync` | Sincroniza paginação com URL params |
| `useVirtualTableHeight` | Calcula altura para tabelas virtualizadas |
| `useAISettings` | Configurações de IA (modelo padrão, etc.) |

### `src/contexts/`
- `ProjectContext.tsx` — `currentProject`, `projects`, `setCurrentProject`, `refreshProjects`
  - Persiste em `localStorage` via `'krigzis_current_project_id'`
  - Emite `krg:project-changed` (CustomEvent) e `project:changed` (postMessage)

### `src/pages/`
| Página | Rota | Permissão |
|--------|------|-----------|
| `Index.tsx` | `/` | auth |
| `TestPlans.tsx` | `/plans` | can_manage_plans |
| `TestCases.tsx` | `/cases` | can_manage_cases |
| `TestExecutions.tsx` | `/executions` | can_manage_executions |
| `TestRuns.tsx` | `/runs` | can_manage_executions |
| `Gestao.tsx` | `/management` | can_manage_cases \| can_manage_executions |
| `AIGenerator.tsx` | `/ai-generator` | can_use_ai |
| `Reports.tsx` | `/reports` | can_view_reports |
| `History.tsx` | `/history` | auth |
| `Defects.tsx` | (via /management) | can_manage_executions |
| `Requirements.tsx` | (via /management) | can_manage_cases |
| `Coverage.tsx` | (via /management) | — |
| `UserManagement.tsx` | `/user-management` | can_manage_users |
| `ProjectAdmin.tsx` | `/project-admin` | can_manage_projects |
| `ModelControlPanel.tsx` | `/model-control` | can_access_model_control |

### `src/components/`
| Componente | Descrição |
|-----------|-----------|
| `Sidebar.tsx` | Navegação lateral com ícones e permissões |
| `Layout.tsx` | Wrapper com Sidebar + Header |
| `Dashboard.tsx` | Painel principal com métricas |
| `DetailModal.tsx` | Modal de detalhes reutilizável |
| `SearchableCombobox.tsx` | Combobox com busca |
| `StandardButton.tsx` | Botão padronizado (brand/outline/destructive) |
| `ViewModeToggle.tsx` | Toggle cards/lista |
| `StatusManagerModal.tsx` | Gerenciar status dinâmicos |
| `forms/TestPlanForm.tsx` | Form de plano |
| `forms/TestCaseForm.tsx` | Form de caso + assigned_to |
| `forms/TestExecutionForm.tsx` | Form de execução + run_id + assigned_to |
| `forms/AIGeneratorForm.tsx` | Geração IA + run_id + assignedTo |
| `forms/AIBatchGeneratorForm.tsx` | Geração em lote |
| `ui/StatusDot.tsx` | Dot colorido por status |
| `ui/UserAvatar.tsx` | Avatar de usuário |
| `ui/PriorityTag.tsx` | Tag de prioridade |
| `ui/card.tsx` | Card (shadcn) |
| `ui/badge.tsx` | Badge (shadcn) |
| `ui/select.tsx` | Select (Radix) |
| `ui/dialog.tsx` | Dialog (Radix) |
| `ui/alert-dialog.tsx` | AlertDialog (Radix) |

## Schema SQLite (tabelas relevantes)

### `test_runs`
```sql
id TEXT PRIMARY KEY
title TEXT NOT NULL
description TEXT DEFAULT ''
status TEXT DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','aborted'))
project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE
plan_id TEXT REFERENCES test_plans(id) ON DELETE SET NULL
assigned_to TEXT REFERENCES profiles(id)
starts_at TEXT
ends_at TEXT
created_by TEXT REFERENCES profiles(id)
sequence INTEGER
created_at TEXT
updated_at TEXT
```

### `test_executions` (campos adicionados)
```sql
run_id TEXT REFERENCES test_runs(id) ON DELETE SET NULL
assigned_to TEXT REFERENCES profiles(id)
```

### `test_cases` (campos adicionados)
```sql
project_id TEXT REFERENCES projects(id) ON DELETE CASCADE
assigned_to TEXT REFERENCES profiles(id)
```

## Padrões visuais
- **ID badge**: `RUN-001`, `PT-001`, `CT-001`, `EXE-001` via `sequence.padStart(3,'0')`
- **Cards**: `Card` + `CardHeader` + `CardContent` + classe `card-hover`
- **Status**: `StatusDot` com mapeamento em `DOT_CLASS`
- **Usuário**: `UserAvatar userId={id}`
- **Datas**: `formatLocalDate()` / `formatLocalDateTime()` (fuso America/Sao_Paulo)
- **Notificação**: `useToast()` (shadcn) + `toast({title, description, variant})`
- **Botões**: `StandardButton variant="brand|outline|destructive"`
- **Draft**: `localStorage` key `draft:{entidade}:{new|edit}:{id?}:{userId}:{projectId}`

## Constantes
- `TOKEN_KEY = 'krg_local_auth_token'`
- `API_URL = import.meta.env.VITE_API_URL || '/api'`
- `SHARED_DATA = import.meta.env.VITE_SHARED_DATA ?? 'true'` (controla filtro por user_id)
- `SINGLE_TENANT = import.meta.env.VITE_SINGLE_TENANT ?? 'true'` (permissões)

## Notificações para assigned_to
Padrão: inserir via `supabase.from('notifications').insert({...})` quando `assigned_to` muda.
Campos: `user_id` (destinatário), `title`, `body`, `link`.
Implementado em: `TestExecutionForm`, `TestCaseForm`, `AIGeneratorForm`, `Defects.tsx`.
