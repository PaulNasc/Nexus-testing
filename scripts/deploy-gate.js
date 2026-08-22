/**
 * Nexus TCMS - Pre-deployment Quality & Security Gate
 * Garante que 100% dos testes, verificações de tipo, auditoria de segurança e build passem antes da publicação.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const steps = [
  { name: '1. Verificação Estática de Tipos (TypeScript)', cmd: 'npm run typecheck' },
  { name: '2. Auditoria de Segurança & Varredura de Vulnerabilidades', cmd: 'node scripts/security-audit.js' },
  { name: '3. Execução da Suíte de Testes Automatizados (Robô)', cmd: 'node scripts/test-runner.js' },
  { name: '4. Build e Otimização de Produção', cmd: 'npm run build' },
];

console.log('\n\x1b[1m\x1b[34m====================================================\x1b[0m');
console.log('\x1b[1m\x1b[34m  🚀 NEXUS TCMS — PRE-DEPLOYMENT GATEKEEPER        \x1b[0m');
console.log('\x1b[1m\x1b[34m====================================================\x1b[0m\n');

for (const step of steps) {
  console.log(`\x1b[1m\x1b[33m▶ Executando: ${step.name}...\x1b[0m`);
  try {
    execSync(step.cmd, { cwd: rootDir, stdio: 'inherit' });
    console.log(`\x1b[32m✔ [GATE PASSED] ${step.name}\x1b[0m\n`);
  } catch (error) {
    console.error(`\n\x1b[31m✖ [GATE FAILED] Falha crítica na etapa: ${step.name}\x1b[0m`);
    console.error('\x1b[31mO deploy foi bloqueado pelo Gatekeeper de Segurança e Qualidade.\x1b[0m\n');
    process.exit(1);
  }
}

console.log('\x1b[1m\x1b[32m====================================================\x1b[0m');
console.log('\x1b[1m\x1b[32m  🎉 TODOS OS GATES FORAM APROVADOS COM SUCESSO!   \x1b[0m');
console.log('\x1b[1m\x1b[32m  O sistema está 100% pronto para publicação.      \x1b[0m');
console.log('\x1b[1m\x1b[32m====================================================\x1b[0m\n');
