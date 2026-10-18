'use client';
import { useEffect, useMemo, useState } from 'react';
import { GraduationCap, Plus, Pencil, Trash2, Star, ListChecks, Inbox, Image as ImageIcon, ArrowRight, ChevronRight } from 'lucide-react';
import { adminApi, CourseDTO, LessonDTO } from '@/lib/adminApi';
import { IconUploader } from '@/components/admin/IconUploader';
import {
  Field, inputClass, PrimaryButton, EmptyState, useToast, Drawer, PageHeader, RefreshButton, IconButton, StatusBadge,
} from '@/components/admin/AdminUI';

interface LessonRow extends LessonDTO {
  _count?: { steps: number };
}

export default function AdminLessonsPage() {
  const [courses, setCourses] = useState<CourseDTO[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [courseId, setCourseId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<LessonRow | null>(null);
  const [form, setForm] = useState<{
    title: string; iconUrl: string | null; sortOrder: number; rewardStars: number;
  }>({
    title: '', iconUrl: null, sortOrder: 1, rewardStars: 3,
  });
  const [saving, setSaving] = useState(false);

  async function refreshCourses() {
    const c = await adminApi.listCourses();
    setCourses(c);
    if (!courseId && c[0]) setCourseId(c[0].id);
    return c;
  }

  async function refreshLessons() {
    if (!courseId) {
      setLessons([]);
      return;
    }
    setLoading(true);
    try {
      const ls = await adminApi.listLessons(courseId);
      setLessons(ls);
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        await refreshCourses();
      } catch (e: any) {
        toast({ type: 'error', text: '加载失败：' + (e?.message ?? String(e)) });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refreshLessons(); /* eslint-disable-next-line */ }, [courseId]);

  const sorted = useMemo(
    () => [...lessons].sort((a, b) => a.sortOrder - b.sortOrder),
    [lessons],
  );

  function openCreate() {
    if (!courseId) {
      toast({ type: 'info', text: '请先选择课程' });
      return;
    }
    setEditing(null);
    setForm({
      title: '',
      iconUrl: null,
      sortOrder: lessons.length + 1,
      rewardStars: 3,
    });
    setDrawerOpen(true);
  }

  function openEdit(l: LessonRow) {
    setEditing(l);
    setForm({
      title: l.title,
      iconUrl: l.iconUrl ?? null,
      sortOrder: l.sortOrder,
      rewardStars: l.rewardStars,
    });
    setDrawerOpen(true);
  }

  async function submitForm() {
    if (!form.title.trim() || !courseId) {
      toast({ type: 'error', text: '请填写课时标题' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await adminApi.updateLesson(editing.id, {
          title: form.title,
          iconUrl: form.iconUrl,
          sortOrder: form.sortOrder,
          rewardStars: form.rewardStars,
        });
        toast({ type: 'success', text: '已保存' });
      } else {
        await adminApi.createLesson({
          courseId,
          title: form.title,
          iconUrl: form.iconUrl ?? undefined,
          sortOrder: form.sortOrder,
          rewardStars: form.rewardStars,
        });
        toast({ type: 'success', text: '已新建课时' });
      }
      setDrawerOpen(false);
      await refreshLessons();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: LessonRow) {
    if (!confirm(`确认删除课时「${l.title}」？其下所有步骤会一起删除。`)) return;
    try {
      await adminApi.deleteLesson(l.id);
      toast({ type: 'success', text: '已删除' });
      await refreshLessons();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    }
  }

  const currentCourse = courses.find((c) => c.id === courseId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="课时管理"
        subtitle="每个课时包含若干步骤（视频/图片/小测验），可上传自定义关卡 icon。"
        icon={GraduationCap}
        actions={
          <PrimaryButton onClick={openCreate} variant="purple" size="lg" icon={Plus} disabled={!courseId}>
            新建课时
          </PrimaryButton>
        }
      />

      {/* 课程切换：pill 列表 */}
      {courses.length > 0 ? (
        <div className="rounded-2xl bg-white/90 border-2 border-white shadow-pop p-3">
          <div className="flex flex-wrap gap-2">
            {courses.map((c) => {
              const active = c.id === courseId;
              return (
                <button
                  key={c.id}
                  onClick={() => setCourseId(c.id)}
                  className={
                    'inline-flex items-center gap-2 rounded-2xl px-3.5 py-2 font-extrabold border-2 transition ' +
                    (active
                      ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white border-white/40 shadow-pop'
                      : 'bg-white text-stone-700 border-amber-200 hover:border-brand-purple hover:text-brand-purple')
                  }
                >
                  <span
                    className={
                      'inline-grid place-items-center w-6 h-6 rounded-lg border ' +
                      (active ? 'bg-white/20 border-white/30' : 'bg-brand-purple/10 border-brand-purple/15')
                    }
                  >
                    <GraduationCap className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </span>
                  {c.title}
                  {active ? <ChevronRight className="w-3.5 h-3.5 opacity-80" strokeWidth={2.5} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* 当前课时的课时列表 */}
      <section className="rounded-3xl bg-white/90 border-2 border-white shadow-pop overflow-hidden">
        <div className="px-5 py-3.5 border-b-2 border-amber-100 bg-gradient-to-r from-brand-purple/8 to-brand-cyan/8 flex items-center justify-between flex-wrap gap-2">
          <div className="font-extrabold text-stone-800 inline-flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
            {currentCourse?.title ?? '请选择课程'}
            <span className="ml-1 text-sm text-stone-500 font-bold">· {sorted.length} 课时</span>
          </div>
          <RefreshButton onClick={refreshLessons} />
        </div>

        {loading ? (
          <div className="p-10 text-stone-500 text-center font-extrabold">加载中…</div>
        ) : !courseId ? (
          <EmptyState icon={Inbox} title="请先选择一个课程" />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="该课程下还没有课时"
            hint="点击右上角「新建课时」开始添加"
            action={
              <PrimaryButton onClick={openCreate} variant="purple" icon={Plus}>
                新建第一课时
              </PrimaryButton>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
            {sorted.map((l, i) => (
              <article
                key={l.id}
                className="group relative rounded-2xl bg-white border-2 border-amber-100 shadow-pop overflow-hidden hover:border-brand-purple/40 transition"
              >
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-purple via-brand-blue to-brand-cyan opacity-60" />
                <div className="p-4 flex gap-3">
                  <div className="flex-shrink-0">
                    <div className="relative">
                      <div
                        className="rounded-2xl border-2 border-amber-200 bg-amber-50 grid place-items-center overflow-hidden"
                        style={{ width: 64, height: 64 }}
                      >
                        {l.iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={l.iconUrl} alt={l.title} className="w-full h-full object-contain" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-stone-300" strokeWidth={2} />
                        )}
                      </div>
                      <span className="absolute -top-1.5 -left-1.5 inline-grid place-items-center min-w-[24px] h-6 px-1.5 rounded-full bg-gradient-to-br from-brand-purple to-brand-blue text-white text-[11px] font-extrabold border-2 border-white shadow-pop">
                        {i + 1}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-stone-800 line-clamp-1">{l.title}</div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs flex-wrap">
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-extrabold border border-amber-200">
                        <Star className="w-3 h-3" strokeWidth={2.5} />
                        {l.rewardStars}
                      </span>
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-stone-100 text-stone-700 px-2 py-0.5 font-extrabold">
                        <ListChecks className="w-3 h-3" strokeWidth={2.5} />
                        {l._count?.steps ?? 0} 步
                      </span>
                      {l.iconUrl ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 text-emerald-700 px-2 py-0.5 font-extrabold">
                          已配 icon
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-stone-50 text-stone-500 px-2 py-0.5 font-extrabold">
                          无 icon
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2.5 border-t-2 border-amber-100 bg-amber-50/30 flex items-center justify-between">
                  <a
                    href={`/admin/steps?lessonId=${l.id}`}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-brand-purple hover:text-brand-blue"
                  >
                    管理步骤
                    <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
                  </a>
                  <div className="flex items-center gap-1.5">
                    <IconButton icon={Pencil} onClick={() => openEdit(l)} label="编辑" variant="purple" size="sm" />
                    <IconButton icon={Trash2} onClick={() => remove(l)} label="删除" variant="rose" size="sm" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 抽屉：新建/编辑 */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? `编辑课时：${editing.title}` : '新建课时'}
        icon={editing ? Pencil : Plus}
        footer={
          <>
            <PrimaryButton variant="stone" onClick={() => setDrawerOpen(false)}>取消</PrimaryButton>
            <PrimaryButton variant="purple" onClick={submitForm} disabled={saving} icon={Plus}>
              {saving ? '保存中…' : editing ? '保存' : '创建'}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="课时标题" required icon={GraduationCap}>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={inputClass}
              placeholder="如：Lesson 1 — cat / dog"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="奖励星星" hint="完成可得的星星数（0-10）" icon={Star}>
              <input
                type="number"
                min={0}
                max={10}
                value={form.rewardStars}
                onChange={(e) => setForm({ ...form, rewardStars: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="排序" hint="数字越小越靠前" icon={ListChecks}>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="关卡 Icon" hint="不传则用默认占位，推荐 256×256 PNG/SVG" icon={ImageIcon}>
            <IconUploader value={form.iconUrl} onChange={(url) => setForm({ ...form, iconUrl: url })} />
          </Field>
        </div>
      </Drawer>
    </div>
  );
}
