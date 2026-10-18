'use client';
// 学员端"我的"页面：展示学生账号信息 + 个人学习进度（英文文案）
// 顶部：头像 / 名字 / 年级 / Bio
// 中部：Stats 卡片（4 个英文指标：Lessons Completed / Stars Earned / In Progress / Streak）
// 底部：Recent Lessons 列表（最近 3 条完成记录）
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { api, LearningSummaryDTO } from '@/lib/api';
import { isStudentLoggedIn, getStudentPhone, getStudentName, getStudentUserId, clearStudentAuth } from '@/lib/auth';
import { Star, Trophy, BookOpen, Mic } from 'lucide-react';

interface MeDTO {
  id: string;
  phone: string;
  name: string | null;
  grade: string | null;
}

interface ProgressItem {
  id: string;
  lessonId: string;
  status: 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
  starsEarned: number;
  updatedAt: string;
  lesson: { id: string; title: string; level: string; unitNo: number; lessonNo: number };
}

// 英文名首字母 → 头像 emoji
function avatarFor(name?: string | null): string {
  if (!name) return '🙂';
  const n = name.trim().toLowerCase();
  const map: Record<string, string> = {
    a: '🦊', b: '🐻', c: '🐱', d: '🐶', e: '🐼', f: '🐯', g: '🦁',
    h: '🐰', i: '🐨', j: '🐸', k: '🐵', l: '🐮', m: '🐷', n: '🐹',
    o: '🐭', p: '🐔', q: '🐧', r: '🐦', s: '🐤', t: '🦄', u: '🐢',
    v: '🐬', w: '🦉', x: '🐺', y: '🦒', z: '🦓',
  };
  return map[n[0]] ?? '🙂';
}

function makeBio(name: string | null, grade: string | null): string {
  const who = name ? `${name}` : 'A young learner';
  const where = grade ? `from ${grade}` : 'on a learning journey';
  return `Hi! I'm ${who}, ${where}. I love exploring English through songs, stories, and games.`;
}

// Score emoji based on percentage
function getScoreEmoji(score: number): string {
  if (score >= 90) return '🌟';
  if (score >= 80) return '⭐';
  if (score >= 70) return '✨';
  if (score >= 60) return '👍';
  return '💪';
}

export default function ProfilePage() {
  const router = useRouter();
  const [logged, setLogged] = useState(false);
  const [me, setMe] = useState<MeDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // 进度数据
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);

  // 学习总结数据
  const [learningSummaries, setLearningSummaries] = useState<LearningSummaryDTO[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(true);

  useEffect(() => {
    if (!isStudentLoggedIn()) {
      router.replace('/student/login');
      return;
    }
    setLogged(true);
    api.studentGetMe()
      .then((res) => setMe(res))
      .catch((e) => setErr(e?.message ?? 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!logged) return;
    setProgressLoading(true);
    api
      .listProgress()
      .then((res) => setProgress(res.progress ?? []))
      .catch(() => setProgress([]))
      .finally(() => setProgressLoading(false));
  }, [logged]);

  // 加载学习总结
  useEffect(() => {
    if (!logged) return;
    setSummariesLoading(true);
    api.getAllLearningSummaries()
      .then((res) => {
        setLearningSummaries(res.summaries ?? []);
      })
      .catch(() => setLearningSummaries([]))
      .finally(() => setSummariesLoading(false));
  }, [logged]);

  if (!logged) return null;

  const name = me?.name ?? getStudentName() ?? null;
  const phone = me?.phone ?? getStudentPhone() ?? '';
  const grade = me?.grade ?? null;
  const avatar = avatarFor(name);
  const bio = makeBio(name, grade);

  // === 进度聚合 ===
  const completed = progress.filter((p) => p.status === 'COMPLETED');
  const inProgress = progress.filter((p) => p.status === 'UNLOCKED');
  const totalStars = completed.reduce((s, p) => s + (p.starsEarned || 0), 0);
  // 找出最近完成时间（updatedAt 最新的 completed 记录所在日期）
  const lastDone = completed
    .slice()
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
  const streakDays = lastDone ? daysSince(lastDone.updatedAt) : null;
  // Current Level：取最近完成课程的 level
  const currentLevel = lastDone?.lesson.level ?? progress[0]?.lesson.level ?? grade ?? '—';

  return (
    <AppShell>
      <div className="page-grid mt-4 sm:mt-6">
        {/* ===== 顶部 Profile 卡片 ===== */}
        <div className="rounded-3xl bg-white border-4 border-amber-200 shadow-pop overflow-hidden">
          <div
            className="h-28 sm:h-32 relative"
            style={{ background: 'linear-gradient(135deg, #FFD4B0 0%, #F58C76 50%, #A48AF0 100%)' }}
          >
            <div className="absolute -bottom-12 left-6 sm:left-8">
              <div
                className="size-24 sm:size-28 rounded-full grid place-items-center text-5xl sm:text-6xl bg-white border-4 border-amber-200 shadow-pop"
                aria-label="avatar"
              >
                {avatar}
              </div>
            </div>
          </div>

          <div className="pt-16 sm:pt-16 px-6 sm:px-8 pb-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-800">
                {name || 'New friend'}
              </h1>
              {grade && (
                <span className="text-sm sm:text-base font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  {grade}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.18em] text-stone-400">
              My Profile
            </p>
          </div>

          <div className="px-6 sm:px-8 pb-4">
            <p className="text-stone-600 text-sm sm:text-base leading-relaxed">{bio}</p>
          </div>

          <div className="px-6 sm:px-8 pb-6">
            <Row label="Phone" value={phone} />
          </div>

          {err && (
            <div className="mx-6 sm:mx-8 mb-4 text-rose-600 text-sm font-bold">{err}</div>
          )}
        </div>

        {/* ===== 学习进度区（英文文案） ===== */}
        <div className="rounded-3xl bg-white border-4 border-violet-200 shadow-pop p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-extrabold text-stone-800">My Learning</h2>
            <button
              onClick={() => router.push('/')}
              className="text-xs font-extrabold uppercase tracking-wider text-violet-600 hover:text-violet-800"
            >
              Continue →
            </button>
          </div>

          {progressLoading ? (
            <SkeletonGrid />
          ) : progress.length === 0 ? (
            <EmptyState onStart={() => router.push('/')} />
          ) : (
            <>
              {/* 4 个统计卡（英文） */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <StatCard
                  icon="📚"
                  label="Lessons Completed"
                  value={completed.length.toString()}
                  tint="bg-emerald-50 text-emerald-700"
                />
                <StatCard
                  icon="⭐"
                  label="Stars Earned"
                  value={totalStars.toString()}
                  tint="bg-amber-50 text-amber-700"
                />
                <StatCard
                  icon="🚀"
                  label="In Progress"
                  value={inProgress.length.toString()}
                  tint="bg-sky-50 text-sky-700"
                />
                <StatCard
                  icon="🔥"
                  label={streakDays === null ? 'Streak' : streakDays === 0 ? 'Today' : `${streakDays}d ago`}
                  value={currentLevel}
                  tint="bg-rose-50 text-rose-700"
                  sub={streakDays === null ? 'Start today!' : 'Last lesson'}
                />
              </div>

              {/* 最近完成 */}
              {completed.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-xs font-extrabold uppercase tracking-[0.18em] text-stone-400 mb-2">
                    Recent Lessons
                  </h3>
                  <ul className="space-y-2">
                    {completed
                      .slice()
                      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
                      .slice(0, 3)
                      .map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between rounded-2xl bg-stone-50 border border-stone-100 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="font-extrabold text-stone-700 truncate">
                              {p.lesson.title}
                            </p>
                            <p className="text-xs text-stone-400">
                              {p.lesson.level} · Unit {p.lesson.unitNo} · Lesson {p.lesson.lessonNo}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-amber-500 font-extrabold shrink-0">
                            {Array.from({ length: 3 }).map((_, i) => (
                              <span key={i} className={i < p.starsEarned ? '' : 'opacity-20'}>
                                ⭐
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* ===== Learning Summary 区域 - 显示 AI 生成的学习报告 ===== */}
        {learningSummaries.length > 0 && (
          <div className="rounded-3xl bg-gradient-to-br from-purple-50 via-pink-50 to-amber-50 border-4 border-purple-200 shadow-pop p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📊</span>
                <h2 className="text-lg sm:text-xl font-extrabold text-stone-800">Learning Reports</h2>
              </div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-purple-600">
                {learningSummaries.length} Reports
              </span>
            </div>

            <div className="space-y-4">
              {learningSummaries.slice(0, 5).map((summary) => (
                <LearningReportCard key={summary.id} summary={summary} />
              ))}
            </div>

            {learningSummaries.length > 5 && (
              <button
                onClick={() => {
                  // 可以添加查看更多的功能
                }}
                className="mt-4 w-full py-2 rounded-2xl bg-white border-2 border-purple-200 text-purple-600 font-extrabold text-sm hover:bg-purple-50 transition"
              >
                View all {learningSummaries.length} reports →
              </button>
            )}
          </div>
        )}

        {/* ===== 操作按钮 ===== */}
        <div className="space-y-2">
          <button
            onClick={() => router.push('/')}
            className="w-full py-3 rounded-2xl bg-amber-400 text-white font-extrabold text-base shadow-pop hover:scale-[1.01] active:scale-[0.99] transition"
          >
            Keep Learning →
          </button>
          <button
            onClick={() => {
              if (
                !confirm(
                  'Sign out of this student account? Your progress stays in the cloud.',
                )
              )
                return;
              clearStudentAuth();
              router.push('/student/login');
            }}
            className="w-full py-3 rounded-2xl bg-stone-100 text-stone-600 font-extrabold text-base hover:bg-stone-200 transition"
          >
            Sign out
          </button>
        </div>
      </div>
    </AppShell>
  );
}

// 学习报告卡片组件
function LearningReportCard({ summary }: { summary: LearningSummaryDTO }) {
  const [expanded, setExpanded] = useState(false);
  
  const date = new Date(summary.completedAt);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  return (
    <div 
      className="rounded-2xl bg-white/90 border-2 border-purple-200 overflow-hidden transition-all hover:shadow-md cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      {/* 卡片头部 */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-stone-800 truncate">
              {summary.lessonTitle}
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              {dateStr} · {summary.stepResults.length} steps
            </p>
          </div>
          
          {/* 分数徽章 */}
          <div className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-extrabold ${
            summary.overallScore >= 80 
              ? 'bg-emerald-100 text-emerald-700' 
              : summary.overallScore >= 60
              ? 'bg-amber-100 text-amber-700'
              : 'bg-rose-100 text-rose-700'
          }`}>
            <span>{getScoreEmoji(summary.overallScore)}</span>
            <span>{summary.overallScore}%</span>
          </div>
        </div>
        
        {/* 星星进度 */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all"
              style={{ width: `${(summary.totalStars / summary.maxStars) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-amber-600">
            <Star className="w-4 h-4 fill-amber-400" />
            <span className="text-xs font-extrabold">{summary.totalStars}/{summary.maxStars}</span>
          </div>
        </div>
      </div>
      
      {/* 展开内容 */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-purple-100 pt-3 space-y-3">
          {/* AI 总结文字 */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-3">
            <p className="text-sm text-stone-700 leading-relaxed">
              {summary.summaryText}
            </p>
          </div>
          
          {/* Strengths */}
          {summary.strengths.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-emerald-500 text-lg">✨</span>
              <div className="flex-1">
                <p className="text-xs font-extrabold text-emerald-700 uppercase mb-1">Strengths</p>
                <ul className="space-y-0.5">
                  {summary.strengths.slice(0, 2).map((s, i) => (
                    <li key={i} className="text-xs text-stone-600 flex items-start gap-1">
                      <span className="text-emerald-400">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          
          {/* Speaking Analysis */}
          {summary.speakingAnalysis && (
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-extrabold text-blue-700 uppercase">Speaking Report</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-600">Avg Score:</span>
                <span className="font-extrabold text-blue-700">
                  {summary.speakingAnalysis.averageScore.toFixed(1)}/3 ⭐
                </span>
              </div>
              {summary.speakingAnalysis.tips.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  💡 {summary.speakingAnalysis.tips[0]}
                </p>
              )}
            </div>
          )}
          
          {/* Tips */}
          {summary.suggestions.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-amber-500 text-lg">💡</span>
              <div className="flex-1">
                <p className="text-xs font-extrabold text-amber-700 uppercase mb-1">Tips</p>
                <ul className="space-y-0.5">
                  {summary.suggestions.slice(0, 2).map((s, i) => (
                    <li key={i} className="text-xs text-stone-600 flex items-start gap-1">
                      <span className="text-amber-400">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* 展开提示 */}
      <div className="px-4 pb-3 text-center">
        <span className="text-xs text-stone-400">
          {expanded ? '▲ Tap to collapse' : '▼ Tap to see details'}
        </span>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  tint: string;
  sub?: string;
}) {
  return (
    <div className={`rounded-2xl p-4 ${tint}`}>
      <div className="text-2xl mb-1" aria-hidden>
        {icon}
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold leading-none">{value}</div>
      <div className="mt-1 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider opacity-80">
        {label}
      </div>
      {sub && <div className="mt-0.5 text-[10px] font-bold opacity-60">{sub}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-amber-100">
      <span className="text-xs font-extrabold uppercase tracking-wider text-stone-400">
        {label}
      </span>
      <span className="text-sm font-extrabold text-stone-700">{value}</span>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-stone-100 animate-pulse h-24" />
      ))}
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center py-6">
      <div className="text-5xl mb-2" aria-hidden>
        🌱
      </div>
      <p className="font-extrabold text-stone-700 mb-1">No lessons yet</p>
      <p className="text-sm text-stone-500 mb-4">
        Start your first lesson and your progress will appear here.
      </p>
      <button
        onClick={onStart}
        className="px-5 py-2 rounded-2xl bg-amber-400 text-white font-extrabold shadow-pop hover:scale-[1.02] active:scale-[0.98] transition"
      >
        Start now →
      </button>
    </div>
  );
}

// 距今天 N 天
function daysSince(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  return Math.max(0, Math.floor((+now - +d) / 86_400_000));
}
