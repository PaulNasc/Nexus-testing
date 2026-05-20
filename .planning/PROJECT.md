# Nexus Testing — PROJECT.md

## O que é

**Nexus Testing** é um TCMS (Test Case Management System) self-hosted, moderno e com IA nativa. Roda 100% localmente com SQLite, sem dependência de SaaS externo. Gerencia o ciclo completo de qualidade de software:

```
Requisitos → Planos → Casos → Ciclos → Execuções → Defeitos → Relatórios
```

## Para quem

Times de QA/engenharia que querem:
- Controle total dos dados (sem Jira Cloud, sem TestRail pago)
- IA para acelerar criação de artefatos de teste
- Stack moderna sem burocracia de setup

## Diferencial central

1. **IA multi-provider nativa** — gera planos, casos e execuções via Gemini, OpenAI, Anthropic, Groq, Ollama, OpenRouter
2. **Self-hosted SQLite** — zero infra, dados na máquina
3. **Ciclos de execução** — agrupa execuções por sprint/release com progresso em tempo real
4. **Rastreabilidade completa** — Requisito ↔ Caso ↔ Execução ↔ Defeito
5. **State machines duplas** — validação de transições de status em frontend (Zod) + backend

## Referências de mercado

| Ferramenta | O que aprender |
|-----------|---------------|
| TestRail | Milestone tracking, relatórios executivos por ciclo |
| Zephyr Scale | Test Cycles vinculados a versões/sprints, traceability rica |
| Plane | UX moderna self-hosted, cards compactos, sidebar clara |
| Linear | Velocidade de interação, densidade de informação |
| qTest | Dashboard de saúde de qualidade por release |

## Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express (Node ESM) + better-sqlite3 (SQLite WAL)
- **Auth**: JWT local
- **AI**: @google/generative-ai + multi-provider via ModelControlPanel
- **Alias**: `@/` → `src/`

## Estado atual

Todas as entidades core estão implementadas. A última fase entregou:
- Ciclos de execução (TestRuns) — CRUD, state machine, progresso por status
- Campo `assigned_to` em casos, execuções e ciclos com notificações
- Campo `run_id` em execuções para vincular a um ciclo
- Hook `useProjectUsers` para selects de interessado em todos os formulários
- Página `/runs` com cards + lista, barra de progresso, filtros e ordenação

Ver `.planning/codebase/STATUS.md` para lista completa.

## Próximas prioridades (ordem recomendada)

1. **Filtro por ciclo nas execuções** — página `/executions` filtrar por `run_id`
2. **Notificações UI** — sino no header lendo a tabela `notifications` (já populada)
3. **Dashboard de ciclos** — métricas agregadas: runs ativos, % conclusão, taxa de aprovação
4. **DetailModal para TestRun** — visualização detalhada com progresso e execuções vinculadas
5. **Importação JUnit XML** — fechar o loop de automação CI → Nexus

## Decisões arquiteturais

- `filterToTableCols()` no backend — aceita qualquer campo existente na tabela sem código extra
- `SHARED_DATA=true` por padrão — todos os usuários do projeto veem os mesmos dados
- `SINGLE_TENANT=true` por padrão — permissões de master para instalação local single-user
- Notificações via insert direto em `notifications` table (sem websocket; polling 10s)
- Client Supabase é uma implementação local (não usa Supabase cloud por padrão)

## Guias de referência rápida

- `.planning/codebase/STRUCTURE.md` — mapa completo de arquivos, tipos, componentes
- `.planning/codebase/DATA_FLOW.md` — fluxos de dados detalhados
- `.planning/codebase/DEPENDENCIES.md` — dependências e scripts
- `.planning/codebase/STATUS.md` — o que está feito, pendente e bugs conhecidos
