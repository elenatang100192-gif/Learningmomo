'use client';
// 课程场景画布编辑器：
//   - 课程大图（sceneImageUrl）
//   - 把课程下所有 lesson 作为可拖拽气泡摆在这张图上
//   - 气泡显示 lesson 标题、序号；选中后可改颜色、上传音频
//   - 全部用相对坐标 0~1 存储
import { useRef, useState, useEffect, useCallback } from 'react';
import { MediaUploader } from './MediaUploader';
import { LessonDTO } from '@/lib/adminApi';

export type PlacementItem = {
  lessonId: string;
  x: number;        // 0~1
  y: number;        // 0~1
  audioUrl?: string | null;
  color?: string | null;
};

const PALETTE = ['#FF8A3D', '#5BC0EB', '#9BC53D', '#E55934', '#F7D147', '#A056F7', '#FF6B9D'];

export function CourseSceneEditor({
  courseTitle,
  sceneImageUrl,
  lessons,                       // 该课程下所有 lesson（按 sortOrder）
  placements,                    // 已有的 placement（按 lessonId 索引）
  onChange,
}: {
  courseTitle: string;
  sceneImageUrl: string | null;
  lessons: LessonDTO[];
  placements: PlacementItem[];
  onChange: (next: { sceneImageUrl: string | null; placements: PlacementItem[] }) => void;
}) {
  const [sceneImage, setSceneImage] = useState<string | null>(sceneImageUrl);
  const [list, setList] = useState<PlacementItem[]>(placements ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef<{ lessonId: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => { setSceneImage(sceneImageUrl); }, [sceneImageUrl]);
  useEffect(() => { setList(placements ?? []); }, [placements]);

  const flush = useCallback((nextList: PlacementItem[], nextScene: string | null = sceneImage) => {
    onChange({ sceneImageUrl: nextScene, placements: nextList });
  }, [onChange, sceneImage]);

  // 初始化：lesson 没有 placement 时，均匀摆成两行
  useEffect(() => {
    if (!lessons.length) return;
    const existing = new Set(list.map((p) => p.lessonId));
    const missing = lessons.filter((l) => !existing.has(l.id));
    if (missing.length && !list.length) {
      // 自动均分：N 个 lesson → 多行多列
      const cols = Math.min(3, Math.ceil(Math.sqrt(missing.length)));
      const rows = Math.ceil(missing.length / cols);
      const generated: PlacementItem[] = missing.map((l, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const x = (c + 0.5) / cols;
        const y = (r + 0.5) / rows;
        return {
          lessonId: l.id,
          x: Math.max(0.05, Math.min(0.95, x)),
          y: Math.max(0.05, Math.min(0.95, y)),
          color: PALETTE[i % PALETTE.length],
        };
      });
      setList(generated);
      flush(generated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons.length]);

  // 新加一个 lesson：先 auto 摆位
  useEffect(() => {
    if (!lessons.length) return;
    const existing = new Set(list.map((p) => p.lessonId));
    const newOnes = lessons.filter((l) => !existing.has(l.id));
    if (!newOnes.length) return;
    // 简单右下角堆放
    const next = [...list];
    newOnes.forEach((l, i) => {
      const angle = ((list.length + i) * 47) % 360;
      next.push({
        lessonId: l.id,
        x: 0.5 + 0.2 * Math.cos((angle * Math.PI) / 180),
        y: 0.5 + 0.2 * Math.sin((angle * Math.PI) / 180),
        color: PALETTE[(list.length + i) % PALETTE.length],
      });
    });
    setList(next);
    flush(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessons.length]);

  const updatePlacement = (lessonId: string, patch: Partial<PlacementItem>) => {
    const next = list.map((p) => (p.lessonId === lessonId ? { ...p, ...patch } : p));
    setList(next);
    flush(next);
  };

  const onPointerDown = (e: React.PointerEvent, p: PlacementItem) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(p.lessonId);
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    draggingRef.current = { lessonId: p.lessonId, offsetX: px - p.x, offsetY: py - p.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = draggingRef.current;
    if (!d) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - d.offsetX;
    const py = (e.clientY - rect.top) / rect.height - d.offsetY;
    updatePlacement(d.lessonId, {
      x: Math.max(0.02, Math.min(0.98, px)),
      y: Math.max(0.02, Math.min(0.98, py)),
    });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = null;
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  const selected = list.find((p) => p.lessonId === selectedId) ?? null;
  const selectedLesson = selected ? lessons.find((l) => l.id === selected.lessonId) ?? null : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
      {/* 左：画布 */}
      <div>
        <div className="text-xs font-bold text-stone-500 mb-2">
          画布（点击选中气泡拖动；自动为新加的 lesson 均分位置；坐标保存为 0~1 相对值）
        </div>
        <div
          ref={wrapRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => setSelectedId(null)}
          className="relative w-full overflow-hidden rounded-2xl border-2 border-amber-300 bg-amber-50/40 select-none touch-none"
          style={{ aspectRatio: '16 / 10' }}
        >
          {sceneImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sceneImage}
              alt={courseTitle}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-stone-400 text-sm font-bold">
              请在右侧上传场景大图
            </div>
          )}

          {/* 提示文案：未摆位时 */}
          {sceneImage && !list.length && (
            <div className="absolute inset-0 grid place-items-center text-amber-800/70 text-sm font-extrabold bg-amber-50/40">
              右下角「＋ 新增课时」可加 lesson，或点上方场景大图任意位置放置
            </div>
          )}

          {sceneImage && list.map((p) => {
            const lesson = lessons.find((l) => l.id === p.lessonId);
            if (!lesson) return null;
            const isSel = p.lessonId === selectedId;
            return (
              <div
                key={p.lessonId}
                onPointerDown={(e) => onPointerDown(e, p)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(p.lessonId); }}
                className={[
                  'absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing',
                  'rounded-full px-3 py-1.5 text-white text-xs sm:text-sm font-extrabold whitespace-nowrap',
                  'shadow-lg border-2 border-white flex items-center gap-1.5',
                  isSel ? 'ring-4 ring-amber-400 z-10' : 'z-[1]',
                ].join(' ')}
                style={{
                  left: `${p.x * 100}%`,
                  top: `${p.y * 100}%`,
                  background: p.color || '#FF8A3D',
                }}
              >
                <span
                  className="inline-block w-5 h-5 rounded-full bg-white/95 text-stone-800 text-[10px] font-extrabold leading-5 text-center"
                >
                  {lesson.sortOrder}
                </span>
                <span>{lesson.title || '(未命名)'}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右：工具面板 */}
      <div className="space-y-4">
        <div>
          <div className="text-xs font-bold text-stone-500 mb-1">场景大图</div>
          <MediaUploader
            type="image"
            compact
            value={sceneImage}
            onChange={(url) => { setSceneImage(url); flush(list, url); }}
            hint="学员端的画布底图（16:10 / 4:3 均可）"
          />
        </div>

        <div className="rounded-2xl border-2 border-amber-200 bg-white p-3">
          <div className="text-xs font-extrabold text-stone-700 mb-2">
            该课程的 lesson（{lessons.length}）
          </div>
          {lessons.length === 0 ? (
            <div className="text-xs text-stone-400 py-2 text-center">
              还没课时。请先到「课时」页添加 lesson
            </div>
          ) : (
            <ul className="space-y-1.5">
              {lessons.map((l) => {
                const placed = list.some((p) => p.lessonId === l.id);
                const cur = list.find((p) => p.lessonId === l.id);
                return (
                  <li
                    key={l.id}
                    onClick={() => setSelectedId(l.id)}
                    className={[
                      'flex items-center gap-2 rounded-xl border-2 px-2 py-1.5 cursor-pointer',
                      selectedId === l.id ? 'border-amber-500 bg-amber-50' : 'border-amber-100 bg-white',
                    ].join(' ')}
                  >
                    <span
                      className="inline-block w-3.5 h-3.5 rounded-full border border-white shadow flex-shrink-0"
                      style={{ background: cur?.color || '#ccc' }}
                    />
                    <span className="flex-1 min-w-0 text-xs font-extrabold text-stone-700 truncate">
                      {l.sortOrder}. {l.title}
                    </span>
                    <span className={['text-[10px] font-bold', placed ? 'text-emerald-600' : 'text-stone-400'].join(' ')}>
                      {placed ? '已摆位' : '待摆位'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 选中编辑面板 */}
        {selected && selectedLesson && (
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-3 space-y-3">
            <div className="text-xs font-extrabold text-stone-700">
              编辑 {selectedLesson.title}
            </div>

            <div>
              <div className="text-[10px] font-bold text-stone-500 mb-1">颜色</div>
              <div className="flex flex-wrap gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updatePlacement(selected.lessonId, { color: c })}
                    className={[
                      'w-7 h-7 rounded-full border-2',
                      selected.color === c ? 'border-stone-800 scale-110' : 'border-white',
                    ].join(' ')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-stone-500 mb-1">点击后播放的音频</div>
              <MediaUploader
                type="audio"
                compact
                value={selected.audioUrl ?? null}
                onChange={(url) => updatePlacement(selected.lessonId, { audioUrl: url })}
                hint="学员点气泡 → 播音频 → 播完进 lesson"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-stone-500 font-mono">
              <div>x: {selected.x.toFixed(3)}</div>
              <div>y: {selected.y.toFixed(3)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
