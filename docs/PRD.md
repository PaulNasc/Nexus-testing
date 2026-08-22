# 📄 Product Requirements Document (PRD) — Nexus TCMS

**Produto:** Nexus Testing & Quality Management System (Nexus TCMS)  
**Versão:** 1.0.0 Enterprise  
**Classificação:** Confidencial / Engenharia de Produto  
**Status:** Aprovado  
**Última Atualização:** 2026-08-22  

---

## 1. Visão Geral do Produto

O **Nexus TCMS** é uma plataforma corporativa completa de Gestão de Testes e Garantia da Qualidade de Software (Quality Assurance), equipada com inteligência artificial generativa de múltiplos provedores (OpenAI, Anthropic, Google Gemini, Groq, Ollama, DeepSeek), isolamento multi-tenant rigoroso, matriz de rastreabilidade bidirecional e arquitetura modular por catálogo de funcionalidades.

### 1.1 Missão e Proposta de Valor
- **Acelerar o ciclo de testes** em até 70% por meio da geração assistida por IA de planos, casos e execuções de teste.
- **Garantir rastreabilidade de ponta a ponta** (Requisitos ↔ Casos de Teste ↔ Execuções ↔ Defeitos).
- **Prover isolamento absoluto de dados corporativos** com controle de acesso baseado em papéis (RBAC) e suporte a multi-tenancy.
- **Permitir personalização modular** onde funcionalidades podem ser ativadas ou desativadas por projeto ou plano de assinatura.

---

## 2. Personas e Níveis de Acesso

| Persona | Papel RBAC | Descrição de Responsabilidades |
|---|---|---|
| **Diretor de Tecnologia / Security Officer** | `Master` | Acesso irrestrito a todas as organizações, gerenciamento de infraestrutura, controle de chaves de API, auditoria global e exclusão de recursos críticos. |
| **Líder de QA / Tech Lead** | `Admin` | Gestão completa de projetos, configuração de modelos de IA da equipe, convite e gestão de membros, gerenciamento de grupos. |
| **Gerente de Projetos / Scrum Master** | `Manager` | Criação e acompanhamento de ciclos de teste, matriz de requisitos, dashboards de qualidade, relatórios executivos e gestão de defeitos. |
| **Engenheiro de QA / Testador** | `Tester` | Escrita e execução de casos de teste, geração com IA, registro de evidências e abertura de defeitos vinculados. |
| **Stakeholder / Auditor / Desenvolvedor** | `Viewer` | Visualização de planos, casos, execuções, requisitos, relatórios e exportação de dados em modo somente leitura. |

---

## 3. Matriz de Requisitos Funcionais (FR)

### Épico 1: Gestão do Ciclo de Testes (Core Testing)
- **FR-01 (Planos de Teste):** Criação, edição, clonagem, versionamento e categorização de planos de teste com códigos sequenciais (`PT-001`).
- **FR-02 (Casos de Teste):** Elaboração de casos com pré-condições, passos estruturados (Ação / Resultado Esperado), pós-condições, tags e prioridades (`CT-001`).
- **FR-03 (Execuções de Teste):** Registro de status (`Aprovado`, `Falhou`, `Bloqueado`, `Não Executado`), tempo de execução, versão testada e logs de evidências (`EXE-001`).
- **FR-04 (Ciclos de Teste / Test Runs):** Agrupamento de execuções com metas de cobertura, progresso percentual e cálculo automatizado de taxa de aprovação (`RUN-001`).

### Épico 2: Gestão da Qualidade e Rastreabilidade (Quality & Defects)
- **FR-05 (Requisitos):** Cadastro de requisitos funcionais e não-funcionais com nível de criticidade e rastreabilidade ativa (`REQ-001`).
- **FR-06 (Matriz de Rastreabilidade):** Visualização interativa do vínculo bidirecional entre Requisitos, Casos de Teste e Defeitos.
- **FR-07 (Gestão de Defeitos / Bugs):** Registro de incidentes vinculados diretamente a casos de teste que falharam, com severidade (`Crítica`, `Alta`, `Média`, `Baixa`) e ciclo de vida (`Aberto`, `Em Análise`, `Corrigido`, `Verificado`, `Fechado`) (`DEF-001`).

### Épico 3: Inteligência Artificial Generativa (AI Assistant & Model Control)
- **FR-08 (Geração de Planos por IA):** Geração de estratégias de teste a partir de especificações de software ou histórias de usuário.
- **FR-09 (Geração de Casos por IA):** Criação em lote de cenários positivos, negativos e de borda.
- **FR-10 (Painel de Modelos de IA):** Cadastro dinâmico de chaves criptografadas (AES-256-GCM), seleção de provedor padrão por tarefa e teste de conectividade em tempo real.
- **FR-11 (Templates de Prompts):** Customização de prompts de engenharia de contexto por organização.

### Épico 4: Relatórios e Analytics Executivos
- **FR-12 (Dashboard de Qualidade):** Métricas consolidadas em tempo real (Pass Rate, Cobertura de Requisitos, Densidade de Defeitos).
- **FR-13 (Exportação Multi-formato):** Exportação fiel de relatórios e dados para PDF estruturado, Excel (`.xlsx`), Word (`.doc`), Markdown (`.md`), CSV e Texto puro.

### Épico 5: Observabilidade e Error Reporting
- **FR-14 (Widget de Reporte de Erro):** Botão flutuante sutil no canto inferior direito com captura automática de screenshot DOM, console logs, stack trace e envio direto para a fila de incidentes.
- **FR-15 (Global Error Boundary):** Tratamento de falhas de renderização React com UI de recuperação e despacho de telemetria.

---

## 4. Matriz de Requisitos Não-Funcionais (NFR)

| ID | Categoria | Especificação Técnica |
|---|---|---|
| **NFR-01** | **Segurança (WAF & Headers)** | WAF ativo com bloqueio de SQLi, XSS, Path Traversal, Rate Limiting granular por IP e HSTS Full (`max-age=31536000`). |
| **NFR-02** | **Criptografia em Repouso** | Chaves de API e credenciais confidenciais armazenadas com criptografia simétrica `AES-256-GCM`. |
| **NFR-03** | **Performance & Latência** | Tempo de resposta de rotas da API < 120ms (p95) para consultas e < 250ms para transações de escrita. |
| **NFR-04** | **Disponibilidade (SLA)** | 99.9% de uptime para o serviço central com fallback local SQLite resiliente. |
| **NFR-05** | **Multi-Tenancy** | Isolamento lógico por `organization_id` e `project_id` em todas as tabelas e queries de banco. |
| **NFR-06** | **Acessibilidade & UX** | Conformidade WCAG 2.1 AA, layout responsivo (mobile, tablet, desktop) e suporte a Dark/Light Mode. |

---

## 5. Matriz RBAC Detalhada

| Permissão Funcional | Master | Admin | Manager | Tester | Viewer |
|---|:---:|:---:|:---:|:---:|:---:|
| Gerenciar Organizações & Configurações Globais | ✅ | ❌ | ❌ | ❌ | ❌ |
| Gerenciar Chaves de Provedores de IA | ✅ | ✅ | ❌ | ❌ | ❌ |
| Criar / Editar / Excluir Projetos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Convidar e Gerenciar Membros / Papéis | ✅ | ✅ | ❌ | ❌ | ❌ |
| Criar / Editar Planos e Casos de Teste | ✅ | ✅ | ✅ | ✅ | ❌ |
| Executar Casos e Registrar Resultados | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cadastrar / Editar Requisitos e Defeitos | ✅ | ✅ | ✅ | ✅ | ❌ |
| Utilizar Geração com IA | ✅ | ✅ | ✅ | ✅ | ❌ |
| Visualizar Dashboards e Relatórios | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exportar Dados (PDF, CSV, Excel) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reportar Erros via Widget | ✅ | ✅ | ✅ | ✅ | ✅ |
