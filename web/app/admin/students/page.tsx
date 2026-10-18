'use client';
import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Edit3, Search, Check, X, BarChart3 } from 'lucide-react';
import { adminApi, StudentAccountDTO } from '@/lib/adminApi';
import {
  PageHeader, PrimaryButton, useToast, Field, inputClass, EmptyState, StatCard, SearchInput, RefreshButton,
} from '@/components/admin/AdminUI';

function StatusPill({ status }: { status: 'ACTIVE' | 'DISABLED' }) {
  if (status === 'ACTIVE') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-bold border border-emerald-200">
        ● 启用
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-500 px-2.5 py-0.5 text-xs font-bold border border-stone-200">
      ○ 停用
    </span>
  );
}

interface FormState {
  phone: string;
  name: string;
  grade: string;
  note: string;
}
const EMPTY: FormState = { phone: '', name: '', grade: '', note: '' };

export default function AdminStudentsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<StudentAccountDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<StudentAccountDTO | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [reportFor, setReportFor] = useState<StudentAccountDTO | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await adminApi.listStudents(q || undefined);
      setRows(data);
    } catch (e: any) {
      toast({ type: 'error', text: '加载失败：' + (e?.message ?? String(e)) });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  }
  function openEdit(s: StudentAccountDTO) {
    setEditing(s);
    setForm({ phone: s.phone, name: s.name || '', grade: s.grade || '', note: s.note || '' });
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY);
  }

  async function submitForm() {
    if (!/^1[3-9]\d{9}$/.test(form.phone)) {
      toast({ type: 'error', text: '手机号格式不正确' });
      return;
    }
    try {
      if (editing) {
        await adminApi.updateStudent(editing.id, {
          phone: form.phone,
          name: form.name,
          grade: form.grade,
          note: form.note,
        });
        toast({ type: 'success', text: '已更新' });
      } else {
        await adminApi.createStudent({
          phone: form.phone,
          name: form.name,
          grade: form.grade,
          note: form.note,
        });
        toast({ type: 'success', text: '已添加' });
      }
      closeForm();
      load();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? '保存失败' });
    }
  }

  async function toggleStatus(s: StudentAccountDTO) {
    const next = s.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await adminApi.updateStudent(s.id, { status: next });
      toast({ type: 'success', text: next === 'ACTIVE' ? '已启用' : '已停用' });
      load();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? '操作失败' });
    }
  }

  async function remove(s: StudentAccountDTO) {
    if (!confirm(`确认删除 ${s.name || s.phone}？该账号的学习进度数据也会保留（可后续按需清理）。`)) return;
    try {
      await adminApi.deleteStudent(s.id);
      toast({ type: 'success', text: '已删除' });
      load();
    } catch (e: any) {
      toast({ type: 'error', text: e?.message ?? '删除失败' });
    }
  }

  const totals = {
    total: rows.length,
    active: rows.filter((r) => r.status === 'ACTIVE').length,
    disabled: rows.filter((r) => r.status === 'DISABLED').length,
    withProgress: rows.filter((r) => r.progressCount > 0).length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="学生账号"
        subtitle="后台手动添加手机号，只有添加过的手机号才能登录学生端并保存学习进度。"
        icon={Users}
        actions={
          <PrimaryButton variant="purple" icon={Plus} onClick={openCreate}>
            添加学生
          </PrimaryButton>
        }
      />

      {/* 数据卡片 */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="账号总数" value={loading ? '…' : totals.total} icon={Users} variant="purple" />
        <StatCard label="启用中"   value={loading ? '…' : totals.active} icon={Check} variant="cyan" />
        <StatCard label="已停用"   value={loading ? '…' : totals.disabled} icon={X} variant="orange" />
        <StatCard label="有学习记录" value={loading ? '…' : totals.withProgress} icon={BarChart3} variant="purple" />
      </section>

      {/* 搜索 */}
      <div className="rounded-3xl bg-white/90 border-2 border-white shadow-pop p-3 flex items-center gap-2 flex-wrap">
        <SearchInput value={q} onChange={setQ} placeholder="搜索手机号 / 姓名 / 班级" />
        <PrimaryButton variant="sky" onClick={load} icon={Search}>搜索</PrimaryButton>
        <RefreshButton onClick={load} />
      </div>

      {/* 列表 */}
      <section className="rounded-3xl bg-white/90 border-2 border-white shadow-pop overflow-hidden">
        {loading ? (
          <div className="p-8 text-stone-500 text-center font-bold">加载中…</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="还没有学生账号"
            hint="点击右上角「添加学生」开始添加手机号"
            action={
              <PrimaryButton variant="purple" icon={Plus} onClick={openCreate}>
                添加第一个学生
              </PrimaryButton>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-stone-500 border-b-2 border-amber-100">
                  <th className="px-4 py-3 font-extrabold">手机号</th>
                  <th className="px-4 py-3 font-extrabold">姓名</th>
                  <th className="px-4 py-3 font-extrabold">班级</th>
                  <th className="px-4 py-3 font-extrabold">状态</th>
                  <th className="px-4 py-3 font-extrabold text-right">完成/尝试</th>
                  <th className="px-4 py-3 font-extrabold text-right">总星</th>
                  <th className="px-4 py-3 font-extrabold">最近活跃</th>
                  <th className="px-4 py-3 font-extrabold text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-amber-50 hover:bg-amber-50/30">
                    <td className="px-4 py-3 font-extrabold text-stone-800">{s.phone}</td>
                    <td className="px-4 py-3 text-stone-700">{s.name || '—'}</td>
                    <td className="px-4 py-3 text-stone-700">{s.grade || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-stone-700 font-bold">
                      <span className="text-emerald-700">{s.completedLessons}</span>
                      <span className="text-stone-400"> / </span>
                      <span>{s.attemptCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 font-extrabold">⭐ {s.totalStars}</td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => setReportFor(s)}
                          className="inline-grid place-items-center w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                          title="查看进度"
                        >
                          <BarChart3 className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => openEdit(s)}
                          className="inline-grid place-items-center w-8 h-8 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
                          title="编辑"
                        >
                          <Edit3 className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => toggleStatus(s)}
                          className="inline-grid place-items-center w-8 h-8 rounded-lg bg-stone-50 text-stone-700 border border-stone-200 hover:bg-stone-100"
                          title={s.status === 'ACTIVE' ? '停用' : '启用'}
                        >
                          {s.status === 'ACTIVE' ? <X className="w-4 h-4" strokeWidth={2.5} /> : <Check className="w-4 h-4" strokeWidth={2.5} />}
                        </button>
                        <button
                          onClick={() => remove(s)}
                          className="inline-grid place-items-center w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2.5} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 新增 / 编辑 抽屉 */}
      {showForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={closeForm}>
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-pop border-4 border-amber-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-extrabold text-stone-800">
              {editing ? '编辑学生' : '添加学生'}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              添加后，该手机号即可在学生端通过验证码 123456 登录。
            </div>
            <div className="mt-4 space-y-3">
              <Field label="手机号 *">
                <input
                  inputMode="numeric"
                  maxLength={11}
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                  placeholder="11 位手机号"
                />
              </Field>
              <Field label="姓名">
                <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="学生姓名" />
              </Field>
              <Field label="班级 / 年级">
                <input className={inputClass} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} placeholder="如 三年级 1 班" />
              </Field>
              <Field label="备注">
                <textarea
                  className={inputClass + ' min-h-[64px]'}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="可选"
                />
              </Field>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button onClick={closeForm} className="btn-kid bg-stone-200 text-stone-700">取消</button>
              <PrimaryButton variant="purple" onClick={submitForm}>
                {editing ? '保存' : '添加'}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* 进度报表 */}
      {reportFor && <StudentReportDrawer student={reportFor} onClose={() => setReportFor(null)} />}
    </div>
  );
}

function StudentReportDrawer({ student, onClose }: { student: StudentAccountDTO; onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const r = await adminApi.getStudentReport(student.id);
        setData(r);
      } catch (e) {
        setData({ error: String(e) });
      } finally {
        setLoading(false);
      }
    })();
  }, [student.id]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-pop border-4 border-amber-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-xl font-extrabold text-stone-800">
              {student.name || student.phone} · 学习进度
            </div>
            <div className="text-xs text-stone-500 mt-0.5">
              {student.phone} · {student.grade || '未填班级'}
            </div>
          </div>
          <button onClick={onClose} className="btn-kid bg-stone-200 text-stone-700">关闭</button>
        </div>

        {loading ? (
          <div className="p-8 text-stone-500 text-center font-bold">加载中…</div>
        ) : data?.error ? (
          <div className="p-6 text-rose-600">{data.error}</div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="总星" value={data.totalStars} icon={BarChart3} variant="orange" />
              <StatCard label="完成课" value={data.completedLessons} icon={Check} variant="cyan" />
              <StatCard label="总弹题尝试" value={data.totalAttempts} icon={Edit3} variant="purple" />
              <StatCard
                label="最后活跃"
                value={data.lastActiveAt ? new Date(data.lastActiveAt).toLocaleDateString() : '—'}
                icon={Users}
                variant="purple"
              />
            </div>

            <div className="mt-4 space-y-3">
              {data.summary.length === 0 ? (
                <div className="p-6 text-stone-500 text-center">暂无课程数据</div>
              ) : data.summary.map((c: any) => (
                <div key={c.courseId} className="rounded-2xl border-2 border-amber-100 overflow-hidden">
                  <div className="px-4 py-2 bg-gradient-to-r from-brand-purple/8 to-brand-cyan/8 flex items-center gap-2">
                    <span className="inline-block rounded-md bg-stone-100 text-stone-700 px-1.5 py-0.5 text-xs font-extrabold">
                      {c.level}
                    </span>
                    <div className="font-extrabold text-stone-800 flex-1">{c.title}</div>
                    <div className="text-xs font-extrabold text-stone-600">
                      {c.completed}/{c.total} 课 · ⭐ {c.stars} · {c.rate}%
                    </div>
                  </div>
                  {c.lessons.length > 0 && (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-stone-500 border-b border-amber-100">
                          <th className="px-3 py-2 font-extrabold">课时</th>
                          <th className="px-3 py-2 font-extrabold">状态</th>
                          <th className="px-3 py-2 font-extrabold text-right">星</th>
                          <th className="px-3 py-2 font-extrabold text-right">步骤答对</th>
                          <th className="px-3 py-2 font-extrabold">最近</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.lessons.map((l: any) => {
                          const totalCorrect = l.steps.reduce((s: number, x: any) => s + x.correctCount, 0);
                          const totalAttempts = l.steps.reduce((s: number, x: any) => s + x.attemptCount, 0);
                          return (
                            <tr key={l.lessonId} className="border-b border-amber-50">
                              <td className="px-3 py-2 font-bold text-stone-800">{l.title}</td>
                              <td className="px-3 py-2">
                                {l.status === 'COMPLETED' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-bold border border-emerald-200">
                                    ● 完成
                                  </span>
                                ) : l.status === 'UNLOCKED' ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 px-2.5 py-0.5 text-xs font-bold border border-amber-200">
                                    ● 进行中
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-500 px-2.5 py-0.5 text-xs font-bold border border-stone-200">
                                    ○ 未解锁
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right text-amber-600 font-extrabold">{l.starsEarned || 0}</td>
                              <td className="px-3 py-2 text-right text-stone-700 font-bold">
                                <span className="text-emerald-700">{totalCorrect}</span>
                                <span className="text-stone-400"> / {totalAttempts}</span>
                              </td>
                              <td className="px-3 py-2 text-stone-500 text-xs">
                                {l.lastSeenAt ? new Date(l.lastSeenAt).toLocaleString() : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
