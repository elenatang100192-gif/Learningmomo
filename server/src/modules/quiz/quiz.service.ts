import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface QuizSubmission {
  stepId: string;
  // FILL: 用户输入的字符串数组；SINGLE/MULTI: 选项 id 数组
  answers: string[];
}

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  async grade(sub: QuizSubmission) {
    const step = await this.prisma.step.findUnique({ where: { id: sub.stepId } });
    if (!step) throw new NotFoundException('Step not found');

    const content: any = step.content;
    // TEST 步骤：content.questions[]，每题可能答对。answers 是单题答案。
    // 其它旧 QUIZ 单题保持原行为。
    if (step.type === 'TEST' && Array.isArray(content?.questions)) {
      const questions = content.questions as any[];
      const total = questions.length;
      // 用户本次只提交 1 道题的答案（前端一次只判一道题，最后一题判完即通关）
      // 兼容老格式：把 answers 当成第 (content._cursor ?? 0) 题的答案
      const cursor: number = typeof content._cursor === 'number' ? content._cursor : 0;
      const q = questions[cursor] ?? questions[0];
      if (!q) {
        return { correct: false, expected: [], given: sub.answers, starsEarned: 0, total, cursor };
      }
      const ok = this.compareQuestion(q, sub.answers);
      return {
        correct: ok,
        expected: Array.isArray(q.answer) ? q.answer : [],
        given: sub.answers,
        // 一题 3 颗星，全部答对再加奖励
        starsEarned: ok ? 3 : 0,
        total,
        cursor,
      };
    }

    // 兼容老数据：SINGLE 题型历史上 content.answer 是字符串，统一成字符串数组再比较
    const rawAnswer = content.answer;
    const correct: string[] = Array.isArray(rawAnswer)
      ? rawAnswer
      : (rawAnswer == null || rawAnswer === '' ? [] : [String(rawAnswer)]);
    const userAns = (sub.answers || []).map((x) => String(x).trim().toLowerCase());

    const isRight =
      correct.length === userAns.length &&
      correct.every((c: string) => userAns.includes(c.toLowerCase()));

    return {
      correct: isRight,
      expected: correct,
      given: sub.answers,
      // 每答对 1 题 3 颗星（与 Lesson.rewardStars 对齐）
      starsEarned: isRight ? 3 : 0,
    };
  }

  // 复用 QuizBuilder 的判定逻辑：FILL 不区分大小写 trim 比较
  private compareQuestion(q: any, answers: string[]): boolean {
    if (!q) return false;
    if (q.kind === 'SINGLE') {
      const expected = Array.isArray(q.answer) ? q.answer : [];
      return expected.length === 1 && answers.length === 1 &&
        expected[0] === answers[0];
    }
    if (q.kind === 'MULTIPLE') {
      const expected = new Set<string>((Array.isArray(q.answer) ? q.answer : []).map((x: string) => String(x)));
      const given = new Set<string>(answers.map((x) => String(x)));
      if (expected.size !== given.size) return false;
      for (const v of expected) if (!given.has(v)) return false;
      return true;
    }
    if (q.kind === 'FILL') {
      const expected = (Array.isArray(q.answer) ? q.answer : []).map((x: string) => x.trim().toLowerCase());
      const given = (answers || []).map((x) => String(x).trim().toLowerCase());
      if (given.length === 0) return false;
      return given.every((g) => expected.includes(g));
    }
    // 兜底：按旧逻辑
    const correct = (Array.isArray(q.answer) ? q.answer : []).map((x: string) => x.trim().toLowerCase());
    const userAns = (answers || []).map((x) => String(x).trim().toLowerCase());
    return correct.length === userAns.length && correct.every((c) => userAns.includes(c));
  }
}
