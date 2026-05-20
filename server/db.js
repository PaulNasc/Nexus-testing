import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATABASE_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'nexus_testing.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Garantir que todos os índices secundários de FK existam no boot
const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_test_plans_project ON test_plans(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_test_cases_plan ON test_cases(plan_id)',
  'CREATE INDEX IF NOT EXISTS idx_test_cases_project ON test_cases(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_executions_case ON test_executions(case_id)',
  'CREATE INDEX IF NOT EXISTS idx_executions_plan ON test_executions(plan_id)',
  'CREATE INDEX IF NOT EXISTS idx_executions_project ON test_executions(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_defects_project ON defects(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at)',
  'CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_defects_execution ON defects(execution_id)',
  'CREATE INDEX IF NOT EXISTS idx_defects_case ON defects(case_id)',
  'CREATE INDEX IF NOT EXISTS idx_defects_plan ON defects(plan_id)',
  'CREATE INDEX IF NOT EXISTS idx_requirements_cases_req ON requirements_cases(requirement_id)',
  'CREATE INDEX IF NOT EXISTS idx_requirements_cases_case ON requirements_cases(case_id)',
  'CREATE INDEX IF NOT EXISTS idx_test_cases_project_status ON test_cases(project_id, status)',
  'CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(project_id)',
  'CREATE INDEX IF NOT EXISTS idx_test_runs_plan ON test_runs(plan_id)',
  'CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status)',
  'CREATE INDEX IF NOT EXISTS idx_executions_run ON test_executions(run_id)'
];

try {
  for (const idx of INDEXES) {
    db.prepare(idx).run();
  }
} catch (err) {
  console.error('[db] Falha ao criar índices no boot:', err.message);
}

// Converte placeholders PostgreSQL-style ($1, $2, ...) para ? do SQLite
function toSQLite(sql) {
  return sql.replace(/\$\d+/g, '?');
}

// better-sqlite3 não aceita booleanos — converte para 0/1
function coerceParams(params) {
  return params.map(p => typeof p === 'boolean' ? (p ? 1 : 0) : p);
}

export function query(sql, params = []) {
  const converted = toSQLite(sql);
  const hasReturning = /RETURNING/i.test(converted);
  const isRead = /^\s*(SELECT|WITH)/i.test(converted);
  const stmt = db.prepare(converted);
  const safe = coerceParams(Array.isArray(params) ? params : []);
  try {
    if (isRead || hasReturning) {
      const rows = safe.length === 0 ? stmt.all() : stmt.all(...safe);
      return { rows, rowCount: rows.length };
    }
    const result = safe.length === 0 ? stmt.run() : stmt.run(...safe);
    return { rows: [], rowCount: result.changes };
  } catch (err) {
    console.error('[db] query error\nSQL:', converted, '\nparams:', safe, '\nerr:', err.message);
    throw err;
  }
}

export function getClient() {
  return {
    query: (sql, params = []) => query(sql, params),
    release: () => {},
  };
}

export const pool = {
  connect: () => getClient(),
  end: () => { try { db.close(); } catch {} },
};

// Transação nativa do better-sqlite3
export function transaction(fn) {
  return db.transaction(fn);
}
