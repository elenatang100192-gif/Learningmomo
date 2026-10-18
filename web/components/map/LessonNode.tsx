'use client';
// 学生端关卡节点：圆形 + 扁平纯色平涂（可汗儿童版风）
// 状态：UNLOCKED 当前可用（紫色圆）、COMPLETED 已完成（草绿圆 + 白勾）、LOCKED 未解锁（淡灰圆 + 🔒）

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Status = 'LOCKED' | 'UNLOCKED' | 'COMPLETED';

const PRESET_COLORS = [
  '#FFCE4D', // 黄
  '#FF8A5C', // 桃橙
  '#FF8FA3', // 桃粉
  '#7CC77B', // 草绿
  '#74C0E5', // 天蓝
  '#A48AF0', // 紫
];

function colorFor(i: number) {
  return PRESET_COLORS[i % PRESET_COLORS.length];
}

export function LessonNode({
  index,
  title,
  status,
  iconUrl,
  href,
  children,
}: {
  index: number;
  title?: string;
  status: Status;
  iconUrl?: string | null;
  href?: string;
  children?: ReactNode;
}) {
  const isCurrent = status === 'UNLOCKED';
  const isDone = status === 'COMPLETED';
  const isLocked = status === 'LOCKED';

  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isTallOrWide, setIsTallOrWide] = useState(false);

  useEffect(() => {
    if (!iconUrl) { setIsTallOrWide(false); return; }
    const probe = new window.Image();
    probe.onload = () => {
      const ratio = probe.naturalWidth / probe.naturalHeight;
      setIsTallOrWide(!(ratio > 0.85 && ratio < 1.15));
    };
    probe.onerror = () => setIsTallOrWide(false);
    probe.src = iconUrl.startsWith('http')
      ? `/api/media?u=${encodeURIComponent(iconUrl)}`
      : iconUrl;
  }, [iconUrl]);

  // 扁平纯色背景：已完成 → 草绿；当前 → 紫色；锁定 → 淡灰
  const bgColor = isLocked
    ? '#E5DFF5'
    : isDone
      ? '#7CC77B'
      : isCurrent
        ? '#A48AF0'
        : colorFor(index - 1);

  // 当前：淡紫光圈；已完成：淡绿光圈；锁定：无光圈
  const ringColor = isCurrent
    ? '0 0 0 5px rgba(164, 138, 240, .35)'
    : isDone
      ? '0 0 0 4px rgba(124, 199, 123, .40)'
      : isLocked
        ? 'none'
        : 'none';

  const cardInner = (
    <div
      className={[
        'relative w-full aspect-square rounded-full overflow-hidden',
        'border-[2px] border-white/30',
        isLocked ? 'opacity-70' : 'group-hover:scale-[1.04] transition-transform',
      ].join(' ')}
      style={{
        background: bgColor,
        boxShadow: 'none',
      }}
    >
      {/* 图片：cover/contain 自适应 */}
      {!isLocked && iconUrl && !imgFailed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl.startsWith('http')
            ? `/api/media?u=${encodeURIComponent(iconUrl)}`
            : iconUrl}
          alt={title ?? `Lesson ${index}`}
          className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${
            isTallOrWide ? 'object-contain' : 'object-cover'
          } ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={isTallOrWide ? { background: 'rgba(255,255,255,0.5)' } : undefined}
          draggable={false}
          loading="eager"
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            // eslint-disable-next-line no-console
            console.warn('[LessonNode] image load failed:', iconUrl);
            setImgFailed(true);
          }}
        />
      )}

      {/* 失败兜底 */}
      {!isLocked && iconUrl && imgFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl">⚠️</span>
          <span className="text-[9px] font-bold mt-1" style={{ color: 'white' }}>Image failed</span>
        </div>
      )}

      {/* 占位字符 / loading */}
      {!isLocked && (!iconUrl || (!imgLoaded && !imgFailed)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {!iconUrl ? (
            <span className="text-white font-extrabold text-4xl sm:text-5xl" style={{ textShadow: '0 2px 8px rgba(0,0,0,.15)' }}>
              {String.fromCharCode(65 + ((index - 1) % 26))}
            </span>
          ) : (
            <div className="flex flex-col items-center gap-2" style={{ color: 'rgba(255,255,255,.7)' }}>
              <div className="size-7 rounded-full animate-spin" style={{ border: '3px solid rgba(255,255,255,.3)', borderTopColor: 'white' }} />
              <span className="text-[9px] font-extrabold">LOADING…</span>
            </div>
          )}
        </div>
      )}

      {/* 锁定：🔒 居中 */}
      {isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.15))' }}>🔒</span>
        </div>
      )}

      {/* 序号徽章：左上角（白色圆 + 紫色字） */}
      <div
        className="absolute rounded-full font-extrabold flex items-center justify-center"
        style={{
          top: 6,
          left: 6,
          width: 30,
          height: 30,
          fontSize: 14,
          background: '#FFFFFF',
          color: '#A48AF0',
          boxShadow: '0 2px 6px rgba(0,0,0,.12)',
        }}
      >
        {index}
      </div>

      {/* 已完成：右上角绿色圆形勾（白底绿勾） */}
      {isDone && (
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            top: 6,
            right: 6,
            width: 28,
            height: 28,
            fontSize: 14,
            background: '#FFFFFF',
            color: '#7CC77B',
            boxShadow: '0 2px 6px rgba(0,0,0,.12)',
          }}
        >
          ✓
        </div>
      )}

      {/* 当前："START" 标签 */}
      {isCurrent && (
        <div
          className="absolute left-1/2 -translate-x-1/2 font-extrabold
                     rounded-full px-2.5 py-0.5 text-[10px] sm:text-[11px] tracking-wider"
          style={{
            bottom: 8,
            background: '#FFFFFF',
            color: '#A48AF0',
            boxShadow: 'none',
          }}
        >
          START
        </div>
      )}

      {children}
    </div>
  );

  return (
    <div className="relative" style={{ boxShadow: ringColor, borderRadius: 9999 }}>
      {href && !isLocked ? (
        <Link href={href} className="block group">
          {cardInner}
        </Link>
      ) : (
        <div className={isLocked ? 'cursor-not-allowed' : 'cursor-pointer group'}>
          {cardInner}
        </div>
      )}

      {/* 节点标题（圆下方） */}
      {title && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 text-center
                     font-extrabold whitespace-nowrap text-xs sm:text-sm"
          style={{ color: 'var(--stu-ink, #1F1838)' }}
        >
          {title}
        </div>
      )}
    </div>
  );
}
