'use client';
// 衔接步骤：听 Listen / 看 Watch / 读 Read / 练 Practice 4 种模式
// 后台每配一个 BRIDGE step 选一种 mode，前台按 step 数组顺序一张一张渲染
// 模式不在该 step 就不显示
import { useEffect, useRef } from 'react';

export type BridgeMode = 'LISTEN' | 'WATCH' | 'READ' | 'PRACTICE';

export const BRIDGE_MODES: { value: BridgeMode; emoji: string; cn: string; en: string; color: string; ring: string; bg: string }[] = [
  { value: 'LISTEN',   emoji: '🎧', cn: '听', en: 'Listen',   color: 'text-sky-700',    ring: 'ring-sky-400',    bg: 'from-sky-100 to-cyan-100'    },
  { value: 'WATCH',    emoji: '👀', cn: '看', en: 'Watch',    color: 'text-purple-700', ring: 'ring-purple-400', bg: 'from-purple-100 to-fuchsia-100' },
  { value: 'READ',     emoji: '📖', cn: '读', en: 'Read',     color: 'text-emerald-700',ring: 'ring-emerald-400',bg: 'from-emerald-100 to-teal-100'  },
  { value: 'PRACTICE', emoji: '✏️', cn: '练', en: 'Practice', color: 'text-amber-700',  ring: 'ring-amber-400',  bg: 'from-amber-100 to-yellow-100'  },
];

export interface BridgeContent {
  mode: BridgeMode;          // 当前 step 选中的模式
  audio?: string;            // 兼容旧字段
  // 4 种模式各自可独立配音频/文字/图，便于以后扩展
  resources?: Partial<Record<BridgeMode, { audio?: string; text?: string; image?: string }>>;
}

function getActiveAudio(c: BridgeContent): string | undefined {
  if (c.resources && c.resources[c.mode]?.audio) return c.resources[c.mode]!.audio;
  return c.audio;
}

export function BridgeStep({ content, onDone }: { content: BridgeContent; onDone: () => void }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mode = content.mode;
  const audio = getActiveAudio(content);
  const active = BRIDGE_MODES.find((m) => m.value === mode) ?? BRIDGE_MODES[2]; // 默认 Read
  const res = content.resources?.[mode];

  // 进入步骤时自动播放；播完 + 1 秒缓冲自动切下一步
  useEffect(() => {
    const el = audioRef.current;
    let doneTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const advance = () => {
      if (doneTimer) clearTimeout(doneTimer);
      doneTimer = setTimeout(() => {
        if (!cancelled) onDone();
      }, 1000);
    };

    if (el && audio) {
      el.src = audio;
      el.currentTime = 0;
      el.volume = 0.85;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.then(() => {/* 播放成功，依赖 onEnded 触发 advance */})
          .catch(() => {
            // 自动播放被浏览器阻止 / 资源加载失败：兜底 3 秒后跳
            if (!cancelled) {
              if (doneTimer) clearTimeout(doneTimer);
              doneTimer = setTimeout(() => onDone(), 3000);
            }
          });
      }
    } else {
      // 没配音频：2 秒后直接跳
      if (doneTimer) clearTimeout(doneTimer);
      doneTimer = setTimeout(() => {
        if (!cancelled) onDone();
      }, 2000);
    }

    return () => {
      cancelled = true;
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, [audio, onDone]);

  return (
    <div className="grid place-items-center min-h-[400px] text-center">
      <div className="flex flex-col items-center gap-5 max-w-[640px] w-full">
        {/* 当前模式单卡片：不再同时显示 4 chip */}
        <div
          className={
            'relative rounded-[28px] border-4 p-6 sm:p-8 transition flex flex-col items-center gap-3 w-full ' +
            `bg-gradient-to-br ${active.bg} ${active.ring} ring-4 scale-100 shadow-pop border-white`
          }
        >
          <div className="text-6xl sm:text-7xl">{active.emoji}</div>
          <div className={'text-3xl sm:text-4xl font-extrabold ' + active.color}>
            {active.en}
          </div>

          {res?.text && (
            <div className="text-base sm:text-lg text-stone-700 font-bold mt-1 max-w-full">
              {res.text}
            </div>
          )}

          {res?.image && (
            <img
              src={res.image}
              alt=""
              className="rounded-2xl border-2 border-white shadow-pop max-h-48 object-contain bg-white/60 mt-1"
            />
          )}
        </div>

        {/* 自动播放音频（无 UI 控件），播完后 1 秒自动跳到下一步 */}
        <audio
          ref={audioRef}
          autoPlay
          style={{ display: 'none' }}
          onEnded={() => {
            setTimeout(() => onDone(), 1000);
          }}
        />
      </div>
    </div>
  );
}
