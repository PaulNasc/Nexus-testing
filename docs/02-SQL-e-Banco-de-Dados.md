# SQL — Banco de Dados (SQLite local)

Este documento descreve o banco de dados do Nexus TCMS: um SQLite local gerenciado pelo servidor Express.

## 1. Arquivos relevantes

| Arquivo | Descrição |
|---|---|
| `server/schema.sql` | Schema completo (tabelas + índices) |
| `server/db.js` | Conexão via `better-sqlite3`, WAL, FK habilitadas |
| `server/index.js` | Auto-migration no boot (adiciona colunas/tabelas faltantes) |
| `data/nexus_testing.db` | Banco em tempo de execução (gitignored) |

## 2. Tabelas principais

| Tabela | Descrição |
|---|---|
| `profiles` | Usuários (email, role, password_hash, display_name) |
| `user_permissions` | Permissões granulares por usuário |
| `projects` | Projetos de teste |
| `test_plans` | Planos de teste (por projeto) |
| `test_cases` | Casos de teste (por plano/projeto) |
| `test_executions` | Execuções de casos |
| `requirements` | Requisitos funcionais |
| `defects` | Defeitos vinculados a execuções/casos |
| `requirements_cases` | Tabela de junção Requirements ↔ Cases |
| `api_keys` | Chaves de API de LLMs criptografadas (AES-256-GCM) |
| `notifications` | Notificações internas por usuário |
| `activity_logs` | Audit trail de ações |

## 3. Segurança do banco

- **Chaves de API** nunca são armazenadas em texto claro. Usam AES-256-GCM com chave derivada do `LOCAL_AUTH_SECRET` via `scrypt` (`server/lib/crypto.js`).
- **Integridade referencial**: `PRAGMA foreign_keys = ON` ativo em toda conexão.
- **WAL mode**: `PRAGMA journal_mode = WAL` para concorrência segura.
- O arquivo `.db` é gitignored — nunca commitar dados reais.

## 4. Auto-migration

O servidor aplica automaticamente no boot:
1. Executa `server/schema.sql` (tabelas via `CREATE TABLE IF NOT EXISTS`).
2. Adiciona colunas faltantes em tabelas existentes (colunas detectadas por introspection).
3. Cria índices de performance (idempotentes).

Para novas colunas ou tabelas, adicione em `server/schema.sql` e no bloco `extraTables` de `server/index.js`.

## 5. Índices de performance

```sql
-- Notificações não lidas (Header polling)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at);

-- Defeitos por execução/caso/plano
CREATE INDEX IF NOT EXISTS idx_defects_execution ON defects(execution_id);
CREATE INDEX IF NOT EXISTS idx_defects_case ON defects(case_id);
CREATE INDEX IF NOT EXISTS idx_defects_plan ON defects(plan_id);

-- Rastreabilidade
CREATE INDEX IF NOT EXISTS idx_requirements_cases_req ON requirements_cases(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirements_cases_case ON requirements_cases(case_id);

-- Casos por projeto+status (dashboards)
CREATE INDEX IF NOT EXISTS idx_test_cases_project_status ON test_cases(project_id, status);
```

## 6. Verificações rápidas

```bash
# Abrir o banco com sqlite3 CLI
sqlite3 data/nexus_testing.db

# Listar tabelas
.tables

# Ver estrutura de uma tabela
.schema test_plans

# Contar registros
SELECT COUNT(*) FROM profiles;
SELECT COUNT(*) FROM test_cases;
```

## 7. Troubleshooting

- **Banco não inicializa**: verificar `LOCAL_AUTH_SECRET` no `.env` e que `data/` é gravável.
- **FOREIGN KEY constraint failed**: verificar se a entidade referenciada existe antes de inserir.
- **Coluna não existe**: o auto-migration deve adicionar; reiniciar o servidor resolve na maioria dos casos.
- **API key inválida após reset do LOCAL_AUTH_SECRET**: re-cadastrar as chaves no MCP (a chave derivada muda com o secret).

---

Changelog: v1.0 (Supabase/PostgreSQL) → v2.0 (SQLite/Express local, mai/2026).
