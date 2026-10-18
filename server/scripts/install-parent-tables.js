// 在 nexusmind 库内创建 3 张 Hongen* 家长/孩子表（幂等，不影响其他表）
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOSTNAME,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    multipleStatements: true,
  });

  const sql = fs.readFileSync(
    require('path').join(__dirname, '../prisma/parent-schema.sql'),
    'utf8',
  );
  await conn.query(sql);

  const [rows] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME LIKE 'Hongen%'
      ORDER BY TABLE_NAME`,
    [process.env.DB_DATABASE],
  );
  console.log('当前 Hongen* 表：');
  for (const r of rows) console.log('  -', r.TABLE_NAME);

  await conn.end();
})().catch((e) => {
  console.error('失败：', e.code || '', e.message);
  process.exit(1);
});
