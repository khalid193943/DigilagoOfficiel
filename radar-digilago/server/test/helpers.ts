import { pool } from '../src/db/pool.js';
import { migrate } from '../src/db/migrate.js';

export async function resetDb() {
  await migrate(() => {});
  await pool.query(`TRUNCATE users, sessions, discovery_jobs, companies, task_queue, source_usage, do_not_contact, audit_log, export_log, settings, lists RESTART IDENTITY CASCADE`);
}
