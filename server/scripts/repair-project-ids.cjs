
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../data/nexus_testing.db');
const db = new Database(dbPath);

console.log('--- Inciando reparo de project_id ---');

// 1. Corrigir test_cases que estão sem project_id mas tem plan_id
const casesToFix = db.prepare(`
  UPDATE test_cases 
  SET project_id = (SELECT project_id FROM test_plans WHERE test_plans.id = test_cases.plan_id)
  WHERE project_id IS NULL AND plan_id IS NOT NULL
`).run();
console.log(`Test Cases atualizados: ${casesToFix.changes}`);

// 2. Corrigir test_executions que estão sem project_id mas tem plan_id ou case_id
const execsToFixPlan = db.prepare(`
  UPDATE test_executions
  SET project_id = (SELECT project_id FROM test_plans WHERE test_plans.id = test_executions.plan_id)
  WHERE project_id IS NULL AND plan_id IS NOT NULL
`).run();

const execsToFixCase = db.prepare(`
  UPDATE test_executions
  SET project_id = (SELECT project_id FROM test_cases WHERE test_cases.id = test_executions.case_id)
  WHERE project_id IS NULL AND case_id IS NOT NULL
`).run();
console.log(`Test Executions atualizados: ${execsToFixPlan.changes + execsToFixCase.changes}`);

// 3. Corrigir defects que estão sem project_id mas tem plan_id ou case_id
const defectsToFixPlan = db.prepare(`
  UPDATE defects
  SET project_id = (SELECT project_id FROM test_plans WHERE test_plans.id = defects.plan_id)
  WHERE project_id IS NULL AND plan_id IS NOT NULL
`).run();
console.log(`Defeitos atualizados: ${defectsToFixPlan.changes}`);

console.log('--- Reparo concluído ---');
db.close();
