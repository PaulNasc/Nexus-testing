# Changelog

Todas as mudanças notáveis neste projeto são documentadas aqui.

## 2026-05 — Refactor de Segurança, Performance e Qualidade

- security: JWT secret com validação de tamanho mínimo (32 chars) no boot; sem fallback inseguro em produção
- security: CORS restrito via `ALLOWED_ORIGINS` no `.env`; headers de segurança adicionados (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`)
- security: Rate limiting em `/api/auth/*` (10 req / 15 min via `express-rate-limit`)
- security(api-keys): API keys de LLMs migradas de `localStorage` para backend criptografado (AES-256-GCM, tabela `api_keys`); endpoints `/api/ai/keys` com scoping por usuário
- perf: Índices SQLite adicionados para notificações, defeitos, rastreabilidade e casos por status
- perf: Polling de notificações otimizado para 10 s com pausa automática quando aba está oculta (`visibilitychange`)
- perf: Lazy loading de rotas pesadas com `React.lazy` + `Suspense`, reduzindo bundle inicial
- validation: Schemas Zod em `src/lib/schemas.ts` para validação no frontend
- validation: Validação de payload e state machine de status (defects/requirements) no endpoint `/api/db/mutate`
- chore(cleanup): Removido `supabase/`, `context/`, `bun.lockb`, `apps/ai/`, scripts legados
- chore(cleanup): Removidas dependências não utilizadas: `firebase`, `@types/jspdf`, `@supabase/supabase-js`
- chore(cleanup): Removido `assets/` (ferramentas de geração de ícones, já em `public/`)
- chore(cleanup): Removido `public/design/` (pasta vazia de mockups)
- docs: Guias atualizados para refletir stack atual (SQLite/Express, sem Supabase)
- test: Smoke tests do Playwright reescritos — healthcheck, login UI, redirect, auth 401

## 2025-09-12 — Integrações de Defeitos e Indicadores na Matriz

- feat(traceability): indicadores compactos na Matriz
  - Pílulas apenas com ícone + contador (sem os textos "vínculos/defeitos").
  - Tamanhos "rentes" e padrão (altura reduzida, padding menor, borda discreta).
  - Aplicado tanto no modo Cards quanto no modo Lista em `src/pages/TraceabilityMatrix.tsx`.
- feat(defects): filtro ampliado na aba Defeitos
  - Considera defeitos vinculados por `execution_id` cujo `case_id` pertença aos casos filtrados via `?cases=...` na navegação a partir da Matriz.
  - Implementado em `src/pages/Defects.tsx`, com mapa `execution_id -> case_id` carregado por projeto.
- feat(defects): formulário com novos campos de vínculo
  - Campos opcionais para selecionar Caso e Execução (com carregamento das execuções ao escolher o caso).
  - Persistência de `case_id` e `execution_id` no create/update.
- ui(buttons): `StandardButton` padronizado
  - Animações de `hover/active`.
  - Variant `brand` com gradiente.
  - Melhor suporte a `iconOnly` (tamanho fixo consistente).
- ui(listas de Gestão): padronização visual
  - Cabeçalhos e colunas consistentes, centralização, toolbar com seletor de modo.
  - Botão `+ Novo` com variant brand; cards com overflow fix; ações compactas.
- chore(cleanup): remoção de To-Do e Organizações
  - Exclusão de componentes, hooks e serviços legados (To-Do/Organizations).
  - Migração Supabase: `supabase/migrations/20250910_drop_todo_and_organizations.sql`.
  - Migração de integridade relacional: `supabase/migrations/20250906_enforce_fk_integrity_test_entities.sql`.
- docs/assets: inclusão de materiais auxiliares
  - Ícones e assets em `assets/` e `public/app-icon.svg`.
  - Documentos de contexto em `context/`.
- security: verificação rápida de segredos
  - Sem chaves/API hardcoded detectadas em código-fonte.
  - Integrações usam variáveis de ambiente (ex.: Supabase `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  - Funções Edge utilizam `Deno.env` para secrets.

### Mudanças potencialmente impactantes
- Remoção definitiva dos domínios To-Do e Organizações.
  - Requer aplicar as migrações mencionadas antes de subir para produção.

### Passos de atualização
1. Garantir variáveis de ambiente configuradas (`.env.local` / secrets do deploy):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
2. Aplicar migrações do Supabase:
   - `20250906_enforce_fk_integrity_test_entities.sql`
   - `20250910_drop_todo_and_organizations.sql`
3. Build do projeto e smoke tests da Matriz e da aba Defeitos:
   - Verificar indicadores (cards e lista) e a navegação com `?cases=...`.
   - Criar/editar defeitos com Caso/Execução vinculados.
