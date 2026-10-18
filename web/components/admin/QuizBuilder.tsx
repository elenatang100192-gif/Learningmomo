'use client';
// 结构化测验编辑器：SINGLE / MULTIPLE / BLANK 三种题型
// 支持题目配图 + 选项配图（BLANK 题型：配图可作为答案卡）
import { useState } from 'react';
import { MediaUploader } from './MediaUploader';

export type QuizKind = 'SINGLE' | 'MULTIPLE' | 'BLANK';

export interface QuizOption {
  id: string;          // 'a', 'b', 'c'...
  text: string;        // 选项文字
  image?: string;      // 选项配图（七牛 URL）
  audioUrl?: string;   // 选项音频（七牛 URL），学生点选时自动播放
}

export interface QuizContent {
  kind: QuizKind;
  prompt: string;      // 题目文字
  image?: string;      // 题目配图（七牛 URL）
  promptAudioUrl?: string; // 题目音频（七牛 URL），进入步骤时自动播放
  options?: QuizOption[];        // SINGLE / MULTIPLE
  // BLANK 专属：把图片当答案卡，每个答案一个图片
  answerImages?: { id: string; image: string; audioUrl?: string }[];
  answer: string | string[];     // SINGLE→string(optionId), MULTIPLE→string[], BLANK→string(关键词)
}

function genId(): string {
  return Math.random().toString(36).slice(2, 4);
}

export function QuizBuilder({
  value,
  onChange,
}: {
  value: QuizContent;
  onChange: (c: QuizContent) => void;
}) {
  const kind = value.kind;

  function update(partial: Partial<QuizContent>) {
    onChange({ ...value, ...partial });
  }

  function updateOption(idx: number, patch: Partial<QuizOption>) {
    const opts = [...(value.options ?? [])];
    opts[idx] = { ...opts[idx], ...patch };
    update({ options: opts });
  }

  function removeOption(idx: number) {
    const opts = [...(value.options ?? [])];
    const removed = opts.splice(idx, 1)[0];
    // 如果答案里有被删的，清理掉
    let answer = value.answer;
    if (kind === 'SINGLE' && answer === removed?.id) answer = '';
    if (kind === 'MULTIPLE' && Array.isArray(answer)) {
      answer = answer.filter((a) => a !== removed?.id);
    }
    update({ options: opts, answer });
  }

  function addOption() {
    const id = genId();
    update({ options: [...(value.options ?? []), { id, text: '' }] });
  }

  function setAnswer(id: string, checked: boolean) {
    if (kind === 'SINGLE') {
      update({ answer: checked ? id : '' });
    } else if (kind === 'MULTIPLE') {
      const cur = Array.isArray(value.answer) ? [...value.answer] : [];
      const next = checked ? [...cur, id] : cur.filter((a) => a !== id);
      update({ answer: next });
    }
  }

  function isAnswer(id: string): boolean {
    if (kind === 'SINGLE') return value.answer === id;
    if (kind === 'MULTIPLE') return Array.isArray(value.answer) && value.answer.includes(id);
    return false;
  }

  const KINDS: { value: QuizKind; label: string; desc: string }[] = [
    { value: 'SINGLE',   label: '单选题', desc: '选一个正确答案' },
    { value: 'MULTIPLE', label: '多选题', desc: '选多个正确答案' },
    { value: 'BLANK',    label: '填空题', desc: '填一个或多个关键词' },
  ];

  return (
    <div className="space-y-4">
      {/* 题型切换 */}
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => {
          const active = kind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => {
                const next: QuizContent = {
                  kind: k.value,
                  prompt: value.prompt,
                  image: value.image,
                  answer: '',
                };
                if (k.value === 'SINGLE' || k.value === 'MULTIPLE') {
                  next.options = value.options?.length
                    ? value.options
                    : [
                        { id: 'a', text: '' },
                        { id: 'b', text: '' },
                      ];
                }
                if (k.value === 'BLANK') {
                  next.answer = typeof value.answer === 'string' ? value.answer : (value.answer as string[]).join('|');
                  next.answerImages = value.answerImages;
                }
                onChange(next);
              }}
              className={
                'rounded-2xl px-4 py-2 font-extrabold border-2 transition ' +
                (active
                  ? 'bg-emerald-700 text-white border-emerald-900 shadow-pop ring-2 ring-emerald-900/30'
                  : 'bg-white text-stone-700 border-amber-200 hover:border-amber-400')
              }
            >
              {k.label}
              <span className="ml-1 text-xs opacity-70">{k.desc}</span>
            </button>
          );
        })}
      </div>

      {/* 题目题干 + 配图 + 音频 */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr,260px] gap-3">
        <label className="block">
          <span className="text-sm font-bold text-stone-600">
            题目 / 提示语 {kind === 'BLANK' && <span className="text-stone-400 font-normal">（可用 <code>___</code> 表示填空位置）</span>}
          </span>
          <textarea
            value={value.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded-2xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-amber-500 resize-none"
            placeholder={
              kind === 'BLANK'
                ? '在 ___ 时用英语怎么说？'
                : '看图，选出对应的英语单词'
            }
          />
        </label>
        <div className="space-y-3">
          <div className="rounded-xl bg-amber-50/40 border-2 border-dashed border-amber-200 p-2">
            <div className="text-xs font-extrabold text-amber-700 mb-1 flex items-center gap-1">
              🖼 题目配图 <span className="text-stone-400 font-normal">（可选）</span>
            </div>
            <MediaUploader
              value={value.image}
              onChange={(url) => update({ image: url ?? '' })}
              type="image"
              compact
            />
          </div>
          <div className="rounded-xl bg-sky-50/40 border-2 border-dashed border-sky-200 p-2">
            <div className="text-xs font-extrabold text-sky-700 mb-1 flex items-center gap-1">
              🔊 题目音频 <span className="text-stone-400 font-normal">（进入步骤时播放）</span>
            </div>
            <MediaUploader
              value={value.promptAudioUrl}
              onChange={(url) => update({ promptAudioUrl: url ?? '' })}
              type="audio"
              compact
            />
          </div>
        </div>
      </div>

      {/* 选项（SINGLE / MULTIPLE） */}
      {(kind === 'SINGLE' || kind === 'MULTIPLE') && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-stone-600">
              选项列表
              <span className="ml-2 text-xs font-normal text-stone-400">
                {kind === 'SINGLE' ? '（点击圆圈选正确答案）' : '（点击方框选正确答案，可多选）'}
              </span>
            </span>
            <button
              type="button"
              onClick={addOption}
              className="rounded-2xl bg-brand-sky text-stone-800 border-2 border-amber-700 px-3 py-1 font-extrabold text-xs shadow-pop hover:bg-amber-200"
            >
              ➕ 加选项
            </button>
          </div>

          <div className="space-y-3">
            {(value.options ?? []).map((opt, idx) => {
              const chosen = isAnswer(opt.id);
              return (
                <div
                  key={opt.id}
                  className={
                    'relative rounded-2xl border-2 bg-white p-3 transition shadow-sm ' +
                    (chosen
                      ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50/40'
                      : 'border-amber-200 hover:border-amber-400')
                  }
                >
                  {/* 顶栏：编号 / 选中按钮 / 选项文字 / 删除 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 选中控件 */}
                    <button
                      type="button"
                      onClick={() => setAnswer(opt.id, !isAnswer(opt.id))}
                      className={
                        'flex-shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center transition font-extrabold ' +
                        (chosen
                          ? 'bg-emerald-600 border-emerald-800 text-white shadow-pop'
                          : 'bg-white border-amber-300 text-stone-500 hover:border-amber-500')
                      }
                      aria-label={chosen ? '取消选择' : '选为答案'}
                      title={chosen ? '取消选择' : '选为答案'}
                    >
                      {chosen ? '✓' : <span className="text-sm">{opt.id.toUpperCase()}</span>}
                    </button>

                    {/* 选项文字（占主要宽度） */}
                    <input
                      value={opt.text}
                      onChange={(e) => updateOption(idx, { text: e.target.value })}
                      className="flex-1 min-w-[160px] rounded-xl border-2 border-amber-200 bg-amber-50/30 px-3 py-2 text-base font-bold text-stone-800 outline-none focus:border-amber-500 focus:bg-white"
                      placeholder={`选项 ${opt.id.toUpperCase()} 文字`}
                    />

                    {/* 删除按钮 */}
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      disabled={(value.options ?? []).length <= 1}
                      className="w-9 h-9 rounded-xl bg-rose-50 border-2 border-rose-200 text-rose-500 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 disabled:opacity-30 disabled:cursor-not-allowed font-extrabold text-lg"
                      title="删除选项"
                    >
                      ×
                    </button>
                  </div>

                  {/* 配图 + 音频：两个 MediaUploader 并排，不挤压选项文字 */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl bg-amber-50/30 border-2 border-dashed border-amber-200 p-2">
                      <div className="text-xs font-extrabold text-amber-700 mb-1 flex items-center gap-1">
                        🖼 配图 <span className="text-stone-400 font-normal">（可选）</span>
                      </div>
                      <MediaUploader
                        value={opt.image}
                        onChange={(url) => updateOption(idx, { image: url ?? '' })}
                        type="image"
                        compact
                      />
                    </div>
                    <div className="rounded-xl bg-sky-50/40 border-2 border-dashed border-sky-200 p-2">
                      <div className="text-xs font-extrabold text-sky-700 mb-1 flex items-center gap-1">
                        🔊 音频 <span className="text-stone-400 font-normal">（点选时播放）</span>
                      </div>
                      <MediaUploader
                        value={opt.audioUrl}
                        onChange={(url) => updateOption(idx, { audioUrl: url ?? '' })}
                        type="audio"
                        compact
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {kind === 'MULTIPLE' && Array.isArray(value.answer) && value.answer.length > 0 && (
            <div className="mt-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-sm font-bold px-3 py-2">
              ✓ 已选答案：{value.answer.map((a) => a.toUpperCase()).join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* 填空答案 */}
      {kind === 'BLANK' && (
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-3">
            <div className="text-sm font-bold text-stone-700 flex items-center gap-1">
              ✏️ 文字答案
              <span className="ml-1 text-xs font-normal text-stone-500">
                （多答案用 <code className="px-1 bg-white rounded">|</code> 分隔，如 <code className="px-1 bg-white rounded">cat | CAT</code>）
              </span>
            </div>
            <input
              value={typeof value.answer === 'string' ? value.answer : (value.answer as string[]).join(' | ')}
              onChange={(e) => update({ answer: e.target.value })}
              className="mt-2 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 text-lg font-bold text-stone-800 outline-none focus:border-amber-500"
              placeholder="cat"
            />
            <div className="mt-1.5 text-xs text-stone-500 flex items-center gap-1">
              <span>💡</span> 不区分大小写匹配
            </div>
          </div>

          {/* 填空题也可上传"图片答案卡"——每张图算一个候选答案 */}
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-bold text-stone-600">图片答案（可选）</div>
                <div className="text-xs text-stone-400 mt-0.5">
                  适用场景：题目里是英文句子，答案用图片（如猫/狗）做选项
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const id = genId();
                  update({ answerImages: [...(value.answerImages ?? []), { id, image: '' }] });
                }}
                className="rounded-2xl bg-brand-sky text-stone-800 border-2 border-amber-700 px-3 py-1 font-extrabold text-xs shadow-pop"
              >
                ➕ 加图片答案
              </button>
            </div>

            {(value.answerImages ?? []).length === 0 ? (
              <div className="text-xs text-stone-400 py-4 text-center rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/20">
                还没添加图片答案 · 点右上角 ➕ 开始
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {(value.answerImages ?? []).map((it, idx) => (
                  <div
                    key={it.id}
                    className="relative rounded-2xl border-2 border-amber-200 bg-white p-2 shadow-sm hover:border-amber-400 transition"
                  >
                    <div className="text-xs font-extrabold text-amber-700 mb-1.5 flex items-center justify-between">
                      <span>🖼 图片 {idx + 1}</span>
                      {it.image && <span className="text-emerald-600 text-[10px]">✓ 已传</span>}
                    </div>
                    <MediaUploader
                      value={it.image}
                      onChange={(url) => {
                        const arr = [...(value.answerImages ?? [])];
                        arr[idx] = { id: it.id, image: url ?? '' };
                        update({ answerImages: arr });
                      }}
                      type="image"
                      compact
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const arr = (value.answerImages ?? []).filter((x) => x.id !== it.id);
                        update({ answerImages: arr });
                      }}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-rose-500 text-white border-2 border-white font-extrabold shadow-pop hover:bg-rose-600"
                      title="删除"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
