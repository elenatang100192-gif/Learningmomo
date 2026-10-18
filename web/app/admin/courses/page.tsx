'use client';
import { useEffect, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Power, Image as ImageIcon, Sparkles, Inbox, Filter, Layers } from 'lucide-react';
import { adminApi, CourseDTO, LessonDTO, LessonPlacementDTO } from '@/lib/adminApi';
import {
  Field, inputClass, PrimaryButton, EmptyState, useToast, Drawer, PageHeader, SearchInput, RefreshButton, IconButton, StatusBadge,
} from '@/components/admin/AdminUI';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { CourseSceneEditor, PlacementItem } from '@/components/admin/CourseSceneEditor';

const LEVELS = ['K1', 'K2', 'K3', 'P1', 'P2'];

interface FormState {
  title: string;
  level: string;
  description: string;
  coverImage: string;
  introAudioUrl: string;
  keywordsText: string;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY: FormState = {
  title: '',
  level: 'K1',
  description: '',
  coverImage: '',
  introAudioUrl: '',
  keywordsText: '',
  sortOrder: 1,
  isActive: true,
};

export default function AdminCoursesPage() {
  const [list, setList] = useState<CourseDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const [keyword, setKeyword] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<CourseDTO | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'basic' | 'scene'>('basic');
  const [sceneImage, setSceneImage] = useState<string | null>(null);
  const [lessons, setLessons] = useState<LessonDTO[]>([]);
  const [placements, setPlacements] = useState<PlacementItem[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      setList(await adminApi.listCourses());
    } catch (e: any) {
      toast({ type: 'error', text: '加载失败：' + (e?.message ?? String(e)) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  function parseKeywords(text: string): string[] {
    return text.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY, sortOrder: list.length + 1 });
    setSceneImage(null);
    setLessons([]);
    setPlacements([]);
    setTab('basic');
    setDrawerOpen(true);
  }

  async function openEdit(c: CourseDTO) {
    setEditing(c);
    setForm({
      title: c.title,
      level: c.level,
      description: c.description ?? '',
      coverImage: c.coverImage ?? '',
      introAudioUrl: c.introAudioUrl ?? '',
      keywordsText: (c.keywords ?? []).join(', '),
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    });
    try {
      const ls = await adminApi.listLessons(c.id);
      setLessons(ls);
      const ps = ls
        .map((l) => l.placement)
        .filter((p): p is LessonPlacementDTO => !!p)
        .map<PlacementItem>((p) => ({
          lessonId: p.lessonId,
          x: p.x,
          y: p.y,
          audioUrl: p.audioUrl,
          color: p.color,
        }));
      setPlacements(ps);
    } catch {
      setLessons([]);
      setPlacements([]);
    }
    setSceneImage(c.sceneImageUrl ?? null);
    setTab('basic');
    setDrawerOpen(true);
  }

  async function submitForm() {
    if (!form.title.trim()) {
      toast({ type: 'error', text: '请填写标题' });
      return;
    }
    if (!editing) {
      setSaving(true);
      try {
        const payload = {
          title: form.title,
          level: form.level,
          description: form.description || undefined,
          coverImage: form.coverImage || undefined,
          introAudioUrl: form.introAudioUrl || undefined,
          sceneImageUrl: sceneImage || undefined,
          keywords: parseKeywords(form.keywordsText),
          sortOrder: form.sortOrder,
          isActive: form.isActive,
        };
        const created = await adminApi.createCourse(payload);
        toast({ type: 'success', text: '已新建课程' });
        setDrawerOpen(false);
        await refresh();
        await openEdit(created);
      } catch (e: any) {
        toast({ type: 'error', text: e?.message ?? String(e) });
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        level: form.level,
        description: form.description || undefined,
        coverImage: form.coverImage || undefined,
        introAudioUrl: form.introAudioUrl || undefined,
        sceneImageUrl: sceneImage || undefined,
        keywords: parseKeywords(form.keywordsText),
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };
      await adminApi.updateCourse(editing.id, payload);
      toast({ type: 'success', text: '已保存' });
      setDrawerOpen(false);
      await refresh();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function saveScene() {
    if (!editing) return;
    setSaving(true);
    try {
      await adminApi.updateCourse(editing.id, { sceneImageUrl: sceneImage });
      await adminApi.replaceCoursePlacements(editing.id, placements);
      toast({ type: 'success', text: '已保存场景画布' });
      setDrawerOpen(false);
      await refresh();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  }

  async function remove(c: CourseDTO) {
    if (!confirm(`确认删除课程「${c.title}」？其下所有课时/步骤都会一起删除。`)) return;
    try {
      await adminApi.deleteCourse(c.id);
      toast({ type: 'success', text: '已删除' });
      await refresh();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    }
  }

  async function toggleActive(c: CourseDTO) {
    try {
      await adminApi.updateCourse(c.id, { isActive: !c.isActive });
      await refresh();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? String(e) });
    }
  }

  const filtered = list.filter((c) => {
    if (levelFilter && c.level !== levelFilter) return false;
    if (keyword) {
      const k = keyword.toLowerCase();
      return c.title.toLowerCase().includes(k) || (c.description ?? '').toLowerCase().includes(k);
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="课程管理"
        subtitle="K1 ~ P2 共 5 个等级。在前台按 sortOrder 升序展示。"
        icon={BookOpen}
        actions={
          <PrimaryButton onClick={openCreate} variant="purple" size="lg" icon={Plus}>
            新建课程
          </PrimaryButton>
        }
      />

      {/* 筛选条 */}
      <div className="rounded-2xl bg-white/90 border-2 border-white shadow-pop px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <SearchInput
          value={keyword}
          onChange={setKeyword}
          placeholder="搜索标题或简介…"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setLevelFilter('')}
            className={
              'rounded-xl px-3 py-1.5 text-xs font-extrabold border-2 transition ' +
              (!levelFilter
                ? 'bg-brand-purple text-white border-brand-purple'
                : 'bg-white text-stone-600 border-amber-200 hover:border-brand-purple')
            }
          >
            全部
          </button>
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevelFilter(l)}
              className={
                'rounded-xl px-3 py-1.5 text-xs font-extrabold border-2 transition ' +
                (levelFilter === l
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'bg-white text-stone-600 border-amber-200 hover:border-brand-purple')
              }
            >
              {l}
            </button>
          ))}
        </div>
        <div className="text-xs text-stone-500 ml-auto font-extrabold flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" strokeWidth={2.5} />
          共 <span className="text-stone-800">{filtered.length}</span> / {list.length} 门
        </div>
        <RefreshButton onClick={refresh} />
      </div>

      {/* 列表：卡片网格 */}
      {loading ? (
        <div className="rounded-3xl bg-white/90 border-2 border-white shadow-pop p-10 text-stone-500 text-center font-extrabold">
          加载中…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl bg-white/90 border-2 border-white shadow-pop">
          <EmptyState
            icon={Inbox}
            title={list.length === 0 ? '还没有课程' : '没有匹配的课程'}
            hint={list.length === 0 ? '点击右上角「新建课程」开始添加' : '试试修改搜索条件'}
            action={
              list.length === 0 ? (
                <PrimaryButton onClick={openCreate} variant="purple" icon={Plus}>
                  新建第一门课程
                </PrimaryButton>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const kws = c.keywords ?? [];
            return (
              <article
                key={c.id}
                className="group relative rounded-3xl bg-white/95 border-2 border-white shadow-pop overflow-hidden hover:-translate-y-0.5 transition"
              >
                {/* 顶部渐变条 */}
                <div className="h-1.5 bg-gradient-to-r from-brand-purple via-brand-blue to-brand-cyan" />
                {/* 封面 */}
                <div className="relative aspect-[16/9] bg-gradient-to-br from-brand-purple/10 to-brand-cyan/10 grid place-items-center overflow-hidden">
                  {c.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverImage} alt={c.title} className="w-full h-full object-contain" />
                  ) : (
                    <BookOpen className="w-12 h-12 text-brand-purple/40" strokeWidth={2} />
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm border-2 border-white px-2 py-0.5 text-[10px] font-extrabold text-stone-700 shadow-pop">
                      <Layers className="w-3 h-3" strokeWidth={2.5} />
                      {c.level}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur-sm border-2 border-white px-2 py-0.5 text-[10px] font-extrabold text-stone-700 shadow-pop">
                      #{c.sortOrder}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <button onClick={() => toggleActive(c)} title="点击切换状态">
                      <StatusBadge active={c.isActive} />
                    </button>
                  </div>
                </div>
                {/* 内容 */}
                <div className="p-4">
                  <h3 className="font-extrabold text-stone-800 text-lg leading-snug line-clamp-1">{c.title}</h3>
                  <p className="text-xs text-stone-500 mt-1 line-clamp-2 min-h-[32px]">
                    {c.description || '（无简介）'}
                  </p>
                  {kws.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {kws.slice(0, 4).map((k) => (
                        <span key={k} className="inline-block rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-extrabold">
                          {k}
                        </span>
                      ))}
                      {kws.length > 4 && (
                        <span className="text-[10px] text-stone-400 self-center">+{kws.length - 4}</span>
                      )}
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t-2 border-amber-100 pt-3">
                    <div className="flex items-center gap-1.5 text-xs text-stone-500 font-bold">
                      <ImageIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {c.sceneImageUrl ? '已配场景' : '未配场景'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <IconButton icon={Pencil} onClick={() => openEdit(c)} label="编辑" variant="purple" size="sm" />
                      <IconButton icon={Trash2} onClick={() => remove(c)} label="删除" variant="rose" size="sm" />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 抽屉：新建/编辑 */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? `编辑课程：${editing.title}` : '新建课程'}
        icon={editing ? Pencil : Plus}
        width={tab === 'scene' ? 920 : 560}
        footer={
          tab === 'basic' ? (
            <>
              <PrimaryButton variant="stone" onClick={() => setDrawerOpen(false)}>取消</PrimaryButton>
              <PrimaryButton variant="purple" onClick={submitForm} disabled={saving} icon={Sparkles}>
                {saving ? '保存中…' : editing ? '保存' : '创建'}
              </PrimaryButton>
            </>
          ) : (
            <>
              <PrimaryButton variant="stone" onClick={() => setDrawerOpen(false)}>关闭</PrimaryButton>
              <PrimaryButton variant="purple" onClick={saveScene} disabled={saving || !editing} icon={Sparkles}>
                {saving ? '保存中…' : '保存场景'}
              </PrimaryButton>
            </>
          )
        }
      >
        {/* Tab 切换 */}
        <div className="flex gap-1 mb-4 border-b-2 border-amber-200 -mt-1">
          <button
            type="button"
            onClick={() => setTab('basic')}
            className={[
              'px-3 py-2 text-sm font-extrabold border-b-4 -mb-0.5 transition',
              tab === 'basic' ? 'border-brand-purple text-brand-purple' : 'border-transparent text-stone-400 hover:text-stone-600',
            ].join(' ')}
          >
            <Pencil className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" strokeWidth={2.5} />
            基本信息
          </button>
          <button
            type="button"
            onClick={() => setTab('scene')}
            disabled={!editing}
            className={[
              'px-3 py-2 text-sm font-extrabold border-b-4 -mb-0.5 transition disabled:opacity-40',
              tab === 'scene' ? 'border-brand-purple text-brand-purple' : 'border-transparent text-stone-400 hover:text-stone-600',
            ].join(' ')}
            title={!editing ? '请先保存基本信息' : '切换到场景画布'}
          >
            <ImageIcon className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" strokeWidth={2.5} />
            场景画布
          </button>
        </div>

        {tab === 'basic' && (
          <div className="space-y-4">
            <Field label="标题" required icon={BookOpen}>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputClass}
                placeholder="如：Topic 1 Animals"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="等级" hint="K1~P2 共 5 档" icon={Layers}>
                <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={inputClass}>
                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="排序" hint="数字越小越靠前" icon={Filter}>
                <input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="简介" hint="一句话介绍，会显示在课程卡下方">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass}
                placeholder="如：认识 8 种可爱的小动物"
              />
            </Field>
            <Field label="封面图路径" hint="支持 /img/xxx.svg 或七牛 https URL" icon={ImageIcon}>
              <input
                value={form.coverImage}
                onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                className={inputClass}
                placeholder="/img/course-animals.svg"
              />
              {form.coverImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.coverImage} alt="" className="mt-2 h-20 rounded-xl border border-amber-200 object-contain bg-amber-50" />
              )}
            </Field>
            <Field label="课程介绍音频" hint="学生端进入该课程 tab 时自动播放；支持 mp3 / wav / m4a / aac">
              <MediaUploader
                value={form.introAudioUrl}
                onChange={(url) => setForm({ ...form, introAudioUrl: url ?? '' })}
                type="audio"
              />
            </Field>
            <Field label="关键词气泡" hint="前台课程页底部的气泡胶囊，用英文逗号或换行分隔">
              <input
                value={form.keywordsText}
                onChange={(e) => setForm({ ...form, keywordsText: e.target.value })}
                className={inputClass}
                placeholder="Hello, Name, Happy"
              />
            </Field>
            <Field label="状态" icon={Power}>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-5 h-5 accent-emerald-600"
                />
                <span className="text-sm font-bold text-stone-700">启用（前台可见）</span>
              </label>
            </Field>
          </div>
        )}

        {tab === 'scene' && editing && (
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border-2 border-amber-200 px-3 py-2 text-xs text-amber-800 font-bold">
              提示：先添加本课程的 lesson（用顶部「课时」页），然后在画布上拖动每个 lesson 气泡到想要的位置。
            </div>
            <CourseSceneEditor
              courseTitle={editing.title}
              sceneImageUrl={sceneImage}
              lessons={lessons}
              placements={placements}
              onChange={(v) => {
                setSceneImage(v.sceneImageUrl);
                setPlacements(v.placements);
              }}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}
