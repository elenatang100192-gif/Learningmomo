'use client';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, LessonDTO, StepDTO, StepType } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { VideoStep } from '@/components/lesson/VideoStep';
import { ImageStep } from '@/components/lesson/ImageStep';
import { QuizStep } from '@/components/lesson/QuizStep';
import { BridgeStep } from '@/components/lesson/BridgeStep';
import { TestStep } from '@/components/lesson/TestStep';
import { VideoLabStep } from '@/components/lesson/VideoLabStep';
import { ImageSafariStep } from '@/components/lesson/ImageSafariStep';
import { TraceStep } from '@/components/lesson/TraceStep';
import { GrassHill } from '@/components/layout/SkyDecor';
import { LearningSummaryCard, PreviousAnswerDisplay } from '@/components/lesson/LearningSummaryCard';
import { useLearningRecord, type StepAnswer, type LearningSummary } from '@/lib/useLearningRecord';

// 没填自定义名称时的兜底中文名（学员端进度条显示用）
const DEFAULT_STEP_NAME: Record<StepType, string> = {
  VIDEO: 'Watch Video',
  IMAGE: 'Look at Picture',
  QUIZ: 'Quiz',
  BRIDGE: 'In-Between',
  TEST: 'Multi-Quiz',
  VIDEO_LAB: 'Speak Up',
  IMAGE_SAFARI: 'Safari Hunt',
  TRACE: 'Trace',
};
function stepDisplayName(s: StepDTO | undefined): string {
  if (!s) return '';
  const n = (s.name ?? '').trim();
  return n || DEFAULT_STEP_NAME[s.type] || 'Step';
}

// IMAGE step 用的自动推进定时器：图片 step 没有"下一步"按钮，
// 等一个固定时长（音频也基本能放完）后自动切下一个 step。
function ImageAutoNext_REMOVED() { return null; } // 占位避免被 lint 警告 — 已废弃，ImageStep 自管

// 胶囊线进度条：横线 + 圆点（无数字，无步骤名）
// 当前：白底 + 深紫描边 + 凸起
// 已完成：白底 + 深紫描边 + 深紫勾
// 未完成：半透白底 + 白描边
function StepDots({
  steps, current,
}: {
  steps: StepDTO[];
  current: number;
}) {
  const total = steps.length;
  // 当前圆点中心在水平方向上的百分比位置
  const dotPct = total <= 1 ? 50 : (current / (total - 1)) * 100;
  return (
    <div
      className="w-full"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current + 1}
    >
      {/* 轨道样式：内嵌灰槽 + 紫色进度 + 立体的圆点节点 */}
      <div className="relative w-full h-8 px-1.5">
        {/* ① 凹槽（轨道底）：淡紫底 + 内阴影 + 暗色描边，模拟凹陷金属轨 */}
        <div
          className="absolute left-1.5 right-1.5 top-1/2 -translate-y-1/2 h-[8px] rounded-full"
          aria-hidden
          style={{
            background: 'linear-gradient(180deg, #E3D9F5 0%, #D8C9F0 100%)',
            boxShadow:
              'inset 0 1px 2px rgba(60,40,120,0.18), inset 0 -1px 0 rgba(255,255,255,0.6), 0 1px 0 rgba(255,255,255,0.7)',
          }}
        />
        {/* ② 进度填充：主紫渐变 + 顶部高光条 */}
        <div
          className="absolute left-1.5 top-1/2 -translate-y-1/2 h-[8px] rounded-full overflow-hidden"
          style={{
            width: `calc(${dotPct}% - 3px + 6px)`,
            background: 'linear-gradient(180deg, #B89BF5 0%, #8E70E8 100%)',
            boxShadow: '0 1px 3px rgba(126,99,222,0.45)',
          }}
          aria-hidden
        >
          {/* 顶部 1px 高光（光泽感） */}
          <div
            className="absolute left-0 right-0 top-[1px] h-[1.5px] rounded-full"
            style={{ background: 'rgba(255,255,255,0.55)' }}
          />
        </div>
        {/* ③ 节点层：6 个立体的圆点 */}
        <div className="absolute inset-0 flex justify-between items-center">
          {steps.map((s, i) => {
            const isCurrent = i === current;
            const isDone = i < current;
            const isPending = i > current;
            return (
              <div
                key={s.id ?? i}
                className={
                  'shrink-0 rounded-full inline-flex items-center justify-center transition-all ' +
                  // 当前节点略大
                  (isCurrent ? ' size-8 ' : ' size-7 ') +
                  // 状态色：已完成=白底紫勾；当前=白底紫环+脉冲；未完成=紫灰底
                  (isDone
                    ? ' bg-white ring-2 ring-[var(--stu-purple)] '
                    : isCurrent
                    ? ' bg-white ring-[3px] ring-[var(--stu-purple)] shadow-[0_0_0_4px_rgba(164,138,240,0.25),0_4px_10px_rgba(126,99,222,0.35)] '
                    : ' bg-[#D8C9F0] ring-2 ring-[#C9B8F7] ')
                }
                style={
                  isPending
                    ? {
                        boxShadow:
                          'inset 0 1px 2px rgba(60,40,120,0.15), 0 1px 0 rgba(255,255,255,0.6)',
                      }
                    : isDone
                    ? {
                        boxShadow:
                          '0 2px 6px rgba(126,99,222,0.30), inset 0 1px 0 rgba(255,255,255,0.9)',
                      }
                    : undefined
                }
                aria-hidden
              >
                {isDone ? (
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3.5"
                    style={{ color: 'var(--stu-purple)' }}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                ) : isCurrent ? (
                  // 当前：实心小紫点
                  <div
                    className="size-2.5 rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle at 30% 30%, #C9B8F7 0%, #7E63DE 80%)',
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 学生端 lesson header：扁平白底（可汗儿童版风）
function LessonHeader({
  courseName,
  stars,
  rewardStars,
  onBack,
  canBack,
  onNext,
  canNext,
  progress,
}: {
  courseName: string;
  stars: number;
  rewardStars: number;
  onBack: () => void;
  canBack: boolean;
  onNext: () => void;
  canNext: boolean;
  progress?: React.ReactNode;
}) {
  return (
    <div
      className="page-grid w-full"
      style={{
        background: 'var(--stu-paper)',
        borderBottom: '1px solid var(--stu-line)',
        boxShadow: 'none',
        color: 'var(--stu-ink)',
      }}
    >
      {/* 第一行：logo + 课程名 / Back / Next / 星星 */}
      <div className="w-full py-3 inline-flex justify-between items-center">
        {/* 左：logo + 课程名 */}
        <div className="inline-flex items-center gap-3 min-w-0">
          <div
            className="size-10 rounded-full grid place-items-center font-extrabold text-white text-lg"
            style={{
              background: 'var(--stu-rose)',
            }}
          >
            L
          </div>
          <div className="min-w-0">
            <div className="text-[var(--stu-ink)] text-base sm:text-lg font-extrabold leading-5 truncate">
              {courseName || 'LingoLand'}
            </div>
            <div className="text-[var(--stu-ink-soft)] text-[10px] sm:text-[11px] font-extrabold leading-3 tracking-[0.18em]">
              LESSON
            </div>
          </div>
        </div>

        {/* 右：Back / Next / 星星 */}
        <div className="inline-flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onBack}
            disabled={!canBack}
            className={
              'min-h-9 px-3.5 rounded-full inline-flex items-center gap-1.5 text-xs font-extrabold transition-all ' +
              (canBack
                ? 'active:translate-y-[1px]'
                : 'cursor-not-allowed opacity-60')
            }
            style={{
              background: 'var(--stu-bg-soft)',
              color: 'var(--stu-ink)',
              border: '1px solid var(--stu-line)',
            }}
            title="Previous"
          >
            <span aria-hidden>←</span>
            <span>Back</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className={
              'min-h-9 px-3.5 rounded-full inline-flex items-center gap-1.5 text-xs font-extrabold transition-all ' +
              (canNext
                ? 'active:translate-y-[1px]'
                : 'cursor-not-allowed opacity-60')
            }
            style={
              canNext
                ? {
                    background: 'var(--stu-purple)',
                    color: '#FFFFFF',
                    border: 'none',
                  }
                : {
                    background: 'var(--stu-bg-soft)',
                    color: 'var(--stu-ink-soft)',
                    border: '1px solid var(--stu-line)',
                    opacity: 0.6,
                  }
            }
          >
            <span>Next</span>
            <span aria-hidden>→</span>
          </button>
          {/* 星星计数 */}
          <div
            className="min-h-9 px-3 rounded-full inline-flex items-center gap-1.5"
            style={{
              background: 'var(--stu-yellow)',
              color: 'var(--stu-ink)',
            }}
          >
            <span aria-hidden className="text-lg leading-none">★</span>
            <span className="font-extrabold leading-5 text-sm">{stars}</span>
            <span className="text-[var(--stu-ink)]/70 text-xs leading-4">
              /{rewardStars}
            </span>
          </div>
        </div>
      </div>

      {/* 第二行：胶囊进度条 */}
      {progress && (
        <div className="w-full pb-3.5">
          {progress}
        </div>
      )}
    </div>
  );
}

export default function LessonPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [lesson, setLesson] = useState<LessonDTO | null>(null);
  const [idx, setIdx] = useState(0);
  const [earnedStars, setEarned] = useState(0);
  const [lessonDone, setLessonDone] = useState(false);
  
  // Learning record hook
  const { 
    answers, 
    currentSummary, 
    recordAnswer, 
    saveLessonAnswers, 
    loadPreviousAnswers,
    getAnswersForStep,
    clearAnswers
  } = useLearningRecord();
  
  // 存储每个step的答题结果
  const [stepResults, setStepResults] = useState<Record<string, { correct?: boolean; stars: number; answer?: string | string[] }>>({});
  
  // 用 ref 同步保存最新 earnedStars，避免 setEarned 异步 + 同步读 earnedStars 拿到旧值
  const earnedRef = useRef(0);
  useEffect(() => { earnedRef.current = earnedStars; }, [earnedStars]);
  // 同步最新 idx，避免传出去的 next/onDone 闭包住旧的 idx，导致一直停在同一题
  const idxRef = useRef(0);
  useEffect(() => { idxRef.current = idx; }, [idx]);
  // 保存stepResults ref
  const stepResultsRef = useRef(stepResults);
  useEffect(() => { stepResultsRef.current = stepResults; }, [stepResults]);

  useEffect(() => {
    if (!params?.id) return;
    api.getLesson(params.id).then(setLesson).catch(console.error);
    // 加载之前保存的答题记录
    loadPreviousAnswers(params.id);
  }, [params?.id, loadPreviousAnswers]);

  const steps: StepDTO[] = useMemo(() => lesson?.steps ?? [], [lesson]);
  const cur = steps[idx];
  
  // 记录答题结果的回调
  const handleStepResult = useCallback((stepId: string, stepType: StepType, result: { correct?: boolean; stars: number; answer?: string | string[]; asrText?: string; speakingFeedback?: string }) => {
    const stepName = stepDisplayName(steps.find(s => s.id === stepId));
    
    // 更新本地星星和答题结果
    setStepResults(prev => {
      const updated = { ...prev, [stepId]: result };
      return updated;
    });
    
    // 记录到学习记录
    recordAnswer({
      stepId,
      stepType,
      stepName,
      answer: result.answer || '',
      correct: result.correct,
      starsEarned: result.stars,
      asrText: result.asrText,
      speakingFeedback: result.speakingFeedback,
    });
  }, [steps, recordAnswer]);

  async function handleQuizResult(stars: number) {
    const next = earnedRef.current + stars;
    setEarned(next);
    earnedRef.current = next;
  }
  
  // 显示之前的答题记录
  const previousAnswers = getAnswersForStep(cur?.id || '');

  function next() {
    // eslint-disable-next-line no-console
    console.log('[play page] next() called, current idxRef=', idxRef.current, 'steps.length=', steps.length, 'cur.type=', steps[idxRef.current]?.type);
    if (idxRef.current + 1 < steps.length) {
      const n = idxRef.current + 1;
      idxRef.current = n;
      setIdx(n);
    } else {
      // 全部完成: 调 API 持久化 + 显示总结弹窗
      // eslint-disable-next-line no-console
      console.log('[play page] lesson all done! earned=', earnedRef.current);
      api.completeLesson(params!.id, earnedRef.current).catch(() => {});

      // 立即把弹窗打开（先显示 loading 骨架），避免用户点完按钮后长时间无反馈。
      // summary 内容随后由 saveLessonAnswers 异步填充进来。
      setLessonDone(true);

      // 保存学习记录并生成总结（不阻塞弹窗显示）
      const lessonTitle = lesson?.title || lesson?.course?.title || 'Lesson';
      saveLessonAnswers(params!.id, lessonTitle).catch((e) => {
        console.warn('[play page] saveLessonAnswers failed:', e);
      });
    }
  }

  function prev() {
    if (idxRef.current > 0) {
      const p = idxRef.current - 1;
      idxRef.current = p;
      setIdx(p);
    }
  }

  return (
    <div className="student-theme">
      {/* 学生端 lesson header：暖黄渐变 */}
      <div>
        <LessonHeader
          courseName={lesson?.title || lesson?.course?.title || 'LingoLand'}
          stars={earnedStars}
          rewardStars={lesson?.rewardStars ?? 0}
          onBack={() => {
            if (idx > 0) {
              prev();
            } else if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
            } else {
              router.push('/');
            }
          }}
          canBack={steps.length > 0}
          onNext={next}
          canNext={steps.length > 0}
          progress={
            steps.length > 0 ? (
              <StepDots
                steps={steps}
                current={idx}
              />
            ) : null
          }
        />
      </div>

      <AppShell>
        <section className="page-grid mt-4 relative">
          <div className="relative min-h-[460px] overflow-hidden">
            <div key={cur?.id ?? 'empty'} className="relative max-w-[960px] mx-auto w-full">
              {!cur ? (
                <div className="grid place-items-center min-h-[400px] font-extrabold" style={{ color: 'var(--stu-ink-soft)' }}>Loading…</div>
              ) : cur.type === 'VIDEO' ? (
                <VideoStep stepId={cur.id} content={cur.content} onResult={handleQuizResult} onDone={next} onPrev={prev} />
              ) : cur.type === 'IMAGE' ? (
                <ImageStep content={cur.content} onDone={next} onPrev={prev} />
              ) : cur.type === 'QUIZ' ? (
                <div>
                  <QuizStep 
                    stepId={cur.id} 
                    content={cur.content} 
                    onResult={(stars) => {
                      handleQuizResult(stars);
                      handleStepResult(cur.id, cur.type, { correct: stars > 0, stars });
                    }} 
                    onDone={next} 
                    onPrev={prev} 
                  />
                  {previousAnswers ? (
                    <PreviousAnswerDisplay answers={answers} currentStepId={cur.id} />
                  ) : null}
                </div>
              ) : cur.type === 'BRIDGE' ? (
                <BridgeStep content={cur.content} onDone={next} />
              ) : cur.type === 'TEST' ? (
                <div>
                  <TestStep 
                    stepId={cur.id} 
                    content={cur.content} 
                    onResult={(stars) => {
                      handleQuizResult(stars);
                      handleStepResult(cur.id, cur.type, { correct: stars > 0, stars });
                    }} 
                    onDone={next} 
                    onPrev={prev} 
                  />
                  {previousAnswers ? (
                    <PreviousAnswerDisplay answers={answers} currentStepId={cur.id} />
                  ) : null}
                </div>
              ) : cur.type === 'VIDEO_LAB' ? (
                <VideoLabStep 
                  content={cur.content} 
                  onResult={(stars) => {
                    handleQuizResult(stars);
                    handleStepResult(cur.id, cur.type, { correct: stars >= 3, stars });
                  }} 
                  onDone={next} 
                  onPrev={prev} 
                />
              ) : cur.type === 'IMAGE_SAFARI' ? (
                <ImageSafariStep 
                  content={cur.content} 
                  onResult={(stars) => {
                    handleQuizResult(stars);
                    handleStepResult(cur.id, cur.type, { stars });
                  }} 
                  onDone={next} 
                  onPrev={prev} 
                />
              ) : cur.type === 'TRACE' ? (
                <div>
                  <TraceStep 
                    stepId={cur.id} 
                    content={cur.content} 
                    onResult={(stars) => {
                      handleQuizResult(stars);
                      handleStepResult(cur.id, cur.type, { correct: stars > 0, stars });
                    }} 
                    onDone={next} 
                    onPrev={prev} 
                  />
                  {previousAnswers ? (
                    <PreviousAnswerDisplay answers={answers} currentStepId={cur.id} />
                  ) : null}
                </div>
              ) : (
                <div className="font-extrabold" style={{ color: 'var(--stu-ink)' }}>Unknown step type: {cur.type}</div>
              )}
            </div>
          </div>
        </section>

        {/* Learning Summary Modal - 使用 Qwen LLM 生成的学习总结
            弹窗在 lessonDone=true 时立即出现（先展示 loading 骨架），
            等 saveLessonAnswers API 返回后 currentSummary 会被填充，骨架自动替换为真实内容 */}
        {lessonDone && (
          <LearningSummaryCard
            summary={currentSummary}
            earnedStars={earnedStars}
            isLoading={!currentSummary}
            onContinue={() => {
              clearAnswers();
              router.push('/');
            }}
            onReplay={() => {
              clearAnswers();
              setStepResults({});
              setEarned(0);
              earnedRef.current = 0;
              setIdx(0);
              idxRef.current = 0;
              setLessonDone(false);
            }}
          />
        )}

        <GrassHill />
      </AppShell>
    </div>
  );
}
