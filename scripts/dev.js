/**
 * Nexus Testing - Dev Runner Multi-process (Zero External Dependencies & Node Compat)
 * Spawns both Backend API (Node) and Frontend (Vite) simultaneously with graceful shutdown.
 */

// ── Global Polyfill for AbortController & AbortSignal (for older Node versions) ──
if (typeof globalThis.AbortController === 'undefined') {
  class CustomAbortSignal {
    constructor() {
      this.aborted = false;
      this._listeners = [];
    }
    addEventListener(type, listener) {
      if (type === 'abort') this._listeners.push(listener);
    }
    removeEventListener(type, listener) {
      if (type === 'abort') {
        this._listeners = this._listeners.filter(l => l !== listener);
      }
    }
    _dispatch() {
      this.aborted = true;
      for (const listener of this._listeners) {
        try { listener(); } catch (err) { console.error(err); }
      }
    }
  }

  globalThis.AbortController = class CustomAbortController {
    constructor() {
      this.signal = new CustomAbortSignal();
    }
    abort() {
      this.signal._dispatch();
    }
  };
}

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

console.log('\x1b[36m%s\x1b[0m', '══════════════════════════════════════════════════════════════════════');
console.log('\x1b[36m%s\x1b[0m', '           NEXUS TESTING - INICIANDO AMBIENTE DE DESENVOLVIMENTO      ');
console.log('\x1b[36m%s\x1b[0m', '══════════════════════════════════════════════════════════════════════\n');

const majorVersion = parseInt(process.versions.node.split('.')[0], 10);
if (majorVersion < 18) {
  console.error('\x1b[31m%s\x1b[0m', `\n[ERRO CRÍTICO] Você está executando com Node.js v${process.versions.node} (antigo).`);
  console.error('\x1b[33m%s\x1b[0m', `O Nexus Testing e suas dependências nativas (better-sqlite3, Vite 6) requerem Node.js >= 18 (recomendado v22.23.0).`);
  console.error('\x1b[36m%s\x1b[0m', `Para corrigir no seu Prompt de Comando (CMD), execute:\n  nvm use 22.23.0\nOu execute diretamente o arquivo: dev.bat\n`);
}

// 1. Iniciar API Backend
console.log('\x1b[33m[SISTEMA]\x1b[0m Iniciando API Backend (Porta 4000)...');
const apiProcess = spawn('node', ['server/index.js'], {
  cwd: rootDir,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: isWindows,
  env: { ...process.env, FORCE_COLOR: '1' }
});

apiProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.log(`\x1b[36m[API]\x1b[0m ${line}`);
    }
  }
});

apiProcess.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.error(`\x1b[31m[API ERRO]\x1b[0m ${line}`);
    }
  }
});

// 2. Iniciar Frontend Vite
console.log('\x1b[33m[SISTEMA]\x1b[0m Iniciando Frontend Vite (Porta 5173)...');
const viteProcess = spawn(npxCmd, ['vite'], {
  cwd: rootDir,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: isWindows,
  env: { ...process.env, FORCE_COLOR: '1' }
});

viteProcess.stdout.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.log(`\x1b[35m[WEB]\x1b[0m ${line}`);
    }
  }
});

viteProcess.stderr.on('data', (data) => {
  const lines = data.toString().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.error(`\x1b[33m[WEB]\x1b[0m ${line}`);
    }
  }
});

// Encerramento limpo em Ctrl+C
const shutdown = () => {
  console.log('\n\x1b[33m[SISTEMA]\x1b[0m Encerrando servidores de desenvolvimento...');
  try {
    if (isWindows) {
      if (apiProcess.pid) spawn('taskkill', ['/pid', String(apiProcess.pid), '/f', '/t']);
      if (viteProcess.pid) spawn('taskkill', ['/pid', String(viteProcess.pid), '/f', '/t']);
    } else {
      apiProcess.kill('SIGINT');
      viteProcess.kill('SIGINT');
    }
  } catch { }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
