// 一次性清理脚本：删除 lesson 7520314a 下重复/空 url 的脏 IMAGE step
// 保留：url 非空、sortOrder 正常、type 正常的 step
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LESSON_ID = '7520314a-94ad-439d-8650-c12bfc8cac1a';

async function main() {
  const steps: any[] = await prisma.step.findMany({
    where: { lessonId: LESSON_ID },
    orderBy: { sortOrder: 'asc' },
  });
  console.log('当前 step 数:', steps.length);

  for (const s of steps) {
    const c: any = s.content ?? {};
    const isImage = s.type === 'IMAGE';
    const isEmptyImage = isImage && (!c.url || c.url.trim() === '');
    const isTestDummy = c.url === 'https://example.com/test.jpg';
    const shouldDelete = isEmptyImage || isTestDummy;
    console.log(
      shouldDelete ? '[删]' : '[留]',
      s.id.slice(0, 8),
      s.type,
      'sortOrder=' + s.sortOrder,
      'url=' + (c.url || '').slice(0, 60),
    );
    if (shouldDelete) {
      await prisma.step.delete({ where: { id: s.id } });
    }
  }

  // 重新规范化 sortOrder：按 id 顺序递增（这里按你给的 0f86b3bf → 2c82eb25 → c4168ae9 → a5528183 的顺序）
  // 你说 0f86b3bf IMAGE 在第一个；接下来 2c82eb25 VIDEO；c4168ae9 QUIZ；a5528183 VIDEO
  const keep: any[] = await prisma.step.findMany({
    where: { lessonId: LESSON_ID },
    orderBy: { createdAt: 'asc' },
  });
  // 找到 0f86b3bf 真实 sortOrder=1，让剩下的按 createdAt 升序排
  const fixedOrder = ['0f86b3bf-423d-483a-a8cc-b71814c42c40'];
  const rest = keep
    .filter((s) => s.id !== fixedOrder[0])
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const orderedIds = [...fixedOrder, ...rest.map((s) => s.id)];

  for (let i = 0; i < orderedIds.length; i++) {
    await prisma.step.update({
      where: { id: orderedIds[i] },
      data: { sortOrder: i + 1 },
    });
    console.log('  → 写 sortOrder=' + (i + 1) + ' : ' + orderedIds[i].slice(0, 8));
  }

  console.log('清理完成');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });