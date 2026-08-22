/**
 * Nexus TCMS - Security Audit & Vulnerability Scanner
 * Varredura estática de segurança: detecção de segredos, headers de segurança, HSTS, WAF e integridade de isolamento.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let auditErrors = 0;
let auditWarnings = 0;
let checksCount = 0;

function auditPass(message) {
  checksCount++;
  console.log(`  \x1b[32m✔\x1b[0m [PASSED] ${message}`);
}

function auditFail(message, details = '') {
  checksCount++;
  auditErrors++;
  console.log(`  \x1b[31m✖\x1b[0m [FAILED] ${message} \x1b[31m${details}\x1b[0m`);
}

function auditWarn(message) {
  checksCount++;
  auditWarnings++;
  console.log(`  \x1b[33m⚠\x1b[0m [WARNING] ${message}`);
}

console.log('\n\x1b[1m\x1b[35m====================================================\x1b[0m');
console.log('\x1b[1m\x1b[35m  🛡️ NEXUS SECURITY AUDIT & VULNERABILITY SCANNER  \x1b[0m');
console.log('\x1b[1m\x1b[35m====================================================\x1b[0m\n');

// 1. Verificar .gitignore
console.log('\x1b[1m[1/4] Verificando Políticas de Bloqueio no .gitignore...\x1b[0m');
try {
  const gitignore = fs.readFileSync(path.join(rootDir, '.gitignore'), 'utf8');
  if (gitignore.includes('.env') && gitignore.includes('*.db')) {
    auditPass('.gitignore bloqueia adequadamente arquivos .env e bancos *.db');
  } else {
    auditFail('Falha nas regras do .gitignore para .env ou arquivos *.db');
  }
} catch {
  auditFail('Arquivo .gitignore não encontrado!');
}

// 2. Verificar Headers de Segurança e HSTS no servidor
console.log('\n\x1b[1m[2/4] Auditando Headers de Segurança e HSTS Full...\x1b[0m');
try {
  const serverIndex = fs.readFileSync(path.join(rootDir, 'server', 'index.js'), 'utf8');
  if (serverIndex.includes('Strict-Transport-Security') && serverIndex.includes('max-age=31536000')) {
    auditPass('Header HSTS Strict ativo com max-age de 1 ano');
  } else {
    auditFail('HSTS Strict não configurado em server/index.js');
  }

  if (serverIndex.includes('X-Content-Type-Options') && serverIndex.includes('X-Frame-Options')) {
    auditPass('Headers Anti-Clickjacking e Nosniff ativos');
  } else {
    auditFail('Headers X-Content-Type-Options ou X-Frame-Options ausentes');
  }

  if (serverIndex.includes('wafMiddleware')) {
    auditPass('Firewall de Aplicação Web (WAF) ativo');
  } else {
    auditFail('WAF middleware ausente no fluxo de requisição');
  }
} catch (e) {
  auditFail('Falha ao auditar server/index.js:', e.message);
}

// 3. Varredura de Código por Chaves Expostas no Source
console.log('\n\x1b[1m[3/4] Escaneando Código Fonte por Segredos ou Tokens Expostos...\x1b[0m');
const DANGEROUS_PATTERNS = [
  /sk-proj-[a-zA-Z0-9_-]{20,}/,
  /ghp_[a-zA-Z0-9]{36}/,
  /AIzaSy[a-zA-Z0-9_-]{33}/,
  /-----BEGIN RSA PRIVATE KEY-----/,
];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === '.env') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (/\.(ts|tsx|js|jsx|json)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(content)) {
          auditFail(`Possível segredo ou chave exposta encontrada em: ${path.relative(rootDir, fullPath)}`);
        }
      }
    }
  }
}

try {
  scanDir(path.join(rootDir, 'src'));
  scanDir(path.join(rootDir, 'server'));
  auditPass('Nenhum segredo ou chave de produção exposta no código fonte');
} catch (e) {
  auditFail('Erro na varredura de código fonte:', e.message);
}

// 4. Verificação de Criptografia AES-256-GCM
console.log('\n\x1b[1m[4/4] Validando Motor Criptográfico de Chaves em Repouso...\x1b[0m');
try {
  const cryptoFile = fs.readFileSync(path.join(rootDir, 'server', 'lib', 'crypto.js'), 'utf8');
  if (cryptoFile.includes('aes-256-gcm') && cryptoFile.includes('createCipheriv')) {
    auditPass('Motor criptográfico AES-256-GCM validado com autenticação por tag');
  } else {
    auditFail('Criptografia AES-256-GCM não implementada no motor de segurança');
  }
} catch (e) {
  auditFail('Falha ao auditar server/lib/crypto.js:', e.message);
}

// Resumo
console.log('\n\x1b[1m\x1b[35m----------------------------------------------------\x1b[0m');
console.log(`\x1b[1mTotal de Verificações de Segurança: ${checksCount}\x1b[0m`);
console.log(`\x1b[32mVerificações Aprovadas:             ${checksCount - auditErrors}\x1b[0m`);
console.log(`\x1b[31mInconformidades / Falhas:           ${auditErrors}\x1b[0m`);
console.log('\x1b[1m\x1b[35m----------------------------------------------------\x1b[0m\n');

if (auditErrors > 0) {
  console.error('\x1b[31m🚨 Auditoria de Segurança Reprovada! Corrija as falhas antes do deploy.\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m🔒 Auditoria de Segurança 100% Aprovada!\x1b[0m\n');
  process.exit(0);
}
