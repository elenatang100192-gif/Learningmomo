'use client';
// 衔接步骤编辑器：4 种模式（听/看/读/练），每个模式可独立配音频
import { MediaUploader } from './MediaUploader';
import { BridgeMode, BRIDGE_MODES } from '@/components/lesson/BridgeStep';

export interface BridgeContent {
  mode: BridgeMode;
  audio?: string;
  // 4 种模式各自的可选配置：音频 / 文字 / 图
  resources?: Partial<Record<BridgeMode, { audio?: string; text?: string; image?: string }>>;
}

export function BridgeBuilder({
  value,
  onChange,
}: {
  value: BridgeContent;
  onChange: (c: BridgeContent) => void;
}) {
  const mode = value.mode ?? 'READ';
  const resources = value.resources ?? {};

  function setMode(m: BridgeMode) {
    onChange({ ...value, mode: m });
  }

  function setResource(m: BridgeMode, patch: Partial<{ audio: string; text: string; image: string }>) {
    const next = { ...resources, [m]: { ...(resources[m] ?? {}), ...patch } };
    onChange({ ...value, resources: next });
  }

  return (
    <div className="space-y-4">
      {/* 4 个模式：附件风格 chip，当前高亮 */}
      <div>
        <div className="text-sm font-bold text-stone-600 mb-2">
          选择衔接方式
          <span className="ml-2 text-xs font-normal text-stone-400">（学生进入步骤时只看到选中的那一个高亮）</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BRIDGE_MODES.map((m) => {
            const active = m.value === mode;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={
                  'rounded-2xl border-2 p-3 transition flex flex-col items-center gap-1 ' +
                  (active
                    ? `bg-gradient-to-br ${m.bg} ${m.ring} ring-2 border-white shadow-pop`
                    : 'bg-white border-amber-200 hover:border-amber-400 text-stone-500')
                }
              >
                <div className="text-3xl">{m.emoji}</div>
                <div className={'text-lg font-extrabold ' + (active ? m.color : 'text-stone-600')}>
                  {m.cn}
                </div>
                <div className={'text-xs font-bold ' + (active ? 'opacity-90' : 'opacity-50')}>
                  {m.en}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 当前选中模式的可选配置：音频 / 文字 / 图 */}
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-3 space-y-3">
        <div className="text-sm font-bold text-stone-700 flex items-center gap-1">
          🎛 配置「{BRIDGE_MODES.find((m) => m.value === mode)?.cn} · {BRIDGE_MODES.find((m) => m.value === mode)?.en}」
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr,260px] gap-3">
          <div>
            <span className="text-xs font-bold text-stone-500">配套文字（可选）</span>
            <textarea
              rows={3}
              value={resources[mode]?.text ?? ''}
              onChange={(e) => setResource(mode, { text: e.target.value })}
              placeholder="如：试着跟读 / 听三遍 / 看着读出单词"
              className="mt-1 w-full rounded-2xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-amber-500 resize-none"
            />
            <div className="mt-3">
              <span className="text-xs font-bold text-stone-500">配套图片（可选）</span>
              <div className="mt-1">
                <MediaUploader
                  value={resources[mode]?.image}
                  onChange={(url) => setResource(mode, { image: url ?? '' })}
                  type="image"
                  compact
                />
              </div>
            </div>
          </div>
          <div>
            <span className="text-xs font-bold text-stone-500">配套音频（可选）</span>
            <div className="mt-1">
              <MediaUploader
                value={resources[mode]?.audio}
                onChange={(url) => setResource(mode, { audio: url ?? '' })}
                type="audio"
                compact
              />
            </div>
            <div className="mt-1.5 text-xs text-stone-400">进入步骤时自动播放</div>
          </div>
        </div>
      </div>

      {/* 兼容旧字段：顶层 audio（兜底用） */}
      <details className="rounded-2xl border-2 border-amber-100 bg-amber-50/20 p-3 text-sm">
        <summary className="cursor-pointer text-stone-500 font-bold">高级 · 全局兜底音频</summary>
        <div className="mt-2">
          <div className="text-xs text-stone-500 mb-1">
            如果 4 种模式都没配音频，会用这里的兜底；一般情况下不用填。
          </div>
          <MediaUploader
            value={value.audio}
            onChange={(url) => onChange({ ...value, audio: url ?? '' })}
            type="audio"
            compact
          />
        </div>
      </details>
    </div>
  );
}
