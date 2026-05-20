# Plano de Análise Estrutural e Auditoria: Nexus Testing (Krigzis-TCMS)

## 📝 Visão Geral
Este plano define o processo para realizar uma análise detalhada e auditoria do projeto Nexus Testing (Krigzis-TCMS). O objetivo é entender a arquitetura do sistema, stacks tecnológicas, regras de negócio, e os conceitos de segurança aplicados, culminando em uma lista prioritária de melhorias e tarefas pendentes (backlog). Adicionalmente, mapearemos com rigor os padrões de layout e o design system minimalista adotados no frontend.

---

## 🛠️ Objetivos de Análise
1. **Arquitetura & Stacks**: Identificar e documentar a estrutura de diretórios, frameworks, padrões de design e integrações (local vs. nuvem, IA).
2. **Regras de Negócio**: Mapear os fluxos críticos (Requisitos → Planos → Casos → Execuções → Defeitos) e máquinas de estado.
3. **Segurança & Privacidade**: Analisar autenticação JWT, RBAC, validação de inputs e prevenção contra ataques comuns (IDOR, SQL Injection, CSRF).
4. **Padrão de Layout e Minimalismo**: Aprender, mapear e documentar o padrão estético minimalista e as regras de layout (Tailwind, Radix, Shadcn) utilizadas no frontend.
5. **Lista de Pendências (Backlog)**: Criar um backlog técnico e funcional priorizado com base nos achados.

---

## 📅 Fases do Plano

### Fase 1: Mapeamento de Arquitetura e Stacks (@explorer-agent)
- [ ] Mapear toda a estrutura do projeto (`server/` e `src/`) e dependências principais.
- [ ] Identificar a lógica de acesso local (SQLite) e a comutação/sincronização com o Supabase.
- [ ] Documentar o fluxo de integração do painel de controle de modelos de IA (Gemini, etc.).

### Fase 2: Auditoria de Segurança (@security-auditor)
- [ ] Analisar a lógica de autenticação baseada em JWT (`server/index.js`, `server/lib/crypto.js`).
- [ ] Auditar o controle de acesso baseado em papéis (RBAC) e verificar brechas de IDOR nas rotas genéricas `/api/db/mutate`.
- [ ] Verificar a robustez das validações de input (`server/lib/validation.js`) contra injeções.

### Fase 3: Engenharia Reversa de Regras de Negócio e Design System (@backend-specialist, @frontend-specialist)
- [ ] Mapear o ciclo de vida e transições de estado para Defeitos, Requisitos e Runs.
- [ ] Avaliar a consistência do banco de dados (chaves estrangeiras, `ON DELETE CASCADE` e numeradores automáticos).
- [ ] Entender a arquitetura de persistência e se há gaps na sincronização de dados ou preferências.
- [ ] Analisar o padrão de design minimalista da UI (paletas de cores, sombras, fontes, espacamentos, micro-interações) e consistência dos modais/layouts.

### Fase 4: Consolidação do Relatório e Backlog (@project-planner)
- [ ] Reunir os achados de todos os agentes.
- [ ] Desenhar o mapa estrutural e fluxo lógico do sistema.
- [ ] Consolidar a documentação dos padrões de design/layout minimalistas identificados.
- [ ] Gerar uma lista de melhorias e correções a serem realizadas no código (Backlog Técnico e UX).

---

## 📋 Checklist de Verificação
- [ ] Estrutura do projeto mapeada por completo.
- [ ] Stacks tecnológicas identificadas com racional de uso.
- [ ] Regras de negócio essenciais e máquinas de estado documentadas.
- [ ] Padrão de layout minimalista e guias visuais identificados e documentados.
- [ ] Mecanismos de segurança analisados e potenciais riscos apontados.
- [ ] Lista de tarefas pendentes organizada e priorizada.

---

## 🤖 Atribuição de Agentes
- **project-planner**: Coordenação da análise, consolidação do backlog e estruturação do plano.
- **explorer-agent**: Varredura estrutural do código-fonte e mapeamento de dependências.
- **backend-specialist**: Mapeamento de banco de dados, fluxos de API Express e regras de negócio.
- **security-auditor**: Auditoria das práticas de criptografia, controle de acessos (RBAC) e IDOR.
- **frontend-specialist**: Avaliação da consistência dos componentes React, UX do painel, consumo da API e mapeamento do design system minimalista.
