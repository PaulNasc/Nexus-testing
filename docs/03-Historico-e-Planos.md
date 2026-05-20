# Historiologia de Desenvolvimento — Krigzis‑TCMS

Documento consolidado do histórico, diagnósticos, plano de ação e lições aprendidas do projeto.

Fontes consolidadas:
- `docs/99-historico/HISTORICO_GERAL.md`
- `docs/03-diagnosticos-correcoes/DIAGNOSTICO_DETALHADO_ERROS.md`
- `docs/03-diagnosticos-correcoes/INSTRUCOES_CORRECAO.md`
- `docs/03-diagnosticos-correcoes/INSTRUCOES_CORRECAO_ATUALIZADAS.md`
- `docs/03-diagnosticos-correcoes/RESUMO_CORRECOES.md`
- `docs/04-planos-qualidade/PLANO_ACAO_COMPLETO.md`
- `docs/04-planos-qualidade/QUALITY_IMPROVEMENT_PLAN.md`

## 1. Linha do Tempo Resumida

- Sessão inicial: análise da arquitetura (TestMaster AI → Krigzis‑TCMS), papéis e permissões.
- Implementação: múltiplos modelos Gemini, seleção por tarefa, MCP (Model Control Panel).
- Permissões IA: `can_access_model_control`, `can_configure_ai_models`, `can_test_ai_connections`, `can_manage_ai_templates`, `can_select_ai_models`.
- Módulo To‑Do: pastas/tarefas, integrações planejadas com TCMS.
- Sessões de correções: redução de erros TS/ESLint, build estável, limpeza de duplicações.

## 2. Diagnóstico — Problemas Clássicos

- Duplicação massiva de código (origem: cópia e iterações paralelas sem limpeza).
- Divergência entre tipos TypeScript e schema do banco.
- RLS complexo prematuro; permissões sobrepostas.
- Erros de sintaxe e imports/exports inconsistentes.
- Scripts SQL extensos e com repetições.

## 3. Plano de Ação (Consolidado)

Fases (executivo):
- Fase 1 — Limpeza e Organização: unificação de docs (este repositório), SQL limpo, remoção de duplicações.
- Fase 2 — Correção da Base: sincronizar tipos, simplificar permissões e RLS funcional.
- Fase 3 — Core Frontend: hooks e serviços CRUD; páginas principais.
- Fase 4 — Funcionalidades Avançadas: anexos, subtarefas, templates; traçabilidade.
- Fase 5 — Integração e Qualidade: validações, testes, documentação final e deploy.

Critérios de sucesso:
- 0 erros de build/TS; lint sob controle; RLS validada; UI/UX consistente.

## 4. Decisões e Diretrizes

- MCP e módulos de IA são ativos do projeto (não remover). Melhorias visuais e refinos podem ser propostos.
- Permissões: masters não têm passe‑livre universal; apenas permissões administrativas críticas têm override.
- IA: chaves por usuário, seleção de modelo por tarefa, templates versionáveis (roadmap).

## 5. Métricas e Conquistas

- Build estável; ESLint sem erros bloqueantes; tipagem alinhada às interfaces‑chave.
- Redução expressiva de duplicações e normalização de padrões (hooks, componentes, tratamento de erros).
- Documentação consolidada em três guias principais.

## 6. Próximos Passos

- Implementar matriz de traçabilidade (Requirements ↔ Cases ↔ Executions ↔ Defects).
- Dashboard de relatórios (KPIs, cobertura, flakiness, riscos).
- Versionamento e auditoria (planos/casos); histórico e restauração.
- CI com quality gates (lint, typecheck, testes, cobertura) e automações (pre‑commit).

## 7. Lições Aprendidas

- MVP primeiro; evoluções incrementais e validadas.
- Sincronizar tipos sempre que alterar o schema.
- RLS evolutivo; privilégios mínimos por padrão.
- Padrões de código e UI/UX consistentes evitam regressões.

---

Changelog deste guia: versão 1.0 (consolidação inicial).
