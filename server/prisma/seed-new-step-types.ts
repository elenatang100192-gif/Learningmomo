// 一次性种子：给现有 Topic 1 Animals 课时的最后追加 3 条新类型 step
//  - TEST  (多题测验：Taste Quest 风格)
//  - VIDEO_LAB  (视频口语实验)
//  - IMAGE_SAFARI  (超市探险)
//
// 数据存在 Step.content (JSON) 里，不动表结构。已存在则跳过（按 sortOrder 1/2/3 找）。
// 跑法：npx ts-node prisma/seed-new-step-types.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 三种 step 的示例 content
const testContent = {
  introVideoUrl: '',
  questions: [
    {
      kind: 'SINGLE',
      prompt: 'Which animal says "meow"?',
      options: [
        { id: 'a', text: 'cat' },
        { id: 'b', text: 'dog' },
        { id: 'c', text: 'bird' },
      ],
      answer: ['a'],
    },
    {
      kind: 'MULTIPLE',
      prompt: 'Select all the animals.',
      options: [
        { id: 'a', text: 'cat' },
        { id: 'b', text: 'car' },
        { id: 'c', text: 'dog' },
        { id: 'd', text: 'pen' },
      ],
      answer: ['a', 'c'],
    },
    {
      kind: 'FILL',
      prompt: 'A ___ says "woof! woof!"',
      answer: ['dog'],
      inputMode: 'LETTERS',
    },
  ],
};

const videoLabContent = {
  videos: [
    {
      id: 'demo-v1',
      name: 'Q1 · Greeting',
      videoUrl: '',
      videoName: '',
      micRequired: true,
      prompt: 'Say: "Hello, my name is ..."',
    },
    {
      id: 'demo-v2',
      name: 'Q2 · Listening',
      videoUrl: '',
      videoName: '',
      micRequired: false,
      prompt: 'Just watch and listen (no answer required).',
    },
  ],
};

const imageSafariContent = {
  imageUrl: '',
  mascotUrl: '',
  tags: [
    { id: 't1', x: 25, y: 50, label: 'apple',  color: '#FF876E' },
    { id: 't2', x: 50, y: 30, label: 'banana', color: '#FFC64E' },
    { id: 't3', x: 75, y: 60, label: 'grape',  color: '#9A79EF' },
  ],
};

async function main() {
  // 找到 Topic 1 Animals 的第一课时（"1. cat"）
  const course = await prisma.course.findFirst({ where: { title: 'Topic 1 Animals' } });
  if (!course) {
    console.log('✗ 没找到 Topic 1 Animals，请先跑 prisma:db:seed');
    return;
  }
  const lesson = await prisma.lesson.findFirst({
    where: { courseId: course.id },
    orderBy: { sortOrder: 'asc' },
  });
  if (!lesson) {
    console.log('✗ 该课程下没有任何课时');
    return;
  }

  // 已有 demo 步骤则跳过（按 type + content.length 查重）
  const existTest = await prisma.step.findFirst({
    where: { lessonId: lesson.id, type: 'TEST' },
  });
  const existVideo = await prisma.step.findFirst({
    where: { lessonId: lesson.id, type: 'VIDEO_LAB' },
  });
  const existSafari = await prisma.step.findFirst({
    where: { lessonId: lesson.id, type: 'IMAGE_SAFARI' },
  });

  // 找到最大 sortOrder，追加在末尾
  const last = await prisma.step.findFirst({
    where: { lessonId: lesson.id },
    orderBy: { sortOrder: 'desc' },
  });
  let next = (last?.sortOrder ?? 0) + 1;

  if (!existTest) {
    await prisma.step.create({
      data: { lessonId: lesson.id, type: 'TEST', sortOrder: next++, content: testContent as any },
    });
    console.log(`✓ 新增 TEST 步骤（多题测验）`);
  } else {
    console.log('· TEST 已存在，跳过');
  }
  if (!existVideo) {
    await prisma.step.create({
      data: { lessonId: lesson.id, type: 'VIDEO_LAB', sortOrder: next++, content: videoLabContent as any },
    });
    console.log(`✓ 新增 VIDEO_LAB 步骤（视频口语实验）`);
  } else {
    console.log('· VIDEO_LAB 已存在，跳过');
  }
  if (!existSafari) {
    await prisma.step.create({
      data: { lessonId: lesson.id, type: 'IMAGE_SAFARI', sortOrder: next++, content: imageSafariContent as any },
    });
    console.log(`✓ 新增 IMAGE_SAFARI 步骤（超市探险）`);
  } else {
    console.log('· IMAGE_SAFARI 已存在，跳过');
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
