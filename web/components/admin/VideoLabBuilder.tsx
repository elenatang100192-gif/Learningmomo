'use client';
// 视频口语实验编辑器（Video Lab step）—— 上传多个视频，
// 每个视频独立开关「需要麦克风口语回答」+ 配口语题干 + 口语评分配置。
import { useRef } from 'react';
import { Plus, X, Mic } from 'lucide-react';
import { MediaUploader } from './MediaUploader';
import type { VideoLabContent, VideoLabItem } from '@/lib/stepContents';

function genId(): string {
  return Math.random().toString(36).slice(2, 6);
}

function defaultItem(): VideoLabItem {
  return {
    id: genId(),
    name: 'Question',
    videoUrl: '',
    videoName: '',
    micRequired: true,
    prompt: 'Answer the question aloud in a full sentence.',
    minRecordingMs: 3000,
    speechLanguages: ['en', 'zh'],
    passPhrases: [],
    answerAudioUrl: '',
    answerAudioName: '',
  };
}

export function VideoLabBuilder({
  value,
  onChange,
}: {
  value: VideoLabContent;
  onChange: (c: VideoLabContent) => void;
}) {
  function patchItem(id: string, patch: Partial<VideoLabItem>) {
    onChange({
      ...value,
      videos: value.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    });
  }

  function addItem() {
    onChange({ ...value, videos: [...value.videos, defaultItem()] });
  }

  function removeItem(id: string) {
    onChange({ ...value, videos: value.videos.filter((v) => v.id !== id) });
  }

  function move(id: string, dir: -1 | 1) {
    const idx = value.videos.findIndex((v) => v.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= value.videos.length) return;
    const next = [...value.videos];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ ...value, videos: next });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-stone-700">
          🎬 视频队列 <span className="text-xs font-normal text-stone-500">（{value.videos.length} 个视频）</span>
        </div>
        <button
          type="button"
          onClick={addItem}
          className="rounded-2xl bg-brand-orange text-white text-xs font-extrabold shadow-pop px-3 py-1.5"
        >
          ➕ 添加视频
        </button>
      </div>

      {value.videos.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-6 text-center text-sm text-stone-500">
          还没有视频 · 点击右上角「添加视频」开始
        </div>
      ) : (
        <ol className="space-y-3">
          {value.videos.map((v, idx) => (
            <li key={v.id} className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-3 space-y-3">
              {/* 顶栏：编号 / 标题 / 操作 */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-8 h-8 rounded-full bg-brand-purple text-white font-extrabold flex items-center justify-center text-sm shadow-pop">
                  V{idx + 1}
                </div>
                <input
                  value={v.name}
                  onChange={(e) => patchItem(v.id, { name: e.target.value })}
                  className="flex-1 min-w-[160px] rounded-xl border-2 border-amber-200 bg-amber-50/30 px-3 py-2 text-base font-bold text-stone-800 outline-none focus:border-amber-500 focus:bg-white"
                  placeholder="视频名（学生端也会看到）"
                />
                <button
                  type="button"
                  onClick={() => move(v.id, -1)}
                  disabled={idx === 0}
                  className="w-8 h-8 rounded-lg bg-white border-2 border-amber-200 text-stone-600 disabled:opacity-30 font-bold"
                  title="上移"
                >↑</button>
                <button
                  type="button"
                  onClick={() => move(v.id, 1)}
                  disabled={idx === value.videos.length - 1}
                  className="w-8 h-8 rounded-lg bg-white border-2 border-amber-200 text-stone-600 disabled:opacity-30 font-bold"
                  title="下移"
                >↓</button>
                <button
                  type="button"
                  onClick={() => removeItem(v.id)}
                  className="w-8 h-8 rounded-lg bg-rose-100 border-2 border-rose-300 text-rose-700 font-bold"
                  title="删除"
                >×</button>
              </div>

              {/* 视频文件上传 */}
              <div>
                <span className="text-xs font-bold text-stone-500">视频文件（mp4 / mov / webm）</span>
                <div className="mt-1">
                  <MediaUploader
                    value={v.videoUrl}
                    onChange={(url) =>
                      patchItem(v.id, { videoUrl: url ?? '', videoName: url ? v.videoName ?? '' : '' })
                    }
                    type="video"
                  />
                </div>
                {/* 没视频时的兜底：图片 + 音频 */}
                <details className="mt-2 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/40 px-3 py-2 group">
                  <summary className="text-xs font-bold text-stone-600 cursor-pointer select-none flex items-center gap-1.5">
                    <span className="text-amber-600">🖼️</span> 没上传视频？点这里配置"图片+音频"兜底
                    <span className="ml-auto text-[10px] text-stone-400 group-open:hidden">展开 ▾</span>
                    <span className="ml-auto text-[10px] text-stone-400 hidden group-open:inline">收起 ▴</span>
                  </summary>
                  <div className="mt-2 space-y-3">
                    <div className="text-[10px] text-stone-500 leading-relaxed">
                      当「视频文件」为空时，学员端直接展示下面这张图，并自动播放下面的音频（可循环）。
                    </div>
                    <Field label="兜底封面图" hint="学员端会撑满卡片显示">
                      <MediaUploader
                        value={v.coverImageUrl || ''}
                        onChange={(url) => patchItem(v.id, { coverImageUrl: url ?? '' })}
                        type="image"
                        compact
                      />
                    </Field>
                    <Field label="兜底音频" hint="进入本条时自动播放（循环）；按 Space 也可控制播放/暂停">
                      <MediaUploader
                        value={v.fallbackAudioUrl || ''}
                        onChange={(url) =>
                          patchItem(v.id, {
                            fallbackAudioUrl: url ?? '',
                            fallbackAudioName: url ? v.fallbackAudioName ?? '' : '',
                          })
                        }
                        type="audio"
                      />
                    </Field>
                  </div>
                </details>
              </div>

              {/* 口语题干 */}
              <div>
                <span className="text-xs font-bold text-stone-500">口语题干</span>
                <textarea
                  rows={2}
                  value={v.prompt}
                  onChange={(e) => patchItem(v.id, { prompt: e.target.value })}
                  className="mt-1 w-full rounded-2xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-amber-500 resize-none text-sm"
                  placeholder="如：What food do you like, and why?"
                />
              </div>

              {/* 题目音频（学员进入 answer 阶段自动播放一遍） */}
              <Field label="题目音频（可空）" hint="学员进入回答阶段自动播放一遍，用于示范读音/听力题">
                <MediaUploader
                  value={v.promptAudioUrl || ''}
                  onChange={(url) =>
                    patchItem(v.id, {
                      promptAudioUrl: url ?? '',
                      promptAudioName: url ? v.promptAudioName ?? '' : '',
                    })
                  }
                  type="audio"
                />
              </Field>

              {/* 麦克风开关 */}
              <label
                className={
                  'flex items-center gap-3 rounded-2xl border-2 p-3 cursor-pointer transition ' +
                  (v.micRequired
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-amber-200 bg-white')
                }
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={v.micRequired}
                  onClick={() => patchItem(v.id, { micRequired: !v.micRequired })}
                  className={
                    'relative inline-flex w-12 h-7 rounded-full transition ' +
                    (v.micRequired ? 'bg-emerald-600' : 'bg-stone-300')
                  }
                >
                  <span
                    className={
                      'absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition ' +
                      (v.micRequired ? 'translate-x-5' : 'translate-x-0')
                    }
                  />
                </button>
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-stone-800 flex items-center gap-1">
                    {v.micRequired ? '🎙️ 需要口语回答' : '👂 仅观看，不录音'}
                  </div>
                  <div className="text-xs text-stone-500 mt-0.5">
                    {v.micRequired
                      ? '学生按 Tab 聚焦录音按钮 · Space 开始 / 结束 · 录完自动进入下一题'
                      : '视频播完自动进入下一题，学生无需回答'}
                  </div>
                </div>
              </label>

              {/* 口语评分配置（仅在 micRequired=true 时显示） */}
              {v.micRequired && (
                <SpeechConfig
                  v={v}
                  onPatch={(p) => patchItem(v.id, p)}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {value.videos.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-sm font-bold px-3 py-2">
          ✓ 共 {value.videos.length} 个视频 · {value.videos.filter((v) => v.micRequired).length} 个需要口语回答
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 口语评分配置子组件
// - 参考图片：录音时显示在题干上方
// - 最少录音：毫秒（默认 3000）
// - 语音识别语言：多选按钮
// - 通过短语：ASR 文本需包含每一行（去标点/大小写无关）
// ─────────────────────────────────────────────────────────────────
function SpeechConfig({
  v,
  onPatch,
}: {
  v: VideoLabItem;
  onPatch: (p: Partial<VideoLabItem>) => void;
}) {
  const langs: { value: string; label: string; color: string }[] = [
    { value: 'en', label: '🇬🇧 英文', color: 'sky' },
    { value: 'zh', label: '🇨🇳 中文', color: 'rose' },
    { value: 'ja', label: '🇯🇵 日语', color: 'amber' },
    { value: 'ko', label: '🇰🇷 韩语', color: 'violet' },
  ];

  return (
    <div className="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-3 space-y-3">
      <div className="text-xs font-extrabold text-rose-700 flex items-center gap-1">
        <Mic className="w-3.5 h-3.5" /> 口语评分配置
      </div>

      <Field label="参考图片（可空）" hint="显示在录音区上方，帮助学生看图说话">
        <MediaUploader
          value={v.referenceImageUrl || ''}
          onChange={(url) => onPatch({ referenceImageUrl: url ?? '' })}
          type="image"
          compact
        />
      </Field>

      <Field label="最少录音（毫秒）" hint="少于该时长算未达标。默认 3000（约 3 秒）">
        <input
          type="number"
          min={0}
          max={60000}
          step={500}
          value={v.minRecordingMs ?? 3000}
          onChange={(e) => onPatch({ minRecordingMs: Math.max(0, Number(e.target.value) || 0) })}
          className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
        />
      </Field>

      <Field label="语音识别语言" hint="决定 ASR 优先识别哪种语言（多选）">
        <div className="flex gap-2 flex-wrap">
          {langs.map((lang) => {
            const selected = v.speechLanguages?.includes(lang.value) ?? false;
            return (
              <button
                key={lang.value}
                type="button"
                onClick={() => {
                  const cur: string[] = v.speechLanguages ?? [];
                  const next = selected
                    ? cur.filter((l) => l !== lang.value)
                    : [...cur, lang.value];
                  onPatch({ speechLanguages: next.length ? next : undefined });
                }}
                className={
                  'rounded-xl px-3 py-1.5 text-xs font-extrabold border-2 transition ' +
                  (selected
                    ? `bg-${lang.color}-50 text-${lang.color}-700 border-${lang.color}-300`
                    : 'bg-white text-stone-500 border-amber-200 hover:border-brand-purple')
                }
              >
                {lang.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="通过短语（每行一句 · 全部命中才算通过）"
        hint="例：I like apples → 学员说 I really like apples 即命中。空配置 = 必不通过。"
      >
        <div className="space-y-1.5">
          {(v.passPhrases ?? []).map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="shrink-0 w-5 h-5 rounded-md bg-rose-100 text-rose-600 grid place-items-center text-[10px] font-extrabold">
                {i + 1}
              </span>
              <input
                type="text"
                value={s}
                onChange={(e) => {
                  const next = [...(v.passPhrases ?? [])];
                  next[i] = e.target.value;
                  onPatch({ passPhrases: next });
                }}
                placeholder="例如：I like apples"
                className="flex-1 rounded-xl border-2 border-amber-200 bg-white px-3 py-1.5 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
              />
              <button
                type="button"
                onClick={() => onPatch({ passPhrases: (v.passPhrases ?? []).filter((_, j) => j !== i) })}
                className="shrink-0 rounded-lg p-1.5 hover:bg-rose-50 text-rose-500"
                title="删除这一句"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onPatch({ passPhrases: [...(v.passPhrases ?? []), ''] })}
            className="rounded-xl border-2 border-dashed border-amber-300 text-stone-500 text-xs font-extrabold py-1.5 w-full hover:border-brand-purple hover:text-brand-purple"
          >
            <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> 加一句
          </button>
        </div>
      </Field>

      {/* 正确答案音频：与"通过短语"配套。学员答题识别错误时自动播放。
          与上方"题目音频"区分：题目音频是进题就播，本字段是答错才播。 */}
      <Field
        label="正确答案音频（可空）"
        hint="学员答题识别错误时自动播放这段音频。管理员自己念一遍标准答案放这里即可。"
      >
        <MediaUploader
          value={v.answerAudioUrl || ''}
          onChange={(url) =>
            onPatch({
              answerAudioUrl: url ?? '',
              answerAudioName: url ? v.answerAudioName ?? '' : '',
            })
          }
          type="audio"
        />
      </Field>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-extrabold text-stone-700 mb-1">
        {label}
        {hint && <span className="ml-2 text-stone-400 font-normal">· {hint}</span>}
      </div>
      {children}
    </div>
  );
}
