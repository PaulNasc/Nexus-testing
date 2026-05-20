# Plano Estrutural e Arquitetural: Nexus Testing (Krigzis-TCMS)

## 1. Overview
**Nexus Testing** é um Test Case Management System (TCMS) desenhado para rivalizar com soluções de mercado como TestRail, Qase, Zephyr e Xray, trazendo como diferencial a integração nativa com modelos generativos de IA (Gemini, Groq, OpenAI, Anthropic, Ollama, OpenRouter) e um modo "Offline-first/Local" utilizando SQLite + Express, além da capacidade de operar em nuvem via Supabase.

O objetivo deste plano é garantir que todo o fluxo de criação (Requisitos → Planos → Casos → Execuções → Defeitos) seja rastreável, intuitivo para o usuário, otimizado para performance em produção (Vercel/AWS/Docker) e blindado contra vulnerabilidades de segurança (Agnostic Security).

---

## 2. Tipo de Projeto
- **Tipo:** Aplicação Full-Stack (WEB App + API Local/Backend)
- **Modo Atual:** React 18 (Vite) no Frontend + Node.js (Express + better-sqlite3) no Backend.

---

## 3. Análise Competitiva e Inspiração de Mercado
| Funcionalidade / Fluxo | Inspiração de Mercado (Referência) | Como faremos no Nexus Testing |
|------------------------|------------------------------------|-------------------------------|
| **Matriz de Rastreabilidade** | Jira + Xray / TestRail | Rastreabilidade Bidirecional (Requisitos ↔ Casos ↔ Defeitos) via chaves estrangeiras (`requirements_cases`). Interface clean e matriz de cobertura dinâmica. |
| **Geração via IA** | Qase AI / BrowserStack AI | Multi-provedor (Model Control Panel). O usuário insere a chave API localmente (`localStorage`), garantindo privacidade e evitando custos centralizados na AWS. |
| **Execuções em Lote (Runs)**| Zephyr Scale / TestOps | Tabela `test_runs` com `starts_at`/`ends_at` e agregação de progresso em tempo real (`/api/runs/:id/progress`), evitando requisições excessivas (gaps de lentidão). |
| **Segurança e Isolamento** | Enterprise SaaS padrão ISO | Backend já possui JWT, RBAC (`user_permissions`), e in-memory Rate Limiting. Evoluiremos com Headers de Segurança (Helmet) e Data Validation estrito. |

---

## 4. Engenharia Reversa Estrutural (Regras de Negócio Mapeadas)

### 4.1. Camada de Dados (SQLite Schema)
- **Tabelas Principais:** `profiles`, `projects`, `test_plans`, `test_cases`, `test_runs`, `test_executions`, `requirements`, `defects`.
- **Regras Implícitas de Integridade:** `ON DELETE CASCADE` (Ao apagar um projeto, tudo o que está dentro dele é apagado em cascata). 
- **Auto-Sequence:** Implementado numeradores automáticos (`sequence`) isolados por `project_id` (Ex: `PT-001`, `CT-002`).

### 4.2. API Backend (`server/index.js`)
- **Autenticação:** Baseada em JWT (`LOCAL_AUTH_SECRET`). Senhas são encriptadas com `bcryptjs`. Rate limiting implementado nas rotas de Auth.
- **Mutations e Queries (GraphQL-like Rest):** O backend adota um padrão `/api/db/query` e `/api/db/mutate` inspirado no PostgREST (Supabase), permitindo que o Frontend controle as queries de forma agnóstica.
- **Validação de Estado (State Machine):** Defeitos, Requisitos e Runs possuem validações de transição (`canTransitionDefect`, etc.) para impedir que status ilógicos ocorram.

### 4.3. Frontend (`src/`) e UI
- **Estilização:** Tailwind CSS + shadcn/ui. Tema suporta Dark Mode nativamente (`next-themes`).
- **Comunicação de Dados:** `src/services/supabaseService.ts` atua como um repositório centralizado, abstraindo se os dados vêm do Supabase Nuvem ou do Express Local. Possui flag `SHARED_DATA` para isolar ou compartilhar bases entre usuários.

---

## 5. Estratégia de Desenvolvimento e Melhores Práticas

1. **Performance no Banco de Dados:**
   - As consultas via `/api/db/query` recebem paginação dinâmica.
   - Foram mapeados índices (`CREATE INDEX IF NOT EXISTS`) para chaves estrangeiras. Avaliaremos se todas as FKs estão com índices adequados.
   - Execuções paralelas em API de relatórios para evitar Single Thread blocking no Node.js.

2. **Segurança (Agnóstica - AWS/Vercel/VPS):**
   - **Front-end:** Nenhuma variável `VITE_SUPABASE_ANON_KEY` será exposta sem necessidade.
   - **Back-end:** Proteção contra SQL Injection (consultas parametrizadas já estão no core, ex: `SELECT ... WHERE email = ?`). Rate Limiter para brute force.
   - **Red-Team Tactics:** Testes para Insecure Direct Object Reference (IDOR) - garantir que o Usuário A não consiga editar casos do Projeto do Usuário B.

3. **Melhoria Contínua da UX:**
   - Fluxo intuitivo para o testador: Relatar Defeito a partir de uma Execução falha com "1-click" e preenchimento via IA.

---

## 6. Task Breakdown (Detalhamento de Execução)

| ID | Nome da Tarefa | Agente | Skill | Prioridade | Dependência | Validação (INPUT → OUTPUT → VERIFY) |
|---|---|---|---|---|---|---|
| 01 | Revisão de Vulnerabilidades (IDOR & Rate Limiting) | `security-auditor` | `red-team-tactics` | Crítica | - | **In:** Rotas `/api/db/mutate`. **Out:** Lógica com checks de permissões (RBAC). **Verify:** Tentativa de mutação com role 'viewer' falha (403). |
| 02 | Otimização de Consultas N+1 (Relatórios e Dashboard) | `backend-specialist` | `performance-profiling`| Alta | T01 | **In:** Endpoint `/api/reports/aggregate`. **Out:** Query unificada com CTEs. **Verify:** Tempo de resposta < 200ms para 100k registros. |
| 03 | UX Refinement: Fluxo de Criação de Testes | `frontend-specialist` | `ui-ux-pro-max` | Média | - | **In:** Páginas `TestCases.tsx` / `TestPlans.tsx`. **Out:** Formulário unificado em steps. **Verify:** Preenchimento de IA ocorre sem travar a thread principal. |
| 04 | Integração de Testes Unitários e E2E Playwright | `test-engineer` | `webapp-testing` | Alta | T01, T02 | **In:** Casos de sucesso Críticos (Login, Criar Execução). **Out:** Suite de Playwright em `.tests`. **Verify:** `npm run test:e2e` passa 100%. |

---

## ✅ Phase X: Verification Checklist
*Critérios exigidos para concluir o projeto.*

- [ ] Linter & Type Check passando sem erros.
- [ ] Scan de Segurança (Vulnerabilidades) não aponta falhas críticas.
- [ ] UX Audit / Acessibilidade confirmados (Tema não quebra legibilidade).
- [ ] Testes Playwright (E2E) da jornada principal do usuário executados com sucesso.
- [ ] Tempo de reposta do servidor para queries complexas no banco (agregados) otimizado.
