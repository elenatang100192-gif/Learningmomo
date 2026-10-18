'use client';
// 手描 step（TRACE）学生端
// - 顶部题面 + 题面音频
// - 单词大字号浅色（中间淡色大字，给学生看"写啥"）
// - 4 色画笔（红/黑/蓝/绿）
// - canvas 手绘（鼠标/触屏，pointer events）
// - 模板图淡色显示在画布背后（按原图大小等比缩放）
// - 笔画覆盖 ≥ threshold（默认 95%）视为完成；上一个完成才解锁下一个
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, Volume2 } from 'lucide-react';
import type { TraceContent, TraceWordItem } from '@/lib/stepContents';

// 画笔固定红色（不再提供颜色选择）
const PEN_COLOR = '#E53935';

const COMPLETE_RATIO = 0.95; // 学生笔画覆盖率 >= 阈值 => 100% 完成
const COVERAGE_SAMPLE = 256; // 模板/笔画采样边长
const TEMPLATE_ALPHA = 0.55; // 模板图在前台的淡色程度（0.55 让字迹清晰可见但又不会盖住学生描的笔触）

interface Props {
  stepId: string;
  content: TraceContent;
  onResult: (starsEarned: number) => void;
  onDone?: () => void;
  onPrev?: () => void;
}

interface WordState {
  painted: boolean;   // 是否已完成（点过"完成"）
  ratio: number;      // 0..1，当前覆盖率
  doneAt?: number;    // 上次"完成"的时间戳（用于触发打勾动画重播）
}

export function TraceStep({ stepId, content, onResult, onDone, onPrev }: Props) {
  const words: TraceWordItem[] = useMemo(
    () => (content.words ?? []).filter((w) => w && (w.word || w.templateImage)),
    [content.words]
  );
  const threshold = content.threshold ?? COMPLETE_RATIO;
  const [idx, setIdx] = useState(0);
  const [states, setStates] = useState<Record<string, WordState>>({});
  // 已经上报过 onResult 的 word id 集合（避免重复加分）
  const reportedRef = useRef<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // 题目音频自动播放：用 ref 指向 JSX 中挂载的 <audio>，避免 new Audio() 在 Safari 被自动播放策略拒绝
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 画布操作句柄（父级"重画"按钮通过 ref 触发 WordCanvas.clear()）
  const canvasHandleRef = useRef<WordCanvasHandle | null>(null);
  useEffect(() => {
    const url = content.promptAudioUrl;
    if (!url) return;
    let cancelled = false;
    const tryPlay = (retries: number) => {
      if (cancelled) return;
      const a = audioRef.current;
      if (!a) {
        if (retries > 0) return setTimeout(() => tryPlay(retries - 1), 200);
        return;
      }
      // 关键：必须先设 src 并 load()，否则切换 step 时还是旧 url
      if (a.src !== url) {
        a.src = url;
      }
      try { a.currentTime = 0; } catch {}
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // 失败就再试一次（用户马上要点击解锁）
          if (!cancelled && retries > 0) {
            setTimeout(() => tryPlay(retries - 1), 600);
          }
        });
      }
    };
    const t = setTimeout(() => tryPlay(30), 200); // 最多重试 ~18s
    return () => {
      cancelled = true;
      clearTimeout(t);
      try {
        const a = audioRef.current;
        if (a) { a.pause(); a.currentTime = 0; }
      } catch {}
    };
  }, [content.promptAudioUrl, stepId]);

  // 浏览器自动播放策略：必须先有一次用户手势（点击/触摸/按键）才能自动播音频
  // 在 document 上挂一次性监听，记录"用户已经交互过"
  const autoplayUnlockedRef = useRef(false);
  useEffect(() => {
    const unlock = () => {
      autoplayUnlockedRef.current = true;
    };
    const opts = { once: true, passive: true } as AddEventListenerOptions;
    document.addEventListener('pointerdown', unlock, opts);
    document.addEventListener('keydown', unlock, opts);
    return () => {
      document.removeEventListener('pointerdown', unlock, opts);
      document.removeEventListener('keydown', unlock, opts);
    };
  }, []);

  // 切换到新单词时，自动播放：1) 题面音频（已生效）2) 当前单词的 referenceAudio（独立参考发音）
  // 用 idx 触发；避免重复：只在 idx 变化时重播当前 cur 的音频
  // 注意：不要在 effect 里引用外部 cur（声明顺序在下方会 TDZ），直接从 words[idx] 取
  const lastPlayedWordIdxRef = useRef<number | null>(null);
  useEffect(() => {
    const w = words[idx];
    if (!w) return;
    if (lastPlayedWordIdxRef.current === idx) return;
    lastPlayedWordIdxRef.current = idx;
    const ref = w.referenceAudio;
    if (!ref) return;
    // 等用户解锁自动播，且错开题面音频 350ms
    let cancelled = false;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const tryPlay = (retries: number) => {
      if (cancelled) return;
      if (!autoplayUnlockedRef.current) {
        if (retries <= 0) return;
        pending = setTimeout(() => tryPlay(retries - 1), 500);
        return;
      }
      try {
        const a = new Audio(ref);
        a.volume = 0.95;
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {}
    };
    pending = setTimeout(() => tryPlay(30), 600); // 错开题面 + 等待解锁
    return () => {
      cancelled = true;
      if (pending) clearTimeout(pending);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, words]);

  const total = words.length;
  const cur = words[idx];
  const curState = cur ? states[cur.id] : undefined;

  // 提交整 step（最后一个单词完成时由 TraceCanvas 触发）
  async function finishStep() {
    if (submitting) return;
    setSubmitting(true);
    try {
      // 一题 3 颗星（与 Quiz/Test 对齐）
      onResult(3);
      onDone?.();
    } finally {
      setSubmitting(false);
    }
  }

  // 学生点"完成"按钮时调用：标记 painted → 切下一词（非最后一词）/ 结束 step（最后一词）
  function handleWordManualComplete(word: TraceWordItem) {
    setStates((prev) => {
      const old = prev[word.id];
      // 总是更新 doneAt → 让打勾动画每次都能重播（即便词已 painted）
      return {
        ...prev,
        [word.id]: {
          painted: true,
          ratio: old?.ratio ?? 0,
          doneAt: Date.now(),
        },
      };
    });
    if (!reportedRef.current.has(word.id)) {
      reportedRef.current.add(word.id);
    }
    const isLast = words.length > 0 && words[words.length - 1]!.id === word.id;
    if (isLast) {
      // 最后一词：结束整 step（不切 idx，无下一词）
      window.setTimeout(() => finishStep(), 400);
    } else if (idx < words.length - 1) {
      // 非最后一词：切到下一个 word，给学员一点反馈时间（看到打勾再切）
      window.setTimeout(() => {
        setIdx((i) => Math.min(words.length - 1, i + 1));
      }, 550);
    }
  }

  if (words.length === 0) {
    return (
      <div className="grid place-items-center min-h-[400px] text-center">
        <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-sm font-extrabold text-stone-500">
          No words yet — please add some in the admin panel~
        </div>
      </div>
    );
  }

  return (
    <div className="grid place-items-center min-h-[400px] text-center">
      <div className="flex flex-col items-center gap-4 w-full max-w-[860px]">
        {/* 题面 + 重听按钮（同行右侧） */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {content.prompt && (
            <div className="text-xl md:text-2xl font-extrabold text-stone-800">
              {content.prompt}
            </div>
          )}
          {content.promptAudioUrl && (
            <button
              type="button"
              onClick={() => {
                const a = audioRef.current;
                if (!a) return;
                try { a.currentTime = 0; a.play().catch(() => {}); } catch {}
              }}
              className="inline-flex items-center justify-center rounded-full p-1.5 bg-amber-50 border-2 border-amber-200 text-amber-800"
              title="Replay prompt"
              aria-label="Replay prompt audio"
            >
              <Volume2 className="w-3.5 h-3.5" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* 题目音频：挂载到 DOM 才能在 Safari/iOS 自动播放 */}
        {content.promptAudioUrl && (
          <audio
            ref={audioRef}
            src={content.promptAudioUrl}
            preload="auto"
            playsInline
          />
        )}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {words.map((w, i) => {
            const s = states[w.id];
            const isCurrent = i === idx;
            const isDone = s?.painted === true;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => {
                  setIdx(i);
                }}
                className={
                  'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-base font-extrabold border-2 shadow-sm transition-all ' +
                  (isDone
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200'
                    : isCurrent
                    ? 'bg-brand-purple text-white border-brand-purple'
                    : 'bg-white text-stone-500 border-amber-200 hover:border-brand-purple hover:text-brand-purple') +
                  ' cursor-pointer'
                }
                title={isDone ? 'Done — tap to redraw' : 'Tap to switch to this word'}
              >
                {isDone ? (
                  <span
                    key={`done-${s?.doneAt ?? 0}`}
                    className="check-pop inline-flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500 border-2 border-emerald-600 text-white"
                    aria-hidden
                  >
                    <Check className="w-3.5 h-3.5" strokeWidth={3.5} />
                  </span>
                ) : (
                  <span
                    className={
                      'inline-block w-5 h-5 rounded-md border-2 ' +
                      (isCurrent ? 'border-white/80' : 'border-amber-300')
                    }
                    aria-hidden
                  />
                )}
                <span>{w.word || `#${i + 1}`}</span>
              </button>
            );
          })}
        </div>

        {/* 当前单词：参考媒体（如有）+ 大字浅色 + canvas */}
        {cur && (
          <WordCanvas
            key={cur.id}
            ref={canvasHandleRef}
            word={cur}
            colorHex={PEN_COLOR}
            threshold={threshold}
            alreadyDone={curState?.painted === true}
            onProgressChange={(ratio) => {
              setStates((prev) => {
                const old = prev[cur.id];
                if (old?.painted) return prev;
                return { ...prev, [cur.id]: { painted: false, ratio } };
              });
            }}
          />
        )}

        {/* 重画 + 完成：同一行同样大小（次要 / 主要 双按钮） */}
        {cur && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => canvasHandleRef.current?.clear()}
              disabled={curState?.painted === true}
              className="inline-flex items-center gap-1.5 text-sm font-extrabold px-6 py-2.5 rounded-full bg-white border-2 border-amber-300 text-stone-700 shadow-sm hover:bg-amber-50 active:translate-y-px transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redraw current word"
            >
              <RotateCcw className="w-4 h-4" strokeWidth={2.5} />
              Redraw
            </button>
            <button
              type="button"
              onClick={() => handleWordManualComplete(cur)}
              disabled={curState?.painted === true}
              className="inline-flex items-center gap-1.5 text-sm font-extrabold px-6 py-2.5 rounded-full bg-amber-400 border-2 border-amber-500 text-white shadow-sm hover:bg-amber-500 active:translate-y-px transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Finish and go to the next word"
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              {curState?.painted === true ? 'Done' : 'Finish'}
            </button>
          </div>
        )}

        {/* 反馈条 */}
        {curState?.painted && (
          <div className="rounded-2xl px-5 py-3 text-base md:text-lg font-extrabold shadow-pop bg-emerald-700 text-white">
            🎉 Great! On to the next one
          </div>
        )}
      </div>
    </div>
  );
}

// ========== WordCanvas ==========
// 暴露给父级的方法：通过 ref 调 clear() 清空画布
export type WordCanvasHandle = { clear: () => void };

// 单词大字号浅色 + 参考媒体 + 模板图淡色 + canvas 手绘
const WordCanvas = forwardRef<WordCanvasHandle, {
  word: TraceWordItem;
  colorHex: string;
  threshold: number;
  alreadyDone: boolean;
  onProgressChange: (ratio: number) => void;
}>(function WordCanvas({
  word,
  colorHex,
  threshold,
  alreadyDone,
  onProgressChange,
}, ref) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const templateImgRef = useRef<HTMLImageElement | null>(null);
  // 学生画笔轨迹（等 canvas 尺寸的 hidden mask，灰度"已画"区域）
  const paintedMaskRef = useRef<HTMLCanvasElement | null>(null);
  // 模板阈值 mask（一旦加载完模板图就建好，等比缩放）
  const templateMaskRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const completedRef = useRef(false);
  const [tip, setTip] = useState<{ ratio: number } | null>(null);

  // 加载模板图（按原图自然大小，display 尺寸 = wrap 容器宽度）
  useEffect(() => {
    if (!word.templateImage) {
      templateImgRef.current = null;
      templateMaskRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      templateImgRef.current = img;
      // 重新同步 canvas 尺寸并重画
      layoutAndRedraw();
    };
    img.onerror = () => {
      templateImgRef.current = null;
    };
    img.src = word.templateImage;
  }, [word.templateImage]);

  // 切换单词时清状态
  useEffect(() => {
    completedRef.current = false;
    setTip(null);
    if (paintedMaskRef.current) {
      const m = paintedMaskRef.current;
      const ctx = m.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, m.width, m.height);
    }
    layoutAndRedraw();
    // 通知一次 0% 进度
    onProgressChange(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  // 等容器渲染后初始化 canvas 尺寸（DPR 自适应：缓冲区 = CSS px × dpr，所有 ctx 内部已 scale(dpr)）
  // 返回 CSS 像素下的宽高（w/h），供后续以 CSS 单位绘制
  function ensureLayout(targetW?: number, targetH?: number) {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return null;
    // 优先用调用方传入的"目标尺寸"（紧贴 word 算出），否则按外框当前尺寸
    let cssW: number;
    let cssH: number;
    if (typeof targetW === 'number' && typeof targetH === 'number' && targetW > 0 && targetH > 0) {
      cssW = targetW;
      cssH = targetH;
    } else {
      const rect = wrap.getBoundingClientRect();
      cssW = Math.max(160, Math.floor(rect.width));
      cssH = Math.max(160, Math.floor(rect.height));
    }
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1)); // 限制最大 3x，防 4K 屏过度
    const bw = Math.floor(cssW * dpr);
    const bh = Math.floor(cssH * dpr);
    if (cv.width !== bw || cv.height !== bh) {
      cv.width = bw;
      cv.height = bh;
      const ctx = cv.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); // 先清掉旧变换，避免重复 scale
        ctx.scale(dpr, dpr); // 之后所有 ctx 绘制按 CSS 像素
      }
    } else {
      // 尺寸没变，但也要确保 transform 在（防止热重载后状态丢失）
      const ctx = cv.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    }
    if (!paintedMaskRef.current) {
      paintedMaskRef.current = document.createElement('canvas');
    }
    const pm = paintedMaskRef.current!;
    // mask 也用 dpr，且 ctx 设了 setTransform(dpr,dpr)
    // 每次 ensureLayout 都保证变换在位（热重载 / 单词切换时也安全）
    if (pm.width !== bw || pm.height !== bh) {
      pm.width = bw;
      pm.height = bh;
      const pctx0 = pm.getContext('2d');
      if (pctx0) pctx0.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      const pctx0 = pm.getContext('2d');
      if (pctx0) pctx0.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { w: cssW, h: cssH, dpr };
  }

  // 外框尺寸变化时自动重排 + 重绘（响应式 + 屏幕旋转 + 窗口缩放）
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    // 重入锁：避免 layoutAndRedraw 内写 wrap.style → 触发 ResizeObserver → 无限循环
    let scheduled = false;
    const ro = new ResizeObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        layoutAndRedraw();
      });
    });
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步绘制：模板图（淡色）+ 浅色大字"单词" + 学生手绘轨迹
  function layoutAndRedraw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    // === 先算"内容实际需要"的尺寸，再把这个尺寸应用到外框 ===
    // 没模板图：按 word 文字 bbox 算；多模板图：取 word bbox 与模板图 contain 尺寸的并集
    const parentMaxW = wrapRef.current?.parentElement?.getBoundingClientRect().width ?? 720;
    const maxW = Math.min(720, Math.floor(parentMaxW - 8)); // 上限 720，留 8px 边距防溢出
    const maxH = 560;

    // 1) word bbox（即便有模板图也用于兜底，不可见）
    let wordW = 0;
    let wordH = 0;
    if (word.word) {
      // 探针字号与下方实际渲染字号保持一致（0.45 比例，最小 80），保证 bbox 估算准确
      const fsProbe = Math.max(80, Math.min(maxW, maxH) * 0.45);
      ctx.font = `900 ${fsProbe}px "Comic Sans MS", "Microsoft YaHei", system-ui, sans-serif`;
      const m = ctx.measureText(word.word);
      wordW = m.width;
      // 高度用 actualBoundingBoxAscent + descent（如不可用则按 fontSize * 1.2 估）
      const asc = m.actualBoundingBoxAscent || fsProbe * 0.8;
      const desc = m.actualBoundingBoxDescent || fsProbe * 0.2;
      wordH = asc + desc;
    }

    // 2) 模板图 contain 装下时的尺寸（等比缩放到 maxW × maxH 内）
    const img = templateImgRef.current;
    let imgW = 0;
    let imgH = 0;
    if (img) {
      const ar = img.naturalWidth / img.naturalHeight || 1;
      const car = maxW / maxH;
      if (ar > car) {
        imgW = maxW;
        imgH = maxW / ar;
      } else {
        imgH = maxH;
        imgW = maxH * ar;
      }
    }

    // 3) 取 word 与模板图两者中较大的尺寸，并加 padding 留出描边空间
    const PAD = 32; // 上下左右各 32px 内边距，让笔画不顶到边
    let cssW = Math.max(wordW, imgW) + PAD * 2;
    let cssH = Math.max(wordH, imgH) + PAD * 2;

    // 4) 边界兜底：最小 240×240，最大不超过 maxW×maxH
    cssW = Math.max(240, Math.min(maxW, cssW));
    cssH = Math.max(240, Math.min(maxH, cssH));

    // 5) 写到外框（覆盖原 aspectRatio 4/3 + minHeight 320）
    if (wrapRef.current) {
      wrapRef.current.style.width = `${cssW}px`;
      wrapRef.current.style.height = `${cssH}px`;
      wrapRef.current.style.aspectRatio = ''; // 解除 4/3 锁定
      wrapRef.current.style.minHeight = ''; // 解除最小高度
    }

    // 6) 用新尺寸初始化 canvas
    const dim = ensureLayout(cssW, cssH);
    if (!dim) return;
    const { w, h } = dim;
    // 1) 模板图淡色（若有）：contain 完全装下，不溢出
    if (img) {
      const ar = img.naturalWidth / img.naturalHeight || 1;
      const car = w / h;
      // contain：图宽高比 > 容器宽高比 -> 以宽为准；反之以高为准
      let dw: number, dh: number;
      if (ar > car) {
        // 图比容器更宽 -> 以宽装下
        dw = w;
        dh = w / ar;
      } else {
        // 图比容器更窄 -> 以高装下
        dh = h;
        dw = h * ar;
      }
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.save();
      ctx.globalAlpha = TEMPLATE_ALPHA;
      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
      // 计算模板 mask（与显示区域一致）
      ensureTemplateMask(img, dx, dy, dw, dh, w, h);
    } else {
      templateMaskRef.current = null;
      // 没模板图：居中显示浅色单词作为"描啥"提示
      // 视觉：极淡填充 + 虚线深灰描边 → 一眼看出"要沿着虚线描"
      if (word.word) {
        const fontSize = Math.max(80, Math.min(w, h) * 0.45);
        ctx.save();
        ctx.font = `900 ${fontSize}px "Comic Sans MS", "Microsoft YaHei", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // 1) 极淡填充（仅作位置提示，几乎看不见）
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fillText(word.word, w / 2, h / 2);
        // 2) 虚线描边（告诉用户"沿这画"）
        ctx.strokeStyle = 'rgba(80, 80, 110, 0.55)';
        ctx.lineWidth = Math.max(2, fontSize * 0.012);
        ctx.setLineDash([fontSize * 0.08, fontSize * 0.06]);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeText(word.word, w / 2, h / 2);
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }

  // 把模板图阈值化成 mask：只按"亮度"判定笔画像素（兼容白底/透明底图）
  // 算法：
  //   1) 透明像素（a < 30）= 背景
  //   2) 其余像素：luma < 0.82 视为笔画像素（兼容浅灰字 + 白底图）
  function ensureTemplateMask(
    img: HTMLImageElement,
    dx: number, dy: number, dw: number, dh: number,
    cw: number, ch: number
  ) {
    if (typeof document === 'undefined') return;
    const tc = document.createElement('canvas');
    tc.width = Math.max(1, Math.floor(dw));
    tc.height = Math.max(1, Math.floor(dh));
    const tctx = tc.getContext('2d');
    if (!tctx) return;
    tctx.drawImage(img, 0, 0, tc.width, tc.height);
    const data = tctx.getImageData(0, 0, tc.width, tc.height);
    const m = COVERAGE_SAMPLE;
    const mask = document.createElement('canvas');
    mask.width = m;
    mask.height = m;
    const mctx = mask.getContext('2d');
    if (!mctx) return;
    const maskData = mctx.createImageData(m, m);
    let count = 0;
    for (let y = 0; y < m; y++) {
      for (let x = 0; x < m; x++) {
        const sx = Math.min(tc.width - 1, Math.floor((x / m) * tc.width));
        const sy = Math.min(tc.height - 1, Math.floor((y / m) * tc.height));
        const i = (sy * tc.width + sx) * 4;
        const a = data.data[i + 3] ?? 0;
        const r = data.data[i] ?? 255;
        const g = data.data[i + 1] ?? 255;
        const b = data.data[i + 2] ?? 255;
        const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; // 0..1
        // 透明像素 = 背景
        if (a < 30) continue;
        // 字比白底暗 -> 视作笔画
        if (luma < 0.82) {
          const idx2 = (y * m + x) * 4;
          maskData.data[idx2] = 255;
          maskData.data[idx2 + 1] = 255;
          maskData.data[idx2 + 2] = 255;
          maskData.data[idx2 + 3] = 255;
          count++;
        }
      }
    }
    mctx.putImageData(maskData, 0, 0);
    (mask as any).__displayRect = { dx, dy, dw, dh, cw, ch };
    (mask as any).__total = count;
    templateMaskRef.current = mask;
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log('[TraceStep] 模板 mask: 笔画像素', count, 'of', m * m, '（total=0 意味着模板图识别失败）');
    }
  }

  // 画笔 → 主 canvas + paintedMask
  function strokeTo(x: number, y: number) {
    const cv = canvasRef.current;
    const pm = paintedMaskRef.current;
    if (!cv || !pm) return;
    const ctx = cv.getContext('2d');
    const pctx = pm.getContext('2d');
    if (!ctx || !pctx) return;
    const w = cv.width, h = cv.height;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, Math.floor(Math.min(w, h) * 0.015));
    ctx.strokeStyle = colorHex;
    pctx.lineCap = 'round';
    pctx.lineJoin = 'round';
    pctx.lineWidth = Math.max(4, Math.floor(Math.min(w, h) * 0.015));
    pctx.strokeStyle = '#000';
    const last = lastPointRef.current;
    if (last) {
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      pctx.beginPath();
      pctx.moveTo(last.x, last.y);
      pctx.lineTo(x, y);
      pctx.stroke();
    } else {
      // 起笔打点
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = colorHex;
      ctx.fill();
      pctx.beginPath();
      pctx.arc(x, y, pctx.lineWidth / 2, 0, Math.PI * 2);
      pctx.fillStyle = '#000';
      pctx.fill();
    }
    lastPointRef.current = { x, y };
  }

  // 计算笔画覆盖率：paintedMask ∩ templateMask / templateMask
  function computeCoverage(): { ratio: number; hit: number; total: number } {
    const pm = paintedMaskRef.current;
    const tm = templateMaskRef.current;
    if (!pm || !tm) return { ratio: 0, hit: 0, total: 0 };
    const rect = (tm as any).__displayRect as { dx: number; dy: number; dw: number; dh: number; cw: number; ch: number } | undefined;
    const total = (tm as any).__total as number | undefined;
    if (!rect || !total || total === 0) return { ratio: 0, hit: 0, total: 0 };
    // 缩放 paintedMask 到 COVERAGE_SAMPLE
    const m = COVERAGE_SAMPLE;
    const tmp = document.createElement('canvas');
    tmp.width = m;
    tmp.height = m;
    const tctx = tmp.getContext('2d');
    if (!tctx) return { ratio: 0, hit: 0, total };
    // paintedMask 整体缩到 m×m（画布坐标系统一）
    tctx.drawImage(pm, 0, 0, pm.width, pm.height, 0, 0, m, m);
    const pdata = tctx.getImageData(0, 0, m, m).data;
    const tdata = tm.getContext('2d')!.getImageData(0, 0, m, m).data;
    // 计算交集体素
    let hit = 0;
    for (let y = 0; y < m; y++) {
      for (let x = 0; x < m; x++) {
        const i = (y * m + x) * 4;
        const tA = tdata[i + 3] ?? 0;
        const pA = pdata[i + 3] ?? 0;
        if (tA > 0 && pA > 0) hit++;
      }
    }
    return { ratio: hit / total, hit, total };
  }

  // 触发"覆盖检查"（节流到 ~250ms），仅更新进度，不触发完成
  const checkTimerRef = useRef<number | null>(null);
  function scheduleCheck() {
    if (completedRef.current) return;
    if (checkTimerRef.current) window.clearTimeout(checkTimerRef.current);
    checkTimerRef.current = window.setTimeout(() => {
      const { ratio } = computeCoverage();
      onProgressChange(ratio);
      setTip({ ratio });
      // ✅ 不再自动触发完成 — 全部由学生点"完成"按钮决定
    }, 200);
  }

  // 鼠标/触屏坐标 → CSS 画布坐标
  // 因为 ctx.scale(dpr, dpr) 后所有绘制都按 CSS 像素算，所以这里也返回 CSS 坐标
  function localPoint(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const cv = canvasRef.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    // rect.width 是 CSS 像素；直接用差值算 CSS 坐标
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (alreadyDone) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = localPoint(e);
    if (!p) return;
    drawingRef.current = true;
    lastPointRef.current = null;
    strokeTo(p.x, p.y);
    scheduleCheck();
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || alreadyDone) return;
    const p = localPoint(e);
    if (!p) return;
    strokeTo(p.x, p.y);
    scheduleCheck();
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch {}
    // 落笔收尾做一次完整检查（仅更新进度，不触发完成）
    if (checkTimerRef.current) window.clearTimeout(checkTimerRef.current);
    const { ratio } = computeCoverage();
    onProgressChange(ratio);
    setTip({ ratio });
  }

  function clearCanvas() {
    if (alreadyDone) return;
    const cv = canvasRef.current;
    const pm = paintedMaskRef.current;
    if (pm) {
      const ctx = pm.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, pm.width, pm.height);
    }
    completedRef.current = false;
    onProgressChange(0);
    setTip(null);
    layoutAndRedraw();
  }

  // 暴露 clear() 给父级（"重画"按钮在父级渲染）
  useImperativeHandle(ref, () => ({ clear: clearCanvas }), [clearCanvas]);

  // 容器尺寸自适应
  useEffect(() => {
    function onResize() {
      layoutAndRedraw();
    }
    window.addEventListener('resize', onResize);
    // 首帧
    requestAnimationFrame(() => layoutAndRedraw());
    return () => window.removeEventListener('resize', onResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word.id]);

  // 参考媒体：按后台上传类型原样显示（不加背景）
  // 自动按后缀判定
  const refKind: 'image' | 'audio' | 'video' = (() => {
    if (word.referenceKind) return word.referenceKind;
    const u = (word.referenceMedia ?? '').toLowerCase();
    if (/\.(mp4|mov|webm|m4v)(\?|$)/i.test(u)) return 'video';
    if (/\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(u)) return 'audio';
    return 'image';
  })();

  return (
    <div className="w-full">
      {/* ===== 参考媒体区（画布上方） ===== */}
      {(word.referenceMedia || word.referenceAudio) && (
        <div className="max-w-[720px] mx-auto mb-3 flex items-center gap-2 flex-wrap">
          {word.referenceMedia && refKind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={word.referenceMedia}
              alt=""
              className="max-w-full max-h-[40vh] object-contain"
              style={{ width: 'auto', height: 'auto' }}
            />
          )}
          {word.referenceMedia && refKind === 'video' && (
            <video
              src={word.referenceMedia}
              controls
              className="max-w-full max-h-[50vh]"
              style={{ width: 'auto', height: 'auto' }}
            />
          )}
          {word.referenceMedia && refKind === 'audio' && (
            <audio
              src={word.referenceMedia}
              controls
              className="w-full max-w-[60%]"
            />
          )}
          {/* 独立参考音频（即使已上传 audio/video 也可以再放一个"标准发音"） */}
          {word.referenceAudio && word.referenceAudio !== word.referenceMedia && (
            <button
              type="button"
              onClick={() => {
                try {
                  const a = new Audio(word.referenceAudio);
                  a.volume = 0.95;
                  const p = a.play();
                  if (p && typeof p.catch === 'function') p.catch(() => {});
                } catch {}
              }}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border-2 border-amber-300 text-stone-700 shadow-sm hover:bg-amber-50"
              title="Listen to pronunciation"
            >
              <Volume2 className="w-4 h-4 text-amber-500" strokeWidth={2.5} />
            </button>
          )}
        </div>
      )}

      {/* ===== 画布区 ===== */}
      <div
        ref={wrapRef}
        className="relative mx-auto overflow-hidden bg-white rounded-2xl shadow-md outline outline-4 outline-dashed outline-purple-300 outline-offset-[-4px]"
        style={{ width: 480, height: 360 }}
      >
        {/* 手绘 canvas（纯画布，不放任何参考媒体） */}
        <canvas
          ref={canvasRef}
          className={
            'absolute inset-0 w-full h-full z-0 ' +
            (alreadyDone ? 'cursor-default' : 'cursor-crosshair touch-none')
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>

      {/* （重画按钮由父级 TraceStep 渲染，与"完成"按钮同行同尺寸） */}
    </div>
  );
});
