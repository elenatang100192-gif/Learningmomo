'use client';
// 多题测验（Test step）—— 题前视频 + 多题依次作答
// 视觉参考：参考 UI 的 Taste Quest（卡片配色）+ Shopping Challenge（多选加购动效）
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { TestContent, TestQuestionContent } from '@/lib/stepContents';
import { mediaProxy } from '@/lib/mediaProxy';

type AnswerState = { single: string | null; multiple: string[]; fill: string };

const blankAnswer: AnswerState = { single: null, multiple: [], fill: '' };

function isAnswered(q: TestQuestionContent, a: AnswerState): boolean {
  if (q.kind === 'SINGLE') return !!a.single;
  if (q.kind === 'MULTIPLE') return a.multiple.length > 0;
  return a.fill.trim().length > 0;
}

function isCorrect(q: TestQuestionContent, a: AnswerState): boolean {
  if (q.kind === 'SINGLE') {
    return !!a.single && Array.isArray(q.answer) && q.answer[0] === a.single;
  }
  if (q.kind === 'MULTIPLE') {
    const exp = new Set(Array.isArray(q.answer) ? q.answer : []);
    const got = new Set(a.multiple);
    if (exp.size !== got.size) return false;
    for (const v of exp) if (!got.has(v)) return false;
    return true;
  }
  const value = a.fill.trim().toLowerCase();
  return (Array.isArray(q.answer) ? q.answer : []).some((x) => x.trim().toLowerCase() === value);
}

const TASTE_PALETTE = [
  '#A88BFF', '#7099F0', '#43CABB', '#FF8A3D', '#FFC64E',
  '#FF876E', '#5EBF6A', '#FF8FA3', '#9A79EF', '#67B3EF',
];

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function TestStep({
  content,
  stepId,
  onResult,
  onDone,
  onPrev,
}: {
  content: TestContent;
  stepId: string;
  onResult: (stars: number) => void;
  onDone?: () => void;
  onPrev?: () => void;
}) {
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>(() =>
    content.questions.map(() => ({ ...blankAnswer })),
  );
  const [feedback, setFeedback] = useState<('idle' | 'right' | 'wrong')[]>(() =>
    content.questions.map(() => 'idle'),
  );
  const [submitting, setSubmitting] = useState(false);
  const [introDone, setIntroDone] = useState(!content.introVideoUrl);

  useEffect(() => {
    setCursor(0);
    setAnswers(content.questions.map(() => ({ ...blankAnswer })));
    setFeedback(content.questions.map(() => 'idle'));
    setIntroDone(!content.introVideoUrl);
  }, [stepId, content.introVideoUrl, content.questions.length]);

  const total = content.questions.length;
  const q = content.questions[cursor];
  const a = answers[cursor] ?? blankAnswer;
  const f = feedback[cursor] ?? 'idle';

  const answeredCount = useMemo(
    () => content.questions.reduce((sum, _q, i) => sum + (isAnswered(_q, answers[i] ?? blankAnswer) ? 1 : 0), 0),
    [content.questions, answers],
  );

  function setAnswer(patch: Partial<AnswerState>) {
    setAnswers((cur) => {
      const next = [...cur];
      next[cursor] = { ...(next[cursor] ?? blankAnswer), ...patch };
      return next;
    });
    setFeedback((cur) => {
      const next = [...cur];
      next[cursor] = 'idle';
      return next;
    });
  }

  async function check() {
    if (!q) return;
    if (!isAnswered(q, a)) return;
    setSubmitting(true);
    let correct = isCorrect(q, a);
    if (stepId) {
      try {
        const payload =
          q.kind === 'SINGLE' ? [a.single] :
          q.kind === 'MULTIPLE' ? a.multiple :
          [a.fill.trim()];
        const r = await api.gradeQuiz(stepId, payload);
        correct = r.correct;
      } catch {
        // 离线兜底
      }
    }
    setFeedback((cur) => {
      const next = [...cur];
      next[cursor] = correct ? 'right' : 'wrong';
      return next;
    });
    setSubmitting(false);
  }

  function next() {
    if (cursor + 1 < total) {
      setCursor(cursor + 1);
    } else {
      // 全部完成：累计 correct 数 × 3 颗星
      const stars = feedback.filter((x) => x === 'right').length * 3;
      onResult(stars);
    }
  }

  if (total === 0) {
    return (
      <div className="grid place-items-center min-h-[400px] text-stone-500">
        (No questions in this step)
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 顶部进度条：题号 + 答对/总题数 */}
      <div className="flex items-center gap-3">
        <div className="text-amber-700 font-extrabold">
          {cursor + 1} / {total}
        </div>
        <div className="flex-1 h-3 bg-white/70 rounded-full overflow-hidden border border-amber-300">
          <div
            className="h-full bg-gradient-to-r from-brand-yellow to-brand-orange transition-all"
            style={{ width: `${((cursor) / total) * 100}%` }}
          />
        </div>
        <div className="text-xs text-amber-700 font-extrabold">
          ⭐ Correct: {feedback.filter((x) => x === 'right').length} / {total}
        </div>
      </div>

      {/* 题前视频 */}
      {content.introVideoUrl && (
        <div
          className={
            'rounded-2xl bg-white/85 border-4 border-white shadow-pop p-3 transition ' +
            (introDone ? 'opacity-60' : '')
          }
        >
          {!introDone ? (
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <video
                src={mediaProxy(content.introVideoUrl)}
                controls
                autoPlay
                playsInline
                onEnded={() => setIntroDone(true)}
                className="w-full h-full"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-700 font-extrabold text-sm">
                <span>✅</span> Video watched
              </div>
              <button
                onClick={() => setIntroDone(false)}
                className="rounded-xl bg-amber-100 border-2 border-amber-300 px-3 py-1 text-xs font-extrabold text-amber-800"
              >
                🔁 Replay
              </button>
            </div>
          )}
        </div>
      )}

      {/* 题目卡片 */}
      <div className="rounded-[28px] bg-white/90 border-4 border-white shadow-pop p-5 sm:p-7">
        {/* 题干 */}
        <div className="flex items-start gap-3">
          {q.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.image} alt="" className="max-h-24 rounded-2xl border-2 border-amber-200 object-contain bg-amber-50" />
          )}
          <div className="flex-1">
            <div className="text-xs font-extrabold text-amber-700 uppercase tracking-wider mb-1">
              Q{cursor + 1} · {q.kind === 'SINGLE' ? 'Single' : q.kind === 'MULTIPLE' ? 'Multi' : 'Fill'}
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-stone-800 leading-snug">
              {q.prompt}
            </div>
            {q.promptAudioUrl && (
              <audio src={q.promptAudioUrl} autoPlay controls className="mt-2 h-8" />
            )}
          </div>
        </div>

        {/* 选项 / 填空 */}
        <div className="mt-5">
          {q.kind === 'FILL' ? (
            <FillInput
              mode={q.inputMode ?? 'LETTERS'}
              value={a.fill}
              onChange={(v) => setAnswer({ fill: v })}
              disabled={f === 'right'}
            />
          ) : (
            <div
              className={
                'grid gap-3 ' +
                (q.options.length <= 3
                  ? 'grid-cols-1 sm:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3')
              }
            >
              {q.options.map((opt, idx) => {
                const color = TASTE_PALETTE[idx % TASTE_PALETTE.length];
                const isPicked =
                  q.kind === 'SINGLE' ? a.single === opt.id : a.multiple.includes(opt.id);
                const isCorrect = Array.isArray(q.answer) && q.answer.includes(opt.id);
                const showCorrect = f === 'right' && isCorrect;
                const showWrong = f === 'wrong' && isPicked && !isCorrect;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={f === 'right'}
                    onClick={() => {
                      if (q.kind === 'SINGLE') {
                        setAnswer({ single: opt.id });
                      } else {
                        const set = new Set(a.multiple);
                        if (set.has(opt.id)) set.delete(opt.id);
                        else set.add(opt.id);
                        setAnswer({ multiple: Array.from(set) });
                      }
                    }}
                    className={
                      'rounded-2xl border-4 p-3 transition shadow-pop flex flex-col items-center gap-2 text-left ' +
                      (showCorrect
                        ? 'bg-emerald-100 border-emerald-500'
                        : showWrong
                          ? 'bg-rose-50 border-rose-400'
                          : isPicked
                            ? 'bg-amber-100 border-amber-500 scale-105'
                            : 'bg-white border-amber-200 hover:border-amber-400')
                    }
                    style={
                      isPicked
                        ? ({
                            '--tw-shadow': `0 6px 0 ${color}55`,
                          } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {opt.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={opt.image} alt="" className="h-20 w-full object-contain rounded-xl bg-amber-50" />
                    ) : (
                      <div
                        className="h-20 w-full rounded-xl grid place-items-center text-5xl"
                        style={{ background: color + '22' }}
                      >
                        {String.fromCharCode(65 + idx)}
                      </div>
                    )}
                    <div className="text-sm sm:text-base font-extrabold text-stone-800 self-stretch">
                      {opt.text ?? opt.id}
                    </div>
                    {q.kind === 'MULTIPLE' && (
                      <div
                        className={
                          'self-stretch rounded-xl py-1 text-center text-xs font-extrabold border-2 ' +
                          (isPicked ? 'bg-brand-orange text-white border-amber-700' : 'bg-white text-stone-500 border-amber-200')
                        }
                      >
                        {isPicked ? '✓ Added' : 'Tap to add'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 反馈条 */}
        {f !== 'idle' && (
          <div
            className={
              'mt-4 rounded-2xl px-4 py-3 text-base md:text-lg font-extrabold shadow-pop ' +
              (f === 'right' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300' : 'bg-rose-50 text-rose-700 border-2 border-rose-300')
            }
          >
            {f === 'right'
              ? '🎉 Correct! +3 ⭐'
              : '😅 Try a different one~'}
          </div>
        )}

        {/* 按钮区：Back + Next（Next 只有提交答对后才能点） */}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          {f !== 'right' ? (
            <button
              onClick={check}
              disabled={submitting || !isAnswered(q, a)}
              className="btn-kid bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : '✅ Submit'}
            </button>
          ) : (
            <button
              onClick={() => {
                if (cursor + 1 < total) {
                  setCursor(cursor + 1);
                } else {
                  const stars = feedback.filter((x) => x === 'right').length * 3;
                  onResult(stars);
                  onDone?.();
                }
              }}
              className="btn-kid bg-emerald-700"
            >
              {cursor + 1 < total ? 'Next →' : 'Finish →'}
            </button>
          )}
        </div>

        {/* 底部状态：本题已完成 X / 总题数 */}
        <div className="mt-3 text-xs text-stone-500 font-bold text-center">
          {answeredCount} / {total} answered · {feedback.filter((x) => x === 'right').length} correct
        </div>
      </div>
    </div>
  );
}

function FillInput({
  mode,
  value,
  onChange,
  disabled,
}: {
  mode: 'LETTERS' | 'FREE';
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  if (mode === 'FREE') {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        autoFocus
        placeholder="Type the word…"
        className="w-full text-center text-3xl md:text-4xl font-extrabold tracking-widest
                   rounded-2xl border-4 border-amber-300 bg-white px-4 py-4
                   focus:outline-none focus:border-amber-500 shadow-pop
                   uppercase placeholder:normal-case placeholder:text-stone-300"
      />
    );
  }
  // LETTERS 模式：保留参考 UI 的字母键盘
  return (
    <div>
      <div className="rounded-2xl bg-white border-4 border-amber-300 px-4 py-3 text-2xl md:text-3xl font-extrabold tracking-widest text-center mb-3 min-h-[64px] grid place-items-center">
        {value || <span className="text-stone-300 text-base">— Tap letters to spell —</span>}
      </div>
      <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5">
        {LETTERS.map((l) => (
          <button
            key={l}
            type="button"
            disabled={disabled}
            onClick={() => onChange((value + l).slice(0, 16))}
            className="aspect-square rounded-xl bg-white border-2 border-amber-300 text-lg font-bold hover:bg-amber-100 disabled:opacity-50"
          >
            {l.toUpperCase()}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(value.slice(0, -1))}
          className="aspect-square rounded-xl bg-amber-200 border-2 border-amber-400 text-lg font-bold"
        >
          ⌫
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('')}
          className="aspect-square rounded-xl bg-stone-200 border-2 border-stone-400 text-lg font-bold"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
