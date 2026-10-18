'use client';
// 超市探险 / 图片标签（Image Safari step）—— 学生在背景图上用方向键走吉祥物，
// 靠近 tag 时自动 TTS 朗读 + 点 tag 触发朗读 + 显示词卡。
// 视觉参考：参考 UI 的 Supermarket Safari
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ImageSafariContent, ImageTag } from '@/lib/stepContents';

const ACTIVE_RADIUS = 12; // % 横向距离阈值，吉祥物在轨道上靠近 tag 时触发自动朗读

function speak(text: string): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  window.speechSynthesis.cancel();
  if (!text.trim()) return null;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
  return u;
}

// 按顺序播放音频链：A1 → A2 → ...。
// - 空字符串 / undefined 跳过
// - 用 HTMLAudioElement + ended 事件串联；新调用会取消上一组未完成的链
// - 返回最后一节 audio 元素（用于在 onClick 同步播报时不需要）
let _audioChainStop: (() => void) | null = null;
function playAudioSequence(urls: (string | undefined | null)[]): void {
  if (typeof window === 'undefined') return;
  // 停止上一段链
  if (_audioChainStop) _audioChainStop();
  const list = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
  if (list.length === 0) {
    _audioChainStop = null;
    return;
  }
  const audios: HTMLAudioElement[] = list.map((u) => {
    const a = new Audio(u);
    a.preload = 'auto';
    return a;
  });
  let cancelled = false;
  // 链式：i 播完 → 播放 i+1
  const playAt = (i: number) => {
    if (cancelled) return;
    const a = audios[i];
    a.onended = () => {
      if (cancelled) return;
      if (i + 1 < audios.length) playAt(i + 1);
      else _audioChainStop = null;
    };
    a.onerror = () => {
      if (cancelled) return;
      // 任意一段加载失败就跳过该段继续下一段，避免一次失败全卡死
      if (i + 1 < audios.length) playAt(i + 1);
      else _audioChainStop = null;
    };
    a.play().catch(() => {
      if (i + 1 < audios.length) playAt(i + 1);
      else _audioChainStop = null;
    });
  };
  _audioChainStop = () => {
    cancelled = true;
    audios.forEach((a) => {
      a.onended = null;
      a.onerror = null;
      try { a.pause(); a.currentTime = 0; } catch { /* noop */ }
    });
  };
  playAt(0);
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** 题面音频：挂载 / src 变化时自动播一次。失败不报错。 */
function PromptAudioAutoPlay({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
  }, [src]);
  return <audio ref={ref} src={src} preload="auto" />;
}

export function ImageSafariStep({
  content,
  onResult,
  onDone,
  onPrev,
}: {
  content: ImageSafariContent;
  onResult: (stars: number) => void;
  onDone?: () => void;
  onPrev?: () => void;
}) {
  // 兼容旧 IMAGE step 的 url/audio：仍可作为单一 scene 使用
  const sceneUrl = useMemo(() => {
    if (content.imageUrl) return content.imageUrl;
    if (content.url) return content.url;
    return content.pages?.[0]?.url;
  }, [content.imageUrl, content.url, content.pages]);

  // 没有 tag 但有 caption/音频：退化到普通图片步骤
  const isLegacy = !content.tags?.length;

  const sceneRef = useRef<HTMLDivElement>(null);
  // 初始位置优先用 admin 设置的 mascotX/Y，否则用底部中央 (50, 85) 作为默认
  const [mascotPos, setMascotPos] = useState({
    x: typeof content.mascotX === 'number' ? content.mascotX : 50,
    y: typeof content.mascotY === 'number' ? content.mascotY : 85,
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [popId, setPopId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  // drop-anim 的 key：每次递增强制重渲染，让 keyframe 重新触发（否则 React 会复用同一节点、不再跑动画）
  const [dropKey, setDropKey] = useState(0);

  // 点击 image-style tag 时，复制一个图片副本从 tag 中心飞到 mascot 中心。
  // flying = null 时不渲染；点 tag 时设置，动画结束（onAnimationEnd）清空。
  // 注意：tag 在右栏（场景图）、mascot 在左栏，二者在 viewport 坐标上是分离的，
  // 用 fixed 定位 + getBoundingClientRect 拿到绝对坐标，跨栏飞行无障碍。
  type FlyAnim = { id: number; src: string; fromX: number; fromY: number; toX: number; toY: number; arc: number };
  const [flying, setFlying] = useState<FlyAnim | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const mascotNodeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 组件挂载时触发动画；之后切换 mascotUrl 也会重新触发
    setDropKey((k) => k + 1);
  }, [content.mascotUrl]);

  // 吉祥物"被点击"图片切换：有点击后图片时，点 tag 后切到 active 图并保持。
  // 后台清除 mascotActiveUrl 时回到默认图。
  const [mascotActive, setMascotActive] = useState(false);
  useEffect(() => {
    if (!content.mascotActiveUrl) {
      setMascotActive(false);
    }
  }, [content.mascotActiveUrl]);

  // 飞行兜底：onAnimationEnd 偶尔在 dev 模式下不触发，1.1s 后强制清空
  useEffect(() => {
    if (!flying) return;
    const t = window.setTimeout(() => setFlying(null), 1100);
    return () => window.clearTimeout(t);
  }, [flying]);

  // 组件卸载时停掉未播完的音频链 + 取消 TTS
  useEffect(() => {
    return () => {
      if (_audioChainStop) _audioChainStop();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);
  // 容器按上传原图比例同比缩放（不同屏保持原比例，不裁切）
  const [sceneRatio, setSceneRatio] = useState<number | null>(null);

  // 找最近的 tag
  const nearest = useMemo(() => {
    if (!content.tags?.length) return null;
    let best: { tag: ImageTag; d: number } | null = null;
    for (const t of content.tags) {
      const d = dist(mascotPos, { x: t.x, y: t.y });
      if (!best || d < best.d) best = { tag: t, d };
    }
    return best;
  }, [mascotPos, content.tags]);

  // 靠近自动朗读（每个 tag 只触发一次直到离开再回来）
  useEffect(() => {
    if (!nearest) return;
    if (nearest.d <= ACTIVE_RADIUS) {
      setActiveId(nearest.tag.id);
      // 第一次进入触发 TTS
      setDone((cur) => {
        if (cur.has(nearest.tag.id)) return cur;
        const next = new Set(cur);
        next.add(nearest.tag.id);
        speak(nearest.tag.label);
        return next;
      });
    } else {
      setActiveId((cur) => (cur === nearest.tag.id ? null : cur));
    }
  }, [nearest]);

  // 同步最新 mascotPos 给键盘移动闭包使用（保留 ref 以备后续扩展）
  const mascotPosRef = useRef(mascotPos);
  useEffect(() => { mascotPosRef.current = mascotPos; }, [mascotPos]);

  // 键盘控制 — 只移动吉祥物（不带动任何其他动画/移动），空格/回车朗读当前激活 tag。
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const step = 4;
      let handled = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setMascotPos((p) => ({ x: p.x, y: Math.max(4, p.y - step) }));
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setMascotPos((p) => ({ x: p.x, y: Math.min(96, p.y + step) }));
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setMascotPos((p) => ({ x: Math.max(4, p.x - step), y: p.y }));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setMascotPos((p) => ({ x: Math.min(96, p.x + step), y: p.y }));
      } else if (e.key === ' ' || e.key === 'Enter') {
        if (activeId) {
          const tag = content.tags.find((t) => t.id === activeId);
          if (tag) {
            speak(tag.label);
            setPopId(tag.id);
            window.setTimeout(() => setPopId(null), 700);
            setDone((cur) => new Set(cur).add(tag.id));
          }
        }
      } else {
        handled = false;
      }
      if (handled) e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, content.tags]);

  if (isLegacy) {
    return (
      <div className="grid place-items-center min-h-[400px] text-center">
        <div className="rounded-[28px] bg-white/90 border-4 border-white shadow-pop p-6 max-w-md">
          <div className="text-5xl mb-2">🖼</div>
          <div className="text-2xl font-extrabold text-stone-800">{content.caption ?? 'Picture Step'}</div>
          {sceneUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sceneUrl} alt="" className="mt-4 max-h-64 rounded-2xl border-2 border-amber-200 object-contain" />
          ) : null}
            <button onClick={() => onResult(0)} className="mt-4 btn-kid bg-brand-orange">Next →</button>
        </div>
      </div>
    );
  }

  const total = content.tags.length;
  const visited = done.size;
  const stars = visited * 3;
  const allVisited = visited >= total;

  return (
    <div className="space-y-4">
      {/* 吉祥物入场动画 keyframe + tag 点击放大 keyframe。
          用 <style jsx global> —— styled-jsx 不会对 global style 做 hash/scope，
          因此 @keyframes 名保持原名，组件任意位置引用 `animation: safari-tag-pop ...` 都能匹配。
          不能用 dangerouslySetInnerHTML + jsx global：styled-jsx 5 校验会报
          "Expected one child under JSX style tag, but got 0"，必须是 children 字符串。 */}
      <style jsx global>{`
        @keyframes mascot-drop-in {
          0%   { transform: translateY(-180%); opacity: 0; }
          55%  { transform: translateY(0);     opacity: 1; }
          70%  { transform: translateY(-18%);  opacity: 1; }
          85%  { transform: translateY(0);     opacity: 1; }
          92%  { transform: translateY(-6%);   opacity: 1; }
          100% { transform: translateY(0);     opacity: 1; }
        }
        @keyframes safari-tag-pop {
          0%   { transform: scale(1);    filter: brightness(1)    drop-shadow(0 0 0 rgba(255,255,255,0)); }
          25%  { transform: scale(1.7);  filter: brightness(1.25) drop-shadow(0 0 16px rgba(255,220,80,0.9)); }
          55%  { transform: scale(0.8);  filter: brightness(1)    drop-shadow(0 0 0 rgba(255,255,255,0)); }
          80%  { transform: scale(1.1);  filter: brightness(1.05) drop-shadow(0 0 4px rgba(255,255,255,0.4)); }
          100% { transform: scale(1);    filter: brightness(1)    drop-shadow(0 0 0 rgba(255,255,255,0)); }
        }
        /* 点击 image-style tag 时，副本从 tag 飞到 mascot 的轨迹动画。
           由 inline style 设置 CSS 自定义属性 --fly-dx / --fly-dy / --fly-arc
           （像素值），keyframes 通过这些变量计算每一帧的 translate 偏移，
           配合 translate(-50%,-50%) 让图片以自身中心为锚点移动。 */
        @keyframes safari-fly-to-mascot {
          0%   {
            transform: translate(calc(-50% + 0px), calc(-50% + 0px)) scale(1);
            opacity: 1;
          }
          15%  {
            /* 上升段：从 tag 起飞，水平先到 0.4dx，纵向向上 -arc */
            transform: translate(calc(-50% + (var(--fly-dx) * 0.4)), calc(-50% + (var(--fly-dy) - var(--fly-arc)))) scale(0.95);
            opacity: 1;
          }
          50%  {
            /* 弧顶附近 */
            transform: translate(calc(-50% + (var(--fly-dx) * 0.7)), calc(-50% + (var(--fly-dy) - (var(--fly-arc) * 0.7)))) scale(0.7);
            opacity: 1;
          }
          100% {
            /* 落到 mascot */
            transform: translate(calc(-50% + var(--fly-dx)), calc(-50% + var(--fly-dy))) scale(0.3);
            opacity: 0.2;
          }
        }
      `}</style>
      {/* 飞行副本：portal 到 body，fixed 定位 + CSS 变量驱动 keyframe 走弧线。
          onAnimationEnd 清空 flying state 让 React 移除节点；onAnimationEnd 兜底
          1000ms setTimeout 防止某些浏览器不触发事件（极少数情况）。 */}
      {flying && typeof document !== 'undefined' && createPortal(
        (() => {
          const dx = flying.toX - flying.fromX;
          const dy = flying.toY - flying.fromY;
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={flying.id}
              src={flying.src}
              alt=""
              aria-hidden
              onAnimationEnd={() => setFlying(null)}
              style={{
                position: 'fixed',
                left: `${flying.fromX}px`,
                top: `${flying.fromY}px`,
                width: 72,
                height: 72,
                objectFit: 'contain',
                pointerEvents: 'none',
                zIndex: 9999,
                // 喂给 keyframe 的位移和弧度
                ['--fly-dx' as any]: `${dx}px`,
                ['--fly-dy' as any]: `${dy}px`,
                ['--fly-arc' as any]: `${flying.arc}px`,
                animation: 'safari-fly-to-mascot 900ms cubic-bezier(.45,.05,.55,.95) forwards',
                filter: 'drop-shadow(0 6px 12px rgba(0,0,0,.25))',
              }}
            />
          );
        })(),
        document.body,
      )}
      {/* 顶部信息 */}
      <div className="flex items-center gap-3">
        <div className="text-amber-700 font-extrabold">
          {visited} / {total}
        </div>
        <div className="flex-1 h-3 bg-white/70 rounded-full overflow-hidden border border-amber-300">
          <div
            className="h-full bg-gradient-to-r from-brand-yellow to-brand-orange transition-all"
            style={{ width: `${(visited / Math.max(1, total)) * 100}%` }}
          />
        </div>
        <div className="text-xs text-amber-700 font-extrabold">⭑ {stars}</div>
      </div>

      {/* 题目（可空 · 顶部题面 + 题面音频进入时自动播） */}
      {(content.prompt || content.promptImageUrl || content.promptAudioUrl) && (
        <div className="rounded-2xl border-2 border-pink-200 bg-white p-3 flex items-start gap-3">
          {content.promptImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={content.promptImageUrl}
              alt=""
              className="max-h-24 w-auto rounded-xl border-2 border-pink-200 bg-pink-50 object-contain"
            />
          )}
          <div className="flex-1 min-w-0">
            {content.prompt && (
              <div className="text-stone-800 font-extrabold text-base leading-relaxed">
                {content.prompt}
              </div>
            )}
            {content.promptAudioUrl && (
              <div className="mt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const a = new Audio(content.promptAudioUrl!);
                    a.play().catch(() => {});
                  }}
                  className="size-8 rounded-full bg-amber-300 grid place-items-center text-stone-800 font-extrabold hover:bg-amber-400 active:scale-95 transition"
                  title="Play again"
                >
                  ♪
                </button>
                <span className="text-xs text-stone-500">Tap ♪ to replay the prompt</span>
              </div>
            )}
            {/* 隐藏的题面音频：场景挂载/题面音频 URL 变时自动播一次。 */}
            {content.promptAudioUrl && (
              <PromptAudioAutoPlay src={content.promptAudioUrl} />
            )}
          </div>
        </div>
      )}

      {/* 左右分栏：左 1/3 给吉祥物，右 2/3 给背景图。没有吉祥物图片时 → 背景图撑满整个区域居中。 */}
      {content.mascotUrl ? (
        <div ref={gridRef} className="grid grid-cols-[1fr_2fr] items-stretch gap-0">
        {/* 左侧：吉祥物站立区（高度跟随右侧背景图等比，保证视觉对齐）。
            admin 在 builder 里设的 (mascotX, mascotY) 直接映射到这里 —— x% 控制横向位置
            （0%=左栏最左 / 100%=左栏最右），y% 控制纵向位置（0%=顶部 / 100%=底部）。 */}
        <div
          className="relative shrink rounded-2xl"
          aria-label="mascot track"
        >
          <div
            ref={mascotNodeRef}
            className="absolute -translate-x-1/2 -translate-y-full transition-[left,top] duration-150 pointer-events-none"
            style={{ left: `${mascotPos.x}%`, top: `${mascotPos.y}%` }}
            aria-label="mascot"
          >
            {/* drop-in 入场动画层 — 单独包一层，避开外层 transform。 */}
            <div key={dropKey} className="inline-block" style={{ animation: 'mascot-drop-in 900ms cubic-bezier(.2,.8,.3,1.1) both' }}>
              {content.mascotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={mascotActive && content.mascotActiveUrl ? content.mascotActiveUrl : content.mascotUrl}
                  alt={content.mascotName ?? 'Mascot'}
                  className="block h-auto w-auto object-contain drop-shadow-lg"
                  draggable={false}
                  style={{ transform: `scale(${content.mascotScale ?? 1})`, transformOrigin: 'center bottom' }}
                />
              ) : (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-brand-orange text-white grid place-items-center text-2xl shadow-pop border-2 border-white">
                  🦊
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：背景图 + tag 点位 + 提示条 */}
        <div
          ref={sceneRef}
          className="relative flex-1 min-w-0 select-none"
          style={{ aspectRatio: sceneRatio ? `${sceneRatio}` : '4 / 3' }}
        >
          {sceneUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sceneUrl}
              alt={content.imageName ?? 'Scene'}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setSceneRatio(img.naturalWidth / img.naturalHeight);
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-stone-400 text-sm font-bold">
              (No background image)
            </div>
          )}

          {/* Tag 圆点 */}
          {content.tags.map((tag) => {
            const isVisited = done.has(tag.id);
            const isActive = activeId === tag.id;
            const isPop = popId === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={(e) => {
                  setActiveId(tag.id);
                  speak(tag.label);
                  // 点击 tag 图片 → 依次播放两段音频（A1 → A2）。
                  // playAudioSequence 内部会过滤空串、单段/多段都支持，并取消上一次未完成的链。
                  playAudioSequence([tag.audioUrl1, tag.audioUrl2]);
                  setPopId(tag.id);
                  window.setTimeout(() => setPopId(null), 700);
                  // 吉祥物反馈图：有点击后图片时点 tag 切到 active 图并保持。
                  if (content.mascotActiveUrl) {
                    setMascotActive(true);
                  }
                  setDone((cur) => new Set(cur).add(tag.id));
                  // 飞行动画（仅 image-style tag 且后台开启 flyToMascot 时触发，默认开启）。
                  // 当前实现不飞：把事件源 button 改成"派发飞行"参数。
                  if (
                    tag.imageUrl &&
                    (content.flyToMascot ?? true) &&
                    typeof window !== 'undefined'
                  ) {
                    const startEl = e.currentTarget.querySelector('img') as HTMLImageElement | null;
                    const target = mascotNodeRef.current;
                    if (startEl && target) {
                      const a = startEl.getBoundingClientRect();
                      const b = target.getBoundingClientRect();
                      const fromX = a.left + a.width / 2;
                      const fromY = a.top + a.height / 2;
                      const toX = b.left + b.width / 2;
                      const toY = b.top + b.height / 2;
                      // 弧线高度 = 水平距离的 0.4，方向向上 (负)；保证近距离 tag 也有可见弧度
                      const dist = Math.max(40, Math.abs(toX - fromX));
                      const arc = Math.min(160, dist * 0.4);
                      setFlying({
                        id: Date.now() + Math.random(),
                        src: tag.imageUrl!,
                        fromX,
                        fromY,
                        toX,
                        toY,
                        arc,
                      });
                    }
                  }
                }}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center group"
                style={{
                  left: `${tag.x}%`,
                  top: `${tag.y}%`,
                  background: 'transparent',
                  boxShadow: 'none',
                  border: 'none',
                  padding: 0,
                }}
                title={tag.label}
              >
                <span
                  className="relative flex items-center"
                  style={{ transform: `scale(${tag.scale ?? 1})`, transformOrigin: 'center center' }}
                >
                {tag.imageUrl ? (
                  <>
                    {/* 内层 key 变化 → React 重新挂载 → 重新跑 safari-tag-pop keyframe。
                        偶数次渲染共享 key='idle' 不会重复触发；只有 isPop 那一帧挂上
                        animation 属性才跑动画。包在内层避开外层 tag.scale 的 transform 冲突。 */}
                    <span
                      key={isPop ? `pop-${tag.id}` : 'idle'}
                      style={{
                        animation: isPop ? 'safari-tag-pop 700ms cubic-bezier(.34,1.56,.64,1)' : undefined,
                        transformOrigin: 'center center',
                        display: 'inline-block',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={tag.imageUrl}
                        alt={tag.label}
                        className="max-w-[120px] max-h-[120px]"
                      />
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className={
                        'w-8 h-8 rounded-full border-[3px] border-white shadow-pop grid place-items-center text-white text-sm font-extrabold transition ' +
                        (isActive ? 'scale-125' : isVisited ? 'scale-100' : 'scale-100')
                      }
                      style={{ background: tag.color }}
                    >
                      {isVisited ? '✓' : tag.label.slice(0, 1).toUpperCase()}
                    </span>
                    {isActive && tag.label.trim() && (
                      <span
                        className="ml-2 px-2.5 py-1 rounded-full bg-white border-2 text-sm font-extrabold text-stone-800 shadow-pop whitespace-nowrap"
                        style={{ borderColor: tag.color }}
                      >
                        {tag.label}
                        {isPop && <span className="ml-1">🔊</span>}
                      </span>
                    )}
                  </>
                )}
                </span>
              </button>
            );
          })}

        </div>
      </div>
      ) : (
        /* 没有吉祥物时：背景图撑满整个区域居中，左栏去掉 */
        <div
          ref={sceneRef}
          className="relative select-none w-full"
          style={{ aspectRatio: sceneRatio ? `${sceneRatio}` : '4 / 3' }}
        >
          {sceneUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sceneUrl}
              alt={content.imageName ?? 'Scene'}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget;
                if (img.naturalWidth && img.naturalHeight) {
                  setSceneRatio(img.naturalWidth / img.naturalHeight);
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-stone-400 text-sm font-bold">
              (No background image)
            </div>
          )}
          {content.tags.map((tag) => {
            const isVisited = done.has(tag.id);
            const isActive = activeId === tag.id;
            const isPop = popId === tag.id;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  setActiveId(tag.id);
                  speak(tag.label);
                  playAudioSequence([tag.audioUrl1, tag.audioUrl2]);
                  setPopId(tag.id);
                  window.setTimeout(() => setPopId(null), 700);
                  setDone((cur) => new Set(cur).add(tag.id));
                }}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center group"
                style={{
                  left: `${tag.x}%`,
                  top: `${tag.y}%`,
                  background: 'transparent',
                  boxShadow: 'none',
                  border: 'none',
                  padding: 0,
                }}
                title={tag.label}
              >
                <span
                  className="relative flex items-center"
                  style={{ transform: `scale(${tag.scale ?? 1})`, transformOrigin: 'center center' }}
                >
                  {tag.imageUrl ? (
                    <span
                      key={isPop ? `pop-${tag.id}` : 'idle'}
                      style={{
                        animation: isPop ? 'safari-tag-pop 700ms cubic-bezier(.34,1.56,.64,1)' : undefined,
                        transformOrigin: 'center center',
                        display: 'inline-block',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={tag.imageUrl} alt={tag.label} className="max-w-[120px] max-h-[120px]" />
                    </span>
                  ) : (
                    <>
                      <span
                        className={
                          'w-8 h-8 rounded-full border-[3px] border-white shadow-pop grid place-items-center text-white text-sm font-extrabold transition ' +
                          (isActive ? 'scale-125' : 'scale-100')
                        }
                        style={{ background: tag.color }}
                      >
                        {isVisited ? '✓' : tag.label.slice(0, 1).toUpperCase()}
                      </span>
                      {isActive && tag.label.trim() && (
                        <span
                          className="ml-2 px-2.5 py-1 rounded-full bg-white border-2 text-sm font-extrabold text-stone-800 shadow-pop whitespace-nowrap"
                          style={{ borderColor: tag.color }}
                        >
                          {tag.label}
                          {isPop && <span className="ml-1">🔊</span>}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onResult(stars);
              onDone?.();
            }}
            disabled={!allVisited}
            className="btn-kid bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✨ Done
          </button>
        </div>
      </div>

      {/* 内联 keyframes for the voice bar */}
      <style jsx>{`
        @keyframes voice-bar {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1.3); }
        }
      `}</style>
    </div>
  );
}
