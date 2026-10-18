// 莫莫英语 - 完整种子数据
// 已建好 4 张 Hongen* 表，这里只写入数据，幂等。
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 通用 mp4（公网可下到的话用这个；不通就替换成你的 CDN）
const DEFAULT_VIDEO = 'https://cdn.jsdelivr.net/gh/mediaelement/mediaelement-files@master/big_buck_bunny.mp4';

type StepSeed = { _kind: 'V' | 'I' | 'Q'; type: string; sortOrder: number; content: any };

interface LessonSeed {
  title: string;
  steps: StepSeed[];
}

interface CourseSeed {
  title: string;
  level: string;
  description: string;
  coverImage: string;
  sortOrder: number;
  lessons: LessonSeed[];
}

const COURSES: CourseSeed[] = [
  {
    title: 'Topic 1 Animals',
    level: 'K1',
    description: '认识常见动物和它们的叫声',
    coverImage: '/img/course-animals.svg',
    sortOrder: 1,
    lessons: [
      {
        title: '1. cat',
        steps: [
          { _kind: 'V', type: 'VIDEO', sortOrder: 1, content: { url: DEFAULT_VIDEO, poster: '/img/lesson-cat.svg', duration: 30 } },
          { _kind: 'I', type: 'IMAGE', sortOrder: 2, content: { url: '/img/word-cat.svg', caption: 'cat /kæt/ n. 猫' } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 3, content: { kind: 'SINGLE', prompt: '哪个是 "猫"？', options: [{ id: 'a', text: 'cat' }, { id: 'b', text: 'dog' }], answer: ['a'] } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 4, content: { kind: 'FILL', prompt: 'A ___ says "meow!".', answer: ['cat'], inputMode: 'LETTERS' } },
        ],
      },
      {
        title: '2. dog',
        steps: [
          { _kind: 'I', type: 'IMAGE', sortOrder: 1, content: { url: '/img/word-dog.svg', caption: 'dog /dɒɡ/ n. 狗' } },
          { _kind: 'V', type: 'VIDEO', sortOrder: 2, content: { url: DEFAULT_VIDEO, poster: '/img/lesson-dog.svg', duration: 25 } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 3, content: { kind: 'FILL', prompt: 'A ___ says "woof!".', answer: ['dog'], inputMode: 'LETTERS' } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 4, content: { kind: 'MULTI', prompt: '选择 "动物"？', options: [{ id: 'cat' }, { id: 'dog' }, { id: 'pen' }], answer: ['cat', 'dog'] } },
        ],
      },
      {
        title: '3. bird',
        steps: [
          { _kind: 'I', type: 'IMAGE', sortOrder: 1, content: { url: '/img/word-bird.svg', caption: 'bird /bɜːd/ n. 鸟' } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 2, content: { kind: 'SINGLE', prompt: '哪只是鸟？', options: [{ id: 'a', text: 'bird' }, { id: 'b', text: 'fish' }], answer: ['a'] } },
          { _kind: 'I', type: 'IMAGE', sortOrder: 3, content: { url: '/img/word-bird-fly.svg', caption: 'A bird can fly.' } },
        ],
      },
    ],
  },
  {
    title: 'Topic 2 Colors',
    level: 'K1',
    description: '学会常见颜色单词',
    coverImage: '/img/course-colors.svg',
    sortOrder: 2,
    lessons: [
      {
        title: '1. red',
        steps: [
          { _kind: 'I', type: 'IMAGE', sortOrder: 1, content: { url: '/img/word-red.svg', caption: 'red 红色' } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 2, content: { kind: 'SINGLE', prompt: '草莓是哪种颜色？', options: [{ id: 'a', text: 'red' }, { id: 'b', text: 'blue' }], answer: ['a'] } },
        ],
      },
      {
        title: '2. blue',
        steps: [
          { _kind: 'I', type: 'IMAGE', sortOrder: 1, content: { url: '/img/word-blue.svg', caption: 'blue 蓝色' } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 2, content: { kind: 'FILL', prompt: 'The sky is ___.', answer: ['blue'], inputMode: 'LETTERS' } },
        ],
      },
      {
        title: '3. yellow',
        steps: [
          { _kind: 'I', type: 'IMAGE', sortOrder: 1, content: { url: '/img/word-yellow.svg', caption: 'yellow 黄色' } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 2, content: { kind: 'SINGLE', prompt: '太阳是什么颜色？', options: [{ id: 'a', text: 'yellow' }, { id: 'b', text: 'green' }], answer: ['a'] } },
        ],
      },
    ],
  },
  {
    title: 'Topic 3 Numbers',
    level: 'K2',
    description: '数一数 1-10',
    coverImage: '/img/course-numbers.svg',
    sortOrder: 3,
    lessons: [
      {
        title: '1. one',
        steps: [
          { _kind: 'I', type: 'IMAGE', sortOrder: 1, content: { url: '/img/number-1.svg', caption: 'one /wʌn/ 1' } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 2, content: { kind: 'FILL', prompt: 'There is ___ apple.', answer: ['one'], inputMode: 'LETTERS' } },
        ],
      },
      {
        title: '2. two',
        steps: [
          { _kind: 'I', type: 'IMAGE', sortOrder: 1, content: { url: '/img/number-2.svg', caption: 'two /tuː/ 2' } },
          { _kind: 'Q', type: 'QUIZ', sortOrder: 2, content: { kind: 'SINGLE', prompt: 'two 是几？', options: [{ id: 'a', text: '2' }, { id: 'b', text: '3' }], answer: ['a'] } },
        ],
      },
    ],
  },
];

async function main() {
  // 已存在 Topic 1 Animals 则跳过（保持幂等）
  const exist = await prisma.course.findFirst({ where: { title: 'Topic 1 Animals' } });
  if (exist) {
    console.log('已存在示例课程，跳过 seed。');
    return;
  }

  let lessonCount = 0;
  let stepCount = 0;

  for (const c of COURSES) {
    const course = await prisma.course.create({
      data: {
        title: c.title,
        level: c.level,
        description: c.description,
        coverImage: c.coverImage,
        sortOrder: c.sortOrder,
      },
    });

      for (let i = 0; i < c.lessons.length; i++) {
        const l = c.lessons[i];
        const lesson = await prisma.lesson.create({
          data: {
            courseId: course.id,
            title: l.title,
            sortOrder: i + 1,
            rewardStars: 3,
          },
        });
        lessonCount++;

        for (let j = 0; j < l.steps.length; j++) {
          const s = l.steps[j];
          await prisma.step.create({
            data: {
              lessonId: lesson.id,
              type: s.type,
              sortOrder: j + 1,
              content: s.content as any,
            },
          });
          stepCount++;
        }
      }
  }

  console.log(`seed 完成：${COURSES.length} 课程 / ${lessonCount} 课时 / ${stepCount} 步骤`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });