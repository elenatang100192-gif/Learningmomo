'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';

export interface QuizOption { id: string; text?: string; image?: string; audioUrl?: string }
export type QuizContent =
  | { kind: 'SINGLE';   prompt: string; image?: string; promptAudioUrl?: string; options: QuizOption[]; answer: string[] }
  | { kind: 'MULTIPLE'; prompt: string; image?: string; promptAudioUrl?: string; options: QuizOption[]; answer: string[] }
  | { kind: 'BLANK';    prompt: string; image?: string; promptAudioUrl?: string; answer: string[]; answerImages?: { id: string; image: string; audioUrl?: string }[] };

interface Props {
  stepId: string;
  content: QuizContent;
  onResult: (starsEarned: number) => void;
  onDone?: () => void;
  onPrev?: () => void;
}

export function QuizStep({ stepId, content, onResult, onDone, onPrev }: Props) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; starsEarned: number } | null>(null);
  const [done, setDone] = useState(false); // 是否已点过 Next（提交后可点）
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isFill = content.kind === 'BLANK';
  const isMulti = content.kind === 'MULTIPLE';

  // BLANK 题的"图片答案"模式：题目要求点图片才算答案
  const isImageFill = isFill && (content.answerImages?.length ?? 0) > 0;

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (isImageFill) return picked.size > 0;
    if (isFill) return text.trim().length > 0;
    return picked.size > 0;
  }, [submitting, isFill, isImageFill, picked, text]);

  function toggle(id: string) {
    if (result) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (isMulti) {
        next.has(id) ? next.delete(id) : next.add(id);
      } else {
        next.clear();
        next.add(id);
      }
      return next;
    });
    // 点选时播放该选项的音频
    if (content.kind !== 'BLANK') {
      const opt = (content.options ?? []).find((o) => o.id === id);
      if (opt?.audioUrl) playOptionAudio(opt.audioUrl);
    }
  }

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      let answers: string[];
      if (isImageFill) {
        // 用图片 id 提交，后端把 answerImages 里的 id 与 content.answer 比较
        answers = Array.from(picked);
      } else if (isFill) {
        answers = [text.trim().toLowerCase()];
      } else {
        answers = Array.from(picked);
      }
      const r = await api.gradeQuiz(stepId, answers);
      setResult({ correct: r.correct, starsEarned: r.starsEarned });
      if (r.correct) {
        onResult(r.starsEarned);
        setDone(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setResult(null);
    setPicked(new Set());
    setText('');
  }

  // 进入题目时自动播放题目音频
  useEffect(() => {
    const url = content.promptAudioUrl;
    if (!url || !audioRef.current) return;
    const el = audioRef.current;
    el.src = url;
    el.currentTime = 0;
    el.volume = 0.85;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { /* 自动播放策略可能拒绝，静默 */ });
    }
  }, [content.promptAudioUrl, stepId]);

  // 选项音频：单选/多选 点选时播放；填空-图片答案 点图片时播放
  function playOptionAudio(url?: string) {
    if (!url || !audioRef.current) return;
    const el = audioRef.current;
    el.src = url;
    el.currentTime = 0;
    el.volume = 0.85;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }

  return (
    <div className="grid place-items-center min-h-[400px] text-center">
      <div className="flex flex-col items-center gap-5 w-full max-w-[720px]">
        {/* 题目题干 + 配图 */}
        <div className="flex flex-col items-center gap-3">
          {content.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.image}
              alt=""
              className="max-w-full max-h-72 h-auto rounded-2xl border-4 border-amber-200 shadow-pop object-contain"
            />
          )}
          {content.prompt && (
            <div className="text-2xl md:text-3xl font-extrabold text-stone-800">
              {content.prompt}
            </div>
          )}
        </div>

        {/* 文字填空（非图片答案模式） */}
        {isFill && !isImageFill && (
          <div className="w-full max-w-[420px]">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!!result}
              autoFocus
              placeholder="Type the word…"
              className="w-full text-center text-3xl md:text-4xl font-extrabold tracking-widest
                         rounded-2xl border-4 border-amber-300 bg-white px-4 py-4
                         focus:outline-none focus:border-amber-500 shadow-pop
                         uppercase placeholder:normal-case placeholder:text-stone-300"
            />
          </div>
        )}

        {/* 单选 / 多选 */}
        {!isFill && (
          <div
            className={
              'grid gap-3 w-full ' +
              ((content.options ?? []).length <= 3
                ? 'grid-cols-1 sm:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-3')
            }
          >
            {(content.options ?? []).map((opt) => {
              const active = picked.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  disabled={!!result}
                  className={
                    'rounded-2xl border-4 px-3 py-4 font-extrabold shadow-pop transition flex flex-col items-center gap-2 ' +
                    (active
                      ? 'bg-brand-orange text-white border-amber-700 scale-105'
                      : 'bg-white text-stone-800 border-amber-300 hover:border-amber-500')
                  }
                >
                  {opt.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={opt.image}
                      alt=""
                      className="max-w-full max-h-32 h-auto object-contain rounded-xl bg-amber-50"
                    />
                  )}
                  <span className="text-xl md:text-2xl">{opt.text ?? opt.id}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 填空-图片答案模式：每张图算一个选项 */}
        {isImageFill && (
          <div className="grid gap-3 w-full grid-cols-2 sm:grid-cols-3">
            {(content.answerImages ?? []).map((it) => {
              const active = picked.has(it.id);
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    if (result) return;
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (next.has(it.id)) next.delete(it.id);
                      else { next.clear(); next.add(it.id); }
                      return next;
                    });
                    if (it.audioUrl) playOptionAudio(it.audioUrl);
                  }}
                  disabled={!!result}
                  className={
                    'rounded-2xl border-4 p-3 font-extrabold shadow-pop transition ' +
                    (active
                      ? 'bg-brand-orange border-amber-700 scale-105'
                      : 'bg-white border-amber-300 hover:border-amber-500')
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.image}
                    alt=""
                    className="max-w-full max-h-40 h-auto object-contain rounded-xl bg-amber-50"
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* 反馈条 */}
        {result && (
          <div
            className={
              'rounded-2xl px-5 py-3 text-lg md:text-xl font-extrabold shadow-pop ' +
              (result.correct ? 'bg-emerald-700 text-white' : 'bg-rose-100 text-rose-700 border-2 border-rose-300')
            }
          >
            {result.correct
              ? `🎉 Correct! +${result.starsEarned} ⭐`
              : 'Try again~'}
          </div>
        )}

        {result && !result.correct && (
          <button onClick={retry} className="btn-kid bg-brand-yellow">
            Try again
          </button>
        )}

        {/* 提交 / 下一题 按钮（顶部导航统一负责 step 间 Back/Next） */}
        <div className="flex items-center gap-3">
          {!result ? (
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="btn-kid bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting…' : isMulti ? 'Submit' : 'Submit'}
            </button>
          ) : (
            <button
              onClick={() => onDone?.()}
              disabled={!done}
              className="btn-kid bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          )}
        </div>
      </div>

      {/* 隐藏的播放器：题目音频 / 选项音频共用一个 audio 元素 */}
      <audio ref={audioRef} preload="auto" />
    </div>
  );
}
