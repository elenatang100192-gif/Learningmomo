'use client';
// 多图 IMAGE step：每一页一张图 + 标题 + 配套音频
// - 多页：底部"上一页 / 下一页"，最后一页给"已完成 ✅"
// - 音频只在用户点击"下一页/上一页"后才播放（不自动）
// - 兼容旧单图数据（只有 url/caption/audio 时只显示一张图 + 已完成按钮）
import { useEffect, useRef, useState } from 'react';

export interface ImagePage {
  url: string;
  caption?: string;
  audio?: string;
}

export interface ImageContent {
  // 旧字段（兼容）
  url?: string;
  caption?: string;
  audio?: string;
  // 新字段
  pages?: ImagePage[];
}

function normalize(c: ImageContent): ImagePage[] {
  if (Array.isArray(c.pages) && c.pages.length > 0) {
    return c.pages
      .filter((p) => !!p?.url)
      .map((p) => ({ url: p.url!, caption: p.caption, audio: p.audio }));
  }
  if (c.url) {
    return [{ url: c.url, caption: c.caption, audio: c.audio }];
  }
  return [];
}

export function ImageStep({ content, onDone, onPrev }: { content: ImageContent; onDone: () => void; onPrev?: () => void }) {
  const pages = normalize(content);
  const total = pages.length;
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [completed, setCompleted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cur = pages[idx];
  const isLast = idx >= total - 1;

  // 播放指定页的音频（不依赖闭包，确保画面和音频严格对应）
  function playPage(targetIdx: number) {
    const el = audioRef.current;
    const page = pages[targetIdx];
    if (!el || !page || !page.audio) {
      setPlaying(false);
      return;
    }
    el.src = page.audio;
    el.currentTime = 0;
    el.volume = 0.85;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => setPlaying(false));
    }
  }

  // 进入步骤时（第 1 张图打开）：自动播放第 1 页音频
  useEffect(() => {
    playPage(0);
    // 只在挂载/数据更新时触发一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  // 翻页：用户点了"下一页/上一页"才切页并播新页音频
  function go(delta: 1 | -1) {
    if (delta === 1 && isLast) {
      onDone();
      return;
    }
    const next = Math.max(0, Math.min(total - 1, idx + delta));
    setIdx(next);
    playPage(next);
  }

  // 最后一页最后一帧"已完成"：不再自动播
  function handleDone() {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaying(false);
    setCompleted(true);
  }

  if (total === 0) {
    // 没有任何图：直接跳下一步，避免卡住
    return (
      <div className="grid place-items-center min-h-[400px] text-stone-400">
        (No images in this step)
      </div>
    );
  }

  return (
    <div className="grid place-items-center min-h-[400px] text-center">
      <div className="flex flex-col items-center gap-4 max-w-[640px] w-full">
        {/* 页码指示 */}
        {total > 1 && (
          <div className="flex items-center gap-1.5">
            {pages.map((_, i) => (
              <span
                key={i}
                className={
                  'h-2 rounded-full transition-all ' +
                  (i === idx ? 'w-8 bg-brand-orange' : 'w-2 bg-amber-200')
                }
              />
            ))}
            <span className="ml-2 text-xs font-bold text-stone-500">
              {idx + 1} / {total}
            </span>
          </div>
        )}

        {/* 当前页图片 */}
        {cur.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={cur.url}
            src={cur.url}
            alt={cur.caption ?? ''}
            className="max-h-[55vh] max-w-full rounded-3xl shadow-pop border-4 border-white bg-white object-contain"
          />
        ) : (
          <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-3xl bg-gradient-to-br from-brand-yellow to-brand-orange grid place-items-center text-9xl shadow-pop border-4 border-white">
            🐱
          </div>
        )}

        {cur.caption && (
          <div className="text-2xl md:text-3xl font-extrabold text-stone-800">
            {cur.caption}
          </div>
        )}

        {/* 翻页 / 提交 按钮 */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            {isLast ? (
              <button
                onClick={handleDone}
                className="btn-kid bg-emerald-500"
                title="Mark as done"
              >
                {completed ? '✅ Done' : '✅ Mark as seen'}
              </button>
            ) : (
              <button onClick={() => go(1)} className="btn-kid bg-brand-orange">
                {playing ? '⏭ Skip audio, next →' : 'Next page ▶'}
              </button>
            )}
          </div>
        </div>

        {/* 手动触发的隐藏播放器（不会自动播放） */}
        <audio
          ref={audioRef}
          preload="auto"
          style={{ display: 'none' }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      </div>
    </div>
  );
}
