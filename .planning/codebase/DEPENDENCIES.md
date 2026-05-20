# Nexus TCMS — Dependências e Integrações

## Dependências de produção (seleção relevante)

| Pacote | Versão | Uso |
|--------|--------|-----|
| react | ^18.3.1 | UI framework |
| react-dom | ^18.3.1 | DOM rendering |
| react-router-dom | ^6.26.2 | Roteamento SPA |
| @tanstack/react-query | ^5.56.2 | Cache e fetch assíncrono |
| @tanstack/react-virtual | ^3.13.12 | Virtualização de listas longas |
| express | ^4.21.2 | Servidor HTTP |
| better-sqlite3 | ^9.6.0 | SQLite (sync) |
| bcryptjs | ^2.4.3 | Hash de senhas |
| jsonwebtoken | ^9.0.2 | Tokens JWT |
| zod | ^3.23.8 | Validação de schemas |
| @google/generative-ai | ^0.24.1 | Gemini API |
| @radix-ui/* | vários | UI primitivos (shadcn) |
| tailwindcss | ^3.4.11 | Estilização |
| lucide-react | ^0.462.0 | Ícones |
| date-fns | ^3.6.0 | Manipulação de datas |
| recharts | ^2.12.7 | Gráficos |
| sonner | ^1.5.0 | Toasts alternativos |
| jspdf + jspdf-autotable | ^4/^5 | Exportação PDF |
| jszip | ^3.10.1 | Exportação ZIP |
| mammoth | ^1.12.0 | Importação DOCX |
| pdf-parse | ^1.1.1 | Importação PDF |
| multer | ^2.0.1 | Upload de arquivos |

## Dependências de dev

| Pacote | Uso |
|--------|-----|
| vite | ^6.4.2 | Build tool |
| @vitejs/plugin-react-swc | Transpilação rápida |
| typescript | ^5.5.3 | Type checking |
| @playwright/test | Testes E2E |
| eslint + plugins | Linting |
| concurrently | Dev: rodar API + Vite juntos |

## Scripts npm
```bash
npm run dev          # Vite dev server (5173)
npm run dev:api      # Express (4000)
npm run dev:all      # Ambos simultâneos (concurrently)
npm run build        # Build produção
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run db:bootstrap # Bootstrap BD local
npm run test:e2e     # Playwright
```

## Variáveis de ambiente (`.env`)
```
VITE_API_URL=http://localhost:4000/api   # URL da API (ou /api via proxy Vite)
VITE_SHARED_DATA=true                    # Compartilha dados entre usuários
VITE_SINGLE_TENANT=true                  # Modo single-tenant (master permissions)
LOCAL_AUTH_SECRET=<jwt-secret-min32>     # Segredo JWT backend
```

## Dependências entre módulos frontend

```
App.tsx
  └── AuthProvider (useAuth)
      └── ProjectProvider (useProject)
          └── AppRouter
              ├── Layout (Sidebar + Header)
              └── Pages (lazy)
                  ├── TestRuns.tsx
                  │   ├── testRunsService (listTestRunsByProject, createTestRun, updateTestRun, deleteTestRun, getRunProgress)
                  │   ├── supabaseService (getTestPlans)
                  │   ├── useProjectUsers
                  │   └── schemas (TestRunInputSchema, canTransitionRun)
                  ├── TestExecutions.tsx
                  │   └── forms/TestExecutionForm.tsx
                  │       ├── testRunsService (listTestRunsByProject)
                  │       ├── supabaseService (createTestExecution, updateTestExecution)
                  │       └── useProjectUsers
                  ├── TestCases.tsx
                  │   └── forms/TestCaseForm.tsx
                  │       ├── supabaseService (createTestCase, updateTestCase)
                  │       └── useProjectUsers
                  └── AIGenerator.tsx
                      └── forms/AIGeneratorForm.tsx
                          ├── testRunsService (listTestRunsByProject)
                          ├── supabaseService (createTestCase, createTestExecution, createTestPlan)
                          ├── modelControlService (generateWithAI)
                          └── useProjectUsers
```

## Dependências backend

```
index.js
  ├── db.js (getClient, db, query)
  ├── lib/validation.js (validateRow, canTransition*)
  ├── lib/crypto.js (encrypt, decrypt)
  └── lib/logger.js
```

## Integração AI
- Provedor principal: **Gemini** (`@google/generative-ai`)
- Multi-provider via `modelControlService.ts` (OpenAI, Anthropic, Groq, OpenRouter, Ollama)
- Chaves criptografadas em BD (`api_keys` table) via `apiKeysService.ts`
- Templates de prompt gerenciados em `ModelControlPanel.tsx`
- Task types: `test-plan-generation`, `test-case-generation`, `test-execution-generation`, `bug-detection`, `code-analysis`, `general-completion`
