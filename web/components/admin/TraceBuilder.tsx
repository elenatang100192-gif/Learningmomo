'use client';
// 手描 step（TRACE）的后台编辑器
// - 题目文字 + 题目音频
// - 单词列表：每条 = 单词文字 + 模板图（描摹底图）+ 参考媒体（图片/音频/视频）
// - 全局覆盖阈值（默认 0.95 = 95%）
import { useState } from 'react';
import { ChevronUp, ChevronDown, Plus, X, Trash2 } from 'lucide-react';
import { MediaUploader } from './MediaUploader';
import type { TraceContent, TraceWordItem } from '@/lib/stepContents';

function genId(): string {
  return Math.random().toString(36).slice(2, 8);
}

function defaultWord(): TraceWordItem {
  return { id: genId(), word: '' };
}

function detectKind(url?: string): 'image' | 'audio' | 'video' | null {
  if (!url) return null;
  const u = url.toLowerCase();
  // 先看扩展名
  const ext = u.split('?')[0]!.split('#')[0]!.split('.').pop() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext)) return 'audio';
  // 七牛 key 一般是 hongen/media/<uuid>.<ext>，所以扩展名判定足够
  return 'image';
}

export function TraceBuilder({
  value,
  onChange,
}: {
  value: TraceContent;
  onChange: (c: TraceContent) => void;
}) {
  const words: TraceWordItem[] = value.words ?? [];
  const [activeId, setActiveId] = useState<string | null>(words[0]?.id ?? null);

  function patch(patch: Partial<TraceContent>) {
    onChange({ ...value, ...patch });
  }
  function patchWord(id: string, p: Partial<TraceWordItem>) {
    onChange({ ...value, words: words.map((w) => (w.id === id ? { ...w, ...p } : w)) });
  }
  function addWord() {
    const w = defaultWord();
    onChange({ ...value, words: [...words, w] });
    setActiveId(w.id);
  }
  function removeWord(id: string) {
    const next = words.filter((w) => w.id !== id);
    onChange({ ...value, words: next });
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  }
  function move(id: string, dir: -1 | 1) {
    const i = words.findIndex((w) => w.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= words.length) return;
    const next = words.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...value, words: next });
  }

  return (
    <div className="space-y-4">
      {/* 题目文字 + 题目音频 */}
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-3 space-y-2">
        <div className="text-sm font-extrabold text-stone-700">题面（可选）</div>
        <div className="grid grid-cols-1 md:grid-cols-[1fr,260px] gap-2">
          <div>
            <div className="text-xs font-bold text-stone-500 mb-1">题目文字</div>
            <input
              type="text"
              value={value.prompt ?? ''}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder="例如：跟着下面的单词描一描"
              className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
            />
          </div>
          <div>
            <div className="text-xs font-bold text-stone-500 mb-1">题目音频</div>
            <MediaUploader
              value={value.promptAudioUrl}
              onChange={(url) => patch({ promptAudioUrl: url ?? '' })}
              type="audio"
              compact
            />
          </div>
        </div>
      </div>

      {/* 阈值 */}
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-extrabold text-stone-700">笔画覆盖阈值</div>
          <input
            type="number"
            min={50}
            max={100}
            step={5}
            value={Math.round((value.threshold ?? 0.95) * 100)}
            onChange={(e) => {
              const n = Math.max(50, Math.min(100, Number(e.target.value) || 95));
              patch({ threshold: n / 100 });
            }}
            className="w-20 rounded-xl border-2 border-amber-200 bg-white px-2 py-1 text-sm font-extrabold"
          />
          <span className="text-xs text-stone-500 font-bold">% （学员描到该比例即视为完成）</span>
        </div>
      </div>

      {/* 单词列表 */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-stone-700 inline-flex items-center gap-1.5">
          ✍️ 单词
          <span className="text-xs font-bold text-stone-400">
            （前台每次显示一个，顺序解锁：上一个 100% 完成才允许切下一个）
          </span>
        </div>
        <button
          type="button"
          onClick={addWord}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-gradient-to-r from-brand-purple to-brand-blue text-white text-xs font-extrabold shadow-pop border-2 border-white/30"
        >
          <Plus className="w-3 h-3" strokeWidth={2.5} />
          添加单词
        </button>
      </div>

      {words.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-4 text-center text-sm text-stone-500 font-bold">
          还没有单词，点右上角"添加单词"开始
        </div>
      )}

      <ol className="space-y-3">
        {words.map((w, i) => {
          const active = activeId === w.id;
          return (
            <li
              key={w.id}
              className={
                'rounded-2xl border-2 p-3 space-y-2 ' +
                (active ? 'border-brand-purple bg-purple-50/30' : 'border-amber-200 bg-amber-50/30')
              }
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setActiveId(w.id)}
                  className="text-xs font-extrabold text-stone-600 inline-flex items-center gap-1.5"
                >
                  <span className="inline-grid place-items-center w-5 h-5 rounded-md bg-brand-purple text-white text-[10px] font-extrabold border border-white/40">
                    {i + 1}
                  </span>
                  第 {i + 1} 个单词
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => move(w.id, -1)}
                    disabled={i === 0}
                    className="w-7 h-7 rounded-lg bg-white border-2 border-amber-200 grid place-items-center text-stone-600 disabled:opacity-30"
                    title="上移"
                  >
                    <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(w.id, 1)}
                    disabled={i === words.length - 1}
                    className="w-7 h-7 rounded-lg bg-white border-2 border-amber-200 grid place-items-center text-stone-600 disabled:opacity-30"
                    title="下移"
                  >
                    <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeWord(w.id)}
                    className="inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-rose-50 border-2 border-rose-200 text-rose-700 text-xs font-extrabold"
                    title="删除"
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={2.5} />
                    删除
                  </button>
                </div>
              </div>

              {/* 单词文字 —— 学员端会用大字号浅色展示 */}
              <div>
                <div className="text-xs font-bold text-stone-500 mb-1">需要描写的单词</div>
                <input
                  type="text"
                  value={w.word}
                  onChange={(e) => patchWord(w.id, { word: e.target.value })}
                  placeholder="例如：apple"
                  className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 text-2xl font-extrabold tracking-wider"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* 模板图：描摹底图（建议透明背景的字迹/轮廓 png） */}
                <div>
                  <div className="text-xs font-bold text-stone-500 mb-1">
                    模板图（描摹底图，建议透明背景 png）
                  </div>
                  <MediaUploader
                    value={w.templateImage}
                    onChange={(url) => patchWord(w.id, { templateImage: url ?? '' })}
                    type="image"
                    compact
                  />
                </div>
                {/* 参考媒体：图片 / 音频 / 视频任选，后台上传什么样展示什么样，不加背景 */}
                <div>
                  <div className="text-xs font-bold text-stone-500 mb-1">
                    参考媒体（图片 / 音频 / 视频，上传什么展示什么，不加背景）
                  </div>
                  <div className="flex items-center gap-1 mb-1">
                    {(['image', 'audio', 'video'] as const).map((k) => {
                      const cur = w.referenceKind ?? detectKind(w.referenceMedia) ?? 'image';
                      const isOn = cur === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => patchWord(w.id, { referenceKind: k })}
                          className={
                            'text-[10px] font-extrabold px-2 py-0.5 rounded-full border-2 ' +
                            (isOn
                              ? 'bg-brand-purple text-white border-brand-purple'
                              : 'bg-white text-stone-500 border-amber-200')
                          }
                        >
                          {k === 'image' ? '图片' : k === 'audio' ? '音频' : '视频'}
                        </button>
                      );
                    })}
                    {w.referenceMedia && (
                      <button
                        type="button"
                        onClick={() =>
                          patchWord(w.id, { referenceMedia: undefined, referenceKind: undefined })
                        }
                        className="text-[10px] font-extrabold text-rose-600 inline-flex items-center gap-0.5 ml-auto"
                      >
                        <X className="w-3 h-3" /> 清除
                      </button>
                    )}
                  </div>
                  <MediaUploader
                    value={w.referenceMedia}
                    onChange={(url) =>
                      patchWord(w.id, {
                        referenceMedia: url ?? undefined,
                        referenceKind:
                          (url ? detectKind(url) : undefined) ?? w.referenceKind ?? 'image',
                      })
                    }
                    type={
                      (w.referenceKind ??
                        (detectKind(w.referenceMedia) as any) ??
                        'image') as any
                    }
                    compact
                  />
                </div>
              </div>

              {/* 独立参考音频（可与图片/视频配合；学员点 "听发音" 按钮播放） */}
              <div>
                <div className="text-xs font-bold text-stone-500 mb-1">
                  参考音频（可选，与图片配合的"听发音"；与音频/视频同 URL 时会自动隐藏避免重复）
                </div>
                <MediaUploader
                  value={w.referenceAudio}
                  onChange={(url) => patchWord(w.id, { referenceAudio: url ?? undefined })}
                  type="audio"
                  compact
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
