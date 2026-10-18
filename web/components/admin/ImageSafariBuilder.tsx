'use client';
// 超市探险 / 图片标签编辑器（Image Safari step）
// 上传背景图 + 可选吉祥物 + 在图上点 / 拖动放置 tag + tag 列表
import { useEffect, useRef, useState } from 'react';
import { MediaUploader } from './MediaUploader';
import type { ImageSafariContent, ImageTag } from '@/lib/stepContents';

const tagPalette = [
  '#FF8A3D', '#43CABB', '#FF876E', '#FFC64E', '#7099F0',
  '#A88BFF', '#67B3EF', '#FF8FA3', '#5EBF6A', '#9A79EF',
];

function genId(): string {
  return Math.random().toString(36).slice(2, 6);
}

function defaultTag(x = 50, y = 50, colorIndex = 0): ImageTag {
  return {
    id: genId(),
    x,
    y,
    label: `Tag`,
    color: tagPalette[colorIndex % tagPalette.length],
    scale: 1,
    imageUrl: undefined,
  };
}

export function ImageSafariBuilder({
  value,
  onChange,
}: {
  value: ImageSafariContent;
  onChange: (c: ImageSafariContent) => void;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(value.tags[0]?.id ?? null);
  // 容器的宽高比 = 上传原图的自然宽高比；不同屏同比缩放，但比例永远跟着原图
  const [sceneRatio, setSceneRatio] = useState<number | null>(null);

  function patchTag(id: string, patch: Partial<ImageTag>) {
    onChange({
      ...value,
      tags: value.tags.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  }

  function addTag(x: number, y: number) {
    const tag = defaultTag(x, y, value.tags.length);
    onChange({ ...value, tags: [...value.tags, tag] });
    setActiveId(tag.id);
  }

  function removeTag(id: string) {
    onChange({ ...value, tags: value.tags.filter((t) => t.id !== id) });
    if (activeId === id) setActiveId(null);
  }

  function onSceneClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!sceneRef.current) return;
    const rect = sceneRef.current.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((event.clientY - rect.top) / rect.height) * 100));
    addTag(x, y);
  }

  const activeTag = value.tags.find((t) => t.id === activeId);

  return (
    <div className="space-y-3">
      {/* 顶部：题目（可空 · 进入场景时显示在玩家上方） */}
      <div className="rounded-2xl border-2 border-pink-200 bg-pink-50/40 p-3 space-y-2">
        <div className="text-sm font-bold text-stone-700 flex items-center gap-1">
          ❓ 题目 <span className="text-xs font-normal text-stone-500">（可空 · 显示在场景上方，并自动播放音频）</span>
        </div>
        <textarea
          value={value.prompt ?? ''}
          onChange={(e) => onChange({ ...value, prompt: e.target.value })}
          rows={2}
          placeholder="例如：在这家超市里找出 3 种水果"
          className="w-full rounded-xl border-2 border-pink-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <div className="text-xs font-bold text-stone-600 mb-1">题目配图（可空）</div>
            <MediaUploader
              value={value.promptImageUrl ?? ''}
              onChange={(url) => onChange({ ...value, promptImageUrl: url ?? '' })}
              type="image"
              compact
            />
          </div>
          <div>
            <div className="text-xs font-bold text-stone-600 mb-1">题目音频（可空 · 进入时自动播）</div>
            <MediaUploader
              value={value.promptAudioUrl ?? ''}
              onChange={(url) => onChange({ ...value, promptAudioUrl: url ?? '' })}
              type="audio"
              compact
            />
          </div>
        </div>
      </div>

      {/* 顶部：背景图 + 吉祥物 上传 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-3">
          <div className="text-sm font-bold text-stone-700 flex items-center gap-1">
            🖼 背景场景 <span className="text-xs font-normal text-stone-500">（必填 · 学生在上面探索）</span>
          </div>
          <div className="mt-2">
            <MediaUploader
              value={value.imageUrl}
              onChange={(url) => onChange({ ...value, imageUrl: url ?? '', imageName: url ? value.imageName ?? '' : '' })}
              type="image"
            />
          </div>
        </div>
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-3">
          <div className="text-sm font-bold text-stone-700 flex items-center gap-1">
            🐾 吉祥物 <span className="text-xs font-normal text-stone-500">（可选 · 学生端的角色）</span>
          </div>
          <div className="mt-2">
            <MediaUploader
              value={value.mascotUrl}
              onChange={(url) => onChange({ ...value, mascotUrl: url ?? '', mascotName: url ? value.mascotName ?? '' : '' })}
              type="image"
            />
          </div>
          {value.mascotUrl && (
            <>
              {/* 点击态图片：有的话学生点 tag 后吉祥物换成这张并保持。
                  适合做"角色被找到/庆祝"反馈。空字符串清除。 */}
              <div className="mt-3 rounded-xl border-2 border-dashed border-amber-300 bg-white/60 p-2">
                <div className="text-xs font-bold text-stone-700 flex items-center gap-1 mb-1.5">
                  ✨ 点击后状态图
                  <span className="text-[10px] font-normal text-stone-500">（可选 · 学生点 tag 时切换并保持）</span>
                </div>
                <MediaUploader
                  value={value.mascotActiveUrl}
                  onChange={(url) => onChange({ ...value, mascotActiveUrl: url ?? '' })}
                  type="image"
                  compact
                />
              </div>
            </>
          )}
          {value.mascotUrl && (
            <label className="mt-2 flex items-center gap-2 text-xs font-bold text-stone-700 select-none cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-amber-500"
                checked={value.flyToMascot !== false}
                onChange={(e) => onChange({ ...value, flyToMascot: e.target.checked })}
              />
              <span>点击 tag 图片飞向吉祥物（路径动画）</span>
            </label>
          )}
          {value.mascotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.mascotUrl}
              alt={value.mascotName ?? 'Mascot'}
              className="mt-2 h-16 rounded-xl border-2 border-amber-200 object-contain bg-white"
            />
          )}
        </div>
      </div>

      {/* 场景预览（点击放置 tag，拖动调整位置） */}
      <div>
        <div className="text-sm font-bold text-stone-700 mb-1.5">
          📍 标签位置 <span className="text-xs font-normal text-stone-500">（点击图放置 · 拖动调整 · {value.tags.length} 个）</span>
        </div>
        <div
          ref={sceneRef}
          onClick={onSceneClick}
          className="relative w-full max-w-[720px] mx-auto rounded-2xl overflow-hidden border-2 border-amber-200 bg-stone-100 select-none"
          style={{
            // 按上传图的原始比例 — 上传什么比例就显示什么比例；max-w 控制最大尺寸，不同屏同比缩放
            aspectRatio: sceneRatio ? `${sceneRatio}` : '4 / 3',
            cursor: 'crosshair',
          }}
        >
          {value.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value.imageUrl}
              alt={value.imageName ?? 'Scene'}
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
              先上传背景图，再点击空白处放置标签
            </div>
          )}

          {value.tags.map((tag) => (
            <TagMarker
              key={tag.id}
              tag={tag}
              active={activeId === tag.id}
              onSelect={() => setActiveId(tag.id)}
              onMove={(x, y) => patchTag(tag.id, { x, y })}
              onRemove={() => removeTag(tag.id)}
            />
          ))}
        </div>

        {/* 吉祥物定位条：在场景框下方独立一条 — 拖动滑块在水平方向上调整横向位置，
            默认居中 (50%)；是否显示/缩放由下方"吉祥物"卡片里的控制按钮决定。 */}
        {value.imageUrl && value.mascotUrl && (
          <MascotPositionBar
            mascotX={value.mascotX ?? 50}
            onChangeX={(x) => onChange({ ...value, mascotX: +x.toFixed(2) })}
            mascotUrl={value.mascotUrl}
            mascotName={value.mascotName}
            scale={value.mascotScale ?? 1}
            onChangeScale={(s) => onChange({ ...value, mascotScale: +s.toFixed(2) })}
          />
        )}
      </div>

      {/* tag 列表：编辑 label / 颜色 / 删除 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-sm font-bold text-stone-700">📋 标签列表</div>
          <button
            type="button"
            onClick={() => addTag(50, 50)}
            className="rounded-2xl bg-brand-sky text-stone-800 border-2 border-amber-700 px-3 py-1.5 font-extrabold text-xs shadow-pop hover:bg-amber-200"
          >
            ➕ 加标签
          </button>
        </div>
        {value.tags.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-4 text-center text-xs text-stone-500">
            还没有标签 · 点场景空白处放置第一个
          </div>
        ) : (
          <ul className="space-y-2">
            {value.tags.map((tag) => (
              <li
                key={tag.id}
                onClick={() => setActiveId(tag.id)}
                className={
                  'flex items-center gap-2 rounded-2xl border-2 p-2 transition ' +
                  (activeId === tag.id
                    ? 'border-brand-orange bg-amber-50 shadow-pop'
                    : 'border-amber-200 bg-white hover:border-amber-400')
                }
              >
                <span
                  className="w-7 h-7 rounded-full border-2 border-white flex-shrink-0"
                  style={{ background: tag.color }}
                />
                <input
                  value={tag.label}
                  onChange={(e) => patchTag(tag.id, { label: e.target.value })}
                  className="flex-1 min-w-[120px] rounded-xl border-2 border-amber-200 bg-amber-50/30 px-3 py-1.5 text-sm font-bold text-stone-800 outline-none focus:border-amber-500 focus:bg-white"
                  placeholder="单词（学生端会显示）"
                />
                <input
                  value={tag.hint ?? ''}
                  onChange={(e) => patchTag(tag.id, { hint: e.target.value })}
                  className="hidden md:block w-32 rounded-xl border-2 border-amber-200 bg-amber-50/30 px-3 py-1.5 text-xs outline-none focus:border-amber-500 focus:bg-white"
                  placeholder="提示（可选）"
                />
                {/* 两段音频上传：点 tag 图片后依次播放。
                    复用 MediaUploader（type=audio），空字符串可清空。 */}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-extrabold text-stone-500 mr-0.5">A1</span>
                  <div className="w-24">
                    <MediaUploader
                      value={tag.audioUrl1}
                      onChange={(url) => patchTag(tag.id, { audioUrl1: url ?? '' })}
                      type="audio"
                      compact
                    />
                  </div>
                  <span className="text-[10px] font-extrabold text-stone-500 mr-0.5 ml-1">A2</span>
                  <div className="w-24">
                    <MediaUploader
                      value={tag.audioUrl2}
                      onChange={(url) => patchTag(tag.id, { audioUrl2: url ?? '' })}
                      type="audio"
                      compact
                    />
                  </div>
                </div>
                <div className="flex items-center gap-0.5 rounded-xl border-2 border-amber-200 bg-white p-0.5">
                  <button
                    type="button"
                    onClick={() => patchTag(tag.id, { scale: Math.max(0.5, +( (tag.scale ?? 1) - 0.1 ).toFixed(2)) })}
                    className="w-7 h-7 rounded-lg text-amber-700 font-extrabold hover:bg-amber-100"
                    title="缩小"
                  >−</button>
                  <span className="w-9 text-center text-xs font-extrabold text-stone-700 tabular-nums">
                    {Math.round((tag.scale ?? 1) * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => patchTag(tag.id, { scale: +( (tag.scale ?? 1) + 0.1 ).toFixed(2) })}
                    className="w-7 h-7 rounded-lg text-amber-700 font-extrabold hover:bg-amber-100"
                    title="放大"
                  >+</button>
                </div>
                <button
                  type="button"
                  onClick={() => tag.imageUrl ? patchTag(tag.id, { imageUrl: undefined }) : document.getElementById(`tag-img-${tag.id}`)?.click()}
                  className="flex-shrink-0 w-8 h-8 rounded-xl border-2 border-amber-200 bg-amber-50 hover:bg-amber-100 flex items-center justify-center transition relative"
                  title={tag.imageUrl ? '清除图片' : '上传标签图片'}
                >
                  {tag.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={tag.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-extrabold flex items-center justify-center leading-none">×</span>
                    </>
                  ) : (
                    <span className="text-amber-700 font-bold text-sm">🖼</span>
                  )}
                </button>
                <input
                  id={`tag-img-${tag.id}`}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const dir = 'hongen/media';
                    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
                    const { adminApi: api } = await import('@/lib/adminApi');
                    try {
                      const t = await api.issueUploadToken(dir, ext);
                      const form = new FormData();
                      form.append('token', t.token);
                      form.append('key', t.key);
                      form.append('file', file);
                      const res = await fetch(t.host, { method: 'POST', body: form });
                      if (!res.ok) throw new Error(`上传失败 ${res.status}`);
                      const json = await res.json();
                      // 七牛返回的 json.key 已包含在 t.publicUrl 里, 不要重复拼.
                      // (qiniu.service.ts 拼的 publicUrl = baseUrl + key, 已完整)
                      patchTag(tag.id, { imageUrl: t.publicUrl });
                    } catch (err) {
                      console.error(err);
                    }
                    e.target.value = '';
                  }}
                />
                <select
                  value={tag.color}
                  onChange={(e) => patchTag(tag.id, { color: e.target.value })}
                  className="rounded-xl border-2 border-amber-200 bg-white px-2 py-1.5 text-xs font-bold outline-none focus:border-amber-500"
                  title="标签颜色"
                >
                  {tagPalette.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeTag(tag.id)}
                  className="w-8 h-8 rounded-lg bg-rose-100 border-2 border-rose-300 text-rose-700 font-bold flex-shrink-0"
                  title="删除标签"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value.tags.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-200 text-emerald-800 text-sm font-bold px-3 py-2">
          ✓ 已放置 {value.tags.length} 个标签 · 学生用方向键移动吉祥物 · 靠近 tag 时自动朗读 · 点 tag 也可朗读
        </div>
      )}
    </div>
  );
}

function TagMarker({
  tag,
  active,
  onSelect,
  onMove,
  onRemove,
}: {
  tag: ImageTag;
  active: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onRemove: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  // moved 标志用 ref 存（避免闭包/重渲导致值不同步）；
  // suppressedClick 在拖动结束后的合成 click 事件里检查，命中则 prevent + stop。
  const movedRef = useRef(false);
  const suppressClickRef = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // 只响应主键（鼠标左键 / 单指 / 笔尖）
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    e.preventDefault();
    const parent = e.currentTarget.parentElement;
    if (!parent) return;
    // 用 pointerdown 时的坐标作为基准；rect 在每次 move 实时拿最新，
    // 防止父容器 reflow / 滚动条 / 窗口尺寸变化导致偏。
    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = tag.x;
    const initialY = tag.y;

    movedRef.current = false;
    suppressClickRef.current = false;

    const handleMove = (ev: PointerEvent) => {
      // 3px 阈值内视为未真拖动，避免点按时误判
      if (
        !movedRef.current &&
        Math.abs(ev.clientX - startX) <= 3 &&
        Math.abs(ev.clientY - startY) <= 3
      ) {
        return;
      }
      movedRef.current = true;
      const r = parent.getBoundingClientRect();
      const dx = ((ev.clientX - startX) / r.width) * 100;
      const dy = ((ev.clientY - startY) / r.height) * 100;
      const x = Math.max(2, Math.min(98, initialX + dx));
      const y = Math.max(2, Math.min(98, initialY + dy));
      onMove(x, y);
    };
    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
      if (movedRef.current) {
        // 阻止紧接的合成 click 冒泡到 scene 触发 addTag
        suppressClickRef.current = true;
      }
    };
    // 用 window 级别 listener，不用 setPointerCapture — 避免 React 重渲时
    // target 节点被替换导致 listener 丢失（之前 bug 的根因：patchTag 触发
    // 整个 scene 树重渲，绑在旧 DOM 上的 pointermove listener 跟着节点一起走）。
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }

  return (
    <div
      ref={ref as any}
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown as any}
      onClick={(e) => {
        // 拖动结束后屏蔽 click 冒泡（避免触发 scene.addTag）
        if (suppressClickRef.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClickRef.current = false;
          return;
        }
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={
        'absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center group cursor-pointer select-none ' +
        (active ? 'z-20' : '')
      }
      style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
      title={`${tag.label} (${Math.round(tag.x)}, ${Math.round(tag.y)})`}
    >
      <span
        className="flex items-center"
        style={{ transform: `scale(${tag.scale ?? 1})`, transformOrigin: 'center center' }}
      >
        {tag.imageUrl ? (
          // 图片模式：直接显示图片，透明背景
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tag.imageUrl}
            alt={tag.label}
            className="max-w-[120px] max-h-[120px]"
          />
        ) : (
          // 文字模式
          <>
            <span
              className="w-7 h-7 rounded-full border-[3px] border-white shadow-pop grid place-items-center text-white text-xs font-extrabold"
              style={{ background: tag.color }}
            >
              {tag.label.slice(0, 1).toUpperCase()}
            </span>
            <span
              className="ml-1 px-2 py-0.5 rounded-full bg-white border-2 text-xs font-extrabold text-stone-800 shadow-pop whitespace-nowrap"
              style={{ borderColor: tag.color }}
            >
              {tag.label}
            </span>
          </>
        )}
      </span>
      {active && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-extrabold border-2 border-white shadow-pop"
          title="删除"
        >×</button>
      )}
    </div>
  );
}

// 吉祥物定位条：场景框下方独立一条；
// - 顶部预览槽：按 mascotX 横向显示吉祥物图标（带 🐾 角标）
//   - 拖拽吉祥物图标 = 调整 mascotX（mousedown/touchstart → pointermove → pointerup）
//   - 拖拽预览槽空白处 = 把吉祥物跳到该位置
// - 滑块：调整 mascotX 水平位置（0–100%），与拖拽双向同步
// - 缩放控制：+ / − 调整 mascot 缩放
function MascotPositionBar({
  mascotX,
  onChangeX,
  mascotUrl,
  mascotName,
  scale,
  onChangeScale,
}: {
  mascotX: number;
  onChangeX: (x: number) => void;
  mascotUrl: string;
  mascotName?: string;
  scale: number;
  onChangeScale: (s: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // 把鼠标/手指 x 坐标换算成预览槽内的横向百分比 (2–98)。
  // 用 requestAnimationFrame 合并频繁的 move 事件，避免 React 渲染压力。
  const pendingXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const commitPending = () => {
    rafRef.current = null;
    if (pendingXRef.current == null) return;
    const v = pendingXRef.current;
    pendingXRef.current = null;
    onChangeX(+v.toFixed(2));
  };

  const applyClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    const clamped = Math.max(2, Math.min(98, pct));
    pendingXRef.current = clamped;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(commitPending);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // 阻止 input[type=range] 抢事件；只看 pointer primary
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    applyClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    applyClientX(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    // 最后一帧立即落盘，避免 raf 没排到
    if (pendingXRef.current != null) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      commitPending();
    }
  };

  // 卸载时清掉未提交的 raf
  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="mt-2 w-full max-w-[720px] mx-auto">
      <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-3">
        <div className="text-xs font-extrabold text-stone-700 flex items-center gap-1 mb-2">
          🐾 吉祥物位置
          <span className="text-[10px] font-normal text-stone-500">（拖动下方小吉祥物调整位置）</span>
        </div>
        {/* 预览槽：水平方向上按 mascotX 定位吉祥物。整槽捕获 pointer 实现拖拽。 */}
        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`relative h-20 rounded-xl border-2 border-dashed bg-white/60 select-none touch-none ${
            dragging ? 'border-amber-500 bg-amber-50/80 cursor-grabbing' : 'border-amber-300 cursor-grab'
          }`}
          title="按住吉祥物图标左右拖动"
        >
          {/* 中央基线 */}
          <div className="absolute left-0 right-0 top-1/2 h-px bg-amber-200 pointer-events-none" />
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center pointer-events-none"
            style={{ left: `${mascotX}%` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mascotUrl}
              alt={mascotName ?? 'Mascot'}
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-contain drop-shadow-lg ${
                dragging ? 'scale-110' : ''
              }`}
              draggable={false}
              style={{
                transform: `scale(${scale}${dragging ? ' * 1.1' : ''})`,
                transformOrigin: 'center center',
                transition: dragging ? 'none' : 'transform 120ms ease-out',
              }}
            />
            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold border-2 border-white shadow-pop flex items-center justify-center">
              🐾
            </span>
          </div>
        </div>
        {/* 滑块 + 缩放 */}
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={2}
            max={98}
            value={mascotX}
            onChange={(e) => onChangeX(+e.target.value)}
            className="flex-1 accent-amber-500"
            aria-label="吉祥物横向位置"
          />
          <span className="w-12 text-center text-xs font-extrabold text-stone-700 tabular-nums">
            {Math.round(mascotX)}%
          </span>
          <div className="flex items-center gap-0.5 rounded-xl border-2 border-amber-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => onChangeScale(Math.max(0.5, +(scale - 0.1).toFixed(2)))}
              className="w-7 h-7 rounded-lg text-amber-700 font-extrabold hover:bg-amber-100"
              title="缩小"
            >−</button>
            <span className="w-10 text-center text-xs font-extrabold text-stone-700 tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => onChangeScale(+(scale + 0.1).toFixed(2))}
              className="w-7 h-7 rounded-lg text-amber-700 font-extrabold hover:bg-amber-100"
              title="放大"
            >+</button>
          </div>
        </div>
      </div>
    </div>
  );
}
