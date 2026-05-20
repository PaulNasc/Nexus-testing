# Nexus TCMS — Fluxo de Dados

## Fluxo de autenticação
```
Login.tsx
  → supabase.auth.signInWithPassword()
  → POST /api/auth/login
  → bcrypt.compare() + jwt.sign()
  → token salvo em localStorage ('krg_local_auth_token')
  → AuthContext.user atualizado via onAuthStateChange
```

## Fluxo de leitura (SELECT)
```
Componente
  → supabase.from('tabela').select('*').eq(...).order(...)
  → QueryBuilder.execute()
  → POST /api/db/query { table, filters, order, columns }
  → filterToTableCols() + buildWhere() + SQL SELECT
  → normalizeRows() (parse JSON, datas)
  → { data: rows[], error: null }
```

## Fluxo de escrita (INSERT/UPDATE/DELETE)
```
Componente
  → supabase.from('tabela').insert/update/delete(payload)
  → QueryBuilder.execute()
  → POST /api/db/mutate { table, action, values, filters }
  → validateRow(table, values)         ← validação campo a campo
  → [UPDATE] canTransition*(from, to)  ← state machine (defects/requirements/test_runs)
  → filterToTableCols()                ← filtra campos que existem na tabela
  → serializeForDb()                   ← converte arrays/objects para JSON strings
  → SQL INSERT/UPDATE/DELETE RETURNING *
  → { data: rows[], error: null }
```

## Fluxo de TestRun (Ciclo de Execução)

### Criar ciclo
```
TestRuns.tsx (handleSave)
  → TestRunInputSchema.safeParse(payload)   ← validação Zod
  → createTestRun(parsed.data)
  → supabase.from('test_runs').insert(...)
  → POST /api/db/mutate { table: 'test_runs', action: 'insert', values: {...} }
  → validateRow('test_runs', row)
  → INSERT INTO test_runs (...) RETURNING *
```

### Atualizar status do ciclo
```
TestRuns.tsx (handleSave, edit mode)
  → canTransitionRun(prev.status, form.status)   ← checagem frontend
  → updateTestRun(id, patch)
  → POST /api/db/mutate { action: 'update' }
  → [backend] canTransitionRun(r.status, values.status)  ← checagem backend (dupla)
  → UPDATE test_runs SET ... WHERE id = ?
```

### Progresso do ciclo
```
TestRuns.tsx (loadRuns)
  → getRunProgress(runId)
  → GET /api/runs/:id/progress
  → SELECT status, COUNT(*) FROM test_executions WHERE run_id = ? GROUP BY status
  → { run, totals: {passed,failed,blocked,not_tested,total}, completionRate, passRate }
```

## Fluxo de assigned_to + notificação

### Ao criar/atualizar com assigned_to
```
TestCaseForm / TestExecutionForm / TestRuns / AIGeneratorForm
  → createTestCase/createTestExecution/createTestRun({ ..., assigned_to: userId })
  → [backend] filterToTableCols() inclui assigned_to automaticamente
  → [frontend] sendStakeholderNotification(userId, entityId, entityTitle)
      → supabase.from('notifications').insert({
          user_id: assignedUserId,
          title: 'Você foi adicionado como interessado',
          body: `${entityType}: ${title}`,
          link: '/path'
        })
```

## Fluxo de geração com IA
```
AIGeneratorForm (generateWithAI)
  → ModelControlService.generateWithAI(task, prompt, model)
  → API do provedor (Gemini/OpenAI/etc.)
  → Parseia JSON gerado
  → Para 'case': createTestCase({ ..., assigned_to: formData.assignedTo })
  → Para 'execution': createTestExecution({ ..., run_id: formData.runId, assigned_to: formData.assignedTo })
  → sendStakeholderNotification() se assigned_to preenchido
```

## Contexto de projeto
```
ProjectContext
  → localStorage 'krigzis_current_project_id' (persiste seleção)
  → CustomEvent 'krg:project-changed' (sincroniza tabs)
  → postMessage 'project:changed' (sincroniza iframes/Studio)
  → queryClient.invalidateQueries() ao trocar projeto (força reload)
```

## Sequência automática (sequence)
```
[backend] INSERT INTO tabela
  → trigger simulado: MAX(sequence) + 1 por project_id
  → Gerado em getTableCols() / normalizeRows()
  → Formato exibição: PT-001, CT-001, EXE-001, RUN-001
```

## Filtro por usuário vs. compartilhado
```
VITE_SHARED_DATA=true  → withUserScope() NÃO adiciona .eq('user_id', userId)
                         → Todos veem todos os dados do projeto
VITE_SHARED_DATA=false → withUserScope() adiciona filtro por user_id
```

## Permissões
```
usePermissions()
  → VITE_SINGLE_TENANT=true → força permissões de 'master' (tudo liberado)
  → VITE_SINGLE_TENANT=false → carrega de user_permissions via /api/db/query
PermissionGuard requiredPermission="can_*"
  → Bloqueia rota se usuário não tiver a permissão
```
