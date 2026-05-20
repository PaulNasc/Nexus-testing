const Database = require('better-sqlite3');
const db = new Database('./server/local.db');
const crypto = require('crypto');

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS group_members (
    id TEXT PRIMARY KEY,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(group_id, user_id)
  );
`);

const defaultGroups = [
  { name: 'Desenvolvimento', color: '#10b981' },
  { name: 'Qualidade (QA)', color: '#8b5cf6' },
  { name: 'Negócios', color: '#f59e0b' },
  { name: 'Produto', color: '#ec4899' },
  { name: 'Infraestrutura', color: '#64748b' }
];

const insert = db.prepare('INSERT OR IGNORE INTO groups (id, name, color) VALUES (?, ?, ?)');
defaultGroups.forEach(g => {
  insert.run(crypto.randomUUID(), g.name, g.color);
});

console.log('Default groups seeded');
