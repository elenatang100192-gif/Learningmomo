import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { scoreInterrupt, InterruptQuestion, InterruptAnswer } from './step-attempt.util';

interface CreateBody {
  stepId: string;
  interruptId: string;
  question: InterruptQuestion;
  answer: InterruptAnswer;
}

@Controller('step-attempts')
export class StepAttemptController {
  constructor(private prisma: PrismaService) {}

  /**
   * 提交一次弹题回答。
   * 当前不强制鉴权 (学员端用)；待接入 userId 后可补一个匿名 device cookie / JWT。
   * stepId 必须存在；interruptId 在 step.content.interrupts 里能找到题面。
   */
  @Post()
  async create(@Query('userId') userId: string, @Query() all: any, @Body() body: CreateBody) {
    if (!userId) userId = 'anonymous';
    if (!body?.stepId) throw new BadRequestException('stepId required');
    if (!body?.interruptId) throw new BadRequestException('interruptId required');
    if (!body?.question?.type) throw new BadRequestException('question.type required');
    if (!body?.answer?.type) throw new BadRequestException('answer.type required');

    const step = await this.prisma.step.findUnique({ where: { id: body.stepId } });
    if (!step) throw new BadRequestException('step not found');

    // 安全: 后端不直接用前端传来的 question，而是从 step.content.interrupts[] 里按 interruptId
    // 取出真实题面再判分，避免前端字段漂移 / 作弊。
    // 注意 DB 里 interrupt 结构是 { id, atSec, question: { type, ... } } —— type 在 question 里
    const stepContent: any = (step as any).content ?? {};
    const realInterrupts: any[] = Array.isArray(stepContent.interrupts) ? stepContent.interrupts : [];
    const realInterruptWrap = realInterrupts.find((it) => it?.id === body.interruptId);
    if (!realInterruptWrap) {
      throw new BadRequestException(`interrupt ${body.interruptId} not found in step ${body.stepId}`);
    }
    const realQuestion: InterruptQuestion = realInterruptWrap?.question as InterruptQuestion;
    if (!realQuestion || realQuestion.type !== body.question.type) {
      throw new BadRequestException(
        `question.type mismatch: server=${realQuestion?.type} client=${body.question.type}`,
      );
    }

    const { isCorrect, score } = scoreInterrupt(realQuestion, body.answer);

    // DEBUG: 把后端实际拿到的 question 题面 (realQuestion, 来自 DB) 打出来
    // eslint-disable-next-line no-console
    console.log('[scoreInterrupt][server]', {
      stepId: body.stepId,
      interruptId: body.interruptId,
      questionType: realQuestion.type,
      // 对 QUIZ 重点: 打印每题的 kind/answer 长度 / 答案预览 (避免日志太长)
      questions: (realQuestion as any).type === 'QUIZ'
        ? ((realQuestion as any).test?.questions ?? (realQuestion as any).questions ?? []).map((q: any, i: number) => ({
            i,
            kind: q.kind,
            answerLen: Array.isArray(q.answer) ? q.answer.length : (q.answer == null ? 0 : 1),
            answerPreview: Array.isArray(q.answer) ? q.answer : (q.answer == null ? null : [q.answer]),
            optionsLen: Array.isArray(q.options) ? q.options.length : 0,
          }))
        : null,
      answerType: body.answer.type,
      answerLen: (body.answer as any).type === 'QUIZ'
        ? ((body.answer as any).answers ?? []).map((a: any) => ({
            kind: a.kind,
            picked: a.picked,
            text: a.text,
          }))
        : null,
      result: { isCorrect, score },
    });

    const row = await this.prisma.stepAttempt.create({
      data: {
        userId,
        stepId: body.stepId,
        interruptId: body.interruptId,
        questionType: body.question.type,
        answer: body.answer as any,
        isCorrect,
        score,
      },
    });
    return { id: row.id, isCorrect, score };
  }

  /**
   * 拉学员在某个 step 上的所有 attempts（按 interruptId 分组取最后一次）
   * GET /step-attempts?userId=xxx&stepId=yyy
   */
  @Get()
  async list(@Query('userId') userId: string, @Query('stepId') stepId: string) {
    if (!userId || !stepId) throw new BadRequestException('userId & stepId required');
    const rows = await this.prisma.stepAttempt.findMany({
      where: { userId, stepId },
      orderBy: { createdAt: 'asc' },
    });
    // 取每个 interruptId 的最后一次
    const last = new Map<string, typeof rows[number]>();
    for (const r of rows) last.set(r.interruptId, r);
    return { total: rows.length, latest: Array.from(last.values()) };
  }
}
