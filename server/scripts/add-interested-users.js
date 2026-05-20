import { db } from '../db.js';
import { logger } from '../lib/logger.js';

async function run() {
  const tables = ['test_plans', 'test_cases', 'test_executions', 'defects'];
  
  for (const table of tables) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN interested_users TEXT DEFAULT '[]'`);
      logger.info(`Column 'interested_users' added to '${table}'`);
    } catch (e) {
      if (e.message.includes('duplicate column')) {
        logger.info(`Column 'interested_users' already exists in '${table}'`);
      } else {
        logger.error(`Error adding column to '${table}':`, e.message);
      }
    }
  }
}

run().catch(console.error);
