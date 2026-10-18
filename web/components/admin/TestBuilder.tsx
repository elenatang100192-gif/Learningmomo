'use client';
// 多题测验编辑器（Test step）—— 一组问题，每题可选 SINGLE / MULTIPLE / FILL。
// 与 QuizBuilder 保持同一套字段（kind / options / answer），便于判分复用。
import { useState } from 'react';
import { MediaUploader } from './MediaUploader';
import { QuizBuilder, QuizContent, QuizOption } from './QuizBuilder';
import type { TestContent, TestQuestionContent } from '@/lib/stepContents';

const TYPES: { value: TestQuestionContent['kind']; label: string; emoji: string; desc: string }[] = [
  { value: 'SINGLE',   label: '单选',  emoji: '🔘', desc: '选一个正确答案' },
  { value: 'MULTIPLE', label: '多选',  emoji: '☑️', desc: '选多个正确答案' },
  { value: 'FILL',     label: '填空',  emoji: '✏️', desc: '字母键盘 / 自由输入' },
];

function genId(): string {
  return Math.random().toString(36).slice(2, 6);
}

function defaultQuestion(kind: TestQuestionContent['kind']): TestQuestionContent {
  if (kind === 'SINGLE') {
    return {
      kind: 'SINGLE',
      prompt: '新问题：用英语怎么说？',
      options: [
        { id: 'a', text: 'cat' },
        { id: 'b', text: 'dog' },
      ],
      answer: ['a'],
    };
  }
  if (kind === 'MULTIPLE') {
    return {
      kind: 'MULTIPLE',
      prompt: '新问题：哪些是动物？',
      options: [
        { id: 'a', text: 'cat' },
        { id: 'b', text: 'car' },
        { id: 'c', text: 'dog' },
      ],
      answer: ['a', 'c'],
    };
  }
  return {
    kind: 'FILL',
    prompt: 'A ___ sat on the mat.',
    answer: ['cat'],
    inputMode: 'LETTERS',
  };
}

export function TestBuilder({
  value,
  onChange,
}: {
  value: TestContent;
  onChange: (c: TestContent) => void;
}) {
  function patchQuestion(idx: number, q: TestQuestionContent) {
    const next = [...value.questions];
    next[idx] = q;
    onChange({ ...value, questions: next });
  }

  function addQuestion(kind: TestQuestionContent['kind']) {
    onChange({ ...value, questions: [...value.questions, defaultQuestion(kind)] });
  }

  function removeQuestion(idx: number) {
    const next = value.questions.filter((_, i) => i !== idx);
    onChange({ ...value, questions: next });
  }

  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= value.questions.length) return;
    const next = [...value.questions];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ ...value, questions: next });
  }

  function changeType(idx: number, kind: TestQuestionContent['kind']) {
    patchQuestion(idx, defaultQuestion(kind));
  }

  return (
    <div className="space-y-4">
      {/* 顶部：题前视频（覆盖在所有题目之上） */}
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-3">
        <div className="text-sm font-bold text-stone-700 flex items-center gap-1">
          🎬 题前视频 <span className="text-xs font-normal text-stone-500">（可选 · 放在所有题目之上）</span>
        </div>
        <div className="mt-2">
          <MediaUploader
            value={value.introVideoUrl}
            onChange={(url) =>
              onChange({ ...value, introVideoUrl: url ?? '', introVideoName: url ? value.introVideoName ?? '' : '' })
            }
            type="video"
          />
        </div>
      </div>

      {/* 题目列表 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-stone-700">
          📚 题目列表 <span className="text-xs font-normal text-stone-500">（{value.questions.length} 道）</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => addQuestion(t.value)}
              className="rounded-2xl bg-brand-sky text-stone-800 border-2 border-amber-700 px-3 py-1.5 font-extrabold text-xs shadow-pop hover:bg-amber-200"
              title={t.desc}
            >
              {t.emoji} 加{t.label}
            </button>
          ))}
        </div>
      </div>

      {value.questions.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-6 text-center text-sm text-stone-500">
          还没有题目，点右上角「加单选/多选/填空」开始
        </div>
      ) : (
        <ol className="space-y-3">
          {value.questions.map((q, idx) => (
            <li key={idx} className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-8 h-8 rounded-full bg-brand-orange text-white font-extrabold flex items-center justify-center text-sm shadow-pop">
                  {idx + 1}
                </div>
                <div className="text-sm font-extrabold text-stone-700">
                  {q.kind === 'SINGLE' ? '单选题' : q.kind === 'MULTIPLE' ? '多选题' : '填空题'}
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => changeType(idx, t.value)}
                      className={
                        'rounded-xl px-2 py-1 text-xs font-bold border-2 transition ' +
                        (q.kind === t.value
                          ? 'bg-emerald-700 text-white border-emerald-900'
                          : 'bg-white text-stone-600 border-amber-200 hover:border-amber-400')
                      }
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0}
                    className="w-8 h-8 rounded-lg bg-white border-2 border-amber-200 text-stone-600 disabled:opacity-30 font-bold"
                    title="上移"
                  >↑</button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === value.questions.length - 1}
                    className="w-8 h-8 rounded-lg bg-white border-2 border-amber-200 text-stone-600 disabled:opacity-30 font-bold"
                    title="下移"
                  >↓</button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(idx)}
                    className="w-8 h-8 rounded-lg bg-rose-100 border-2 border-rose-300 text-rose-700 font-bold"
                    title="删除"
                  >×</button>
                </div>
              </div>
              <div className="rounded-xl bg-white p-3 border-2 border-amber-100">
                {/* 复用 QuizBuilder 的内联编辑器，避免重复 UI */}
                <QuizBuilder
                  value={q as unknown as QuizContent}
                  onChange={(c) => patchQuestion(idx, c as unknown as TestQuestionContent)}
                />
              </div>
            </li>
          ))}
        </ol>
      )}

      {value.questions.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-sm font-bold px-3 py-2">
          ✓ 共 {value.questions.length} 道题 · 学生端会一题一题地答，
          全部答对累计获得 {(value.questions.length * 3)} 颗星
        </div>
      )}
    </div>
  );
}
