'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, GraduationCap, ListChecks, FileQuestion, Video, Image as ImageIcon, Sparkles, Plus, ArrowRight, Inbox, Filter } from 'lucide-react';
import { adminApi, CourseDTO, LessonDTO, StepDTO } from '@/lib/adminApi';
import { useToast, PageHeader, StatCard, EmptyState, PrimaryButton } from '@/components/admin/AdminUI';

export default function AdminHomePage() {
  const [courses, setCourses] = useState<CourseDTO[]>([]);
  const [lessons, setLessons] = useState<LessonDTO[]>([]);
  const [steps, setSteps] = useState<StepDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const cs = await adminApi.listCourses();
        setCourses(cs);
        const allLessons: LessonDTO[] = [];
        for (const c of cs) {
          const ls = await adminApi.listLessons(c.id);
          allLessons.push(...ls);
        }
        setLessons(allLessons);
        const allSteps: StepDTO[] = [];
        for (const l of allLessons) {
          const ss = await adminApi.listSteps(l.id);
          allSteps.push(...ss);
        }
        setSteps(allSteps);
      } catch (e: any) {
        toast({ type: 'error', text: '加载失败：' + (e?.message ?? String(e)) });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const breakdown = useMemo(() => {
    const c = (t: string) => steps.filter((s) => s.type === t).length;
    return [
      { label: '视频步骤', value: c('VIDEO'),      Icon: Video,       cls: 'bg-rose-50 text-rose-700 border-rose-200' },
      { label: '图片步骤', value: c('IMAGE'),      Icon: ImageIcon,   cls: 'bg-sky-50 text-sky-700 border-sky-200' },
      { label: '测验步骤', value: c('QUIZ'),       Icon: FileQuestion,cls: 'bg-amber-50 text-amber-800 border-amber-200' },
      { label: '其它',     value: steps.length - c('VIDEO') - c('IMAGE') - c('QUIZ'), Icon: Sparkles, cls: 'bg-stone-50 text-stone-700 border-stone-200' },
    ];
  }, [steps]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="欢迎回来，老师"
        subtitle="在这里编辑课程、课时、步骤。前台会即时看到效果。"
        icon={Sparkles}
        actions={
          <Link href="/admin/courses">
            <PrimaryButton variant="purple" icon={Plus}>新建课程</PrimaryButton>
          </Link>
        }
      />

      {/* 数据卡片 */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="课程" value={loading ? '…' : courses.length} icon={BookOpen}      href="/admin/courses" variant="purple" />
        <StatCard label="课时" value={loading ? '…' : lessons.length} icon={GraduationCap} href="/admin/lessons" variant="cyan" />
        <StatCard label="步骤" value={loading ? '…' : steps.length}   icon={ListChecks}    href="/admin/steps"   variant="orange" />
      </section>

      {/* 内容分布 */}
      {!loading && steps.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3 text-stone-700 font-extrabold">
            <Filter className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
            <span className="text-sm">题型分布</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {breakdown.map((it) => (
              <div key={it.label} className={`rounded-2xl ${it.cls} border-2 px-4 py-3 shadow-pop bg-white/60 backdrop-blur-sm`}>
                <div className="flex items-center gap-2">
                  <span className="inline-grid place-items-center w-9 h-9 rounded-xl bg-white border border-current/20">
                    <it.Icon className="w-4 h-4" strokeWidth={2.5} />
                  </span>
                  <div className="text-2xl font-extrabold leading-none">{it.value}</div>
                </div>
                <div className="mt-2 text-xs font-extrabold opacity-80">{it.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 课程快捷入口 */}
      <section className="rounded-3xl bg-white/90 border-2 border-white shadow-pop overflow-hidden">
        <div className="px-5 py-3.5 font-extrabold text-stone-800 border-b-2 border-amber-100 bg-gradient-to-r from-brand-purple/8 to-brand-cyan/8 flex items-center justify-between flex-wrap gap-2">
          <span className="inline-flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
            课程列表（快速入口）
          </span>
          <Link
            href="/admin/courses"
            className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-purple hover:text-brand-blue"
          >
            去管理
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-stone-500 text-center font-bold">加载中…</div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="还没有课程"
            hint="点击右上角「新建课程」开始添加"
            action={
              <Link href="/admin/courses">
                <PrimaryButton variant="purple" icon={Plus}>新建第一门课程</PrimaryButton>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-amber-100">
            {courses.slice(0, 6).map((c) => {
              const lessonCount = lessons.filter((l) => l.courseId === c.id).length;
              return (
                <li key={c.id} className="px-5 py-3 flex items-center gap-3 hover:bg-amber-50/40 transition">
                  <span
                    className={
                      'inline-grid place-items-center w-9 h-9 rounded-xl border-2 ' +
                      (c.isActive
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-stone-100 text-stone-400 border-stone-200')
                    }
                  >
                    <BookOpen className="w-4 h-4" strokeWidth={2.5} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold text-stone-800 truncate">{c.title}</div>
                    <div className="text-xs text-stone-500 flex items-center gap-1.5 flex-wrap">
                      <span className="inline-block rounded-md bg-stone-100 text-stone-700 px-1.5 py-0.5 font-bold">{c.level}</span>
                      <span>{lessonCount} 课时</span>
                      <span>· 排序 {c.sortOrder}</span>
                    </div>
                  </div>
                  <Link
                    href={`/admin/lessons?courseId=${c.id}`}
                    className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-purple hover:text-brand-blue"
                  >
                    课时
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </Link>
                </li>
              );
            })}
            {courses.length > 6 && (
              <li className="px-5 py-2 text-center text-xs text-stone-500">
                还有 {courses.length - 6} 门课程…
              </li>
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
