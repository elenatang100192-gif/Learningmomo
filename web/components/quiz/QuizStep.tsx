'use client';
import { useMemo, useState } from 'react';
import { api } from '@/lib/api';

type QuizContent =
  | { kind: 'SINGLE'; prompt: string; options: { id: string; text?: string; image?: string }[]; answer: string[] }
  | { kind: 'MULTI';  prompt: string; options: { id: string; text?: string; image?: string }[]; answer: string[] }
  | { kind: 'FILL';   prompt: string; answer: string[]; inputMode?: 'LETTERS' | 'FREE' };

export function QuizStep({
  content,
  stepId,
  onResult,
}: {
  content: QuizContent;
  stepId?: string;
  onResult: (stars: number, isCorrect: boolean) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [status, setStatus] = useState<'idle' | 'wrong' | 'right'>('idle');
  const [stars, setStars] = useState(0);

  const letters = useMemo(
    () => 'abcdefghijklmnopqrstuvwxyz'.split(''),
    [],
  );

  function togglePick(id: string) {
    if (content.kind === 'SINGLE') {
      setPicked([id]);
    } else {
      setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    }
  }

  async function submit() {
    const answers =
      content.kind === 'FILL'
        ? [typed.trim()]
        : picked;
    let correct = false;
    let earned = 0;

    if (stepId) {
      try {
        const r = await api.gradeQuiz(stepId, answers);
        correct = r.correct;
        earned = r.starsEarned;
      } catch (e) {
        // 后端不可用时本地兜底比较
        correct = compareLocal(answers, content);
        earned = correct ? 3 : 0;
      }
    } else {
      correct = compareLocal(answers, content);
      earned = correct ? 3 : 0;
    }

    setStatus(correct ? 'right' : 'wrong');
    setStars(earned);
  }

  function next() {
    onResult(stars, status === 'right');
  }

  return (
    <div className="min-h-[400px]">
      <div className="text-xl md:text-2xl font-extrabold text-stone-800 mb-4">
        {content.prompt}
      </div>

      {/* 选项区 */}
      {content.kind !== 'FILL' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {content.options.map((opt) => {
            const active = picked.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => togglePick(opt.id)}
                className={`rounded-2xl p-3 border-4 transition shadow-node flex flex-col items-center gap-2 ${
                  active
                    ? 'bg-brand-yellow border-amber-600'
                    : 'bg-white border-amber-200'
                }`}
              >
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-amber-100 grid place-items-center text-6xl">
                  🐱
                </div>
                <div className="font-bold text-stone-800">{opt.text}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* 填空：字母键盘 */}
      {content.kind === 'FILL' && (
        <div>
          <div className="rounded-2xl bg-white border-4 border-amber-300 px-4 py-3 text-xl font-extrabold tracking-widest text-center mb-4">
            {typed || '—'}
          </div>
          <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
            {letters.map((l) => (
              <button
                key={l}
                onClick={() => setTyped((t) => (t + l).slice(0, 16))}
                className="aspect-square rounded-xl bg-white border-2 border-amber-300 text-lg font-bold hover:bg-amber-100"
              >
                {l.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => setTyped((t) => t.slice(0, -1))}
              className="aspect-square rounded-xl bg-amber-200 border-2 border-amber-400 text-lg font-bold"
            >
              ⌫
            </button>
            <button
              onClick={() => setTyped('')}
              className="aspect-square rounded-xl bg-stone-200 border-2 border-stone-400 text-lg font-bold"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 底部动作 */}
      <div className="mt-6 flex items-center justify-center gap-3">
        {status === 'idle' && (
          <button onClick={submit} className="btn-kid bg-brand-orange">
            ✅ Submit
          </button>
        )}
        {status !== 'idle' && (
          <>
            <div
              className={`px-4 py-2 font-extrabold rounded-2xl ${
                status === 'right'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {status === 'right' ? `Correct! +${stars}★` : 'Try again~'}
            </div>
            <button onClick={next} className="btn-kid bg-brand-sky text-white">
              Next →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function compareLocal(answers: string[], content: QuizContent): boolean {
  const userAns = answers.map((a) => a.trim().toLowerCase());
  const correct = (content.answer || []).map((a) => a.trim().toLowerCase());
  return correct.length === userAns.length && correct.every((c) => userAns.includes(c));
}