// 一次性迁移：给 HongenLesson 加 iconUrl，给 HongenCourse 加 keywords
// 用 prisma.$executeRawUnsafe 直接 ALTER，IF NOT EXISTS 保证幂等
// 跑法：npx ts-node prisma/migrate-add-icon-keywords.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // MySQL 8 不支持 IF NOT EXISTS on ADD COLUMN；先查 INFORMATION_SCHEMA
  const lessonCol = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'HongenLesson' AND COLUMN_NAME = 'iconUrl'`,
  );
  if (Number(lessonCol[0].c) === 0) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE HongenLesson ADD COLUMN iconUrl VARCHAR(512) NULL AFTER title`,
    );
    console.log('✓ HongenLesson.iconUrl added');
  } else {
    console.log('· HongenLesson.iconUrl already exists');
  }

  const courseCol = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'HongenCourse' AND COLUMN_NAME = 'keywords'`,
  );
  if (Number(courseCol[0].c) === 0) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE HongenCourse ADD COLUMN keywords TEXT NULL AFTER coverImage`,
    );
    console.log('✓ HongenCourse.keywords added');
  } else {
    console.log('· HongenCourse.keywords already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
