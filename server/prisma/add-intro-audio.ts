// 一次性脚本：给 HongenCourse 加 introAudioUrl 列（如果不存在）
// 用法：cd server && npx ts-node -P tsconfig.json prisma/add-intro-audio.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 查表结构
  const cols: any[] = await prisma.$queryRawUnsafe(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'HongenCourse'`,
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));
  if (names.has('introAudioUrl')) {
    console.log('introAudioUrl 已存在，跳过');
    return;
  }
  await prisma.$executeRawUnsafe(
    `ALTER TABLE HongenCourse ADD COLUMN introAudioUrl VARCHAR(512) NULL AFTER coverImage`,
  );
  console.log('已添加 introAudioUrl 列');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
