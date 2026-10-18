'use client';
// 步骤管理 — 积木池风格：批量添加/拖拽排序/一键保存
// 视觉重做：紫蓝主题 + lucide 图标 + 大圆角白卡 + 渐变 pill 状态标签
import { useEffect, useMemo, useState } from 'react';
import {
  Video, Image as ImageIcon, Link2, FileQuestion, Candy, Mic, ShoppingCart, Pencil, Plus, ChevronUp, ChevronDown, X, Save, RotateCcw, AlertCircle, CheckCircle2, BookOpen, GraduationCap, ListChecks, Inbox,
} from 'lucide-react';
import { adminApi, CourseDTO, LessonDTO, StepType } from '@/lib/adminApi';
import { useToast, PageHeader, PrimaryButton, EmptyState } from '@/components/admin/AdminUI';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { QuizBuilder, QuizContent } from '@/components/admin/QuizBuilder';
import { BridgeBuilder, BridgeContent } from '@/components/admin/BridgeBuilder';
import { InterruptBuilder } from '@/components/admin/InterruptBuilder';
import { TestBuilder } from '@/components/admin/TestBuilder';
import { VideoLabBuilder } from '@/components/admin/VideoLabBuilder';
import { ImageSafariBuilder } from '@/components/admin/ImageSafariBuilder';
import { TraceBuilder } from '@/components/admin/TraceBuilder';
import type { TestContent, VideoLabContent, ImageSafariContent, TraceContent } from '@/lib/stepContents';

type StepDraftStatus = 'kept' | 'new' | 'dirty' | 'removed';

interface StepDraft {
  _id: string;
  status: StepDraftStatus;
  type: StepType;
  name?: string | null;
  sortOrder: number;
  content: any;
}

const TYPES: { value: StepType; label: string; icon: any; hint?: string; cls: string }[] = [
  { value: 'VIDEO',        label: '视频',       icon: Video,        cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'IMAGE',        label: '图片',       icon: ImageIcon,    cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'BRIDGE',       label: '衔接',       icon: Link2,        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'QUIZ',         label: '测验',       icon: FileQuestion, cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'TEST',         label: '多题测验',   icon: Candy,        hint: '题前视频 + 单选/多选/填空混合', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'VIDEO_LAB',    label: '视频口语',   icon: Mic,          hint: '多个视频 + 可选麦克风口语回答', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'IMAGE_SAFARI', label: '超市探险',   icon: ShoppingCart, hint: '图上放标签 + 吉祥物走图', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'TRACE',        label: '手描',       icon: Pencil,        hint: '字迹描摹 + 4 色画笔 + 单词顺序解锁', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const TYPES_BY_VALUE = TYPES.reduce<Record<string, typeof TYPES[number]>>((m, t) => {
  m[t.value] = t;
  return m;
}, {});

function cid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function defaultContent(t: StepType): any {
  if (t === 'VIDEO') return { url: '', poster: '', duration: 60, aspect: '16:9', interrupts: [] };
  if (t === 'IMAGE') return { url: '', caption: '', audio: '' };
  if (t === 'BRIDGE') return { mode: 'READ', resources: {} };
  if (t === 'TEST') return { introVideoUrl: '', questions: [] } satisfies TestContent;
  if (t === 'VIDEO_LAB') return { videos: [] } satisfies VideoLabContent;
  if (t === 'IMAGE_SAFARI') return { imageUrl: '', mascotUrl: '', tags: [] } satisfies ImageSafariContent;
  if (t === 'TRACE') return { words: [], threshold: 0.95 } satisfies TraceContent;
  return { kind: 'SINGLE', prompt: '这个用英语怎么说？', options: [
    { id: 'a', text: '' }, { id: 'b', text: '' },
  ], answer: [] };
}

function fromServer(s: { id: string; type: StepType; sortOrder: number; content: any; name?: string | null }): StepDraft {
  return { _id: s.id, status: 'kept', type: s.type, sortOrder: s.sortOrder, content: s.content, name: s.name ?? null };
}

export default function AdminStepsPage() {
  const [courses, setCourses] = useState<CourseDTO[]>([]);
  const [allLessons, setAllLessons] = useState<LessonDTO[]>([]);
  const [courseId, setCourseId] = useState('');
  const [lessonId, setLessonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const [drafts, setDrafts] = useState<StepDraft[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const [c, ls] = await Promise.all([
        adminApi.listCourses(),
        fetch('/api/lessons', { headers: { 'x-user-id': 'admin' } }).then((r) => r.json()),
      ]);
      setCourses(c);
      setAllLessons(ls);
      if (!courseId && c[0]) setCourseId(c[0].id);
    } catch (e: any) {
      toast({ type: 'error', text: '加载失败：' + (e?.message ?? String(e)) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  const lessons = useMemo(
    () => (allLessons as LessonDTO[]).filter((l) => l.courseId === courseId).sort((a, b) => a.sortOrder - b.sortOrder),
    [allLessons, courseId],
  );

  async function loadSteps(lid: string) {
    if (!lid) { setDrafts([]); return; }
    try {
      const r = await fetch(`/api/lessons/${lid}`, { headers: { 'x-user-id': 'admin' } });
      const d = await r.json();
      const steps: any[] = d?.steps ?? [];
      const ds: StepDraft[] = steps
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(fromServer);
      setDrafts(ds);
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    }
  }
  useEffect(() => { loadSteps(lessonId); /* eslint-disable-next-line */ }, [lessonId]);

  function addStep(t: StepType) {
    if (!lessonId) {
      toast({ type: 'info', text: '请先选择一个课时' });
      return;
    }
    const nextOrder = drafts.reduce((m, d) => Math.max(m, d.sortOrder), 0) + 1;
    setDrafts((cur) => [
      ...cur,
      {
        _id: `new_${cid()}`,
        status: 'new',
        type: t,
        name: null,
        sortOrder: nextOrder,
        content: defaultContent(t),
      },
    ]);
  }

  function updateDraft(id: string, patch: Partial<StepDraft>) {
    setDrafts((cur) => cur.map((d) => {
      if (d._id !== id) return d;
      const next = { ...d, ...patch };
      if (patch.content !== undefined || patch.type !== undefined || patch.name !== undefined) {
        if (next.status === 'kept') next.status = 'dirty';
      }
      return next;
    }));
  }

  function removeDraft(id: string) {
    setDrafts((cur) => cur.map((d) =>
      d._id === id ? { ...d, status: 'removed' as StepDraftStatus } : d
    ));
  }

  function move(id: string, dir: -1 | 1) {
    setDrafts((cur) => {
      const arr = [...cur];
      const i = arr.findIndex((d) => d._id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr.map((d, k) => {
        const targetOrder = k + 1;
        if (d.sortOrder !== targetOrder && d.status === 'kept') {
          return { ...d, sortOrder: targetOrder, status: 'dirty' as StepDraftStatus };
        }
        return { ...d, sortOrder: targetOrder };
      });
    });
  }

  function undoRemove(id: string) {
    setDrafts((cur) => cur.map((d) => d._id === id ? { ...d, status: 'kept' } : d));
  }

  async function saveAll() {
    if (!lessonId) { toast({ type: 'info', text: '请先选择课时' }); return; }
    setSaving(true);
    try {
      // 先把"已删除"清掉。注意：必须在创建/更新前删，否则 sortOrder 重排会撞上
      const removed = drafts.filter((d) => d.status === 'removed');
      for (const d of removed) {
        await adminApi.deleteStep(d._id);
      }

      const live = drafts
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((d) => d.status !== 'removed');

      // 用 Map 收集本次保存后更新的 _id：new → 真 id
      // （避免下次保存时还拿 new_xxx 这种前端临时 id 去 PATCH → 404 Step not found）
      const idReplacements = new Map<string, string>();
      // 记录在保存过程中被改动的"kept"步骤：保存成功后要把它们也标 dirty
      // （这样下次还能正确触发 update；不过本次保存完会 loadSteps 重置为 kept）

      for (let i = 0; i < live.length; i++) {
        const d = live[i];
        const targetSort = i + 1;
        const payload = { type: d.type, sortOrder: targetSort, content: d.content, name: d.name ?? null };
        if (d.status === 'new') {
          const created = await adminApi.createStep({ lessonId, ...payload });
          // createStep 返回的 StepDTO 带后端真 id — 写回 idReplacements，
          // 保存结束后会统一替换 draft._id，避免下一次保存走 PATCH /api/admin/steps/new_xxx → 404
          if (created?.id) idReplacements.set(d._id, created.id);
        } else if (d.status === 'dirty') {
          await adminApi.updateStep(d._id, payload);
        } else if (d.status === 'kept') {
          if (d.sortOrder !== targetSort) {
            await adminApi.updateStep(d._id, payload);
          }
        }
      }

      toast({ type: 'success', text: `已保存，共处理 ${drafts.length} 条` });

      // 立刻把 new 步骤的真 id 写回 draft（不等 loadSteps 异步返回），
      // 这样用户在保存 toast 出来的瞬间如果再点保存 / 改内容，
      // 也不会再用 new_xxx 这种临时 id 去打后端。
      if (idReplacements.size > 0) {
        setDrafts((cur) => cur.map((d) => {
          const realId = idReplacements.get(d._id);
          return realId ? { ...d, _id: realId, status: 'kept' as StepDraftStatus } : d;
        }));
      }

      // 再异步从后端拉一次最新数据，确保所有字段（特别是 createdAt/updatedAt）都对齐
      await loadSteps(lessonId);
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    loadSteps(lessonId);
  }

  const dirtyCount = drafts.filter((d) => d.status === 'new' || d.status === 'dirty' || d.status === 'removed').length;
  const visibleDrafts = drafts.filter((d) => d.status !== 'removed');

  function PreviewThumb({ draft }: { draft: StepDraft }) {
    if (draft.type === 'VIDEO' && draft.content?.url) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <video src={draft.content.url} className="h-12 rounded-lg border-2 border-amber-200 object-cover" muted />
      );
    }
    if (draft.type === 'IMAGE' && (draft.content?.url || draft.content?.pages?.[0]?.url)) {
      const thumb = draft.content?.url || draft.content?.pages?.[0]?.url;
      return <img src={thumb} alt="" className="h-12 rounded-lg border-2 border-amber-200 object-cover" />;
    }
    if (draft.type === 'QUIZ') {
      const q = draft.content as QuizContent;
      return (
        <span className="text-xs text-emerald-700 font-extrabold px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
          {q.kind === 'BLANK' ? '填空' : q.kind === 'MULTIPLE' ? '多选' : '单选'} · {q.prompt ? q.prompt.slice(0, 12) : '(无题)'}
        </span>
      );
    }
    if (draft.type === 'BRIDGE') {
      const b = draft.content as BridgeContent;
      const mode = b.mode ?? 'READ';
      const cn = mode === 'LISTEN' ? '听' : mode === 'WATCH' ? '看' : mode === 'PRACTICE' ? '练' : '读';
      return (
        <span className="text-xs text-emerald-700 font-extrabold px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
          衔接 · {cn}{b.resources?.[mode]?.audio ? ' · 音频已配' : ''}
        </span>
      );
    }
    if (draft.type === 'TEST') {
      const t = draft.content as TestContent;
      return (
        <span className="text-xs text-purple-700 font-extrabold px-2 py-1 bg-purple-50 rounded-lg border border-purple-200">
          多题测验 · {(t.questions ?? []).length} 题
        </span>
      );
    }
    if (draft.type === 'VIDEO_LAB') {
      const v = draft.content as VideoLabContent;
      const micCount = (v.videos ?? []).filter((it) => it.micRequired).length;
      return (
        <span className="text-xs text-rose-700 font-extrabold px-2 py-1 bg-rose-50 rounded-lg border border-rose-200">
          视频口语 · {(v.videos ?? []).length} 个 · 需回答 {micCount} 个
        </span>
      );
    }
    if (draft.type === 'IMAGE_SAFARI') {
      const c = draft.content as ImageSafariContent;
      return (
        <span className="text-xs text-emerald-700 font-extrabold px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
          超市探险 · {(c.tags ?? []).length} 个标签
        </span>
      );
    }
    if (draft.type === 'TRACE') {
      const c = draft.content as TraceContent;
      return (
        <span className="text-xs text-rose-700 font-extrabold px-2 py-1 bg-rose-50 rounded-lg border border-rose-200">
          手描 · {(c.words ?? []).length} 个单词 · 阈值 {Math.round((c.threshold ?? 0.95) * 100)}%
        </span>
      );
    }
    return <span className="text-xs text-stone-400 font-bold">未填写</span>;
  }

  const currentCourse = courses.find((c) => c.id === courseId);
  const currentLesson = lessons.find((l) => l.id === lessonId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="步骤管理"
        subtitle="积木池 · 一次添加多个步骤，自由排序，一键保存整个课时"
        icon={ListChecks}
      />

      {/* 课程切换：pill */}
      {courses.length > 0 && (
        <div className="rounded-2xl bg-white/90 border-2 border-white shadow-pop p-3">
          <div className="flex items-center gap-2 mb-2 px-1 text-xs font-extrabold text-stone-500">
            <BookOpen className="w-3.5 h-3.5 text-brand-purple" strokeWidth={2.5} />
            选择课程
          </div>
          <div className="flex flex-wrap gap-2">
            {courses.map((c) => {
              const active = c.id === courseId;
              return (
                <button
                  key={c.id}
                  onClick={() => { setCourseId(c.id); setLessonId(''); setDrafts([]); }}
                  className={
                    'inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 font-extrabold border-2 transition ' +
                    (active
                      ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white border-white/40 shadow-pop'
                      : 'bg-white text-stone-700 border-amber-200 hover:border-brand-purple hover:text-brand-purple')
                  }
                >
                  <BookOpen className="w-3.5 h-3.5" strokeWidth={2.5} />
                  {c.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 课时下拉 */}
      <div className="rounded-2xl bg-white/90 border-2 border-white shadow-pop p-4">
        <label className="block">
          <span className="text-sm font-extrabold text-stone-700 flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
            当前课时
          </span>
          <select
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
            className="mt-1.5 w-full md:w-1/2 rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
          >
            <option value="">— 请选择 —</option>
            {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </label>
      </div>

      {/* 顶部添加按钮组 */}
      {lessonId && (
        <div className="rounded-3xl bg-white/90 border-2 border-white shadow-pop p-4">
          <div className="text-sm font-extrabold text-stone-700 mb-2.5 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
            往这一课添加：
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => addStep(t.value)}
                  className={
                    'inline-flex items-center gap-1.5 rounded-2xl px-3.5 py-2 font-extrabold text-sm border-2 transition shadow-pop ' +
                    t.cls + ' hover:-translate-y-0.5'
                  }
                >
                  <Icon className="w-4 h-4" strokeWidth={2.5} />
                  {t.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-stone-500">
            提示：学员端一次播放一个步骤。拖动 ↑↓ 调整顺序，修改后记得「一键保存」。
          </div>
        </div>
      )}

      {/* 当前草稿列表 */}
      {lessonId && (
        <div className="rounded-3xl bg-white/90 border-2 border-white shadow-pop p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-extrabold text-stone-800 inline-flex items-center gap-2 flex-wrap">
              <ListChecks className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
              当前草稿
              <span className="text-sm text-stone-500">（{visibleDrafts.length}）</span>
              {dirtyCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-extrabold">
                  <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
                  待保存：{dirtyCount}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                disabled={saving || dirtyCount === 0}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-stone-200 text-stone-700 border-2 border-stone-300 px-3.5 py-2 font-extrabold text-sm disabled:opacity-40 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} />
                取消改动
              </button>
              <button
                onClick={saveAll}
                disabled={saving || dirtyCount === 0}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-blue text-white border-2 border-white/40 px-4 py-2 font-extrabold text-sm shadow-pop disabled:opacity-40 transition hover:-translate-y-0.5"
              >
                <Save className="w-3.5 h-3.5" strokeWidth={2.5} />
                {saving ? '保存中…' : '一键保存'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-stone-500 py-6 text-center font-extrabold">加载中…</div>
          ) : visibleDrafts.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="还没有步骤"
              hint="点击上面的「视频 / 图片 / 测验」按钮开始添加"
            />
          ) : (
            <ul className="space-y-3">
              {visibleDrafts.map((d, i) => (
                <DraftCard
                  key={d._id}
                  draft={d}
                  index={i}
                  total={visibleDrafts.length}
                  onChange={(patch) => updateDraft(d._id, patch)}
                  onRemove={() => removeDraft(d._id)}
                  onUndoRemove={() => undoRemove(d._id)}
                  onMoveUp={() => move(d._id, -1)}
                  onMoveDown={() => move(d._id, 1)}
                  preview={<PreviewThumb draft={d} />}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// —— 单条草稿卡片 ——
function DraftCard({
  draft, index, total, onChange, onRemove, onUndoRemove, onMoveUp, onMoveDown, preview,
}: {
  draft: StepDraft;
  index: number;
  total: number;
  onChange: (p: Partial<StepDraft>) => void;
  onRemove: () => void;
  onUndoRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  preview: React.ReactNode;
}) {
  const meta = TYPES_BY_VALUE[draft.type]!;
  const statusLabel: Record<StepDraftStatus, string> = {
    kept:    '已保存',
    new:     '新增',
    dirty:   '已修改',
    removed: '已删除',
  };
  const statusColor: Record<StepDraftStatus, string> = {
    kept:    'bg-stone-100 text-stone-600 border-stone-200',
    new:     'bg-sky-100 text-sky-800 border-sky-200',
    dirty:   'bg-amber-100 text-amber-800 border-amber-200',
    removed: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  const TypeIcon = meta.icon;

  return (
    <li className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-3">
      {/* 顶栏：序号 / 类型 / 状态 / 名称 / 操作 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-purple to-brand-blue text-white font-extrabold flex items-center justify-center text-sm shadow-pop border-2 border-white">
          {index + 1}
        </div>
        <span className={`inline-flex items-center gap-1 rounded-xl px-2 py-1 font-extrabold text-xs border ${meta.cls}`}>
          <TypeIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
          {meta.label}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-extrabold border ${statusColor[draft.status]}`}>
          {statusLabel[draft.status]}
        </span>

        <label className="ml-1 flex items-center gap-1.5 text-xs font-bold text-stone-500">
          <span>步骤名</span>
          <input
            type="text"
            value={draft.name ?? ''}
            onChange={(e) => onChange({ name: e.target.value })}
            maxLength={64}
            placeholder={`（默认：${meta.label}）`}
            className="rounded-xl border-2 border-amber-200 bg-white px-2 py-1 text-sm font-bold text-stone-800 outline-none focus:border-brand-purple min-w-[140px] max-w-[220px]"
          />
        </label>

        <div className="flex-1" />

        <div className="flex gap-1">
          {draft.status === 'removed' ? (
            <button
              type="button"
              onClick={onUndoRemove}
              className="h-8 px-2.5 rounded-lg bg-emerald-50 border-2 border-emerald-200 text-emerald-700 text-xs font-extrabold inline-flex items-center gap-1"
              title="撤销删除"
            >
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
              撤销
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onMoveUp}
                disabled={index === 0}
                className="w-8 h-8 rounded-lg bg-white border-2 border-amber-200 text-stone-600 disabled:opacity-30 grid place-items-center hover:border-brand-purple hover:text-brand-purple transition"
                title="上移"
              >
                <ChevronUp className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={index === total - 1}
                className="w-8 h-8 rounded-lg bg-white border-2 border-amber-200 text-stone-600 disabled:opacity-30 grid place-items-center hover:border-brand-purple hover:text-brand-purple transition"
                title="下移"
              >
                <ChevronDown className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="w-8 h-8 rounded-lg bg-rose-50 border-2 border-rose-200 text-rose-700 grid place-items-center hover:bg-rose-100 transition"
                title="删除"
              >
                <X className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="flex-shrink-0">{preview}</div>
        <div className="flex-1 text-xs text-stone-500 font-bold">
          拖动 ↑↓ 调整顺序 · 修改内容后记得点「一键保存」
        </div>
      </div>

      {/* 类型切换 */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = draft.type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange({ type: t.value, content: defaultContent(t.value) })}
              className={
                'inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-extrabold border-2 transition ' +
                (active
                  ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white border-white/40 shadow-pop'
                  : 'bg-white text-stone-600 border-amber-200 hover:border-brand-purple hover:text-brand-purple')
              }
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
              {t.label}
            </button>
          );
        })}
        <span className="text-xs text-stone-400 self-center font-bold">（切换会清空内容）</span>
      </div>

      {/* 内嵌表单 —— 按 type 渲染 */}
      <div className="mt-3 rounded-2xl bg-white p-3 border-2 border-amber-100">
        {draft.type === 'VIDEO' && <VideoForm content={draft.content} onChange={(c) => onChange({ content: c })} />}
        {draft.type === 'IMAGE' && <ImageForm content={draft.content} onChange={(c) => onChange({ content: c })} />}
        {draft.type === 'BRIDGE' && <BridgeBuilder value={draft.content} onChange={(c) => onChange({ content: c })} />}
        {draft.type === 'QUIZ'  && <QuizBuilder value={draft.content} onChange={(c) => onChange({ content: c })} />}
        {draft.type === 'TEST'  && <TestBuilder value={draft.content as TestContent} onChange={(c) => onChange({ content: c })} />}
        {draft.type === 'VIDEO_LAB' && <VideoLabBuilder value={draft.content as VideoLabContent} onChange={(c) => onChange({ content: c })} />}
        {draft.type === 'IMAGE_SAFARI' && <ImageSafariBuilder value={draft.content as ImageSafariContent} onChange={(c) => onChange({ content: c })} />}
        {draft.type === 'TRACE'        && <TraceBuilder          value={draft.content as TraceContent}        onChange={(c) => onChange({ content: c })} />}
      </div>
    </li>
  );
}

function VideoForm({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  const aspect = (content.aspect as string) ?? '16:9';
  return (
    <div className="space-y-3">
      <Field label="视频文件（mp4 / mov / webm）*">
        <MediaUploader value={content.url} onChange={(url) => onChange({ ...content, url: url ?? '' })} type="video" />
      </Field>
      <Field label="封面图">
        <MediaUploader value={content.poster} onChange={(url) => onChange({ ...content, poster: url ?? '' })} type="image" />
      </Field>
      <Field label="画面比例" hint="横版适合 16:9 录屏；方形适合动画；竖版适合手机/短视频">
        <div className="flex flex-wrap gap-2">
          {[
            { v: '16:9', label: '横版', desc: '16:9', cls: 'w-12 h-7'  },
            { v: '1:1',  label: '方形', desc: '1:1',  cls: 'w-8 h-8'  },
            { v: '9:16', label: '竖版', desc: '9:16', cls: 'w-7 h-12' },
          ].map((opt) => {
            const active = aspect === opt.v;
            return (
              <button
                key={opt.v}
                type="button"
                onClick={() => onChange({ ...content, aspect: opt.v })}
                className={
                  'rounded-2xl px-3 py-2 font-extrabold border-2 transition flex items-center gap-2 ' +
                  (active
                    ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white border-white/40 shadow-pop'
                    : 'bg-white text-stone-700 border-amber-200 hover:border-brand-purple hover:text-brand-purple')
                }
              >
                <span className={`inline-block rounded border-2 ${active ? 'border-white' : 'border-stone-400'} ${opt.cls}`} />
                <span className="text-sm">{opt.label}</span>
                <span className={`text-xs ${active ? 'opacity-90' : 'opacity-60'}`}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="时长（秒）">
        <input
          type="number"
          min={1}
          value={content.duration ?? 60}
          onChange={(e) => onChange({ ...content, duration: Number(e.target.value) })}
          className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
        />
      </Field>

      <div className="pt-2 border-t-2 border-dashed border-amber-200">
        <InterruptBuilder
          value={content.interrupts ?? []}
          onChange={(v) => onChange({ ...content, interrupts: v })}
          durationSec={Number(content.duration) || 60}
        />
      </div>

      {Array.isArray(content.interrupts) && content.interrupts.length > 0 && (
        <div className="pt-2 border-t-2 border-dashed border-amber-200">
          <Field label="满分（1-3 星）" hint="学员通过弹题后可拿的星星数。0 = 弹题不计星">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((n) => {
                const active = (content.maxStars ?? 1) === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onChange({ ...content, maxStars: n })}
                    className={
                      'rounded-xl px-3 py-1.5 font-extrabold border-2 transition inline-flex items-center gap-1 ' +
                      (active
                        ? 'bg-gradient-to-r from-amber-300 to-amber-400 text-amber-900 border-amber-200 shadow-pop'
                        : 'bg-white text-stone-600 border-amber-200 hover:border-brand-purple')
                    }
                  >
                    {Array.from({ length: n }).map((_, i) => (
                      <span key={i} className="text-base leading-none">★</span>
                    ))}
                  </button>
                );
              })}
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

function ImageForm({ content, onChange }: { content: any; onChange: (c: any) => void }) {
  function getPages(): { url: string; caption?: string; audio?: string }[] {
    if (Array.isArray(content.pages)) return content.pages;
    if (content.url) return [{ url: content.url, caption: content.caption, audio: content.audio }];
    return [];
  }
  const pages = getPages();

  function setPages(next: { url: string; caption?: string; audio?: string }[]) {
    onChange({ ...content, pages: next, url: next[0]?.url ?? '', caption: next[0]?.caption ?? '', audio: next[0]?.audio ?? '' });
  }
  function addPage() { setPages([...pages, { url: '', caption: '', audio: '' }]); }
  function removePage(i: number) { const next = pages.slice(); next.splice(i, 1); setPages(next); }
  function patchPage(i: number, patch: Partial<{ url: string; caption: string; audio: string }>) {
    const next = pages.slice(); next[i] = { ...next[i], ...patch }; setPages(next);
  }
  function movePage(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= pages.length) return;
    const next = pages.slice(); [next[i], next[j]] = [next[j], next[i]]; setPages(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-stone-700 inline-flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
          图片页
          <span className="text-xs font-bold text-stone-400">（每页一张图 + 标题 + 音频，依次播放）</span>
        </div>
        <button
          type="button"
          onClick={addPage}
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 bg-gradient-to-r from-brand-purple to-brand-blue text-white text-xs font-extrabold shadow-pop border-2 border-white/30"
        >
          <Plus className="w-3 h-3" strokeWidth={2.5} />
          添加图片
        </button>
      </div>

      {pages.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 p-4 text-center text-sm text-stone-500 font-bold">
          还没有图片，点右上角"添加图片"开始
        </div>
      )}

      <ol className="space-y-3">
        {pages.map((p, i) => (
          <li key={i} className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-stone-600 inline-flex items-center gap-1.5">
                <span className="inline-grid place-items-center w-5 h-5 rounded-md bg-brand-purple text-white text-[10px] font-extrabold border border-white/40">{i + 1}</span>
                第 {i + 1} 张
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => movePage(i, -1)} disabled={i === 0} className="w-7 h-7 rounded-lg bg-white border-2 border-amber-200 grid place-items-center text-stone-600 disabled:opacity-30">
                  <ChevronUp className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
                <button type="button" onClick={() => movePage(i, 1)} disabled={i === pages.length - 1} className="w-7 h-7 rounded-lg bg-white border-2 border-amber-200 grid place-items-center text-stone-600 disabled:opacity-30">
                  <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
                <button type="button" onClick={() => removePage(i)} className="inline-flex items-center gap-1 px-2 h-7 rounded-lg bg-rose-50 border-2 border-rose-200 text-rose-700 text-xs font-extrabold">
                  <X className="w-3 h-3" strokeWidth={2.5} />
                  删除
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr,260px] gap-3">
              <div className="space-y-2">
                <Field label="图片文件（png / jpg / webp）*">
                  <MediaUploader value={p.url} onChange={(url) => patchPage(i, { url: url ?? '' })} type="image" />
                </Field>
                <Field label="图片说明 / 标题">
                  <textarea
                    rows={2}
                    value={p.caption ?? ''}
                    onChange={(e) => patchPage(i, { caption: e.target.value })}
                    className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 resize-none font-bold"
                  />
                </Field>
              </div>
              <Field label="配套音频" hint="该页显示时自动播放；播完自动翻下一页">
                <MediaUploader value={p.audio} onChange={(url) => patchPage(i, { audio: url ?? '' })} type="audio" />
              </Field>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-xs font-extrabold text-stone-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <div className="mt-1 text-xs text-stone-400">{hint}</div>}
    </div>
  );
}
