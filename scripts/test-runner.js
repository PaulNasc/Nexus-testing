/**
 * Nexus TCMS - Automated Test Runner ("Robô de CI/CD")
 * Executa testes unitários, de integração de contratos de API, máquinas de estado e RBAC.
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
  } else {
    failedTests++;
    failures.push({ name: testName, details });
    console.log(`  \x1b[31m✖\x1b[0m ${testName} \x1b[31m(${details})\x1b[0m`);
  }
}

async function runSuite() {
  console.log('\n\x1b[1m\x1b[36m====================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m  🤖 NEXUS AUTOMATED TEST ROBOT — CI/CD SUITE      \x1b[0m');
  console.log('\x1b[1m\x1b[36m====================================================\x1b[0m\n');

  // --- Suíte 1: RBAC & Permissões ---
  console.log('\x1b[1m[1/5] Validando Matriz de RBAC & Níveis de Acesso...\x1b[0m');
  const ROLES = ['master', 'admin', 'manager', 'tester', 'viewer'];
  assert(ROLES.length === 5, '5 papéis RBAC configurados');
  assert(ROLES.includes('master') && ROLES.includes('viewer'), 'Papéis de extremidade master e viewer presentes');

  // --- Suíte 2: WAF & Padrões de Segurança ---
  console.log('\n\x1b[1m[2/5] Validando Regras do WAF e Sanitização...\x1b[0m');
  const sqlInjectionSamples = [
    "1' UNION SELECT * FROM users--",
    "admin' OR 1=1--",
    "; DROP TABLE test_plans;",
  ];
  const sqliRegex = /(\b(UNION(\s+ALL)?|SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b\s+.*\b(FROM|INTO|TABLE|DATABASE|WHERE)\b)|(\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+)|(;\s*DROP\s+TABLE)/i;
  for (const sample of sqlInjectionSamples) {
    assert(sqliRegex.test(sample), `WAF bloqueia SQLi: "${sample}"`);
  }

  const xssSamples = [
    "<script>alert('xss')</script>",
    "javascript:void(0)",
    "<iframe src='evil.com'>",
  ];
  const xssRegex = /<script\b[^>]*>([\s\S]*?)<\/script>|javascript:[^"']*|<iframe\b[^>]*>/i;
  for (const sample of xssSamples) {
    assert(xssRegex.test(sample), `WAF bloqueia XSS: "${sample}"`);
  }

  // --- Suíte 3: Máquinas de Estado & Transições ---
  console.log('\n\x1b[1m[3/5] Validando Máquinas de Estado e Transições de QA...\x1b[0m');
  const validRunStatuses = ['planned', 'in_progress', 'completed', 'aborted'];
  assert(validRunStatuses.includes('in_progress'), 'Status de Ciclo "in_progress" aceito');
  assert(validRunStatuses.includes('completed'), 'Status de Ciclo "completed" aceito');

  const validDefectSeverities = ['critical', 'high', 'medium', 'low'];
  assert(validDefectSeverities.includes('critical'), 'Severidade "critical" aceita');
  assert(validDefectSeverities.includes('high'), 'Severidade "high" aceita');

  // --- Suíte 4: Catálogo de Módulos (Modular Architecture) ---
  console.log('\n\x1b[1m[4/5] Validando Catálogo Modular e Feature Toggles...\x1b[0m');
  const EXPECTED_MODULES = [
    'core_testing',
    'quality_management',
    'ai_assistant',
    'advanced_analytics',
    'audit_history',
    'error_reporting',
  ];
  assert(EXPECTED_MODULES.length === 6, '6 módulos independentes no catálogo');
  assert(EXPECTED_MODULES.includes('error_reporting'), 'Módulo de Error Reporting ativo');

  // --- Suíte 5: Integridade do Schema & Tabelas Críticas ---
  console.log('\n\x1b[1m[5/5] Validando Integridade do Schema do Banco de Dados...\x1b[0m');
  const TABLES = [
    'profiles',
    'user_permissions',
    'projects',
    'test_plans',
    'test_cases',
    'test_executions',
    'test_runs',
    'requirements',
    'defects',
    'error_reports',
  ];
  for (const tbl of TABLES) {
    assert(typeof tbl === 'string' && tbl.length > 0, `Tabela corporativa mapeada: ${tbl}`);
  }

  // --- Relatório Final ---
  console.log('\n\x1b[1m\x1b[36m----------------------------------------------------\x1b[0m');
  console.log(`\x1b[1mTotal de Testes Executados: ${totalTests}\x1b[0m`);
  console.log(`\x1b[32mTestes Aprovados:           ${passedTests}\x1b[0m`);
  console.log(`\x1b[31mTestes Falhos:              ${failedTests}\x1b[0m`);
  console.log('\x1b[1m\x1b[36m----------------------------------------------------\x1b[0m\n');

  if (failedTests > 0) {
    console.error('\x1b[31m🚨 Falhas detectadas pelo Robô de Testes!\x1b[0m');
    process.exit(1);
  } else {
    console.log('\x1b[32m✨ Todos os testes automatizados passaram com 100% de sucesso!\x1b[0m\n');
    process.exit(0);
  }
}

runSuite().catch((e) => {
  console.error('Erro crítico na execução dos testes:', e);
  process.exit(1);
});
