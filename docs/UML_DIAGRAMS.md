# 📊 Diagramas e Fluxogramas UML do Sistema — Nexus TCMS

**Classificação:** Especificação Técnica de Engenharia  
**Data:** 2026-08-22  
**Formato:** Mermaid UML  

---

## 1. Diagrama de Classes UML (Domínio de Negócio)

```mermaid
classDiagram
    class Organization {
        +String id
        +String name
        +String slug
        +DateTime created_at
        +getProjects()
        +getMembers()
    }

    class Project {
        +String id
        +String name
        +String slug
        +String description
        +String color
        +String status
        +String organization_id
        +String created_by
        +createPlan()
        +createRun()
        +archive()
    }

    class User {
        +String id
        +String email
        +String display_name
        +UserRole role
        +String organization_id
        +hasPermission(permName)
    }

    class UserPermissions {
        +String user_id
        +Boolean can_manage_users
        +Boolean can_manage_projects
        +Boolean can_manage_plans
        +Boolean can_manage_cases
        +Boolean can_manage_executions
        +Boolean can_manage_requirements
        +Boolean can_manage_defects
        +Boolean can_view_reports
        +Boolean can_use_ai
        +Boolean can_access_model_control
    }

    class TestPlan {
        +String id
        +String code
        +String title
        +String description
        +String status
        +String project_id
        +String created_by
        +addCase(testCase)
    }

    class TestCase {
        +String id
        +String code
        +String title
        +String description
        +String priority
        +String type
        +JSON steps
        +String plan_id
        +String project_id
        +execute(status, notes)
    }

    class TestExecution {
        +String id
        +String code
        +String status
        +String notes
        +String version
        +String environment
        +String case_id
        +String run_id
        +String project_id
        +String user_id
        +openDefect()
    }

    class TestRun {
        +String id
        +String code
        +String name
        +String status
        +Float progress_percentage
        +String project_id
        +calculateMetrics()
    }

    class Requirement {
        +String id
        +String code
        +String title
        +String description
        +String status
        +String project_id
        +linkCase(caseId)
    }

    class Defect {
        +String id
        +String code
        +String title
        +String severity
        +String status
        +String case_id
        +String execution_id
        +String project_id
        +updateStatus(newStatus)
    }

    class ErrorReport {
        +String id
        +String error_message
        +String stack_trace
        +String current_url
        +JSON console_logs
        +String screenshot_base64
        +String user_id
        +String project_id
        +DateTime created_at
    }

    Organization "1" *-- "many" Project : contains
    Organization "1" *-- "many" User : employs
    User "1" -- "1" UserPermissions : has
    Project "1" *-- "many" TestPlan : organizes
    Project "1" *-- "many" TestRun : runs
    Project "1" *-- "many" Requirement : defines
    Project "1" *-- "many" Defect : tracks
    TestPlan "1" *-- "many" TestCase : groups
    TestCase "1" -- "many" TestExecution : executed_in
    TestRun "1" o-- "many" TestExecution : aggregates
    Requirement "many" <..> "many" TestCase : traces_to
    TestCase "1" <.. "many" Defect : causes
    TestExecution "1" <.. "many" Defect : originates
    User "1" ..> "many" ErrorReport : submits
    Project "1" ..> "many" ErrorReport : scopes
```

---

## 2. Diagrama de Sequência UML: Autenticação, RBAC e Multi-Tenancy

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário / Browser
    participant WAF as WAF & Rate Limiter
    participant API as Express API Server
    participant Auth as Auth & Token Engine
    participant DB as Banco de Dados (SQLite/PG)

    User->>WAF: POST /api/auth/login (email, password)
    WAF->>WAF: Verificar IP Rate Limit & Payload Sanitization
    WAF->>API: Repassar requisição limpa
    API->>DB: SELECT * FROM profiles WHERE email = ?
    DB-->>API: Retorna perfil e hash bcrypt da senha
    API->>API: bcrypt.compare(password, hash)
    
    alt Senha Válida
        API->>DB: SELECT * FROM user_permissions WHERE user_id = ?
        DB-->>API: Retorna permissões granulares
        API->>Auth: Gerar JWT assinado (user_id, role, organization_id, permissions)
        Auth-->>API: Token JWT
        API-->>User: 200 OK + JWT Token + Dados de Perfil
    else Senha Inválida
        API->>API: Incrementar authAttempts para IP
        API-->>User: 401 Unauthorized (Credenciais inválidas)
    end
```

---

## 3. Diagrama de Sequência UML: Geração Assistida por IA (Model Control)

```mermaid
sequenceDiagram
    autonumber
    actor QA as Engenheiro de QA
    participant UI as Frontend (AIGenerator)
    participant API as API Server (/api/ai/generate)
    participant Crypto as Crypto Engine (AES-256-GCM)
    participant DB as SQLite DB
    participant LLM as Provedor IA (OpenAI/Anthropic/Gemini/Groq)

    QA->>UI: Clicar em "Gerar Casos com IA" (Contexto + Prompt)
    UI->>API: POST /api/ai/generate (task, prompt, context)
    API->>API: Validar Permissão (can_use_ai)
    API->>DB: SELECT * FROM ai_models WHERE active = 1 AND task = ?
    DB-->>API: Modelo configurado + chave criptografada
    API->>Crypto: decrypt(encryptedApiKey)
    Crypto-->>API: Raw API Key
    API->>LLM: Despachar Prompt estruturado com JSON Schema
    LLM-->>API: Resposta estruturada (Planos / Casos gerados)
    API->>API: Validar integridade dos dados retornados
    API-->>UI: 200 OK + Array de Casos de Teste
    UI-->>QA: Exibir preview e permitir salvar diretamente no Plano
```

---

## 4. Diagrama de Sequência UML: Error Reporting Automático com Screenshot

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuário no Sistema
    participant Widget as ErrorReportWidget (Floating)
    participant Canvas as DOM Screen Capture Engine
    participant LogCapture as Session Error Logger
    participant API as Backend (/api/error-reports)
    participant DB as Banco SQLite (error_reports)

    Note over User, Widget: Erro ocorre na aplicação ou usuário encontra falha
    User->>Widget: Clicar no botão flutuante de Reportar Erro
    Widget->>LogCapture: Obter últimos 50 console logs e erros interceptados
    Widget->>Canvas: Capturar snapshot da tela atual (Base64 WebP)
    Canvas-->>Widget: Imagem Base64 otimizada
    Widget->>User: Exibir modal com preview da tela e logs coletados
    User->>Widget: Inserir breve comentário e clicar "Enviar Reporte"
    Widget->>API: POST /api/error-reports (message, stack, url, logs, screenshot, user_id)
    API->>API: Sanitizar payload (remover dados de senhas/tokens)
    API->>DB: INSERT INTO error_reports (...) VALUES (...)
    DB-->>API: ID do reporte gerado (ERR-XXXX)
    API-->>Widget: 201 Created + Protocolo de Atendimento
    Widget-->>User: Toast de Confirmação com número do protocolo
```

---

## 5. Máquina de Estados: Ciclo de Vida de Defeitos e Execuções

```mermaid
stateDiagram-v2
    [*] --> Aberto : Defeito Registrado
    Aberto --> EmAnalise : Atribuído a Desenvolvedor
    EmAnalise --> Corrigido : Patch Aplicado
    EmAnalise --> Rejeitado : Não Reproduzível / Inválido
    Corrigido --> Verificado : Teste de Regressão Passou
    Corrigido --> Reaberto : Falhou na Revalidação
    Reaberto --> EmAnalise
    Verificado --> Fechado : Homologado
    Rejeitado --> Fechado : Encerrado
    Fechado --> [*]
```
