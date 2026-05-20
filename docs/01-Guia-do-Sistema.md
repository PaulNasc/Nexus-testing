# Guia do Sistema — Nexus TCMS

Este guia consolida, em um único documento, tudo que você precisa saber para entender e operar o Nexus TCMS.

- Público-alvo: times de QA, desenvolvedores e administradores.
- Abrangência: visão, arquitetura, módulos, permissões, IA (MCP), APIs e fluxos principais.

## 1. Visão Geral

O Nexus TCMS é um sistema de gestão de testes com suporte à IA, construído em React + TypeScript (frontend) e Node.js + Express + SQLite (backend local). A plataforma cobre todo o ciclo de testes: Planos, Casos, Execuções, Relatórios e Traçabilidade, além de geração assistida por IA.

Principais objetivos:
- Centralizar a gestão de testes (Planos/Casos/Execuções) com rastreabilidade.
- Acelerar a criação de conteúdo por IA (múltiplos provedores e modelos).
- Fornecer segurança (JWT, CORS restrito, criptografia at-rest de API keys, rate limiting).

## 2. Arquitetura e Stack

- Frontend: React 18, TypeScript, Vite, Tailwind, `shadcn/ui`, Radix UI.
- Estado: React Query + Context + Hooks (`src/hooks/`).
- Backend: Node.js + Express (ESM), autenticação JWT, SQLite via `better-sqlite3`.
- Banco: SQLite (`data/nexus_testing.db`), schema em `server/schema.sql`, auto-migration no boot.
- IA: Gemini, OpenAI, Anthropic, Groq, Ollama, OpenRouter — configurados via MCP.
- Segurança: AES-256-GCM para API keys at-rest, `LOCAL_AUTH_SECRET` (≥32 chars), CORS allowlist.

Estrutura de pastas (alto nível):
```
src/
  components/       # UI, formulários, padrões visuais
  pages/            # Páginas (TestPlans, TestCases, Executions, MCP etc.)
  hooks/            # Autenticação, permissões, IA, utilidades
  services/         # Serviços de dados e API keys
  integrations/     # Clientes de IA
  lib/              # Schemas Zod, logger, utilitários
  types/            # Tipos TS das entidades
server/
  index.js          # Express app principal
  db.js             # Conexão SQLite
  schema.sql        # Schema completo
  lib/
    crypto.js       # AES-256-GCM para API keys
    logger.js       # Logger estruturado
    validation.js   # Validação de payloads e state machines
```

## 3. Entidades Principais

- TestPlan (`test_plans`): escopo, critérios, objetivos e metadados de planejamento.
- TestCase (`test_cases`): título, descrição, passos (`steps` JSON), prioridade e tipo.
- TestExecution (`test_executions`): status (`passed|failed|blocked|not_tested`), notas e executado por.
- Requirement (`requirements`): requisitos com prioridade e status.
- Defect (`defects`): defeitos vinculados a execuções/casos, com state machine de status.
- TraceabilityMatrix: rastreabilidade Requirements ↔ Cases.

Tipos em `src/types/`. Schemas de validação em `src/lib/schemas.ts` (Zod).

## 4. Permissões e Segurança

- Papéis (roles): `master`, `admin`, `manager`, `tester`, `viewer`.
- Permissões granulares em `user_permissions` e no hook `src/hooks/usePermissions.tsx`.
- Autenticação JWT (`LOCAL_AUTH_SECRET` ≥ 32 chars, gerado com `openssl rand -base64 48`).
- Rate limiting em `/api/auth/*` (10 req / 15 min).
- CORS restrito via `ALLOWED_ORIGINS` no `.env`.
- Headers de segurança: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `X-XSS-Protection`.

Política aplicada: masters não têm "passe livre" — apenas permissões administrativas críticas têm override. Veja `hasPermission()` em `src/hooks/usePermissions.tsx`.

## 5. IA e o Model Control Panel (MCP)

O MCP é o painel central de IA. Nele, você:
- Configura chaves API por provedor/modelo (armazenamento seguro por usuário).
- Ativa/desativa modelos e define o modelo padrão por tarefa (ex.: `test-plan-generation`).
- Cria e gerencia templates de prompts.
- Testa conectividade dos modelos.

Provedores suportados: Gemini, OpenAI, Anthropic, Groq, Ollama (local). Implementações e decisões em `docs/05-ia-implementacoes/*` (mantidos como referência histórica). API keys dos provedores são armazenadas criptografadas (AES-256-GCM) no banco local via `/api/ai/keys`. Nunca ficam em `localStorage`. O MCP é um ativo do projeto e não deve ser removido.

## 6. Fluxos Principais

- Planos de Teste
  1) Criar/Editar Planos (página `TestPlans`).
  2) Gerar conteúdo com IA opcionalmente (AIGenerator/AIBatch).
  3) Avaliar e versionar (roadmap: versionamento e auditoria).

- Casos de Teste
  1) Criar casos manualmente ou gerar via IA.
  2) Definir `steps` e `expected_result`.
  3) Vincular ao plano (`plan_id`).

- Execuções
  1) Registrar execução para um caso.
  2) Atualizar `status`, `actual_result`, `notes`.
  3) Relatórios e métricas (roadmap).

## 7. APIs e Serviços

A aplicação consome o backend Express em `http://localhost:4000` (via proxy Vite em dev). Principais endpoints:

| Método | Path | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login com email/senha (rate limited) |
| POST | `/api/auth/register` | Registro |
| GET | `/api/db/query` | Consulta genérica (requer auth) |
| POST | `/api/db/mutate` | Insert/update/delete (validação + state machine) |
| GET | `/api/ai/keys` | Lista provedores com chave configurada |
| POST | `/api/ai/keys` | Salva/atualiza chave criptografada |
| DELETE | `/api/ai/keys` | Remove chave |
| POST | `/api/ai/keys/reveal` | Retorna chave descriptografada (somente dono) |
| POST | `/api/upload` | Upload de arquivos (PDF, DOCX, PPTX) |
| GET | `/api/health` | Healthcheck |

Integrações IA em `src/integrations/*/`. Serviços em `src/services/`.

## 8. Padrões de UI/UX e Boas Práticas

- Componentes com estados de loading/empty/erro padronizados.
- Formulários com validações e consistência visual.
- Hooks com tratamento robusto de erros.
- Acessibilidade com Radix (ex.: `DialogHeader`, `DialogTitle`, `DialogDescription`).

## 9. Instalação Rápida

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env: gerar LOCAL_AUTH_SECRET forte:
#   openssl rand -base64 48

# 3. Iniciar backend (porta 4000)
npm run server

# 4. Iniciar frontend (porta 5173, com proxy para :4000)
npm run dev
```

## 10. Onde aprofundar

- Banco de Dados e SQLite: `docs/02-SQL-e-Banco-de-Dados.md`.
- Histórico e Planos: `docs/03-Historico-e-Planos.md`.

---

Changelog deste guia: v1.0 (consolidação inicial) → v2.0 (migração Supabase → SQLite/Express, mai/2026).
