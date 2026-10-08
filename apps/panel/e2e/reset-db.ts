// Drops every table in the e2e database so each run starts from migrations. Refuses non-test databases.
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL ?? '';
if (!/\/servero_(e2e|test)$/.test(url)) throw new Error('reset-db only runs against servero_e2e / servero_test');
const conn = await mysql.createConnection({ uri: url, multipleStatements: true });
const [rows] = await conn.query('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()');
const tables = (rows as { t: string }[]).map((r) => '`' + r.t + '`');
if (tables.length) await conn.query(`SET FOREIGN_KEY_CHECKS = 0; DROP TABLE ${tables.join(', ')}; SET FOREIGN_KEY_CHECKS = 1;`);
await conn.end();
