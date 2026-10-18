// 一次性跑 HongenStudentAccount 建表 SQL
// 用法：cd server && npx ts-node prisma/run-student-account-migration.ts
import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as mysql from 'mysql2/promise';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL 未设置（请检查 server/.env）');
    process.exit(1);
  }

  const file = resolve(__dirname, 'student-account-schema.sql');
  const sql = readFileSync(file, 'utf8');

  // mysql2 支持 mysql://user:pwd@host:port/db 格式
  const conn = await mysql.createConnection(url);
  console.log('✅ 已连接数据库');

  // 切分语句（脚本里是单条 CREATE TABLE，简单点直接 exec）
  try {
    await conn.query(sql);
    console.log('✅ HongenStudentAccount 建表成功');
  } catch (e: any) {
    if (String(e?.code) === 'ER_TABLE_EXISTS_ERROR') {
      console.log('ℹ️ 表已存在，跳过（幂等）');
    } else {
      console.error('❌ SQL 执行失败：', e?.message ?? e);
      await conn.end();
      process.exit(1);
    }
  }

  // 验证表存在
  const [rows] = await conn.query<any>(
    "SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'HongenStudentAccount'",
  );
  console.log('查询结果：', rows);
  await conn.end();
}

main().catch((e) => {
  console.error('未捕获错误：', e);
  process.exit(1);
});
