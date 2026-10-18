'use client';
import { useEffect, useRef, useState } from 'react';
import { mediaProxy } from '@/lib/mediaProxy';
import type { VideoInterrupt, InterruptQuestion, InterruptOption, InterruptQuestionType, VideoContent } from '@/lib/adminApi';
import { adminApi } from '@/lib/adminApi';
import { api } from '@/lib/api';

type Aspect = '16:9' | '1:1' | '9:16';

const ASPECT_CLASS: Record<Aspect, string> = {
  '16:9': 'aspect-video',
  '1:1':  'aspect-square',
  '9:16': 'aspect-[9/16]',
};

const SIZE_CLASS: Record<Aspect, string> = {
  '16:9': 'max-w-[760px]',
  '1:1':  'max-w-[520px]',
  '9:16': 'max-w-[360px]',
};

// 学员端的"假" userId — 后端没接学员鉴权，先用一个固定 id 把 attempts 留痕
const STUDENT_USER_ID = (() => {
  if (typeof window === 'undefined') return 'ssr';
  const KEY = 'hongen.studentId';
  let v = window.localStorage.getItem(KEY);
  if (!v) {
    v = 'stu_' + Math.random().toString(36).slice(2, 10);
    window.localStorage.setItem(KEY, v);
  }
  return v;
})();

export function VideoStep({
  content,
  stepId,
  onResult,
  onDone,
  onPrev,
}: {
  content: VideoContent;
  stepId?: string;
  // 拿到 0..maxStars 的星, 加到 lesson earnedStars (与 QUIZ 路径一致)
  onResult?: (stars: number) => void;
  // 兜底：没 interrupts 时走旧的 onDone
  onDone: () => void;
  // Back 按钮：返回上一步
  onPrev?: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const aspect: Aspect = (content.aspect as Aspect) ?? '16:9';
  const interrupts: VideoInterrupt[] = content.interrupts ?? [];
  const maxStars: number = Math.max(0, Math.min(3, Number(content.maxStars ?? 1)));

  // 已触发过的 interruptId，避免用户拖回去重复弹
  const firedRef = useRef<Set<string>>(new Set());
  const [active, setActive] = useState<VideoInterrupt | null>(null);
  // 学员已完成尝试：Map<interruptId, { isCorrect, score }>（取最后一次）
  const attemptsRef = useRef<Map<string, { isCorrect: boolean; score: number }>>(new Map());
  // 标记是否已算过分（避免拖动视频重复结算）
  const scoredRef = useRef(false);
  // 学员是否已点 "看完了" 触发结算（决定 Next 按钮是否可点）
  const [submitted, setSubmitted] = useState(false);
  // 浏览器拒绝自动播放（带声音的 video 不能无声自动播）→ 显示 "点开始" 引导
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  // ── 防快进 ───────────────────────────────────────────────
  // 锁状态：当 active != null 时禁止 seek；程序回弹期间也短暂加锁，
  // 避免回弹赋值 currentTime 再次触发 seeking 形成抖动。
  // "学员当前最多可前进到的位置" = 最早的"未答弹题点 - 缓冲"，或视频总长
  const seekingLockRef = useRef<{ at: number } | null>(null);
  // 视频总时长（秒）；loadedmetadata 后才有值
  const durationRef = useRef<number>(0);
  // 弹窗开启过程中是否已经"硬暂停"过视频（防止多个 useEffect / handleSeeking
  // 路径都重复调用 pause(); pause() 本身幂等，但为了减少控制台噪音 + 排查方便）
  const pausedByModalRef = useRef(false);

  // 视频源/中断点变了, 重置触发集合 + 拉历史 attempts
  useEffect(() => {
    firedRef.current = new Set();
    scoredRef.current = false;
    setSubmitted(false);
    attemptsRef.current = new Map();
    seekingLockRef.current = null;
    durationRef.current = 0;
    if (stepId && interrupts.length > 0) {
      adminApi.listStepAttempts(STUDENT_USER_ID, stepId).then((r) => {
        for (const a of r.latest) {
          attemptsRef.current.set(a.interruptId, { isCorrect: a.isCorrect, score: a.score });
        }
      }).catch(() => {});
    }
    // 进入该 step 自动播放（autoPlay 已写在 <video> 上，这里再兜底调用一次，
    // 处理 iOS Safari 等浏览器对未静音视频的策略限制）。
    // 带声音的 video 通常会被浏览器拦 autoplay → 失败时显示一个引导按钮，
    // 学员点一下产生 user gesture，就能正常带声播。
    const v = ref.current;
    if (v) {
      v.currentTime = 0;
      setAutoplayBlocked(false);
      const p = v.play();
      if (p && typeof (p as any).then === 'function') {
        (p as Promise<void>)
          .then(() => setAutoplayBlocked(false))
          .catch(() => setAutoplayBlocked(true));
      }
    }
  }, [content.url, interrupts.length, stepId]);

  // ── 弹窗开/关 与 视频播放状态 的硬绑定 ────────────────────
  // 无论弹窗是因 handleTimeUpdate / handleSeeking / handleSeeked 哪条路径弹出，
  // 一旦 active 从 null 变成某个弹题，必须立即把视频暂停住。
  // 关闭弹窗时，让视频继续播放。
  // 之所以用 useEffect 而不是只在弹窗函数里 v.pause()，是因为：
  //   - setState(active) 是异步的，弹窗函数里 v.pause() 之后 React 提交 DOM 之前
  //     可能还有 seeking/timeupdate 回调再次触发 v.play()，导致视频没真正停
  //   - useEffect 在 commit 之后同步执行，且 React 会把同一个事件循环内的所有
  //     setState 合并后再触发 effect，等于"硬关门"，不会再被后续 seeking 反扑
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active) {
      // 弹窗已弹出 → 强制暂停 + 加锁
      v.pause();
      pausedByModalRef.current = true;
      console.log("[🔒 VideoStep] useEffect[active] 弹窗打开, 强制 pause, pausedAfter=", v.paused, "currentTime=", v.currentTime);
      // ── 终极兜底: 弹窗期间每 200ms 巡检一次, 如果视频被任何方式重新 play 了
      // (比如原生控制条的播放按钮、autoPlay 重试、React 重渲等), 立刻反向 pause
      // 同时把 currentTime 拽回到弹题点附近, 防止画面往前漂
      const it = active;
      const ticker = window.setInterval(() => {
        const cur = ref.current;
        if (!cur || !pausedByModalRef.current) return;
        if (!cur.paused) {
          cur.pause();
          console.warn("[🔒 VideoStep] ticker 发现视频被自动 play, 重新 pause, currentTime=", cur.currentTime);
        }
        // currentTime 漂移超过弹题点 + 0.5s → 拽回
        if (cur.currentTime > it.atSec + 0.5) {
          cur.currentTime = it.atSec;
          console.warn("[🔒 VideoStep] ticker 发现 currentTime 漂移, 拽回, atSec=", it.atSec);
        }
      }, 200);
      // 把 ticker id 存到 ref, 弹窗关闭时清掉
      pausedByModalRef.current = true;
      (pausedByModalRef as any).ticker = ticker;
    } else {
      // 弹窗关闭 → 停掉 ticker, 解锁; 继续播放交给 handleModalClose 控制
      if ((pausedByModalRef as any).ticker) {
        clearInterval((pausedByModalRef as any).ticker);
        (pausedByModalRef as any).ticker = null;
      }
      pausedByModalRef.current = false;
      console.log("[🔒 VideoStep] useEffect[active] 弹窗关闭, 解锁, ticker 已清");
    }
    return () => {
      if ((pausedByModalRef as any).ticker) {
        clearInterval((pausedByModalRef as any).ticker);
        (pausedByModalRef as any).ticker = null;
      }
    };
  }, [active]);

  function handleTimeUpdate() {
    const v = ref.current;
    if (!v || active) return;
    const t = v.currentTime;
    for (const it of interrupts) {
      if (firedRef.current.has(it.id)) continue;
      if (t + 0.05 >= it.atSec) {
        console.log("[🔒 VideoStep] handleTimeUpdate 触发弹题", { t, atSec: it.atSec, id: it.id, paused: v.paused });
        firedRef.current.add(it.id);
        v.pause();
        setActive(it);
        break;
      }
    }
  }

  // ── 防快进 ───────────────────────────────────────────────
  // 计算"学员当前最多可前进到的位置（秒）"：
  //   - 还有未答弹题 → 最早未答弹题点的 atSec（学员只能停在那之前）
  //   - 全答完 / 无弹题 → 视频总时长（可看完）
  function maxAllowedSec(): number {
    const dur = durationRef.current;
    for (const it of interrupts) {
      if (!attemptsRef.current.has(it.id)) {
        return Math.max(0, it.atSec - 0.05);
      }
    }
    return dur > 0 ? dur : Number.MAX_SAFE_INTEGER;
  }

  // 触发防快进：算出目标位置并强制回弹 + 弹窗
  function enforceNoSeek(reason: string) {
    const v = ref.current;
    if (!v) return;
    console.log("[🔒 VideoStep] enforceNoSeek 进入", { reason, currentTime: v.currentTime, paused: v.paused, hasActive: !!active });
    // 弹窗已开着 → 不重复触发，等学员答完
    if (active) {
      // 但 currentTime 可能已经被用户拖到很远，先把他拽回到弹窗对应的点附近
      const it = interrupts.find((x) => x.id === (active as VideoInterrupt).id);
      if (it && v.currentTime > it.atSec + 0.5) {
        seekingLockRef.current = { at: it.atSec };
        v.currentTime = it.atSec;
        console.log("[🔒 VideoStep] enforceNoSeek 弹窗已开, 拽回弹题点", { atSec: it.atSec });
      }
      return;
    }
    // 找最早的"未答弹题点"
    const pending = interrupts
      .filter((it) => !attemptsRef.current.has(it.id))
      .sort((a, b) => a.atSec - b.atSec);
    if (pending.length === 0) {
      console.log("[🔒 VideoStep] enforceNoSeek 所有弹题已答完, 放行");
      return; // 全部答完，放行
    }
    const target = pending[0];
    // 回弹 + 立刻弹出
    seekingLockRef.current = { at: target.atSec };
    v.currentTime = Math.max(0, target.atSec - 0.05);
    firedRef.current.add(target.id);
    v.pause();
    setActive(target);
    console.log("[🔒 VideoStep] enforceNoSeek 弹题弹出", { targetAtSec: target.atSec, targetId: target.id, pausedAfter: v.paused });
  }

  function handleSeeking() {
    const v = ref.current;
    if (!v) return;
    const lock = seekingLockRef.current;
    console.log("[🔒 VideoStep] handleSeeking", { currentTime: v.currentTime, paused: v.paused, hasLock: !!lock, lockAt: lock?.at, hasActive: !!active });
    // 短暂"我们自己在回弹"窗口期：忽略 seeking 事件（避免抖动）
    if (lock && Math.abs(v.currentTime - lock.at) < 1) {
      // 这次 seeking 就是我们赋值引起的，清掉锁
      seekingLockRef.current = null;
      console.log("[🔒 VideoStep] handleSeeking 命中回弹锁, 忽略 (清锁)");
      return;
    }
    // 弹窗开着，禁止一切 seek（学员尝试越界）
    if (active) {
      const cur = active;
      if (v.currentTime > cur.atSec + 0.1) {
        seekingLockRef.current = { at: cur.atSec };
        v.currentTime = cur.atSec;
        console.log("[🔒 VideoStep] handleSeeking 弹窗开着, 拽回", { atSec: cur.atSec });
      }
      return;
    }
    // 没有弹窗：判断是否越过"最早未答弹题点"
    const cap = maxAllowedSec();
    if (v.currentTime > cap + 0.05) {
      console.log("[🔒 VideoStep] handleSeeking 越界, 调用 enforceNoSeek", { currentTime: v.currentTime, cap });
      enforceNoSeek("handleSeeking");
    }
  }

  // seeked: 部分浏览器 Safari/iOS 上 seeking 事件不触发或时机不可靠，
  // 在 seeked 再校验一次，作为兜底
  function handleSeeked() {
    const v = ref.current;
    if (!v) return;
    console.log("[🔒 VideoStep] handleSeeked", { currentTime: v.currentTime, paused: v.paused, hasActive: !!active });
    if (active) {
      const cur = active;
      if (v.currentTime > cur.atSec + 0.5) {
        seekingLockRef.current = { at: cur.atSec };
        v.currentTime = cur.atSec;
        console.log("[🔒 VideoStep] handleSeeked 弹窗开着, 拽回", { atSec: cur.atSec });
      }
      return;
    }
    const cap = maxAllowedSec();
    if (v.currentTime > cap + 0.05) {
      console.log("[🔒 VideoStep] handleSeeked 越界, 调用 enforceNoSeek", { currentTime: v.currentTime, cap });
      enforceNoSeek("handleSeeked");
    }
  }

  function handleLoadedMetadata() {
    const v = ref.current;
    if (v && Number.isFinite(v.duration)) {
      durationRef.current = v.duration;
      console.log("[🔒 VideoStep] handleLoadedMetadata duration =", v.duration);
    }
  }

  // 视频自然结束 → 算总分
  function handleEnded() {
    calcAndReport();
  }

  function calcAndReport() {
    if (scoredRef.current) return;
    scoredRef.current = true;
    if (interrupts.length === 0 || maxStars === 0) {
      // 没弹题 / 弹题不计星, 走原 onDone
      onDone();
      return;
    }
    // 所有 interrupt 都至少答过一次, 且平均分 >= 50% 才给 maxStars
    const answered = interrupts.map((it) => attemptsRef.current.get(it.id)).filter(Boolean) as { score: number }[];
    if (answered.length < interrupts.length) {
      // 还有没答的 (学员可能直接拖到结束), 走 onDone 但不奖星
      onDone();
      return;
    }
    const avg = answered.reduce((s, a) => s + a.score, 0) / answered.length;
    const stars = avg >= 50 ? maxStars : 0;
    if (stars > 0) onResult?.(stars);
    onDone();
  }

  async function handleModalClose(result: { isCorrect: boolean; score: number }) {
    console.log("[🔒 VideoStep] handleModalClose 学员答完, 结果=", result);
    setActive(null);
    if (active) attemptsRef.current.set(active.id, result);
    // 答完了, 让视频继续 — 但要先检查 currentTime 是否还在允许范围内
    // （可能是"防快进"把学员拽回弹题点附近 → 学员的 currentTime 实际比弹题点 atSec 还小，是安全的）
    setTimeout(() => {
      const v = ref.current;
      if (!v) return;
      const cap = maxAllowedSec();
      console.log("[🔒 VideoStep] handleModalClose 准备继续播放", { currentTime: v.currentTime, cap, paused: v.paused });
      if (v.currentTime > cap + 0.05) {
        // 仍有未答弹题且 currentTime 在未答点之后 → 强制回弹并弹窗
        console.log("[🔒 VideoStep] handleModalClose currentTime 越界, 调用 enforceNoSeek");
        enforceNoSeek("handleModalClose");
        return;
      }
      v.play().then(() => {
        console.log("[🔒 VideoStep] handleModalClose play() 成功");
      }).catch((e) => {
        console.warn("[🔒 VideoStep] handleModalClose play() 失败", e);
      });
    }, 60);
  }

  return (
    <div className="flex flex-col w-full">
      <div
        className={
          'w-full ' + ASPECT_CLASS[aspect] +
          ' rounded-2xl overflow-hidden shadow-pop border-4 border-white bg-black relative'
        }
      >
        <video
          ref={ref}
          src={mediaProxy(content.url)}
          poster={content.poster}
          // 弹窗开着时, 学员没法点控制条上的播放按钮绕过暂停
          controls={!active}
          autoPlay
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={(e) => {
            setAutoplayBlocked(false);
            // 弹窗开着时如果 video 自己开始播（比如原生控制条被点、autoPlay 重试、
            // React 重渲导致 paused 状态被重置），立即反向 pause() 兜底。
            const v = e.currentTarget;
            if (active) {
              v.pause();
              console.warn("[🔒 VideoStep] onPlay 时弹窗已开, 反向 pause()", { currentTime: v.currentTime, hasActive: !!active });
            } else {
              console.log("[🔒 VideoStep] onPlay 视频开始播", { currentTime: v.currentTime });
            }
          }}
          onPause={(e) => {
            const v = e.currentTarget;
            console.log("[🔒 VideoStep] onPause 视频暂停", { currentTime: v.currentTime, hasActive: !!active });
          }}
          onLoadedMetadata={handleLoadedMetadata}
          onSeeking={handleSeeking}
          onSeeked={handleSeeked}
          className="w-full h-full"
        />
        {autoplayBlocked && (
          <button
            type="button"
            onClick={() => {
              const v = ref.current;
              if (!v) return;
              v.currentTime = 0;
              const p = v.play();
              if (p && typeof (p as any).then === 'function') {
                (p as Promise<void>).then(() => setAutoplayBlocked(false)).catch(() => {});
              }
            }}
            className="absolute inset-0 grid place-items-center bg-black/30 text-white text-2xl font-extrabold"
          >
            <span className="rounded-full bg-white/90 text-stone-800 px-6 py-3 shadow-pop">
              ▶ Tap to start
            </span>
          </button>
        )}
      </div>

      {active && stepId && (
        <InterruptModal
          stepId={stepId}
          interrupt={active}
          onClose={(r) => handleModalClose(r)}
        />
      )}
    </div>
  );
}

// ============================================================
// InterruptModal — 4 种题型都能渲, 提交后调用 onClose 把分数带回
// ============================================================
function InterruptModal({
  stepId,
  interrupt,
  onClose,
}: {
  stepId: string;
  interrupt: VideoInterrupt;
  // 关闭时把最后提交结果带回 (无 attempt 时传 {isCorrect:false, score:0})
  onClose: (result: { isCorrect: boolean; score: number }) => void;
}) {
  const q = interrupt.question;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [speechBlob, setSpeechBlob] = useState<Blob | null>(null);
  const [speechUrl, setSpeechUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  // Web Speech: 转写中的文字 / 最终文字
  const [speechTranscript, setSpeechTranscript] = useState('');
  const [speechInterim, setSpeechInterim] = useState('');
  // qwen paraformer-v2: 已确认文字 / 最新 partial 段(用于"实时滚动"字幕)
  // 策略：
  //   - 录音中每 ~2.5s 切一次 MediaRecorder.requestData() → 上传七牛 → 调 /api/asr →
  //     把"上次确认位置之后"的新文字追加到 qwenTranscript，同时把这一段的全文塞到 qwenInterim
  //   - 停止录音时再做一次"终态识别", 覆盖 qwenTranscript (更准)
  //   - 浏览器支持 Web Speech 时, 优先用 Web Speech 的 transcript (即时+免费); qwen 仅作为终态校准
  //   - 浏览器不支持 Web Speech (Safari/iOS) 时, 实时滚动全靠 qwen
  const [qwenTranscript, setQwenTranscript] = useState('');
  const [qwenInterim, setQwenInterim] = useState('');
  const [qwenRecognizing, setQwenRecognizing] = useState(false); // 终态识别中
  const qwenTickRef = useRef<number | null>(null);
  const qwenBusyRef = useRef(false); // 防止上一轮还没回来就开下一轮
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<null | { isCorrect: boolean; score: number }>(null);
  // 录音 stop 后, qwen 终态识别完成的时刻 (null=还没完成). SpeechArea 用它切"识别中"→"反馈" UI.
  const [recognizedAt, setRecognizedAt] = useState<number | null>(null);
  // QUIZ 题型（多题测验）：每题一个 answer
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, { picked: Set<string>; text: string }>>({});
  // QUIZ 逐题反馈：null=未答；'ok'=答对；'no'=答错
  const [subFeedback, setSubFeedback] = useState<'ok' | 'no' | null>(null);
  const [quizDone, setQuizDone] = useState(false);
  // SAFARI 题型（场景+tag）：记录访问过的 tag id
  const [safariVisited, setSafariVisited] = useState<Set<string>>(new Set());
  const recRef = useRef<MediaRecorder | null>(null);
  const recTickRef = useRef<number | null>(null);
  const recStartRef = useRef<number>(0);
  // Web Speech
  const recSRRef = useRef<any>(null);
  // 跳过: 不进 attempt, 但要"继续"才能看到下一题

  const isMulti = q.type === 'MULTI';
  const SR: any = (typeof window !== 'undefined') &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const sttSupported = !!SR;
  // 弹窗出现即自动播放题目音频：仅覆盖基础 4 题型 (SPEECH/SINGLE/MULTI/FILL) 的题面音频。
  // QUIZ 多题测验的题面音频由内嵌 <QuizInline> 自己按题自动播（见下方），
  // 避免外层 interrupt 顶层的"开场音"和子题题面音同时播造成回声。
  // SAFARI 没有题面音。
  const promptAudioRef = useRef<HTMLAudioElement | null>(null);
  // 答案音频（独立 ref, 不和 promptAudioRef 共用, 避免两个同时响）
  const answerAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (q.type === 'QUIZ' || q.type === 'SAFARI') return;
    const a = promptAudioRef.current;
    if (!a) return;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
  }, [interrupt.id]);

  // QUIZ 整组答完自动提交: quizDone 变 true 时, 把所有子题答案整合成一次 step-attempt 入库
  // (这样星数才能正确累计, 后端也能看到这次完整的答题记录)
  useEffect(() => {
    if (q.type !== 'QUIZ') return;
    if (!quizDone) return;
    if (submitting) return;
    if (feedback) return; // 已提交过
    // 静默提交, 失败也不打断学员
    submit().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizDone]);

  // SPEECH 题型: 录音 stop 后, 等 qwen 终态识别完成 → 自动调 submit() → 等后端打分 → 显示 feedback
  // 然后由 SpeechArea 内部根据 feedback.isCorrect 显示 "继续看" 或 "再录一次"
  useEffect(() => {
    if (q.type !== 'SPEECH') return;
    // 触发条件: 不在录音、有录音文件、还没开始识别、没在提交中、还没出 feedback
    if (recording) return;
    if (!speechBlob) return;
    if (recognizedAt !== null) return;        // 已经在跑了
    if (submitting) return;
    if (feedback) return;
    // 标记"识别中", 让 SpeechArea 显示 loading
    setRecognizedAt(0);
    (async () => {
      try {
        // 等 qwen 终态识别 (rec.onstop 时已启动); 30s 上限由 /api/asr 路由保证
        await (finalizePromiseRef.current ?? Promise.resolve({
          asrText: (qwenTranscript || speechTranscript || '').trim(),
          asrEngine: (qwenTranscript ? 'qwen-parformer-v2' : 'browser-speech') as 'qwen-parformer-v2' | 'browser-speech',
        }));
        // 整段识别完, 自动调 submit
        await submit();
      } catch (e) {
        console.warn('[speech auto submit]', e);
      } finally {
        // 标记识别流程结束 (成功/失败都标), 防止反复触发
        setRecognizedAt(Date.now());
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, speechBlob, q.type]);

  function pickOne(id: string) {
    if (feedback) return;
    if (isMulti) {
      const n = new Set(selected);
      n.has(id) ? n.delete(id) : n.add(id);
      setSelected(n);
    } else {
      setSelected(new Set([id]));
    }
  }

  async function uploadAudio(blob: Blob): Promise<string> {
    const ext = blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : 'mp3';
    const tok = await adminApi.issueUploadToken('hongen/attempts', ext);
    const form = new FormData();
    form.append('file', blob, 'rec.' + ext);
    form.append('token', tok.token);
    form.append('key', tok.key);
    const res = await fetch('https://up-z2.qiniup.com', { method: 'POST', body: form });
    if (!res.ok) throw new Error('upload failed');
    return tok.publicUrl;
  }

  async function startRec() {
    if (feedback) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        setSpeechBlob(blob);
        const url = URL.createObjectURL(blob);
        setSpeechUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        // 终态识别 — 比实时轮询更准, 同时把最终 transcript 回填到 speechTranscript
        // 保留 promise 给 submit 用, 保证提交时一定拿到最终结果
        finalizePromiseRef.current = finalizeQwenAsr(blob, rec.mimeType || 'audio/webm');
        // fire-and-forget; submit 会通过 await 拿结果
        finalizePromiseRef.current.catch(() => {});
      };
      recRef.current = rec;
      recStartRef.current = Date.now();
      // 把 chunks 挂到 rec 上, 便于 onQwenTick 拿"截止当前的累积音频"
      (rec as any)._chunks = chunks;
      rec.start();
      setRecording(true);
      recTickRef.current = window.setInterval(() => {
        setRecDuration(Math.floor((Date.now() - recStartRef.current) / 1000));
      }, 250);

      // qwen 实时识别: 每 2.5s 切一次录音, 上传, 调 /api/asr
      // ① 启动时 reset transcript
      setQwenTranscript('');
      setQwenInterim('');
      qwenBusyRef.current = false;
      // 上次识别的"全段"结果, 用于算"新增部分" (避免字幕被整段覆盖产生闪动)
      const lastFullResultRef: { current: string } = { current: '' };
      const TICK_MS = 2500;
      const onQwenTick = async () => {
        if (qwenBusyRef.current) return;            // 上轮还在跑
        const cur = recRef.current;
        if (!cur || cur.state !== 'recording') return;
        qwenBusyRef.current = true;
        // 拿到当前累积的所有 chunks
        const allChunks: BlobPart[] = (cur as any)._chunks ?? [];
        if (allChunks.length === 0) { qwenBusyRef.current = false; return; }
        const blob = new Blob(allChunks, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 1500) { qwenBusyRef.current = false; return; } // 太小没意义
        try {
          const url = await uploadAudio(blob);
          const r = await api.transcribeAudio(url, (q as any).languageHints ?? ['en', 'zh']);
          const full = (r?.text ?? '').trim();
          if (full) {
            // dashscope paraformer-v2 是离线整段识别: 越往后看到越多上下文, 越准。
            // 直接 setQwenTranscript(full) 会让字幕"整段重写", 体验上是跳字/漏字。
            // 改成: 算新旧结果的最长公共前缀 (按字符), 取新增后缀, 追加到 qwenTranscript。
            const prev = lastFullResultRef.current;
            if (!prev) {
              // 第一次: 直接显示全文
              lastFullResultRef.current = full;
              setQwenTranscript(full);
            } else {
              // 求最长公共前缀长度
              let i = 0;
              const max = Math.min(prev.length, full.length);
              while (i < max && prev[i] === full[i]) i++;
              if (i < full.length) {
                // 有新增
                // 防"修词重复"：若 LCP 比例 < 50%, 说明模型在修正前半段(不是追加), 直接重建字幕
                // (dashscope 偶尔会"修词", 此时把"修正部分"按"新增"追加会重复)
                const rewriteRatio = prev.length === 0 ? 1 : i / prev.length;
                if (rewriteRatio < 0.5) {
                  lastFullResultRef.current = full;
                  setQwenTranscript(full);
                } else {
                  const delta = full.slice(i);
                  lastFullResultRef.current = full;
                  setQwenTranscript((s) => (s ? s + ' ' : '') + delta.trim());
                }
              }
              // i >= full.length 意味着 new 是 old 的前缀 (没新增), 不更新
            }
            setQwenInterim(''); // 完整版, 不需要 interim
          }
        } catch (e) {
          // 单次失败不打扰用户, 静默
          console.warn('[qwen asr tick]', e);
        } finally {
          qwenBusyRef.current = false;
        }
      };
      qwenTickRef.current = window.setInterval(onQwenTick, TICK_MS);
      // 立刻跑一次 (让用户尽快看到第一段字幕)
      window.setTimeout(onQwenTick, 600);

      // Web Speech 实时转写
      if (sttSupported) {
        try {
          const sr = new SR();
          sr.lang = 'zh-CN'; // 默认中文; 学员端可改
          sr.continuous = true;
          sr.interimResults = true;
          sr.onresult = (e: any) => {
            let interim = '';
            let final = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const tr = e.results[i][0].transcript;
              if (e.results[i].isFinal) final += tr;
              else interim += tr;
            }
            if (final) setSpeechTranscript((s) => (s + final).trim());
            setSpeechInterim(interim);
          };
          sr.onerror = () => { /* 静默 */ };
          sr.onend = () => { setSpeechInterim(''); };
          sr.start();
          recSRRef.current = sr;
        } catch { /* 静默 */ }
      }
    } catch (e) {
      alert('Cannot access microphone: ' + (e as Error).message);
    }
  }

  function stopRec() {
    const rec = recRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    setRecording(false);
    if (recTickRef.current) { clearInterval(recTickRef.current); recTickRef.current = null; }
    if (recSRRef.current) { try { recSRRef.current.stop(); } catch {} recSRRef.current = null; }
    // 停掉 qwen 实时轮询
    if (qwenTickRef.current) { clearInterval(qwenTickRef.current); qwenTickRef.current = null; }
    qwenBusyRef.current = false;
  }

  // 录音停止后, 用整段音频做一次"终态识别" -> 覆盖 qwenTranscript (更准)
  // 也回填给 Web Speech 路径下的 transcript (Safari 用户看不到 Web Speech 实时结果, 用这个兜底)
  // 返回最终 transcript 文本 + engine, 供 submit 直接用 (避免 setState 异步拿不到)
  const finalizePromiseRef = useRef<Promise<{ asrText: string; asrEngine: 'qwen-parformer-v2' | 'browser-speech' }> | null>(null);
  async function finalizeQwenAsr(blob: Blob, _mime: string): Promise<{ asrText: string; asrEngine: 'qwen-parformer-v2' | 'browser-speech' }> {
    const fallback: { asrText: string; asrEngine: 'qwen-parformer-v2' | 'browser-speech' } = {
      asrText: speechTranscript.trim(),
      asrEngine: 'browser-speech',
    };
    if (blob.size < 1500) return fallback;
    setQwenRecognizing(true);
    try {
      const url = await uploadAudio(blob);
      const r = await api.transcribeAudio(url, (q as any).languageHints ?? ['en', 'zh']);
      if (r?.text) {
        setQwenTranscript(r.text);
        if (!speechTranscript.trim()) setSpeechTranscript(r.text);
        return { asrText: r.text, asrEngine: 'qwen-parformer-v2' };
      }
      return fallback;
    } catch (e) {
      console.warn('[qwen asr finalize]', e);
      return fallback;
    } finally {
      setQwenRecognizing(false);
    }
  }

  function resetRec() {
    setSpeechBlob(null);
    if (speechUrl) URL.revokeObjectURL(speechUrl);
    setSpeechUrl(null);
    setRecDuration(0);
    setSpeechTranscript('');
    setSpeechInterim('');
    setQwenTranscript('');
    setQwenInterim('');
    setQwenRecognizing(false);
  }

  async function submit() {
    if (submitting || feedback) return;
    setSubmitting(true);
    try {
      let answer: any;
      if (q.type === 'SPEECH') {
        if (!speechBlob) { setSubmitting(false); return; }
        const url = await uploadAudio(speechBlob);
        // 等终态识别跑完 (通常已经返回, 这里只是保险, 上限 30s 由 ASR 路由保证)
        const asr = await (finalizePromiseRef.current ?? Promise.resolve({
          asrText: (qwenTranscript || speechTranscript || '').trim(),
          asrEngine: (qwenTranscript ? 'qwen-parformer-v2' : 'browser-speech') as 'qwen-parformer-v2' | 'browser-speech',
        }));
        answer = {
          type: 'SPEECH',
          audioUrl: url,
          durationSec: recDuration,
          asrText: asr.asrText || undefined,
          asrEngine: asr.asrEngine,
        };
        // DEBUG: 打印实际打分用的 asrText 和 passSentences, 方便排查"明明对了却判错"
        // eslint-disable-next-line no-console
        console.log('[SPEECH submit]', {
          asrText: asr.asrText,
          asrEngine: asr.asrEngine,
          durationSec: recDuration,
          minSeconds: q.minSeconds ?? 0,
          passSentences: q.passSentences ?? [],
          tokens: (asr.asrText || '').toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean),
        });
      } else if (q.type === 'SINGLE') {
        const sel = Array.from(selected)[0] ?? '';
        answer = { type: 'SINGLE', selected: sel };
      } else if (q.type === 'MULTI') {
        answer = { type: 'MULTI', selected: Array.from(selected) };
      } else if (q.type === 'QUIZ') {
        const test: any = (q as any).test;
        const questions: any[] = test?.questions ?? [];
        const answers = questions.map((cz: any, i: number) => {
          const ans = quizAnswers[i] ?? { picked: new Set<string>(), text: '' };
          if (cz?.kind === 'BLANK') {
            const isImageFill = (cz.answerImages?.length ?? 0) > 0;
            return {
              kind: 'BLANK',
              // 后端 scoreInterrupt 期待 ans.text / ans.picked (见 step-attempt.util.ts L120-130)
              text: ans.text.trim().toLowerCase(),
              picked: isImageFill ? Array.from(ans.picked) : undefined,
            };
          }
          if (cz?.kind === 'FILL') {
            // 文本填空：后端要 ans.text；不归一为 lowercase 让后端按配置 caseSensitive 判
            return {
              kind: 'FILL',
              text: ans.text.trim(),
            };
          }
          // SINGLE / MULTIPLE
          return { kind: cz?.kind, picked: Array.from(ans.picked) };
        });
        answer = { type: 'QUIZ', answers };
      } else if (q.type === 'SAFARI') {
        // 探索式：点过几个 tag 都视为通过（score=100），记录下点了哪些
        answer = { type: 'SAFARI', visited: Array.from(safariVisited) };
      } else {
        answer = { type: 'FILL', text };
      }

      // DEBUG: 把前端准备发给后端的 question/answer 整个打出来
      // eslint-disable-next-line no-console
      console.log('[submitStepAttempt][client] ->', {
        stepId,
        interruptId: interrupt.id,
        question: JSON.parse(JSON.stringify(q)),
        answer: JSON.parse(JSON.stringify(answer)),
      });

      const r = await adminApi.submitStepAttempt(STUDENT_USER_ID, {
        stepId,
        interruptId: interrupt.id,
        question: q,
        answer,
      });
      // DEBUG: 后端判完分也打一下返回值
      // eslint-disable-next-line no-console
      console.log('[submitStepAttempt][client] <-', { isCorrect: r.isCorrect, score: r.score });
      setFeedback({ isCorrect: r.isCorrect, score: r.score });
    } catch (e) {
      alert('Submit failed: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function canSubmit(): boolean {
    if (q.type === 'SPEECH') return !!speechBlob;
    if (q.type === 'FILL')   return text.trim().length > 0;
    if (q.type === 'QUIZ') {
      const test = (q as any).test as { questions: any[] };
      const questions = test?.questions ?? [];
      // 全部题目都需已作答
      return questions.every((cz: any, i: number) => {
        const ans = quizAnswers[i];
        if (!ans) return false;
        if (cz?.kind === 'BLANK') {
          const isImageFill = (cz.answerImages?.length ?? 0) > 0;
          if (isImageFill) return ans.picked.size > 0;
          return ans.text.trim().length > 0;
        }
        return ans.picked.size > 0;
      });
    }
    if (q.type === 'SAFARI') {
      return ((q.safari as any)?.tags?.length ?? 0) > 0 ? safariVisited.size > 0 : true;
    }
    return selected.size > 0;
  }

  function handleContinue() {
    if (feedback) {
      onClose({ isCorrect: feedback.isCorrect, score: feedback.score });
    } else {
      onClose({ isCorrect: false, score: 0 });
    }
  }

  // QUIZ 单题判分（前端根据 cur.answer 判；后端在整组提交时再统一判一次入库）
  function judgeSub(cur: any, ans: { picked: Set<string>; text: string }): boolean {
    if (!cur) return false;
    // 老数据里 answer 可能是 string，统一成 string[]
    const normAnswer: string[] = Array.isArray(cur.answer)
      ? (cur.answer as any[]).map((x: any) => String(x))
      : (cur.answer == null || cur.answer === '' ? [] : [String(cur.answer)]);
    if (cur.kind === 'SINGLE') {
      const pickedId = Array.from(ans.picked)[0];
      // DEBUG: 看 admin 配的 answer 和 picked 是否真匹配
      // eslint-disable-next-line no-console
      console.log('[QUIZ sub judge SINGLE]', {
        prompt: cur.prompt,
        normAnswer,
        picked: pickedId,
        options: (cur.options ?? []).map((o: any) => ({ id: o.id, text: o.text })),
        match: normAnswer.length === 1 && ans.picked.size === 1 && normAnswer[0] === pickedId,
      });
      return normAnswer.length === 1 && ans.picked.size === 1 && normAnswer[0] === pickedId;
    }
    if (cur.kind === 'MULTIPLE') {
      const expected = new Set<string>(normAnswer);
      const given = new Set<string>(Array.from(ans.picked).map(String));
      if (expected.size === 0) return false;
      if (expected.size !== given.size) return false;
      for (const id of expected) if (!given.has(id)) return false;
      return true;
    }
    if (cur.kind === 'BLANK') {
      const isImageFill = (cur.answerImages?.length ?? 0) > 0;
      if (isImageFill) {
        // 图片答案：取第一张 id 作为期望值
        const firstId = cur.answerImages?.[0]?.id;
        const expected: string[] = firstId ? [String(firstId)] : normAnswer;
        const got = Array.from(ans.picked).map(String);
        return expected.length === 1 && got.length === 1 && expected[0] === got[0];
      }
      const target = (normAnswer[0] ?? '').trim().toLowerCase();
      return !!target && ans.text.trim().toLowerCase() === target;
    }
    if (cur.kind === 'FILL') {
      // 文本填空：与配置的 answer（数组）任一完全一致（默认不区分大小写，与服务端规则保持一致）
      const target = (normAnswer[0] ?? '').trim();
      if (!target) return false;
      return ans.text.trim().toLowerCase() === target.toLowerCase();
    }
    return false;
  }

  // QUIZ 当前子题是否已作答（用于控制"提交本题"按钮）
  function canSubmitSub(): boolean {
    const cur = (q as any).test?.questions?.[quizIdx];
    const ans = quizAnswers[quizIdx];
    if (!ans) return false;
    if (cur?.kind === 'BLANK') {
      const isImageFill = (cur.answerImages?.length ?? 0) > 0;
      if (isImageFill) return ans.picked.size > 0;
      return ans.text.trim().length > 0;
    }
    if (cur?.kind === 'FILL') {
      // 文本填空：text 非空才能提交
      return ans.text.trim().length > 0;
    }
    return ans.picked.size > 0;
  }

  function submitSub() {
    if (q.type !== 'QUIZ') return;
    if (subFeedback) return; // 已答过
    const cur = (q as any).test?.questions?.[quizIdx];
    const ans = quizAnswers[quizIdx];
    if (!cur || !ans) return;
    const ok = judgeSub(cur, ans);
    setSubFeedback(ok ? 'ok' : 'no');
    if (ok) {
      // 1.2s 后自动进入下一题（或完成）
      window.setTimeout(() => {
        const total = ((q as any).test?.questions ?? []).length;
        if (quizIdx < total - 1) {
          setQuizIdx(quizIdx + 1);
          setSubFeedback(null);
        } else {
          // 最后一题答对：清掉子题绿框（避免和外层 feedback 红框同时显示），
          // 然后再标记 done → useEffect 自动调 submit() → 拿到整组结果
          setSubFeedback(null);
          setQuizDone(true);
        }
      }, 900);
    } else {
      // 答错：清掉当前题答案，提示重试
      window.setTimeout(() => {
        setQuizAnswers((prev) => {
          const n = { ...prev };
          n[quizIdx] = { picked: new Set<string>(), text: '' };
          return n;
        });
        setSubFeedback(null);
      }, 1200);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: 'rgba(28,20,56,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) handleContinue(); }}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-white p-5 shadow-pop border-4 border-amber-200"
        style={{ boxShadow: '0 16px 0 0 rgba(59,42,110,0.25), 0 30px 60px rgba(40,28,90,0.35)' }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="ml-auto text-xs text-stone-400">Q at {formatSec(interrupt.atSec)}</div>
        </div>

        {q.type !== 'QUIZ' && q.type !== 'SAFARI' && (q as any).prompt && (
          <div className="text-stone-800 font-bold text-base mb-2 leading-relaxed">{(q as any).prompt}</div>
        )}
        {q.type !== 'QUIZ' && q.type !== 'SAFARI' && ('promptImageUrl' in q ? (q as any).promptImageUrl : '') && (
          <div className="mb-2 flex justify-center">
            <img
              src={mediaProxy(('promptImageUrl' in q ? (q as any).promptImageUrl : ''))}
              alt="Question image"
              className="max-w-full max-h-72 h-auto object-contain rounded-xl bg-transparent"
            />
          </div>
        )}
        {q.type !== 'QUIZ' && q.type !== 'SAFARI' && (q as any).promptAudioUrl && (
          <PromptAudioPlayer url={(q as any).promptAudioUrl} audioRef={promptAudioRef} />
        )}

        {q.type === 'SPEECH' && (
          <SpeechArea
            recording={recording}
            speechUrl={speechUrl}
            duration={recDuration}
            minSec={q.minSeconds ?? 0}
            sttSupported={sttSupported}
            transcript={speechTranscript}
            interim={speechInterim}
            qwenText={qwenTranscript}
            qwenRecognizing={qwenRecognizing}
            onTranscriptEdit={setSpeechTranscript}
            onStart={startRec}
            onStop={stopRec}
            onReset={resetRec}
            feedback={feedback}
            recognized={!!recognizedAt}
            onPlayPromptAudio={() => {
              // 优先播"答案音频" (答错时播的那段); 没填则回退到题面音频
              const a = (q as any).answerAudioUrl ? answerAudioRef.current : promptAudioRef.current;
              if (!a) return;
              a.currentTime = 0;
              a.play().catch(() => {});
            }}
            onContinue={() => handleContinue()}
            onRetry={() => {
              // 重置全部状态, 让 SpeechArea 重新显示麦克风按钮
              resetRec();
              setFeedback(null);
              setRecognizedAt(null);
              // qwen 终态识别任务 (finalizePromiseRef) 让它自然结束即可, 我们不再 await
            }}
          />
        )}

        {(q.type === 'SINGLE' || q.type === 'MULTI') && (
          <OptionGrid
            options={q.options}
            selected={selected}
            onPick={pickOne}
            onPlayAudio={(url) => {
              // 每次点击 / 选中都从头播一遍
              const a = new Audio(mediaProxy(url));
              a.play().catch(() => {});
            }}
          />
        )}

        {q.type === 'FILL' && (
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer…"
            className="w-full rounded-2xl border-2 border-amber-200 bg-white px-3 py-2.5 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold text-base"
            autoFocus
          />
        )}

        {q.type === 'QUIZ' && (() => {
          const test = (q as any).test as { questions: any[]; introVideoUrl?: string };
          const questions: any[] = test?.questions ?? [];
          if (questions.length === 0) {
            return (
              <div className="rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 text-center text-sm font-bold text-stone-500">
                No questions yet — please add some in the admin panel~
              </div>
            );
          }
          const safeIdx = Math.min(quizIdx, questions.length - 1);
          const cur = questions[safeIdx];
          const ans = quizAnswers[safeIdx] ?? { picked: new Set<string>(), text: '' };
          const isLast = safeIdx === questions.length - 1;
          return (
            <>
              <div className="flex items-center justify-between text-xs font-extrabold text-indigo-700">
                <span>Question {safeIdx + 1} / {questions.length}</span>
              </div>
              <QuizInline
                quiz={cur}
                picked={ans.picked}
                text={ans.text}
                onPick={(id) => {
                  if (subFeedback) return; // 反馈期间不允许改
                  // 直接在闭包里构造 nextPicked（不要依赖 setState updater 的副作用，
                  // 那样 React 18 并发模式下 updater 可能延后执行, 这里的 nextPicked 仍是空 Set）
                  const multi = cur?.kind === 'MULTIPLE';
                  const prevPicked = ans.picked;
                  const nextPicked = new Set<string>(prevPicked);
                  if (multi) {
                    nextPicked.has(id) ? nextPicked.delete(id) : nextPicked.add(id);
                  } else {
                    nextPicked.clear();
                    nextPicked.add(id);
                  }
                  setQuizAnswers((prev) => {
                    const n = { ...prev };
                    n[safeIdx] = { picked: new Set(nextPicked), text: ans.text };
                    return n;
                  });
                  const opt = (cur?.options ?? []).find((o: any) => o.id === id);
                  if (opt?.audioUrl) {
                    const a = new Audio(mediaProxy(opt.audioUrl));
                    a.play().catch(() => {});
                  }
                  // 单选题：点完即判；多选/填空保留"回答本题"按钮触发
                  if (cur?.kind === 'SINGLE') {
                    // 用 nextPicked 临时构造答案立即判
                    const fakeAns = { picked: nextPicked, text: '' };
                    const ok = judgeSub(cur, fakeAns);
                    setSubFeedback(ok ? 'ok' : 'no');
                    if (ok) {
                      window.setTimeout(() => {
                        const total = ((q as any).test?.questions ?? []).length;
                        if (safeIdx < total - 1) {
                          setQuizIdx(safeIdx + 1);
                          setSubFeedback(null);
                        } else {
                          // 最后一道题: 标记 done 同时清掉反馈条, 这样按钮区域才会渲染"继续看"
                          setQuizDone(true);
                          setSubFeedback(null);
                        }
                      }, 800);
                    } else {
                      window.setTimeout(() => {
                        setQuizAnswers((prev2) => {
                          const nn = { ...prev2 };
                          nn[safeIdx] = { picked: new Set<string>(), text: '' };
                          return nn;
                        });
                        setSubFeedback(null);
                      }, 1200);
                    }
                  }
                }}
                onText={(v) => {
                  if (subFeedback) return;
                  setQuizAnswers((prev) => {
                    const n = { ...prev };
                    const old = n[safeIdx] ?? { picked: new Set<string>(), text: '' };
                    n[safeIdx] = { picked: old.picked, text: v };
                    return n;
                  });
                }}
                onPlayAudio={(url) => {
                  const a = new Audio(mediaProxy(url));
                  a.play().catch(() => {});
                }}
                disabled={!!subFeedback}
              />
              {/* 子题反馈：答对自动进下一题；答错提示重试 */}
              {subFeedback && (
                <div
                  className={
                    'mt-3 rounded-2xl px-3 py-2 font-extrabold text-sm flex items-center gap-2 ' +
                    (subFeedback === 'ok'
                      ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-2 border-rose-200')
                  }
                >
                  {subFeedback === 'ok' ? '🎉 Correct!' : '❌ Please try again'}
                </div>
              )}
              {/* 整组完成：仅在还没拿到外层 feedback 时短暂展示一下（避免和外层"得分 X"反馈同时显示） */}
              {quizDone && !subFeedback && !feedback && (
                <div className="mt-3 rounded-2xl px-3 py-2 font-extrabold text-sm bg-emerald-50 text-emerald-700 border-2 border-emerald-200 flex items-center gap-2">
                  🎉 All done!
                </div>
              )}
            </>
          );
        })()}

        {q.type === 'SAFARI' && (
          <SafariInline
            safari={q.safari as any}
            visited={safariVisited}
            onVisit={(id) => setSafariVisited((prev) => new Set(prev).add(id))}
            onPlayAudio={(url) => {
              const a = new Audio(mediaProxy(url));
              a.play().catch(() => {});
            }}
          />
        )}

        {feedback && q.type !== 'SPEECH' && (
          <div
            className={
              'mt-3 rounded-2xl px-3 py-2 font-extrabold text-sm flex items-center gap-2 ' +
              (feedback.isCorrect
                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-2 border-rose-200')
            }
          >
            {feedback.isCorrect ? '🎉 Correct!' : '💪 No worries, listen again~'} <span className="ml-auto opacity-70">Score {feedback.score}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {feedback && q.type !== 'SPEECH' ? (
            <button
              type="button"
              onClick={handleContinue}
              className="flex-1 btn-kid bg-gradient-to-r from-brand-purple to-brand-blue text-white"
            >
              ▶ Keep watching
            </button>
          ) : q.type === 'QUIZ' ? (
            // QUIZ 在子题区域内已处理"答对/答错"逐题反馈；单选是点选即判，
            // 多选 / 填空题需要"回答本题"按钮触发。
            (() => {
              const curKind = (q as any).test?.questions?.[Math.min(quizIdx, ((q as any).test?.questions ?? []).length - 1)]?.kind;
              const needsButton = curKind === 'MULTIPLE' || curKind === 'BLANK';
              if (quizDone && !subFeedback) {
                return (
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="flex-1 btn-kid bg-gradient-to-r from-brand-purple to-brand-blue text-white"
                  >
                    ▶ Keep watching
                  </button>
                );
              }
              if (subFeedback) {
                // 反馈期间不显示按钮（避免学生乱点）
                return null;
              }
              if (!needsButton) {
                // 单选：无需按钮，提示"已选完，自动判分"
                const ans = quizAnswers[Math.min(quizIdx, ((q as any).test?.questions ?? []).length - 1)];
                if (ans?.picked && ans.picked.size > 0) {
                  return (
                    <div className="flex-1 text-center text-sm font-extrabold text-stone-400">
                      Grading…
                    </div>
                  );
                }
                return (
                  <div className="flex-1 text-center text-sm font-extrabold text-stone-400">
                    Please pick an answer
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  onClick={submitSub}
                  disabled={!canSubmitSub()}
                  className={
                    'flex-1 btn-kid ' +
                    (canSubmitSub()
                      ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed')
                  }
                >
                  Answer
                </button>
              );
            })()
          ) : q.type === 'SPEECH' ? (
            // SPEECH 题型不显示底部"回答好了": SpeechArea 内部已经接管了"录音/停止/继续看/再录一次"全部流程
            null
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit() || submitting}
              className={
                'flex-1 btn-kid ' +
                (canSubmit() && !submitting
                  ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed')
              }
            >
              {submitting ? 'Submitting…' : 'Submit answer'}
            </button>
          )}
        </div>
      </div>
      {/* 隐藏的题目音频播放器：仅基础 4 题型 (SPEECH/SINGLE/MULTI/FILL) 使用。
          QUIZ 子题音频由内嵌 <QuizInline> 自己播；SAFARI 题面音频由内嵌 SafariInline 的 <PromptAudioPlayer> 内部 audio 播。
          这里挂的 audio 元素仅承担基础 4 题型题面音频的"自动播"职责，
          它的 ref 已被 <PromptAudioPlayer audioRef={promptAudioRef}> 共用，避免两个 audio 元素并行播同一 src 造成回声。 */}
      {q.type !== 'QUIZ' && q.type !== 'SAFARI' && (q as any).promptAudioUrl && (
        <audio ref={promptAudioRef} src={mediaProxy((q as any).promptAudioUrl)} preload="auto" />
      )}
      {/* 答案音频（独立 ref, 只在答错时播）*/}
      {q.type !== 'QUIZ' && q.type !== 'SAFARI' && (q as any).answerAudioUrl && (
        <audio ref={answerAudioRef} src={mediaProxy((q as any).answerAudioUrl)} preload="auto" />
      )}
    </div>
  );
}

function SpeechArea(props: {
  recording: boolean;
  speechUrl: string | null;
  duration: number;
  minSec: number;
  sttSupported: boolean;
  transcript: string;
  interim: string;
  qwenText: string;
  qwenRecognizing: boolean;
  onTranscriptEdit: (s: string) => void;
  onStart: () => void;
  onStop: () => void;
  onReset: () => void;
  // 自动提交用: 调用方把"识别 + 评分"做完, 把结果回传;
  // 录音 stop 之后由 InterruptModal 触发, 我们不直接调 submit.
  // 这里 props 拿掉自动 submit 相关 — 改为 SpeechArea 只负责"录音/停止/字幕/重录"显示,
  // 评分后是"继续看"还是"再录一次"由 InterruptModal 顶部 feedback 区域统一显示.
  feedback: null | { isCorrect: boolean; score: number };
  onContinue: () => void;
  onRetry: () => void;
  // 整段识别已完成 (录音 stop 后, finalizeQwenAsr 跑完, feedback 已出). 用这个决定按钮区.
  recognized: boolean;
  // 播放"题目示范音" (由 InterruptModal 顶层的 promptAudioRef 控制)
  onPlayPromptAudio: () => void;
}) {
  const { recording, speechUrl, duration, minSec, sttSupported, transcript, interim, qwenText, qwenRecognizing, onTranscriptEdit, onStart, onStop, onReset, feedback, onContinue, onRetry, recognized, onPlayPromptAudio } = props;
  const enough = duration >= minSec;
  // 实时滚动优先用 Web Speech (即时+免费); Safari 没 Web Speech 时回落到 qwen
  const liveText = (transcript || (qwenText && !sttSupported ? qwenText : '')) || '';
  const liveInterim = interim || (qwenText && !sttSupported ? '' : '');
  // 是否识别中: 已经录音结束 (有 speechUrl), 但还在跑 qwen 终态识别, 还没出 feedback
  const isRecognizing = !!speechUrl && !recognized && !feedback;
  // 录音已完成 + 识别完成 (有 feedback) → 走"通过/重录"分支
  const isDone = !!speechUrl && !!feedback;
  // ── ❌ 不再失败时自动播"标准音" ──
  // 之前: 答错时 useEffect 自动调用 onPlayPromptAudio(), 学员还在听反馈就被标准音打断
  // 现在: 学员自己点 UI 上的"🔊 听标准音"按钮才播放 (见下方 button onClick)
  return (
    <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-3 space-y-2">
      {/* 居中麦克风按钮 (默认 + 录音结束识别完成后) */}
      {!recording && !isRecognizing && !isDone && (
        <div className="flex justify-center py-2">
          <button
            type="button"
            onClick={onStart}
            className="size-20 rounded-full grid place-items-center text-white shadow-pop bg-gradient-to-r from-brand-purple to-brand-blue hover:opacity-90 active:scale-95 transition"
            title="Start recording"
            aria-label="Start recording"
          >
            {/* 麦克风 icon (lucide-react 内联 svg, 避免额外 import) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-9 h-9"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
              <path d="M12 19v3" />
              <path d="M8 22h8" />
            </svg>
          </button>
        </div>
      )}

      {/* 录音中: 居中"停止"按钮 + 时长秒数 (不显示字幕, 等录音完再统一显示) */}
      {recording && (
        <div className="flex flex-col items-center gap-1 py-2">
          <div className="text-[10px] text-rose-500 font-extrabold">
            {enough ? (
              <span className="text-emerald-600">Reached minimum {minSec}s ✓</span>
            ) : (
              <span>Recorded {duration}s / min {minSec}s ({Math.max(0, minSec - duration)}s to go)</span>
            )}
          </div>
          <button
            type="button"
            onClick={onStop}
            disabled={!enough}
            className={
              'size-20 rounded-full grid place-items-center text-white shadow-pop transition ' +
              (enough
                ? 'bg-rose-500 animate-pulse hover:opacity-90 active:scale-95'
                : 'bg-stone-300 cursor-not-allowed')
            }
            title={enough ? 'Stop recording' : `${Math.max(0, minSec - duration)}s more to enable stop`}
            aria-label="Stop recording"
          >
            {/* 方块 icon 表示"停止" */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-9 h-9"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        </div>
      )}

      {/* 录音结束 (有 speechUrl) 但还没出 feedback: 显示音频播放器 + 字幕 (录制后看, 替代之前"识别中") */}
      {!!speechUrl && !feedback && (
        <div className="rounded-xl bg-white border-2 border-rose-200 p-2 space-y-1.5">
          <audio src={speechUrl} controls className="w-full" />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-rose-400 font-extrabold mb-1 flex items-center gap-2">
              <span>What you said</span>
              {qwenRecognizing && (
                <span className="text-[9px] text-violet-500 font-bold">recognizing</span>
              )}
            </div>
            {sttSupported ? (
              <textarea
                value={transcript}
                onChange={(e) => onTranscriptEdit(e.target.value)}
                rows={2}
                placeholder="(no text recognized)"
                className="w-full rounded-lg border border-rose-200 bg-rose-50/40 px-2 py-1.5 outline-none focus:border-brand-purple text-stone-800 font-bold text-sm resize-none"
              />
            ) : qwenText ? (
              <textarea
                value={qwenText}
                onChange={(e) => onTranscriptEdit(e.target.value)}
                rows={2}
                placeholder="(no text recognized)"
                className="w-full rounded-lg border border-rose-200 bg-rose-50/40 px-2 py-1.5 outline-none focus:border-brand-purple text-stone-800 font-bold text-sm resize-none"
              />
            ) : qwenRecognizing ? (
              <div className="text-xs text-violet-500 italic">recognizing…</div>
            ) : (
              <div className="text-xs text-stone-500 italic">
                Your browser doesn't support real-time transcription (Chrome / Edge / Android only)
              </div>
            )}
          </div>
        </div>
      )}

      {/* 录音完成 + 识别完成 (有 feedback) → 音频 + 字幕 + 通过/重录 */}
      {(isDone && feedback?.isCorrect) && (
        <div className="rounded-xl bg-emerald-50 border-2 border-emerald-200 px-3 py-3 text-center space-y-2">
          {speechUrl && (
            <audio src={speechUrl} controls className="w-full" />
          )}
          <div className="text-stone-800 font-bold text-sm leading-relaxed px-1 py-1">
            {qwenText || transcript || <span className="text-stone-300">(no text recognized)</span>}
          </div>
          <div className="text-emerald-700 font-extrabold text-sm">🎉 Correct!</div>
          <button
            type="button"
            onClick={onContinue}
            className="w-full btn-kid bg-gradient-to-r from-brand-purple to-brand-blue text-white"
          >
            ▶ Keep watching
          </button>
        </div>
      )}

      {isDone && feedback && !feedback.isCorrect && (
        <div className="rounded-xl bg-rose-50 border-2 border-rose-200 px-3 py-3 text-center space-y-2">
          {speechUrl && (
            <audio src={speechUrl} controls className="w-full" />
          )}
          <div className="text-stone-800 font-bold text-sm leading-relaxed px-1 py-1">
            {qwenText || transcript || <span className="text-stone-300">(no text recognized)</span>}
          </div>
          <div className="text-rose-700 font-extrabold text-sm">💪 Try again</div>
          {/* 听标准音按钮 — 失败时自动播一次, 学员可手动重听 */}
          <button
            type="button"
            onClick={onPlayPromptAudio}
            className="w-full btn-kid bg-white text-stone-800 border-2 border-stone-300"
          >
            🔊 Listen to model
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="w-full btn-kid bg-gradient-to-r from-brand-purple to-brand-blue text-white"
          >
            🎤 Try again
          </button>
        </div>
      )}
    </div>
  );
}

function OptionGrid({
  options,
  selected,
  onPick,
  onPlayAudio,
}: {
  options: InterruptOption[];
  selected: Set<string>;
  onPick: (id: string) => void;
  onPlayAudio: (url: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {options.map((opt, i) => {
        const picked = selected.has(opt.id);
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => {
              onPick(opt.id);
              if (opt.audioUrl) onPlayAudio(opt.audioUrl);
            }}
            className={
              'rounded-2xl border-2 p-2 font-extrabold transition flex flex-col items-center gap-1.5 text-center ' +
              (picked
                ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white border-white/40 shadow-pop'
                : 'bg-white text-stone-700 border-amber-200 hover:border-brand-purple')
            }
          >
            {opt.imageUrl ? (
              <img
                src={mediaProxy(opt.imageUrl)}
                alt=""
                className={
                  'w-full aspect-square object-cover rounded-xl border-2 ' +
                  (picked ? 'border-white/40' : 'border-amber-200 bg-white')
                }
              />
            ) : (
              <div
                className={
                  'w-full aspect-square rounded-xl border-2 grid place-items-center text-2xl ' +
                  (picked ? 'bg-white/20 border-white/40' : 'bg-amber-50 border-amber-200 text-stone-400')
                }
              >
                ?
              </div>
            )}
            <div className="flex items-center gap-1.5 w-full">
              <span
                className={
                  'shrink-0 w-6 h-6 rounded-md grid place-items-center border-2 text-xs ' +
                  (picked ? 'bg-white/20 border-white/40' : 'bg-amber-50 border-amber-200')
                }
              >
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 truncate text-sm">
                {opt.text || `Option ${String.fromCharCode(65 + i)}`}
              </span>
              {opt.audioUrl && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayAudio(opt.audioUrl!);
                  }}
                  className={
                    'shrink-0 w-6 h-6 rounded-md grid place-items-center border-2 text-xs ' +
                    (picked ? 'bg-white/20 border-white/40' : 'bg-amber-50 border-amber-200 hover:bg-amber-100')
                  }
                  title="Play option audio"
                >
                  ♪
                </span>
              )}
              {picked && <span className="text-white text-xs">✓</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function QuizInline({
  quiz,
  picked,
  text,
  onPick,
  onText,
  onPlayAudio,
  disabled,
}: {
  quiz: any;
  picked: Set<string>;
  text: string;
  onPick: (id: string) => void;
  onText: (v: string) => void;
  onPlayAudio: (url: string) => void;
  disabled: boolean;
}) {
  const isFill = quiz?.kind === 'BLANK';
  const isImageFill = isFill && (quiz.answerImages?.length ?? 0) > 0;
  // 进入该题 / quiz 引用变了, 自动播题面音频
  const promptAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = promptAudioRef.current;
    if (!a || !quiz?.promptAudioUrl) return;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => {});
  }, [quiz?.id, quiz?.promptAudioUrl]);
  return (
    <div className="space-y-3">
      {/* 题面 + 配图 + 音频 */}
      {quiz?.image && (
        <div className="flex justify-center">
          <img
            src={mediaProxy(quiz.image)}
            alt=""
            className="max-w-full max-h-72 h-auto object-contain rounded-2xl bg-transparent"
          />
        </div>
      )}
      {quiz?.prompt && (
        <div className="text-stone-800 font-extrabold text-base text-center leading-relaxed">
          {quiz.prompt}
        </div>
      )}
      {quiz?.promptAudioUrl && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => onPlayAudio(quiz.promptAudioUrl)}
            className="size-9 rounded-full bg-amber-300 grid place-items-center text-stone-800 font-extrabold hover:bg-amber-400 active:scale-95 transition"
            title="Play again"
          >
            ♪
          </button>
        </div>
      )}

      {/* 文字填空 */}
      {isFill && !isImageFill && (
        <input
          type="text"
          value={text}
          onChange={(e) => onText(e.target.value)}
          disabled={disabled}
          autoFocus
          placeholder="Type the word…"
          className="w-full text-center text-2xl font-extrabold tracking-widest rounded-2xl border-2 border-amber-200 bg-white px-3 py-3 outline-none focus:border-brand-purple shadow-pop uppercase placeholder:normal-case placeholder:text-stone-300"
        />
      )}

      {/* 选项：单选 / 多选 */}
      {!isFill && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(quiz?.options ?? []).map((opt: any) => {
            const active = picked.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPick(opt.id)}
                disabled={disabled}
                className={
                  'rounded-2xl border-2 font-extrabold transition flex flex-col items-center ' +
                  (opt.image ? 'p-2 gap-2 ' : 'p-2 ') +
                  (active
                    ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white border-white/40 shadow-pop'
                    : 'bg-white text-stone-700 border-amber-200 hover:border-brand-purple')
                }
              >
                {opt.image && (
                  <img
                    src={mediaProxy(opt.image)}
                    alt=""
                    className={'max-w-full max-h-32 h-auto object-contain rounded-xl border-2 bg-transparent ' + (active ? 'border-white/60' : 'border-white/40')}
                  />
                )}
                <div className="flex items-center gap-1.5 w-full">
                  <span className="flex-1 truncate text-sm">{opt.text || opt.id}</span>
                  {opt.audioUrl && (
                    <span
                      role="button"
                      tabIndex={-1}
                      onClick={(e) => { e.stopPropagation(); onPlayAudio(opt.audioUrl); }}
                      className={'shrink-0 w-6 h-6 rounded-md grid place-items-center border-2 text-xs ' + (active ? 'bg-white/20 border-white/40' : 'bg-amber-50 border-amber-200 hover:bg-amber-100')}
                      title="Play option audio"
                    >
                      ♪
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 填空-图片答案模式 */}
      {isImageFill && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(quiz.answerImages ?? []).map((it: any) => {
            const active = picked.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  // 由 onPick 处理 set
                  onPick(it.id);
                  if (it.audioUrl) onPlayAudio(it.audioUrl);
                }}
                disabled={disabled}
                className={
                  'rounded-2xl border-2 p-2 font-extrabold transition flex flex-col items-center gap-2 ' +
                  (active
                    ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white border-white/40 shadow-pop'
                    : 'bg-white text-stone-700 border-amber-200 hover:border-brand-purple')
                }
              >
                <img
                  src={mediaProxy(it.image)}
                  alt=""
                  className={'w-full h-28 object-contain rounded-xl border-2 bg-transparent ' + (active ? 'border-white/60' : 'border-white/40')}
                />
              </button>
            );
          })}
        </div>
      )}
      {/* 隐藏的题面音频：每次 quiz 变 / promptAudioUrl 变自动播一次 */}
      {quiz?.promptAudioUrl && (
        <audio ref={promptAudioRef} src={mediaProxy(quiz.promptAudioUrl)} preload="auto" />
      )}
    </div>
  );
}

function SafariInline({
  safari,
  visited,
  onVisit,
  onPlayAudio,
}: {
  safari: any;
  visited: Set<string>;
  onVisit: (id: string) => void;
  onPlayAudio: (url: string) => void;
}) {
  const tags: any[] = safari?.tags ?? [];
  const mascotUrl: string | undefined = safari?.mascotUrl;
  const sceneUrl: string | undefined = safari?.imageUrl;
  // 容器用原图比例（如果测不到用 4:3 兜底）
  const [ratio, setRatio] = useState<number | null>(null);
  // 题目（可空 · 来自 ImageSafariContent.prompt/promptImageUrl/promptAudioUrl）。
  // 中断弹窗里的 SAFARI 题型与 step=超市探险 共用此区。
  const prompt: string | undefined = safari?.prompt;
  const promptImageUrl: string | undefined = safari?.promptImageUrl;
  const promptAudioUrl: string | undefined = safari?.promptAudioUrl;
  return (
    <div className="space-y-2">
      {(prompt || promptImageUrl || promptAudioUrl) && (
        <div className="rounded-2xl border-2 border-pink-200 bg-white p-3 flex items-start gap-3">
          {promptImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaProxy(promptImageUrl)}
              alt=""
              className="max-h-24 w-auto rounded-xl border-2 border-pink-200 bg-pink-50 object-contain"
            />
          )}
          <div className="flex-1 min-w-0">
            {prompt && (
              <div className="text-stone-800 font-extrabold text-base leading-relaxed">{prompt}</div>
            )}
            {promptAudioUrl && <PromptAudioPlayer url={promptAudioUrl} />}
          </div>
        </div>
      )}
      {sceneUrl ? (
        <div
          className="relative w-full overflow-hidden rounded-2xl border-2 border-amber-200 bg-amber-50"
          style={ratio ? { aspectRatio: `${ratio}` } : { aspectRatio: '4/3' }}
        >
          {/* 原图（用于测比例） */}
          <img
            src={mediaProxy(sceneUrl)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setRatio(img.naturalWidth / img.naturalHeight);
              }
            }}
          />
          {/* 吉祥物 */}
          {mascotUrl && (
            <img
              src={mediaProxy(mascotUrl)}
              alt=""
              className="absolute"
              style={{
                left: `${safari?.mascotX ?? 50}%`,
                top: `${safari?.mascotY ?? 85}%`,
                transform: `translate(-50%, -50%) scale(${safari?.mascotScale ?? 1})`,
                transformOrigin: 'center',
                maxWidth: '20%',
              }}
            />
          )}
          {/* Tags */}
          {tags.map((tag) => {
            const isVisited = visited.has(tag.id);
            const scale = tag.scale ?? 1;
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => {
                  onVisit(tag.id);
                  // 依次播放 audioUrl1 → audioUrl2
                  const seq = [tag.audioUrl1, tag.audioUrl2].filter(Boolean) as string[];
                  seq.forEach((u, i) => setTimeout(() => onPlayAudio(u), i * 50));
                }}
                className="absolute rounded-full font-extrabold flex items-center justify-center transition active:scale-95"
                style={{
                  left: `${tag.x}%`,
                  top: `${tag.y}%`,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                  transformOrigin: 'center',
                  // 有 imageUrl 时只用图片本身（无彩底圆 / 无固定 44px · 撑开真实尺寸）
                  ...(tag.imageUrl
                    ? {
                        background: 'transparent',
                        border: 'none',
                        width: 'auto',
                        height: 'auto',
                        padding: 0,
                        boxShadow: 'none',
                      }
                    : {
                        background: tag.color || '#FF8A3D',
                        color: 'white',
                        border: isVisited ? '3px solid #10b981' : '3px solid white',
                        width: '44px',
                        height: '44px',
                        fontSize: '14px',
                        boxShadow: '0 4px 0 rgba(0,0,0,0.15)',
                      }),
                }}
                title={tag.label}
              >
                {tag.imageUrl ? (
                  // 只用图片本身：去掉内部 rounded-full 避免强行切圆
                  <img
                    src={mediaProxy(tag.imageUrl)}
                    alt=""
                    className="max-w-[120px] max-h-[120px] block"
                    draggable={false}
                  />
                ) : (
                  tag.label?.[0] || '?'
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid place-items-center min-h-[120px] rounded-2xl border-2 border-dashed border-amber-200 text-stone-400 text-sm font-bold">
          No scene image set yet
        </div>
      )}
      <div className="text-xs text-stone-500 text-center">
        Tap around the scene to listen — explored {visited.size} / {tags.length}
      </div>
    </div>
  );
}

function PromptAudioPlayer({ url, audioRef }: { url: string; audioRef?: React.RefObject<HTMLAudioElement | null> }) {
  const innerRef = useRef<HTMLAudioElement | null>(null);
  const ref = (audioRef ?? innerRef) as React.RefObject<HTMLAudioElement | null>;
  // 仅独立使用（外部未传 audioRef）时才在挂载/url 变时自动播。
  // 当外部传入 audioRef 时，自动播由外部 useEffect 统一负责，避免两个 audio 元素同时播同一 src 造成回声。
  useEffect(() => {
    if (audioRef) return;
    const a = ref.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  }, [url, audioRef]);
  return (
    <div className="mb-3 flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          const a = ref.current;
          if (!a) return;
          a.currentTime = 0;
          a.play().catch(() => {});
        }}
        className="size-9 rounded-full bg-amber-300 grid place-items-center text-stone-800 font-extrabold hover:bg-amber-400 active:scale-95 transition"
        title="Play again"
      >
        ♪
      </button>
      {!audioRef && <audio ref={innerRef} src={mediaProxy(url)} preload="auto" />}
    </div>
  );
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
