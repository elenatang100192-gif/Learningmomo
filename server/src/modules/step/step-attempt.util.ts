import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * VIDEO 步骤内嵌弹题点 (interrupt) 的评分工具
 * - 返回 { isCorrect: boolean; score: 0..100 }
 *
 * 设计：
 *   - 学员每次回答都入库 (StepAttempt)；
 *   - score 统一百分制，方便多 interrupt 求和算星。
 *   - SPEECH 永远 isCorrect=true，仅录音存证 (score=100)。
 */
export type InterruptQuestion =
  | { type: 'SPEECH'; prompt: string; promptAudioUrl?: string; minSeconds?: number; passSentences?: string[] }
  | { type: 'SINGLE'; prompt: string; promptAudioUrl?: string; options: { id: string; text: string; correct: boolean }[] }
  | { type: 'MULTI';  prompt: string; promptAudioUrl?: string; options: { id: string; text: string; correct: boolean }[] }
  | { type: 'FILL';   prompt: string; promptAudioUrl?: string; answer: string; caseSensitive?: boolean }
  | {
      type: 'QUIZ';
      prompt?: string;
      questions: Array<
        | { kind: 'SINGLE';   options: { id: string; correct?: boolean }[]; answer: string[] }
        | { kind: 'MULTIPLE'; options: { id: string; correct?: boolean }[]; answer: string[] }
        | { kind: 'BLANK';    answer: string[]; answerImages?: { id: string }[] }
        | { kind: 'FILL';     answer: string[] }
      >;
    }
  // SAFARI（场景+tag 探索式）：与 step=超市探险 共用同套结构
  // 判定：只要学员点过任意一个 tag 即视为通过（score=100, isCorrect=true）
  | { type: 'SAFARI'; prompt?: string; promptImageUrl?: string; promptAudioUrl?: string; imageUrl?: string; mascotUrl?: string; tags?: { id: string }[] };

export type InterruptAnswer =
  | { type: 'SPEECH'; audioUrl: string; durationSec: number; asrText?: string; asrEngine?: 'qwen-parformer-v2' | 'browser-speech' }
  | { type: 'SINGLE'; selected: string }
  | { type: 'MULTI';  selected: string[] }
  | { type: 'FILL';   text: string }
  | { type: 'QUIZ'; answers: Array<{ picked: string[]; text: string }> }
  | { type: 'SAFARI'; visited: string[] };

/**
 * 把一段文字拆成「关键词」数组（小写、去标点、去空串）。
 * 例：`"I like apples."` → `['i', 'like', 'apples']`
 * 用于 SPEECH 题的「通过句子」匹配：每句都拆词后看是否都被 ASR 文本覆盖。
 */
function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ') // 去掉标点（保留字母/数字/单引号）
    .split(/\s+/)
    .filter(Boolean);
}

export function scoreInterrupt(q: InterruptQuestion, a: InterruptAnswer): { isCorrect: boolean; score: number } {
  if (a.type !== q.type) return { isCorrect: false, score: 0 };

  if (q.type === 'SPEECH' && a.type === 'SPEECH') {
    // 旧题（无 passSentences）也按"必含规则"判，配置缺失直接不通过。
    // 时长没到 minSeconds 也算不通过（避免一秒钟糊弄 ASR 拿满分）。
    const min = Math.max(0, q.minSeconds ?? 0);
    if (a.durationSec < min) {
      return { isCorrect: false, score: 0 };
    }
    const passSentences = Array.isArray(q.passSentences) ? q.passSentences : [];
    if (passSentences.length === 0) {
      // 配置缺失：按你定的策略是「视为没设 → 不通过」；
      // 至少给一个低分，避免学员完全拿不到星星（家长看到 0 分体验差）。
      return { isCorrect: false, score: 0 };
    }
    const asrText = (a.asrText ?? '').toString();
    const asrTokens = new Set(tokenize(asrText));
    if (asrTokens.size === 0) {
      return { isCorrect: false, score: 0 };
    }
    for (const s of passSentences) {
      const kws = tokenize(s);
      if (kws.length === 0) continue; // 句子是空的或只有标点 — 跳过不计入
      for (const w of kws) {
        if (!asrTokens.has(w)) {
          return { isCorrect: false, score: 0 };
        }
      }
    }
    return { isCorrect: true, score: 100 };
  }

  if (q.type === 'SINGLE' && a.type === 'SINGLE') {
    const opt = q.options.find((o) => o.id === a.selected);
    const ok = !!opt?.correct;
    return { isCorrect: ok, score: ok ? 100 : 0 };
  }

  if (q.type === 'MULTI' && a.type === 'MULTI') {
    const correctIds = new Set(q.options.filter((o) => o.correct).map((o) => o.id));
    const selected = new Set(a.selected ?? []);
    if (correctIds.size === 0) {
      // 题面配置错误：没有正确答案，给 0 防误判
      return { isCorrect: false, score: 0 };
    }
    let hit = 0;
    for (const id of selected) if (correctIds.has(id)) hit++;
    // 多选了错的扣分：miss 越多越低
    const wrong = selected.size - hit;
    const raw = (hit - wrong) / correctIds.size;
    const score = Math.max(0, Math.min(100, Math.round(raw * 100)));
    return { isCorrect: hit === correctIds.size && wrong === 0, score };
  }

  if (q.type === 'FILL' && a.type === 'FILL') {
    const target = (q.answer ?? '').trim();
    const given = (a.text ?? '').trim();
    if (!target) return { isCorrect: false, score: 0 };
    const eq = q.caseSensitive
      ? given === target
      : given.toLowerCase() === target.toLowerCase();
    return { isCorrect: eq, score: eq ? 100 : 0 };
  }

  if (q.type === 'QUIZ' && a.type === 'QUIZ') {
    // 兼容两种形态:
    //   A) 旧/flat: { type: 'QUIZ', questions: [...] }
    //   B) 嵌套:    { type: 'QUIZ', test: { questions: [...] } }  ← DB 里 interrupt.question 实际是这种
    const qs = (q as any).questions ?? (q as any).test?.questions ?? [];
    if (qs.length === 0) return { isCorrect: false, score: 0 };
    let correct = 0;
    for (let i = 0; i < qs.length; i++) {
      const sub = qs[i];
      const ans = (a.answers ?? [])[i];
      if (!ans) continue;
      // 老数据 sub.answer 可能是 string，统一成 string[]
      const normAnswer: string[] = Array.isArray(sub.answer)
        ? (sub.answer as any[]).map((x: any) => String(x))
        : (sub.answer == null || sub.answer === '' ? [] : [String(sub.answer)]);
      if (sub.kind === 'SINGLE') {
        if (normAnswer.length === 1 && (ans.picked ?? []).length === 1 && normAnswer[0] === ans.picked[0]) correct++;
      } else if (sub.kind === 'MULTIPLE') {
        const expected = new Set(normAnswer);
        const given = new Set((ans.picked ?? []).map(String));
        if (expected.size === given.size && [...expected].every((id) => given.has(id))) correct++;
      } else if (sub.kind === 'BLANK') {
        const target = (normAnswer[0] ?? '').trim().toLowerCase();
        const given = (ans.text ?? '').trim().toLowerCase();
        if (target && given === target) correct++;
      } else if (sub.kind === 'FILL') {
        // 文本填空：与配置 answer（数组）任一完全匹配（不区分大小写）
        const target = (normAnswer[0] ?? '').trim();
        const given = (ans.text ?? '').trim();
        if (target && given && target.toLowerCase() === given.toLowerCase()) correct++;
      }
    }
    const score = Math.round((correct / qs.length) * 100);
    return { isCorrect: correct === qs.length, score };
  }

  if (q.type === 'SAFARI' && a.type === 'SAFARI') {
    // 探索式：学员点过任意一个 tag 即视为通过（与前端 canSubmit 一致）
    const visited = a.visited ?? [];
    const ok = visited.length > 0;
    return { isCorrect: ok, score: ok ? 100 : 0 };
  }

  return { isCorrect: false, score: 0 };
}

@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class StepAttemptModule {}
