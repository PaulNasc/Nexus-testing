import fs from 'fs/promises';
import path from 'path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { getClient, db, query, transaction } from './db.js';
import { encrypt as encryptSecret, decrypt as decryptSecret } from './lib/crypto.js';
import { validateRow, canTransitionDefect, canTransitionRequirement, canTransitionRun } from './lib/validation.js';
import { logger } from './lib/logger.js';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import mammoth from 'mammoth';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const uploadsDir = path.join(rootDir, 'public', 'uploads');

const SEQ_TABLES = new Set(['test_plans', 'test_cases', 'test_executions', 'test_runs', 'requirements', 'defects']);

// Validação do segredo JWT — obrigatório e forte em producao
const IS_PROD = process.env.NODE_ENV === 'production';
const RAW_SECRET = process.env.LOCAL_AUTH_SECRET;
const MIN_SECRET_LEN = 32;
const WEAK_SECRETS = new Set(['nexus-local-secret', 'change-me', 'secret', 'changeme']);

if (!RAW_SECRET) {
  if (IS_PROD) {
    logger.error('[security] LOCAL_AUTH_SECRET nao definido. Abortando em producao.');
    process.exit(1);
  } else {
    logger.warn('[security] LOCAL_AUTH_SECRET nao definido. Usando segredo de desenvolvimento temporario.');
  }
} else if (RAW_SECRET.length < MIN_SECRET_LEN || WEAK_SECRETS.has(RAW_SECRET)) {
  if (IS_PROD) {
    logger.error('[security] LOCAL_AUTH_SECRET fraco (<' + MIN_SECRET_LEN + ' chars ou padrao conhecido). Abortando.');
    process.exit(1);
  } else {
    logger.warn('[security] LOCAL_AUTH_SECRET fraco. Gere um novo com: openssl rand -hex 32');
  }
}

const JWT_SECRET = RAW_SECRET || ('dev-only-' + Math.random().toString(36).slice(2));
const PORT = Number(process.env.API_PORT || 4000);

await fs.mkdir(uploadsDir, { recursive: true });

const app = express();

// CORS com allowlist configuravel via ALLOWED_ORIGINS (separadas por virgula)
const DEFAULT_ORIGINS = [
  'http://localhost:8080', 'http://localhost:5173', 'http://localhost:5174',
  'http://localhost:5175', 'http://127.0.0.1:8080', 'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(','))
  .split(',').map((o) => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permite requisicoes sem Origin (curl, same-origin, ferramentas internas)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Origem nao permitida pelo CORS: ' + origin));
  },
  credentials: true,
}));

// Headers de seguranca basicos (sem dependencia externa)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/uploads', express.static(uploadsDir));

// Rate limit simples em memoria para rotas de autenticacao
const authAttempts = new Map(); // key: ip, value: { count, resetAt }
const AUTH_LIMIT = Number(process.env.AUTH_RATE_LIMIT || 10);
const AUTH_WINDOW_MS = Number(process.env.AUTH_RATE_WINDOW_MS || 15 * 60 * 1000);

function authRateLimit(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = authAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    authAttempts.set(ip, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return next();
  }
  entry.count += 1;
  if (entry.count > AUTH_LIMIT) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: { message: 'Muitas tentativas. Tente novamente em ' + retryAfter + 's.' } });
  }
  next();
}

// Limpeza periodica do mapa de tentativas
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of authAttempts.entries()) {
    if (entry.resetAt < now) authAttempts.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safe);
  },
});
const upload = multer({ storage });

const ALLOWED_TABLES = new Set([
  'profiles', 'user_permissions', 'projects', 'test_plans', 'test_cases',
  'test_executions', 'test_runs', 'requirements', 'requirements_cases', 'defects',
  'activity_logs', 'user_settings', 'notifications', 'notification_preferences',
  'profile_function_roles', 'role_requests', 'groups', 'group_members', 'api_keys'
]);

const BOOL_PERM_COLS = [
  'can_manage_users', 'can_manage_projects', 'can_delete_projects', 'can_manage_plans',
  'can_manage_cases', 'can_manage_executions', 'can_view_reports', 'can_use_ai',
  'can_access_model_control', 'can_access_admin_menu', 'can_configure_ai_models',
  'can_test_ai_connections', 'can_manage_ai_templates', 'can_select_ai_models', 'can_manage_groups',
];

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function parseToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

async function getCurrentUser(req) {
  const payload = parseToken(req);
  if (!payload?.sub) return null;
  const cols = ['id', 'email', 'display_name', 'role', 'avatar_url', 'active', ...BOOL_PERM_COLS];
  const { rows } = query(`
    SELECT p.id, p.email, p.display_name, p.role, p.avatar_url, p.active,
           ${BOOL_PERM_COLS.map(c => `up.${c}`).join(', ')}
    FROM profiles p
    LEFT JOIN user_permissions up ON p.id = up.user_id
    WHERE p.id = ? AND p.active = 1
  `, [payload.sub]);
  if (!rows[0]) return null;
  const user = rows[0];
  const permissions = {};
  for (const col of BOOL_PERM_COLS) {
    permissions[col] = user[col] === 1 || user[col] === true;
  }
  user.permissions = permissions;
  return user;
}

async function requireUser(req, res, next) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: { message: 'Nao autenticado.' } });
    req.user = user;
    next();
  } catch (error) { next(error); }
}

function buildWhere(filters = [], params = []) {
  const clauses = [];
  for (const filter of filters) {
    const { type, column, value } = filter;
    if (!column || !/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(column)) continue;
    if (type === 'eq') {
      if (value === null) {
        clauses.push(column + ' IS NULL');
      } else {
        params.push(value);
        clauses.push(column + ' = \$' + params.length);
      }
    } else if (type === 'neq') {
      if (value === null) {
        clauses.push(column + ' IS NOT NULL');
      } else {
        params.push(value);
        clauses.push(column + ' <> \$' + params.length);
      }
    } else if (type === 'gte') {
      params.push(value);
      clauses.push(column + ' >= \$' + params.length);
    } else if (type === 'lte') {
      params.push(value);
      clauses.push(column + ' <= \$' + params.length);
    } else if (type === 'in' && Array.isArray(value) && value.length > 0) {
      const placeholders = value.map((v) => { params.push(v); return '\$' + params.length; });
      clauses.push(column + ' IN (' + placeholders.join(', ') + ')');
    } else if (type === 'match' && value && typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        if (!/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(key)) continue;
        params.push(val);
        clauses.push(key + ' = \$' + params.length);
      }
    }
  }
  return clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
}

function normalizeRows(table, rows) {
  let normalized = rows;
  if (table === 'user_permissions') {
    normalized = rows.map((row) => {
      const norm = { ...row };
      for (const col of BOOL_PERM_COLS) {
        if (col in norm) norm[col] = norm[col] === 1 || norm[col] === true;
      }
      return norm;
    });
  } else if (table === 'profiles') {
    normalized = rows.map((row) => {
      const { password_hash, ...rest } = row;
      return {
        ...rest,
        active: row.active === 1 || row.active === true,
        tags: typeof row.tags === 'string'
          ? (() => { try { return JSON.parse(row.tags); } catch { return []; } })()
          : (Array.isArray(row.tags) ? row.tags : []),
      };
    });
  } else if (table === 'test_cases') {
    normalized = rows.map((row) => ({
      ...row,
      steps: typeof row.steps === 'string'
        ? (() => { try { return JSON.parse(row.steps); } catch { return []; } })()
        : (Array.isArray(row.steps) ? row.steps : []),
    }));
  } else if (table === 'activity_logs') {
    normalized = rows.map((row) => ({
      ...row,
      metadata: typeof row.metadata === 'string'
        ? (() => { try { return JSON.parse(row.metadata); } catch { return {}; } })()
        : (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}),
    }));
  }

  // Universal: parse interested_users and images if they exist as string
  return normalized.map((row) => {
    const copy = { ...row };
    if (typeof copy.interested_users === 'string') {
      try {
        copy.interested_users = JSON.parse(copy.interested_users);
      } catch {
        copy.interested_users = [];
      }
    }
    if (typeof copy.images === 'string') {
      try {
        copy.images = JSON.parse(copy.images);
      } catch {
        copy.images = [];
      }
    }
    return copy;
  });
}

function serializeForDb(table, values) {
  if (!values) return values;
  let result = { ...values };
  if (table === 'test_cases' && Array.isArray(result.steps)) {
    result.steps = JSON.stringify(result.steps);
  }
  if (table === 'profiles' && Array.isArray(result.tags)) {
    result.tags = JSON.stringify(result.tags);
  }
  if (table === 'activity_logs' && result.metadata && typeof result.metadata === 'object') {
    result.metadata = JSON.stringify(result.metadata);
  }
  if (Array.isArray(result.interested_users)) {
    result.interested_users = JSON.stringify(result.interested_users);
  }
  if (Array.isArray(result.images)) {
    result.images = JSON.stringify(result.images);
  }
  return result;
}

const _tableColsCache = new Map();
function getTableCols(table) {
  if (!_tableColsCache.has(table)) {
    try {
      const rows = db.prepare('PRAGMA table_info(' + table + ')').all();
      _tableColsCache.set(table, new Set(rows.map(r => r.name)));
    } catch { _tableColsCache.set(table, new Set()); }
  }
  return _tableColsCache.get(table);
}
function filterToTableCols(table, obj) {
  const allowed = getTableCols(table);
  const result = {};
  for (const key of Object.keys(obj)) {
    if (allowed.has(key)) result[key] = obj[key];
  }
  return result;
}

/**
 * Retorna o próximo número de sequência disponível para uma tabela e projeto.
 * Se múltiplos itens forem inseridos, deve-se incrementar o retorno manualmente.
 */
function getNextSequence(table, projectId = null) {
  if (!SEQ_TABLES.has(table)) return null;
  const tableCols = getTableCols(table);
  const hasProjectCol = tableCols.has('project_id');
  let seqSql = `SELECT MAX(sequence) as maxSeq FROM ${table} WHERE sequence IS NOT NULL`;
  const seqParams = [];
  if (hasProjectCol && projectId) {
    seqSql += ' AND project_id = ?';
    seqParams.push(projectId);
  } else if (hasProjectCol) {
    seqSql += ' AND project_id IS NULL';
  }
  const { rows: seqRows } = query(seqSql, seqParams);
  const max = Number(seqRows[0]?.maxSeq) || 0;
  return max + 1;
}

// Auto-migrate existing databases: add columns that may be missing
{
  _tableColsCache.clear(); // limpa antes de migrar
  const migrations = [
    'ALTER TABLE test_plans ADD COLUMN sequence INTEGER',
    'ALTER TABLE test_plans ADD COLUMN user_id TEXT',
    'ALTER TABLE test_plans ADD COLUMN generated_by_ai INTEGER DEFAULT 0',
    'ALTER TABLE test_cases ADD COLUMN sequence INTEGER',
    'ALTER TABLE test_cases ADD COLUMN user_id TEXT',
    'ALTER TABLE test_cases ADD COLUMN generated_by_ai INTEGER DEFAULT 0',
    'ALTER TABLE test_executions ADD COLUMN sequence INTEGER',
    'ALTER TABLE test_executions ADD COLUMN user_id TEXT',
    'ALTER TABLE test_executions ADD COLUMN generated_by_ai INTEGER DEFAULT 0',
    'ALTER TABLE defects ADD COLUMN sequence INTEGER',
    'ALTER TABLE requirements ADD COLUMN sequence INTEGER',
    'ALTER TABLE requirements ADD COLUMN user_id TEXT',
    'ALTER TABLE requirements ADD COLUMN generated_by_ai INTEGER DEFAULT 0',
    'ALTER TABLE user_permissions ADD COLUMN can_manage_groups INTEGER DEFAULT 0',
    'ALTER TABLE profiles ADD COLUMN github_url TEXT',
    'ALTER TABLE profiles ADD COLUMN google_url TEXT',
    'ALTER TABLE profiles ADD COLUMN website_url TEXT',
    'ALTER TABLE profiles ADD COLUMN tags TEXT DEFAULT \'[]\'',
    'ALTER TABLE profiles ADD COLUMN bio TEXT',
    'ALTER TABLE defects ADD COLUMN user_id TEXT',
    'ALTER TABLE defects ADD COLUMN plan_id TEXT REFERENCES test_plans(id) ON DELETE SET NULL',
    'ALTER TABLE activity_logs ADD COLUMN context TEXT',
    'ALTER TABLE activity_logs ADD COLUMN metadata TEXT DEFAULT \'{}\'',
    'ALTER TABLE projects ADD COLUMN icon TEXT DEFAULT \'\'',
    'ALTER TABLE test_plans ADD COLUMN branches TEXT DEFAULT \'\'',
    'ALTER TABLE test_cases ADD COLUMN branches TEXT DEFAULT \'\'',
    'ALTER TABLE notifications ADD COLUMN link TEXT DEFAULT \'\'',
    'ALTER TABLE test_cases ADD COLUMN assigned_to TEXT REFERENCES profiles(id)',
    'ALTER TABLE test_executions ADD COLUMN assigned_to TEXT REFERENCES profiles(id)',
    'ALTER TABLE test_cases ADD COLUMN interested_users TEXT DEFAULT \'[]\'',
    'ALTER TABLE test_executions ADD COLUMN interested_users TEXT DEFAULT \'[]\'',
    'ALTER TABLE defects ADD COLUMN interested_users TEXT DEFAULT \'[]\'',
    'ALTER TABLE test_plans ADD COLUMN interested_users TEXT DEFAULT \'[]\'',
    'ALTER TABLE test_plans ADD COLUMN images TEXT DEFAULT \'[]\'',
    'ALTER TABLE test_cases ADD COLUMN images TEXT DEFAULT \'[]\'',
    'ALTER TABLE test_executions ADD COLUMN images TEXT DEFAULT \'[]\'',
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch (e) {
      // Ignore 'duplicate column name' errors but log unexpected ones
      if (!String(e?.message).includes('duplicate column') && !String(e?.message).includes('already exists')) {
        logger.warn('[migration skip]', String(e?.message).slice(0, 120), '|', sql.slice(0, 80));
      }
    }
  }
  _tableColsCache.clear(); // invalida cache após migrações

  // Verificar e criar tabelas que podem estar faltando
  const extraTables = [
    `CREATE TABLE IF NOT EXISTS requirements_cases (
      id TEXT PRIMARY KEY,
      requirement_id TEXT REFERENCES requirements(id) ON DELETE CASCADE,
      case_id TEXT REFERENCES test_cases(id) ON DELETE CASCADE,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(requirement_id, case_id)
    )`,
    `CREATE TABLE IF NOT EXISTS role_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      requested_role TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS api_keys (
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model_id TEXT DEFAULT '',
      key_encrypted TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, provider, model_id)
    )`,
    `CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','aborted')),
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      plan_id TEXT REFERENCES test_plans(id) ON DELETE SET NULL,
      assigned_to TEXT REFERENCES profiles(id),
      starts_at TEXT,
      ends_at TEXT,
      created_by TEXT REFERENCES profiles(id),
      sequence INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(group_id, user_id)
    )`
  ];
  for (const sql of extraTables) {
    try { db.exec(sql); } catch { /* already exists */ }
  }

  // Migracoes tardias (apos criar tabelas dependentes)
  const lateMigrations = [
    'ALTER TABLE test_executions ADD COLUMN run_id TEXT REFERENCES test_runs(id) ON DELETE SET NULL',
    // role_requests: renomear requested_role (singular, NOT NULL) → requested_roles (plural, JSON array)
    'ALTER TABLE role_requests ADD COLUMN requested_roles TEXT DEFAULT \'[]\'',
  ];
  for (const sql of lateMigrations) {
    try { db.exec(sql); } catch (e) {
      if (!String(e?.message).includes('duplicate column') && !String(e?.message).includes('already exists')) {
        logger.warn('[late-migration skip]', String(e?.message).slice(0, 120));
      }
    }
  }

  // Indices de performance (idempotentes)
  const perfIndexes = [
    'CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read_at)',
    'CREATE INDEX IF NOT EXISTS idx_defects_execution ON defects(execution_id)',
    'CREATE INDEX IF NOT EXISTS idx_defects_case ON defects(case_id)',
    'CREATE INDEX IF NOT EXISTS idx_defects_plan ON defects(plan_id)',
    'CREATE INDEX IF NOT EXISTS idx_requirements_cases_req ON requirements_cases(requirement_id)',
    'CREATE INDEX IF NOT EXISTS idx_requirements_cases_case ON requirements_cases(case_id)',
    'CREATE INDEX IF NOT EXISTS idx_test_cases_project_status ON test_cases(project_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_test_runs_project ON test_runs(project_id)',
    'CREATE INDEX IF NOT EXISTS idx_test_runs_plan ON test_runs(plan_id)',
    'CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status)',
    'CREATE INDEX IF NOT EXISTS idx_executions_run ON test_executions(run_id)',
  ];
  for (const sql of perfIndexes) {
    try { db.exec(sql); } catch (e) {
      if (!String(e?.message).includes('already exists')) {
        logger.warn('[index skip]', String(e?.message).slice(0, 120));
      }
    }
  }

  _tableColsCache.clear();

  // Limpeza automática de imagens expiradas (> 30 dias) em planos e casos de teste
  try {
    const cleanPlans = db.prepare("UPDATE test_plans SET images = '[]' WHERE created_at < datetime('now', '-30 days') AND images != '[]' AND images IS NOT NULL").run();
    const cleanCases = db.prepare("UPDATE test_cases SET images = '[]' WHERE created_at < datetime('now', '-30 days') AND images != '[]' AND images IS NOT NULL").run();
    if (cleanPlans.changes > 0 || cleanCases.changes > 0) {
      logger.info(`[db-cleanup] Removidas imagens expiradas de ${cleanPlans.changes} planos e ${cleanCases.changes} casos de teste.`);
    }
  } catch (e) {
    logger.error('[db-cleanup] Erro na limpeza automática de imagens:', e.message);
  }
}


// ─── SSE: Real-time notification push ────────────────────────────────────────
/** userId → Set of active SSE response objects */
const sseClients = new Map();

function sseAdd(userId, res) {
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId).add(res);
}

function sseRemove(userId, res) {
  const set = sseClients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) sseClients.delete(userId);
}

/** Push a notification payload to all open SSE connections for a user */
function broadcastNotification(userId, payload) {
  const set = sseClients.get(userId);
  if (!set || set.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch { /* client disconnected */ }
  }
}

app.get('/api/notifications/stream', async (req, res) => {
  // Auth: token can come from header OR ?token= query param (EventSource cannot set headers)
  let user = await getCurrentUser(req);
  if (!user && req.query.token) {
    try {
      const payload = jwt.verify(String(req.query.token), JWT_SECRET);
      if (payload?.sub) {
        const { rows } = query('SELECT id FROM profiles WHERE id = ? AND active = 1', [payload.sub]);
        if (rows[0]) user = { id: rows[0].id };
      }
    } catch { /* invalid token */ }
  }
  if (!user) return res.status(401).json({ error: { message: 'Nao autorizado.' } });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial heartbeat
  res.write(': connected\n\n');

  sseAdd(user.id, res);

  // Heartbeat every 30s to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(heartbeat); }
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseRemove(user.id, res);
  });
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));


app.post('/api/auth/login', authRateLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const { rows } = query('SELECT * FROM profiles WHERE email = ? AND active = 1', [String(email || '').toLowerCase().trim()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: { message: 'Credenciais invalidas.' } });
    const ok = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!ok) return res.status(401).json({ error: { message: 'Credenciais invalidas.' } });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, user_metadata: { full_name: user.display_name || '' } } });
  } catch (error) { next(error); }
});

app.post('/api/auth/register', authRateLimit, async (req, res, next) => {
  try {
    const { email, password, name } = req.body || {};
    const passwordHash = await bcrypt.hash(String(password || ''), 10);
    const newId = randomUUID();
    const inserted = query(
      'INSERT INTO profiles (id, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?) RETURNING id, email, display_name',
      [newId, String(email || '').toLowerCase().trim(), passwordHash, String(name || ''), 'viewer']
    );
    const user = inserted.rows[0];
    query('INSERT INTO user_permissions (user_id) VALUES (?) ON CONFLICT (user_id) DO NOTHING', [user.id]);
    const token = signToken({ id: user.id, email: user.email, role: 'viewer' });
    res.json({ token, user: { id: user.id, email: user.email, role: 'viewer', user_metadata: { full_name: user.display_name || '' } } });
  } catch (error) { next(error); }
});

app.get('/api/auth/session', async (req, res, next) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.json({ session: null });
    res.json({ session: { user: { id: user.id, email: user.email, role: user.role, user_metadata: { full_name: user.display_name || '' } } } });
  } catch (error) { next(error); }
});

app.post('/api/auth/reset-password', authRateLimit, (_req, res) => {
  res.json({ ok: true, message: 'Recuperacao de senha nao suportada no modo local.' });
});

app.post('/api/auth/update-password', requireUser, async (req, res, next) => {
  try {
    const passwordHash = await bcrypt.hash(String(req.body?.password || ''), 10);
    query('UPDATE profiles SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/db/query', requireUser, async (req, res, next) => {
  try {
    const { table, filters = [], order, limit, columns = '*', options = {} } = req.body || {};
    if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: { message: 'Tabela nao permitida.' } });

    // --- SECURITY: Force user_id scope for personal tables ---
    const { role: userRole, id: userId } = req.user;
    const personalTables = ['api_keys', 'user_settings', 'notification_preferences', 'role_requests', 'activity_logs', 'notifications'];
    let activeFilters = filters;
    if (personalTables.includes(table) && userRole !== 'master' && userRole !== 'admin') {
      const cleanFilters = filters.filter(f => f.column !== 'user_id');
      cleanFilters.push({ type: 'eq', column: 'user_id', value: userId });
      activeFilters = cleanFilters;
    }

    const params = [];
    const whereSql = buildWhere(activeFilters, params);
    const orderSql = order?.column && /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(order.column)
      ? ' ORDER BY ' + order.column + (order.ascending === false ? ' DESC' : ' ASC')
      : '';
    const limitSql = Number.isFinite(limit) ? ' LIMIT ' + Number(limit) : '';
    let selectSql;
    if (options?.head && options?.count) {
      selectSql = 'COUNT(*) AS count';
    } else if (columns === '*') {
      selectSql = '*';
    } else {
      // Filter requested columns to only those that exist in the table
      const existingCols = getTableCols(table);
      const requestedCols = columns.split(',').map(c => c.trim()).filter(c => /^[_a-zA-Z][_a-zA-Z0-9]*$/.test(c));
      const safeCols = existingCols.size > 0 ? requestedCols.filter(c => existingCols.has(c)) : requestedCols;
      selectSql = safeCols.length > 0 ? safeCols.join(', ') : '*';
    }
    const result = query('SELECT ' + selectSql + ' FROM ' + table + whereSql + orderSql + limitSql, params);
    const rows = normalizeRows(table, result.rows);
    const count = options?.count ? (options.head ? (rows[0]?.count || 0) : rows.length) : null;
    res.json({ data: options?.head ? null : rows, error: null, count });
  } catch (error) { next(error); }
});

app.get('/api/db/plan-linked-details/:id', requireUser, async (req, res, next) => {
  try {
    const planId = req.params.id;
    const { role: userRole, id: userId } = req.user;

    // Check SHARED_DATA from process.env or default to true
    const sharedData = String(process.env.VITE_SHARED_DATA ?? 'true') === 'true';

    // Determine if we need to filter by user_id
    const scopeUser = (sharedData || userRole === 'master' || userRole === 'admin') ? null : userId;

    let testCaseCount = 0;
    let executionCount = 0;
    let defectCount = 0;
    let testCases = [];
    let executions = [];
    let defects = [];

    // 1. Test Cases
    const tcParams = scopeUser ? [planId, scopeUser] : [planId];
    const tcCountSql = 'SELECT COUNT(*) AS count FROM test_cases WHERE plan_id = ?' + (scopeUser ? ' AND user_id = ?' : '');
    const tcCountRes = query(tcCountSql, tcParams);
    testCaseCount = tcCountRes.rows[0]?.count || 0;

    const tcListSql = 'SELECT id, title, sequence FROM test_cases WHERE plan_id = ?' + (scopeUser ? ' AND user_id = ?' : '') + ' LIMIT 5';
    const tcListRes = query(tcListSql, tcParams);
    testCases = tcListRes.rows || [];

    // 2. Test Executions
    const exeParams = scopeUser ? [planId, scopeUser] : [planId];
    const exeCountSql = 'SELECT COUNT(*) AS count FROM test_executions WHERE plan_id = ?' + (scopeUser ? ' AND user_id = ?' : '');
    const exeCountRes = query(exeCountSql, exeParams);
    executionCount = exeCountRes.rows[0]?.count || 0;

    const exeListSql = 'SELECT id, status, sequence FROM test_executions WHERE plan_id = ?' + (scopeUser ? ' AND user_id = ?' : '') + ' LIMIT 5';
    const exeListRes = query(exeListSql, exeParams);
    executions = exeListRes.rows || [];

    // 3. Defects
    const defParams = scopeUser ? [planId, scopeUser] : [planId];
    const defCountSql = 'SELECT COUNT(*) AS count FROM defects WHERE plan_id = ?' + (scopeUser ? ' AND user_id = ?' : '');
    const defCountRes = query(defCountSql, defParams);
    defectCount = defCountRes.rows[0]?.count || 0;

    const defListSql = 'SELECT id, title, status, severity FROM defects WHERE plan_id = ?' + (scopeUser ? ' AND user_id = ?' : '') + ' LIMIT 5';
    const defListRes = query(defListSql, defParams);
    defects = defListRes.rows || [];

    res.json({
      data: {
        testCaseCount,
        executionCount,
        defectCount,
        testCases,
        executions,
        defects
      },
      error: null
    });
  } catch (error) { next(error); }
});

app.post('/api/db/mutate', requireUser, async (req, res, next) => {
  try {
    const { table, action, values, filters = [], options = {} } = req.body || {};
    if (!ALLOWED_TABLES.has(table)) return res.status(400).json({ error: { message: 'Tabela nao permitida.' } });

    // --- SECURITY: Require filters for update and delete ---
    if (action === 'update' || action === 'delete') {
      if (!filters || !Array.isArray(filters) || filters.length === 0) {
        return res.status(400).json({ error: { message: 'Operacoes de update/delete exigem pelo menos um filtro de restricao.' } });
      }
    }

    // --- SECURITY: RBAC & Anti-Privilege Escalation ---
    const { role: userRole, id: userId } = req.user;
    const personalTables = ['api_keys', 'user_settings', 'notification_preferences', 'role_requests', 'activity_logs', 'notifications'];

    // Prevent modifying other users' personal data (IDOR mitigation)
    if (personalTables.includes(table)) {
      if (action === 'insert' || action === 'upsert') {
        const isArrayValues = Array.isArray(values);
        const rowsToCheck = isArrayValues ? values : (values ? [values] : []);
        for (const r of rowsToCheck) {
          if (!r.user_id) {
            r.user_id = userId;
          } else if (r.user_id !== userId && userRole !== 'master' && userRole !== 'admin') {
            return res.status(403).json({ error: { message: 'Acesso negado: Tentativa de IDOR em dados de outro usuário.' } });
          }
        }
      } else if (action === 'update' || action === 'delete') {
        const hasIdorFilter = filters.some(f => f.column === 'user_id' && f.value !== userId && userRole !== 'master' && userRole !== 'admin');
        if (hasIdorFilter) {
          return res.status(403).json({ error: { message: 'Acesso negado: Tentativa de IDOR em dados de outro usuário.' } });
        }
        const checkParams = [];
        const checkWhere = buildWhere(filters, checkParams);
        const { rows: existingRows } = query('SELECT user_id FROM ' + table + checkWhere, checkParams);
        for (const r of existingRows) {
          if (r.user_id && r.user_id !== userId && userRole !== 'master' && userRole !== 'admin') {
            return res.status(403).json({ error: { message: 'Acesso negado: Tentativa de IDOR em dados de outro usuário.' } });
          }
        }
      }
    }

    if (userRole === 'viewer') {
      if (!personalTables.includes(table)) {
        if (table === 'profiles' && action === 'update' && filters.some(f => f.column === 'id' && f.value === userId)) {
          if (values?.role) return res.status(403).json({ error: { message: 'Permissão negada: Escalação de privilégio.' } });
        } else {
          return res.status(403).json({ error: { message: 'Permissão negada: Perfil viewer não pode alterar esta tabela.' } });
        }
      }
    }

    if (userRole !== 'master' && userRole !== 'admin') {
      const perms = req.user.permissions || {};
      if (table === 'projects' && action === 'delete' && !perms.can_delete_projects) {
        return res.status(403).json({ error: { message: 'Permissão negada: can_delete_projects.' } });
      }
      if (table === 'projects' && (action === 'insert' || action === 'update') && !perms.can_manage_projects) {
        return res.status(403).json({ error: { message: 'Permissão negada: can_manage_projects.' } });
      }
      if ((table === 'test_plans' || table === 'requirements') && !perms.can_manage_plans) {
        return res.status(403).json({ error: { message: 'Permissão negada: can_manage_plans.' } });
      }
      if (table === 'test_cases' && !perms.can_manage_cases) {
        return res.status(403).json({ error: { message: 'Permissão negada: can_manage_cases.' } });
      }
      if ((table === 'test_executions' || table === 'test_runs' || table === 'defects') && !perms.can_manage_executions) {
        return res.status(403).json({ error: { message: 'Permissão negada: can_manage_executions.' } });
      }
    }

    if (table === 'profiles' && values?.role && userRole !== 'master' && userRole !== 'admin') {
      return res.status(403).json({ error: { message: 'Acesso negado: Apenas administradores podem alterar roles.' } });
    }
    if (table === 'user_permissions' && userRole !== 'master' && userRole !== 'admin') {
      return res.status(403).json({ error: { message: 'Acesso negado: Apenas administradores podem alterar permissões.' } });
    }
    // --- END SECURITY ---
    const client = getClient();
    try {
      let result;
      if (action === 'insert' || action === 'upsert') {
        const rawRows = Array.isArray(values) ? values : [values];
        if (!rawRows.length) return res.json({ data: [], error: null });

        // Validacao por linha (bloqueia em caso de payload invalido)
        for (const r of rawRows) {
          const err = validateRow(table, r, { isUpdate: false, db: client });
          if (err) return res.status(400).json({ error: { message: `Validacao (${table}): ${err}` } });
        }

        // Notifications: exige user_id destino valido (cross-user e feature legitima).
        // Log-trail via activity_logs cobre auditoria de quem criou.
        if (table === 'notifications') {
          for (const r of rawRows) {
            if (!r.user_id || typeof r.user_id !== 'string' || r.user_id.length < 8) {
              return res.status(400).json({ error: { message: 'Notificacao exige user_id valido.' } });
            }
          }
        }

        let nextSeq = null; // inicializado na 1ª linha sem sequence para evitar duplicatas em lote
        const rows = rawRows.map((row) => {
          const r = serializeForDb(table, row);

          // Auto-populacao de project_id para test_cases e test_executions se estiver faltando mas existir plan_id
          if ((table === 'test_cases' || table === 'test_executions' || table === 'defects') && !r.project_id && r.plan_id) {
            const { rows: pRows } = query('SELECT project_id FROM test_plans WHERE id = ?', [r.plan_id]);
            if (pRows.length) r.project_id = pRows[0].project_id;
          }

          const base = r.id ? r : { id: randomUUID(), ...r };
          const filtered = filterToTableCols(table, base);
          if (filtered.sequence == null) {
            if (nextSeq === null) {
              nextSeq = getNextSequence(table, filtered.project_id);
            }
            if (nextSeq !== null) {
              filtered.sequence = nextSeq++;
            }
          }
          return filtered;
        });
        // Union de todas as colunas para garantir alinhamento em batch inserts
        const colSet = new Set();
        rows.forEach(row => Object.keys(row).forEach(k => colSet.add(k)));
        const cols = Array.from(colSet);
        const conflictCols = String(options?.onConflict || '').split(',').map((s) => s.trim()).filter(Boolean);
        const updateCols = cols.filter((c) => !conflictCols.includes(c));
        const onConflict = options?.onConflict
          ? (updateCols.length > 0
            ? ' ON CONFLICT (' + conflictCols.join(', ') + ') DO UPDATE SET ' + updateCols.map((c) => c + ' = excluded.' + c).join(', ')
            : ' ON CONFLICT (' + conflictCols.join(', ') + ') DO NOTHING')
          : '';
        // better-sqlite3: inserir cada row individualmente para evitar
        // desalinhamento de parâmetros em batch com colunas heterogêneas
        const allInserted = [];
        for (const row of rows) {
          const rowParams = [];
          const placeholders = cols.map((col) => { rowParams.push(row[col] !== undefined ? row[col] : null); return '?'; });
          const sql = 'INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + placeholders.join(', ') + ')' + (action === 'upsert' ? onConflict : '') + ' RETURNING *';
          const r = client.query(sql, rowParams);
          allInserted.push(...(r.rows || []));
        }
        result = { rows: allInserted, rowCount: allInserted.length };

        // Broadcast new notifications in real-time via SSE
        if (table === 'notifications') {
          for (const inserted of allInserted) {
            if (inserted.user_id) {
              broadcastNotification(inserted.user_id, { type: 'notification', payload: inserted });
            }
          }
        }
      } else if (action === 'update') {
        const errV = validateRow(table, values, { isUpdate: true });
        if (errV) return res.status(400).json({ error: { message: `Validacao (${table}): ${errV}` } });

        if ((table === 'defects' || table === 'requirements' || table === 'test_runs') && values?.status) {
          const preParams = [];
          const preWhere = buildWhere(filters, preParams);
          const { rows: preRows } = query('SELECT id, status FROM ' + table + preWhere, preParams);
          const checker = table === 'defects' ? canTransitionDefect
            : table === 'requirements' ? canTransitionRequirement
              : canTransitionRun;
          for (const r of preRows) {
            if (!checker(r.status, values.status)) {
              return res.status(400).json({
                error: { message: `Transicao invalida em ${table}: ${r.status} -> ${values.status}` },
              });
            }
          }
        }

        const allowed = getTableCols(table);
        const entries = Object.entries(serializeForDb(table, values) || {})
          .filter(([key]) => !allowed.size || allowed.has(key));
        if (!entries.length) {
          return res.status(400).json({ error: { message: `Nenhum campo valido para atualizar em '${table}'.` } });
        }
        const params = [];
        const setSql = entries.map(([key, val]) => { params.push(val); return key + ' = $' + params.length; }).join(', ');
        const whereSql = buildWhere(filters, params);
        result = client.query('UPDATE ' + table + ' SET ' + setSql + whereSql + ' RETURNING *', params);
      } else if (action === 'delete') {
        const params = [];
        const whereSql = buildWhere(filters, params);
        result = client.query('DELETE FROM ' + table + whereSql + ' RETURNING *', params);
      } else {
        return res.status(400).json({ error: { message: 'Acao invalida.' } });
      }
      res.json({ data: normalizeRows(table, result.rows), error: null });
    } finally {
      client.release();
    }
  } catch (error) { next(error); }
});

app.post('/api/mutate/unified', requireUser, (req, res, next) => {
  const { plan, cases } = req.body;
  if (!plan || !plan.project_id) {
    return res.status(400).json({ error: { message: 'Plano e project_id sao obrigatorios.' } });
  }

  // Permissao Viewer: bloqueia mutacoes
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: { message: 'Permissão negada: Visualizadores não podem criar planos.' } });
  }

  try {
    const result = transaction(() => {
      // 1. Criar o Plano
      const planId = plan.id || randomUUID();
      const planRow = filterToTableCols('test_plans', {
        ...serializeForDb('test_plans', plan),
        id: planId,
        user_id: req.user.id,
        sequence: getNextSequence('test_plans', plan.project_id),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const pCols = Object.keys(planRow);
      const pVals = Object.values(planRow);
      const pSql = `INSERT INTO test_plans (${pCols.join(',')}) VALUES (${pCols.map(() => '?').join(',')}) RETURNING *`;
      const planResult = query(pSql, pVals).rows[0];

      // 2. Criar os Casos
      const caseResults = [];
      if (Array.isArray(cases)) {
        let nextCaseSeq = getNextSequence('test_cases', plan.project_id);
        for (const c of cases) {
          const caseRow = filterToTableCols('test_cases', {
            ...serializeForDb('test_cases', c),
            id: c.id || randomUUID(),
            plan_id: planId,
            project_id: plan.project_id,
            user_id: req.user.id,
            sequence: nextCaseSeq++,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          const cCols = Object.keys(caseRow);
          const cVals = Object.values(caseRow);
          const cSql = `INSERT INTO test_cases (${cCols.join(',')}) VALUES (${cCols.map(() => '?').join(',')}) RETURNING *`;
          const cRes = query(cSql, cVals).rows[0];
          caseResults.push(cRes);
        }
      }

      return { plan: planResult, cases: caseResults };
    })();

    res.json({
      data: {
        plan: normalizeRows('test_plans', [result.plan])[0],
        cases: normalizeRows('test_cases', result.cases)
      },
      error: null
    });
  } catch (error) {
    logger.error('[api] Erro na mutação unificada:', error.message);
    res.status(500).json({ error: { message: 'Erro ao salvar fluxo unificado.' } });
  }
});

// Relatorio agregado para o Dashboard (Otimizacao T02)
app.get('/api/reports/dashboard', requireUser, (req, res, next) => {
  try {
    const projectId = req.query.project_id;
    const userId = req.user.id;

    const whereProject = projectId ? 'WHERE project_id = ?' : '';
    const params = projectId ? [projectId] : [];

    // 1. Overview counts
    const overview = {
      totalPlans: Number(query(`SELECT COUNT(*) as count FROM test_plans ${whereProject}`, params).rows[0].count),
      totalCases: Number(query(`SELECT COUNT(*) as count FROM test_cases ${whereProject}`, params).rows[0].count),
      totalExecutions: Number(query(`SELECT COUNT(*) as count FROM test_executions ${whereProject}`, params).rows[0].count),
      totalRequirements: Number(query(`SELECT COUNT(*) as count FROM requirements ${whereProject}`, params).rows[0].count),
      totalDefects: Number(query(`SELECT COUNT(*) as count FROM defects ${whereProject} ${projectId ? 'AND' : 'WHERE'} status != 'closed'`, params).rows[0].count),
      aiGenerated: Number(query(`SELECT COUNT(*) as count FROM test_cases ${whereProject} ${projectId ? 'AND' : 'WHERE'} generated_by_ai = 1`, params).rows[0].count) +
        Number(query(`SELECT COUNT(*) as count FROM test_plans ${whereProject} ${projectId ? 'AND' : 'WHERE'} generated_by_ai = 1`, params).rows[0].count)
    };

    // 2. Execution distribution
    const execStats = query(`SELECT status, COUNT(*) as count FROM test_executions ${whereProject} GROUP BY status`, params).rows;

    // 3. Defect distribution
    const defectStats = query(`SELECT status, severity, COUNT(*) as count FROM defects ${whereProject} GROUP BY status, severity`, params).rows;

    // 4. Progress by plan (top 5)
    const planProgress = query(`
      SELECT 
        p.id, p.title, p.sequence, p.updated_at,
        (SELECT COUNT(*) FROM test_cases WHERE plan_id = p.id) as case_count,
        (SELECT COUNT(*) FROM test_executions WHERE plan_id = p.id) as exec_count
      FROM test_plans p
      ${whereProject}
      ORDER BY p.updated_at DESC
      LIMIT 10
    `, params).rows;

    // 5. Recent items (combined)
    // Para simplificar e manter performance, pegamos os ultimos de cada e unimos no JS
    const recentPlans = query(`SELECT id, title, updated_at, generated_by_ai FROM test_plans ${whereProject} ORDER BY updated_at DESC LIMIT 5`, params).rows.map(r => ({ ...r, type: 'plan' }));
    const recentCases = query(`SELECT id, title, updated_at, generated_by_ai FROM test_cases ${whereProject} ORDER BY updated_at DESC LIMIT 5`, params).rows.map(r => ({ ...r, type: 'case' }));
    const recentExecs = query(`SELECT id, 'Execução #' || substr(id, 1, 6) as title, executed_at as updated_at FROM test_executions ${whereProject} ORDER BY executed_at DESC LIMIT 5`, params).rows.map(r => ({ ...r, type: 'execution' }));

    res.json({
      overview,
      execStats,
      defectStats,
      planProgress,
      recent: [...recentPlans, ...recentCases, ...recentExecs].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 10)
    });
  } catch (error) { next(error); }
});

// Progresso agregado de um test_run: contagem por status de execucoes vinculadas
app.get('/api/runs/:id/progress', requireUser, (req, res, next) => {
  try {
    const runId = String(req.params.id || '');
    if (!runId) return res.status(400).json({ error: { message: 'run id obrigatorio' } });
    const { rows: runRows } = query('SELECT id, title, status, project_id, plan_id FROM test_runs WHERE id = ?', [runId]);
    const run = runRows[0];
    if (!run) return res.status(404).json({ error: { message: 'Run nao encontrado.' } });
    const { rows } = query(
      "SELECT status, COUNT(*) AS count FROM test_executions WHERE run_id = ? GROUP BY status",
      [runId]
    );
    const totals = { passed: 0, failed: 0, blocked: 0, not_tested: 0, total: 0 };
    for (const r of rows) {
      const s = String(r.status || '');
      const n = Number(r.count) || 0;
      if (s in totals) totals[s] = n;
      totals.total += n;
    }
    const completionRate = totals.total > 0 ? (totals.passed + totals.failed + totals.blocked) / totals.total : 0;
    const passRate = (totals.passed + totals.failed) > 0 ? totals.passed / (totals.passed + totals.failed) : 0;
    res.json({ data: { run, totals, completionRate, passRate }, error: null });
  } catch (error) { next(error); }
});

app.post('/api/rpc/:name', requireUser, async (req, res, next) => {
  try {
    const { name } = req.params;
    if (name === 'list_all_users') {
      const { rows } = query('SELECT id, email, display_name, role, created_at FROM profiles ORDER BY display_name, email');
      // Retorna datas em formato ISO para parse correto no frontend
      const rowsWithIsoDates = rows.map(r => ({
        ...r,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : r.created_at
      }));
      return res.json({ data: rowsWithIsoDates, error: null });
    }
    if (name === 'sync_profiles_from_auth') {
      return res.json({ data: { synced: true }, error: null });
    }
    return res.status(404).json({ error: { message: 'RPC nao implementado.' } });
  } catch (error) { next(error); }
});

app.post('/api/reports/aggregate', requireUser, async (req, res, next) => {
  try {
    const { type, filters = {} } = req.body || {};
    const { dateFrom, dateTo } = filters;
    const dateClauses = [];
    const dateParams = [];
    if (dateFrom) { dateParams.push(dateFrom); dateClauses.push('executed_at >= \$' + dateParams.length); }
    if (dateTo) { dateParams.push(dateTo); dateClauses.push('executed_at <= \$' + dateParams.length); }
    const baseWhere = dateClauses.length ? ' WHERE ' + dateClauses.join(' AND ') : '';

    if (type === 'trend-analysis') {
      const granularity = String(filters.granularity || 'day');
      const dateFmt = granularity === 'month' ? '%Y-%m' : granularity === 'week' ? '%Y-W%W' : '%Y-%m-%d';
      const sql = "SELECT strftime('" + dateFmt + "', executed_at) AS bucket, SUM(CASE WHEN status='passed' THEN 1 ELSE 0 END) AS passed, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed, SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) AS blocked, SUM(CASE WHEN status='not_tested' THEN 1 ELSE 0 END) AS not_tested, COUNT(*) AS total FROM test_executions WHERE executed_at IS NOT NULL" + (dateClauses.length ? ' AND ' + dateClauses.join(' AND ') : '') + " GROUP BY 1 ORDER BY 1";
      const { rows } = query(sql, dateParams);
      const totals = rows.reduce((a, c) => ({ passed: a.passed + Number(c.passed), failed: a.failed + Number(c.failed), blocked: a.blocked + Number(c.blocked), not_tested: a.not_tested + Number(c.not_tested), total: a.total + Number(c.total) }), { passed: 0, failed: 0, blocked: 0, not_tested: 0, total: 0 });
      return res.json({ type, generatedAt: new Date().toISOString(), data: { series: rows, totals, granularity } });
    }

    if (type === 'failure-analysis') {
      const { rows } = query('SELECT id, case_id, plan_id, status, executed_at FROM test_executions' + baseWhere, dateParams);
      const failed = rows.filter((r) => r.status === 'failed');
      const caseCount = new Map();
      const planCount = new Map();
      for (const r of failed) {
        if (r.case_id) caseCount.set(r.case_id, (caseCount.get(r.case_id) || 0) + 1);
        if (r.plan_id) planCount.set(r.plan_id, (planCount.get(r.plan_id) || 0) + 1);
      }
      const caseIds = [...caseCount.keys()];
      const planIds = [...planCount.keys()];
      const caseRows = caseIds.length
        ? query('SELECT id, title FROM test_cases WHERE id IN (' + caseIds.map((_, i) => '\$' + (i + 1)).join(', ') + ')', caseIds).rows
        : [];
      const planRows = planIds.length
        ? query('SELECT id, title FROM test_plans WHERE id IN (' + planIds.map((_, i) => '\$' + (i + 1)).join(', ') + ')', planIds).rows
        : [];
      const caseMap = new Map(caseRows.map((r) => [r.id, r.title]));
      const planMap = new Map(planRows.map((r) => [r.id, r.title]));
      return res.json({
        type, generatedAt: new Date().toISOString(), data: {
          totals: { totalExecutions: rows.length, failedExecutions: failed.length, failureRate: rows.length ? failed.length / rows.length : 0, lastFailedAt: failed[0]?.executed_at || null },
          topCases: caseIds.map((id) => ({ id, title: caseMap.get(id) || id, count: caseCount.get(id) })).sort((a, b) => b.count - a.count).slice(0, 20),
          topPlans: planIds.map((id) => ({ id, title: planMap.get(id) || id, count: planCount.get(id) })).sort((a, b) => b.count - a.count).slice(0, 20),
        }
      });
    }

    if (type === 'requirements-defects') {
      const projectId = filters?.projectId || null;
      const projClause = projectId ? ' WHERE project_id = ?' : '';
      const projParams = projectId ? [projectId] : [];
      const { rows: reqs } = query('SELECT status, priority FROM requirements' + projClause, projParams);
      const { rows: defs } = query('SELECT status, severity FROM defects' + projClause, projParams);
      const countBy = (rowArr, key) => rowArr.reduce((acc, row) => ({ ...acc, [row[key]]: (acc[row[key]] || 0) + 1 }), {});
      return res.json({
        type, generatedAt: new Date().toISOString(), data: {
          totals: { requirements: reqs.length, defects: defs.length },
          requirementsByStatus: countBy(reqs, 'status'),
          requirementsByPriority: countBy(reqs, 'priority'),
          defectsBySeverity: countBy(defs, 'severity'),
          defectsByStatus: countBy(defs, 'status'),
        }
      });
    }

    res.status(400).json({ error: { message: 'Tipo de relatorio nao suportado.' } });
  } catch (error) { next(error); }
});

// Extrai texto e imagens de arquivos .pptx
// Retorna TODAS as imagens por slide agrupadas por número de slide
// (slide com 2 capturas side-by-side gera slide_N_1 e slide_N_2)
async function extractFromPptx(filePath) {
  try {
    const data = await fs.readFile(filePath);
    const zip = await JSZip.loadAsync(data);

    const slideFiles = Object.keys(zip.files)
      .filter(n => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
        const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
        return numA - numB;
      });

    const texts = [];
    // slideNum → ordered array of {mediaPath, rId} (order = relationship declaration order)
    const slideMediaMap = new Map();
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

    for (const slideFile of slideFiles) {
      const slideNumMatch = slideFile.match(/slide(\d+)\.xml$/);
      if (!slideNumMatch) continue;
      const slideNum = parseInt(slideNumMatch[1], 10);

      // Extract text
      const xml = await zip.files[slideFile].async('text');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const tNodes = doc.getElementsByTagName('a:t');
      const slideTexts = [];
      for (let i = 0; i < tNodes.length; i++) {
        const t = tNodes[i].textContent || '';
        if (t.trim()) slideTexts.push(t);
      }
      if (slideTexts.length) {
        texts.push(`=== Slide ${slideNum} ===\n${slideTexts.join('\n')}`);
      }

      // Read relationships — preserve declaration order (= visual order in slide)
      const relFile = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
      const mediaList = [];
      if (zip.files[relFile]) {
        try {
          const relXml = await zip.files[relFile].async('text');
          const relParser = new DOMParser();
          const relDoc = relParser.parseFromString(relXml, 'text/xml');
          const rels = relDoc.getElementsByTagName('Relationship');
          for (let i = 0; i < rels.length; i++) {
            const type = rels[i].getAttribute('Type') || '';
            const target = rels[i].getAttribute('Target') || '';
            const rId = rels[i].getAttribute('Id') || `r${i}`;
            if (type.includes('/image') && target) {
              const cleanTarget = target.replace(/^\.\.\//, 'ppt/');
              if (zip.files[cleanTarget]) {
                const lowerExt = cleanTarget.toLowerCase();
                if (imageExts.some(e => lowerExt.endsWith(e))) {
                  mediaList.push({ mediaPath: cleanTarget, rId });
                }
              }
            }
          }
        } catch (relErr) {
          logger.warn(`Erro ao ler relações de slide ${slideNum}:`, relErr.message);
        }
      }

      if (mediaList.length > 0) {
        slideMediaMap.set(slideNum, mediaList);
      }
    }

    // Extract ALL images per slide, naming slide_N.ext (single) or slide_N_1.ext / slide_N_2.ext (multiple)
    const images = [];
    for (const [slideNum, mediaList] of slideMediaMap.entries()) {
      const hasMultiple = mediaList.length > 1;
      for (let idx = 0; idx < mediaList.length; idx++) {
        const { mediaPath } = mediaList[idx];
        try {
          const ext = path.extname(mediaPath).toLowerCase().replace('.', '');
          const mime = ext === 'jpg' ? 'jpeg' : ext;
          const buffer = await zip.files[mediaPath].async('nodebuffer');
          const base64 = buffer.toString('base64');
          if (base64.length > 10 * 1024 * 1024) continue; // skip > 10MB

          const name = hasMultiple
            ? `slide_${slideNum}_${idx + 1}.${ext}`
            : `slide_${slideNum}.${ext}`;

          images.push({
            name,
            dataUrl: `data:image/${mime};base64,${base64}`,
            slides: [slideNum]
          });
        } catch (imgErr) {
          logger.warn(`Erro ao extrair imagem do slide ${slideNum} [${idx}]:`, imgErr.message);
        }
      }
    }

    // Sort: by slide number, then by position within slide
    images.sort((a, b) => {
      const sA = a.slides[0] || 0, sB = b.slides[0] || 0;
      if (sA !== sB) return sA - sB;
      return a.name.localeCompare(b.name);
    });

    return { text: texts.join('\n\n'), images };
  } catch (e) {
    throw new Error(`Erro ao extrair conteúdo do PPTX: ${e.message}`);
  }
}

app.post('/api/storage/upload', requireUser, upload.single('file'), async (req, res) => {


  res.json({ path: req.file.filename, publicUrl: '/uploads/' + req.file.filename });
});

// Endpoint para extrair conteúdo de documentos (PPTX com imagens, TXT, etc)
app.post('/api/documents/extract', requireUser, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: { message: 'Nenhum arquivo enviado.' } });
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let result = { text: '', images: [] };
    if (ext === '.pptx') {
      result = await extractFromPptx(filePath);
    } else if (ext === '.txt' || ext === '.md' || req.file.mimetype === 'text/plain') {
      result.text = await fs.readFile(filePath, 'utf-8');
    } else if (ext === '.pdf') {
      const buffer = await fs.readFile(filePath);
      const parsed = await pdfParse(buffer);
      result.text = parsed.text || '';
    } else if (ext === '.docx') {
      const buffer = await fs.readFile(filePath);
      const { value } = await mammoth.extractRawText({ buffer });
      result.text = value || '';
    } else if (ext === '.doc') {
      const buffer = await fs.readFile(filePath);
      try {
        const { value } = await mammoth.extractRawText({ buffer });
        result.text = value || '';
      } catch {
        result.text = '(Arquivo .doc legado — conteúdo não pôde ser extraído automaticamente. Por favor, salve como .docx ou cole o conteúdo manualmente.)';
      }
    } else if (ext === '.xlsx' || ext === '.xls') {
      result.text = '(Arquivo Excel detectado — cole o conteúdo das células relevantes no campo de Requisitos abaixo para melhor análise.)';
    } else {
      await fs.unlink(filePath).catch(() => { });
      return res.status(400).json({ error: { message: `Formato '${ext}' não suportado. Use .pptx, .pdf, .docx, .doc ou .txt` } });
    }
    await fs.unlink(filePath).catch(() => { });
    res.json({
      text: result.text,
      images: result.images,
      filename: req.file.originalname,
      format: ext.slice(1)
    });
  } catch (error) { next(error); }
});

// ── API Keys (LLM) — criptografadas em repouso com AES-256-GCM ─────────────
// GET /api/ai/keys            -> lista {provider, model_id, has_key} (nunca a chave)
// POST /api/ai/keys           -> body: { provider, model_id?, key }  (salva/atualiza)
// DELETE /api/ai/keys         -> body: { provider, model_id? }
// POST /api/ai/keys/reveal    -> body: { provider, model_id? } -> { key } (somente dono)
// Regra: sempre escopado ao req.user.id. Nunca se recupera chave de outro usuario.

const VALID_PROVIDERS = new Set(['gemini', 'openai', 'anthropic', 'groq', 'openrouter', 'ollama']);

function sanitizeProvider(p) {
  const v = String(p || '').toLowerCase().trim();
  return VALID_PROVIDERS.has(v) ? v : null;
}

app.get('/api/ai/keys', requireUser, (req, res, next) => {
  try {
    const { rows } = query(
      'SELECT provider, model_id, created_at, updated_at FROM api_keys WHERE user_id = ? ORDER BY provider, model_id',
      [req.user.id]
    );
    res.json({ data: rows.map(r => ({ ...r, has_key: true })), error: null });
  } catch (error) { next(error); }
});

app.post('/api/ai/keys', requireUser, (req, res, next) => {
  try {
    const provider = sanitizeProvider(req.body?.provider);
    if (!provider) return res.status(400).json({ error: { message: 'Provider invalido.' } });
    const modelId = String(req.body?.model_id || '').slice(0, 128);
    const key = String(req.body?.key || '').trim();
    if (!key) return res.status(400).json({ error: { message: 'Chave vazia.' } });
    if (key.length > 8192) return res.status(400).json({ error: { message: 'Chave muito longa.' } });
    const encrypted = encryptSecret(key);
    query(
      `INSERT INTO api_keys (user_id, provider, model_id, key_encrypted, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT (user_id, provider, model_id)
       DO UPDATE SET key_encrypted = excluded.key_encrypted, updated_at = datetime('now')`,
      [req.user.id, provider, modelId, encrypted]
    );
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.delete('/api/ai/keys', requireUser, (req, res, next) => {
  try {
    const provider = sanitizeProvider(req.body?.provider);
    if (!provider) return res.status(400).json({ error: { message: 'Provider invalido.' } });
    const modelId = String(req.body?.model_id || '').slice(0, 128);
    query('DELETE FROM api_keys WHERE user_id = ? AND provider = ? AND model_id = ?', [req.user.id, provider, modelId]);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

app.post('/api/ai/keys/reveal', requireUser, (req, res, next) => {
  try {
    const provider = sanitizeProvider(req.body?.provider);
    if (!provider) return res.status(400).json({ error: { message: 'Provider invalido.' } });
    const modelId = String(req.body?.model_id || '').slice(0, 128);
    // Tenta exato primeiro; fallback para model_id vazio (chave de provider)
    let { rows } = query(
      'SELECT key_encrypted FROM api_keys WHERE user_id = ? AND provider = ? AND model_id = ?',
      [req.user.id, provider, modelId]
    );
    if (!rows.length && modelId) {
      ({ rows } = query(
        'SELECT key_encrypted FROM api_keys WHERE user_id = ? AND provider = ? AND model_id = ?',
        [req.user.id, provider, '']
      ));
    }
    if (!rows.length) return res.status(404).json({ error: { message: 'Chave nao cadastrada.' } });
    try {
      const key = decryptSecret(rows[0].key_encrypted);
      res.json({ key });
    } catch (e) {
      logger.error('[security] Erro ao descriptografar chave:', e.message);
      res.status(500).json({ error: { message: 'Erro ao descriptografar chave. Verifique o segredo mestre.' } });
    }
  } catch (error) { next(error); }
});

// ── Reports Aggregator (Substitui Edge Functions do Supabase) ───────────────
app.post('/api/reports/aggregate', requireUser, (req, res, next) => {
  try {
    const { type, filters } = req.body;

    if (type === 'failure-analysis') {
      const dateFrom = filters?.dateFrom ? `${filters.dateFrom} 00:00:00` : '1970-01-01 00:00:00';
      const dateTo = filters?.dateTo ? `${filters.dateTo} 23:59:59` : '9999-12-31 23:59:59';

      // CTE para buscar totais de execuções no período e calcular métricas de falha no próprio SQLite
      const { rows: totalsRows } = query(`
        WITH stats AS (
          SELECT 
            COUNT(*) as totalExecutions,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedExecutions,
            MAX(CASE WHEN status = 'failed' THEN created_at ELSE NULL END) as lastFailedAt
          FROM test_executions
          WHERE created_at >= ? AND created_at <= ?
        )
        SELECT 
          totalExecutions,
          COALESCE(failedExecutions, 0) as failedExecutions,
          lastFailedAt,
          CASE WHEN totalExecutions > 0 THEN CAST(COALESCE(failedExecutions, 0) AS REAL) / totalExecutions ELSE 0 END as failureRate
        FROM stats
      `, [dateFrom, dateTo]);

      const totals = totalsRows[0] || { totalExecutions: 0, failedExecutions: 0, failureRate: 0, lastFailedAt: null };

      // Top 5 casos de teste com mais falhas
      const { rows: topCases } = query(`
        SELECT c.id, c.title, COUNT(e.id) as count
        FROM test_executions e
        JOIN test_cases c ON e.case_id = c.id
        WHERE e.status = 'failed' AND e.created_at >= ? AND e.created_at <= ?
        GROUP BY c.id
        ORDER BY count DESC
        LIMIT 5
      `, [dateFrom, dateTo]);

      // Top 5 planos de teste com mais falhas
      const { rows: topPlans } = query(`
        SELECT p.id, p.title, COUNT(e.id) as count
        FROM test_executions e
        JOIN test_plans p ON e.plan_id = p.id
        WHERE e.status = 'failed' AND e.created_at >= ? AND e.created_at <= ?
        GROUP BY p.id
        ORDER BY count DESC
        LIMIT 5
      `, [dateFrom, dateTo]);

      return res.json({
        type: 'failure-analysis',
        generatedAt: new Date().toISOString(),
        data: { totals, topCases, topPlans }
      });
    }

    if (type === 'trend-analysis') {
      // Retorna vazio por enquanto para evitar quebrar a interface
      return res.json({
        type: 'trend-analysis',
        generatedAt: new Date().toISOString(),
        data: { series: [], totals: { passed: 0, failed: 0, blocked: 0, not_tested: 0, total: 0 }, granularity: 'day' }
      });
    }

    if (type === 'requirements-defects') {
      // Retorna vazio por enquanto
      return res.json({
        type: 'requirements-defects',
        generatedAt: new Date().toISOString(),
        data: { totals: { requirements: 0, defects: 0 }, requirementsByStatus: {}, requirementsByPriority: {}, defectsBySeverity: {}, defectsByStatus: {} }
      });
    }

    return res.status(400).json({ error: { message: `Relatório do tipo '${type}' não suportado.` } });
  } catch (error) { next(error); }
});

// ── Cleanup Routine ─────────────────────────────────────────────────────────
function cleanupOldData() {
  try {
    // Manter as notificações lidas apenas por 7 dias, e não-lidas por 30 dias
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    query('DELETE FROM notifications WHERE read_at IS NOT NULL AND created_at < ?', [sevenDaysAgo.toISOString()]);
    query('DELETE FROM notifications WHERE created_at < ?', [thirtyDaysAgo.toISOString()]);

    // Limpar logs de atividade com mais de 90 dias
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    query('DELETE FROM activity_logs WHERE created_at < ?', [ninetyDaysAgo.toISOString()]);

    logger.info('[cleanup] Limpeza de dados antigos concluída.');
  } catch (e) {
    logger.warn('[cleanup] Falha na limpeza de dados:', e.message);
  }
}

// Executa limpeza no boot
cleanupOldData();
// E a cada 24 horas
setInterval(cleanupOldData, 24 * 60 * 60 * 1000);

app.use((error, _req, res, _next) => {
  logger.error(error);
  res.status(500).json({ error: { message: error?.message || 'Erro interno.' } });
});

app.listen(PORT, () => {
  logger.info('Nexus Testing API rodando em http://localhost:' + PORT);
});

process.on('SIGINT', () => {
  try { db.close(); } catch { }
  process.exit(0);
});
