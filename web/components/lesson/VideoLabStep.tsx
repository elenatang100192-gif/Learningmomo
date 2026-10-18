'use client';
// 视频口语实验（Video Lab step）—— 多视频队列，
// 每个视频独立开关"需要麦克风口语回答"。
// 视觉参考：参考 UI 的 Video Speaking Lab（紫底老师视频 + 麦克风 + 选项卡）
import { useEffect, useRef, useState } from 'react';
import type { VideoLabContent, VideoLabItem } from '@/lib/stepContents';
import { mediaProxy } from '@/lib/mediaProxy';
import { api } from '@/lib/api';
import { adminApi } from '@/lib/adminApi';

type Phase = 'watch' | 'answer' | 'done';

export function VideoLabStep({
  content,
  onResult,
  onDone,
  onPrev,
}: {
  content: VideoLabContent;
  onResult: (stars: number) => void;
  onDone?: () => void;
  onPrev?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('watch');
  const [recording, setRecording] = useState(false);
  // 用 ref 而不是 state: setState 是异步的, onstop 里如果用 state 还会是上一次的值
  const recStartTsRef = useRef(0);
  const [recStartTs, setRecStartTs] = useState(0);
  const [recDurationMs, setRecDurationMs] = useState(0);
  const [scoring, setScoring] = useState(false);
  const [scoreInfo, setScoreInfo] = useState<{ passed: boolean; asrText: string; reason: string } | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [modelAudioPlaying, setModelAudioPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recordBtnRef = useRef<HTMLButtonElement>(null);
  const promptAudioRef = useRef<HTMLAudioElement>(null);   // 题目音频 (进 answer 时自动播)
  const answerAudioRef = useRef<HTMLAudioElement>(null);   // 答案音频 (答错时自动播, 听标准音按钮)
  const fallbackAudioRef = useRef<HTMLAudioElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<BlobPart[]>([]);

  const total = content.videos.length;
  const v = content.videos[idx];
  const isLast = idx === total - 1;

  useEffect(() => {
    return () => {
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    setPhase('watch');
    setError('');
    setRecording(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      const p = videoRef.current.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  }, [idx, v?.id]);

  // 进入新条目时，若有 promptAudioUrl 则播它；否则播 fallbackAudioUrl
  // （依赖里不放 recording —— 录音中不重播示范音；见下面单独 effect）
  useEffect(() => {
    if (phase !== 'watch') return;
    if (v?.videoUrl) return; // 有视频时不管
    // 优先用 promptAudioUrl（题示范音），没有才用 fallbackAudioUrl
    const usePrompt = !!v?.promptAudioUrl;
    const useFallback = !usePrompt && !!v?.fallbackAudioUrl;
    if (!usePrompt && !useFallback) return;
    const audio = usePrompt ? promptAudioRef.current : fallbackAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* 静默 */ }
    return () => {
      // 离开题目/切换 phase 时停掉
      try {
        if (audio && !audio.paused) audio.pause();
      } catch { /* 静默 */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, v?.id, phase, v?.videoUrl, v?.promptAudioUrl, v?.fallbackAudioUrl]);

  // 录音中：暂停示范音（防止被录进去）。仅依赖 recording 与 v.id（不重播）
  useEffect(() => {
    if (!recording) return;
    const a = v?.promptAudioUrl ? promptAudioRef.current : fallbackAudioRef.current;
    if (a && !a.paused) {
      try { a.pause(); } catch { /* 静默 */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, v?.id]);

  // Tab-to-answer: 进入 answer 阶段自动聚焦录音按钮
  // 同时如果有题目音频：自动播放一遍（浏览器限制下可能被拦截 → 显示「🔊 播放示范音」按钮兜底）
  useEffect(() => {
    if (phase === 'answer' && v?.micRequired) {
      // 短延迟确保 overlay 已挂载
      const t = window.setTimeout(() => {
        recordBtnRef.current?.focus();
      }, 100);

      // 尝试自动播放题目音频
      let promptAudioTimer: number | undefined;
      if (v?.promptAudioUrl && promptAudioRef.current) {
        try {
          promptAudioRef.current.currentTime = 0;
          const p = promptAudioRef.current.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => {
              // 自动播放被拦截：等用户首次点击时再播（通过手动按钮）
            });
          }
        } catch { /* 静默 */ }
        // 30 秒后停止（兜底，防止学员点开始后还在播）
        promptAudioTimer = window.setTimeout(() => {
          if (promptAudioRef.current && !promptAudioRef.current.paused) {
            promptAudioRef.current.pause();
          }
        }, 30000);
      }

      return () => {
        window.clearTimeout(t);
        if (promptAudioTimer) window.clearTimeout(promptAudioTimer);
        if (promptAudioRef.current && !promptAudioRef.current.paused) {
          promptAudioRef.current.pause();
        }
      };
    }
  }, [phase, v?.micRequired, v?.promptAudioUrl, v?.id]);

  // ── 评分结果: ❌ 不再自动播答案音 ──
  // 原因: 答错时学员还在紧张状态, 自动播一段标准音容易被打断/听不清,
  //       而且很多场景下学员想先看反馈文字再决定要不要听示范。
  // 改为: 学员自己点 UI 上的"🔊 听标准音"按钮才播放 (见下方 onClick)
  // 数据保留: answerAudioUrl 字段 + answerAudioRef 依然存在, 仅不再触发自动播
  useEffect(() => {
    // no-op: 留作未来扩展, 例如以后想做"答错后 3s 自动播"再加 if
  }, [scoreInfo?.passed, v?.answerAudioUrl, v?.promptAudioUrl, v?.id]);

  // 不再渲染 phase==='done' 弹窗, 不再需要 8s 兜底 useEffect

  if (!v) {
    return (
      <div className="grid place-items-center min-h-[400px] text-stone-500">
        (No videos in this step)
      </div>
    );
  }

  function onVideoEnded() {
    if (v.micRequired) {
      setPhase('answer');
    } else {
      // 自动进入下一题
      advance();
    }
  }

  function advance() {
    setDone((cur) => new Set(cur).add(v.id));
    // 评分影响星星：通过 +3 / 未通过 +1
    if (scoreInfo) {
      onResult(scoreInfo.passed ? 3 : 1);
    } else {
      onResult(3);
    }
    // 清掉上一题的评分结果，否则切到下一题后反馈条还会挂着
    setScoreInfo(null);
    if (!isLast) {
      setIdx((cur) => cur + 1);
    } else {
      // 最后一题答完: 直接调 onDone 让父组件切到下一步 (或全部完成时显示 lesson 总结)
      if (onDone) onDone();
    }
  }

  function stopStream() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  async function startRecording() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError('Your browser does not support microphone recording.');
      return;
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = next;
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = mime ? new MediaRecorder(next, { mimeType: mime }) : new MediaRecorder(next);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stopStream();
        setRecording(false);
        const dur = Date.now() - recStartTsRef.current;
        setRecDurationMs(dur);
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        chunks.current = [];
        await gradeRecording(blob, dur);
      };
      rec.start();
      recorder.current = rec;
      recStartTsRef.current = Date.now();
      setRecStartTs(Date.now());
      setRecording(true);
    } catch {
      setError('Please allow the browser to use your microphone.');
    }
  }

  // ── 评分流程 ─────────────────────────────────────
  // 1) 时长检查：少于 minRecordingMs → 失败（0 星）
  // 2) ASR 识别（qwen 优先，失败回退）
  // 3) 匹配 passPhrases：每一行都必须命中（去标点/大小写无关）
  // 4) 命中 → 通过，给 3 星；不命中 → 失败
  async function gradeRecording(blob: Blob, durMs: number) {
    setScoring(true);
    setScoreInfo(null);
    try {
      // 兜底: v.minRecordingMs 未填 (undefined) → 默认 3000ms; 但 0 表示"无限制", 不要兜底
      const minMs = v?.minRecordingMs == null ? 3000 : v.minRecordingMs;
      if (blob.size < 1500) {
        setScoreInfo({ passed: false, asrText: '', reason: 'Recording too short — no sound detected' });
        return;
      }
      if (durMs < minMs) {
        setScoreInfo({ passed: false, asrText: '', reason: `Recording length ${(durMs / 1000).toFixed(1)}s, need ${(minMs / 1000).toFixed(1)}s` });
        return;
      }
      // 拿到上传 token —— 后缀必须与实际音频容器一致，否则阿里云 paraformer 解析失败
      // MediaRecorder 在 Chrome 输出 audio/webm; Safari 输出 audio/mp4。paraformer-v2 都吃。
      const mime = blob.type;
      const ext = mime.includes('mp4') || mime.includes('aac')
        ? 'm4a'
        : mime.includes('webm')
          ? 'webm'
          : mime.includes('ogg')
            ? 'ogg'
            : 'mp3';
      const tok = await adminApi.issueUploadToken('hongen/attempts', ext);
      const form = new FormData();
      form.append('file', blob, 'rec.' + ext);
      form.append('token', tok.token);
      form.append('key', tok.key);
      const up = await fetch('https://up-z2.qiniup.com', { method: 'POST', body: form });
      if (!up.ok) throw new Error('upload failed');
      const url = tok.publicUrl;
      const langs = (v?.speechLanguages && v.speechLanguages.length > 0) ? v.speechLanguages : ['en', 'zh'];
      const r = await api.transcribeAudio(url, langs);
      const text = (r?.text ?? '').trim();
      const asrError = (r as any)?.error as string | undefined;
      const phrases = v?.passPhrases ?? [];

      // —— 词级模糊匹配 ——
      // 把 asr 和每句标准短语都拆成"词袋"(全小写、去标点),
      // 然后算单句召回率: 短语词有多少比例出现在 asr 词袋中.
      // 任一短语召回 >= FUZZY_THRESHOLD (默认 0.7) 即视为命中该句.
      //   例: 标准 "chili leaves are not hot" -> 5 词
      //        asr  "chileaves are not hot"     -> 4 词 (chili+leaves 被 ASR 拼成 chileaves)
      //        命中 are/not/hot (3) = 60% < 70% -> 不算
      //   但通常: 标准 "but lemons are not" 5 词全在 -> 100% 命中
      // 这样既容忍 ASR 把 "chili leaves" 拼成 "chileaves" 的常见错误,
      // 又不会让学员完全跳过关键词都通过.
      const FUZZY_THRESHOLD = 0.7;
      const tokenize = (s: string) =>
        s.toLowerCase()
          .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
          .split(/\s+/)
          .filter(Boolean);
      const asrTokens = new Set(tokenize(text));
      const phraseReport = phrases.map((p) => {
        const toks = tokenize(p);
        if (toks.length === 0) return { phrase: p, recall: 0, missing: [] as string[] };
        const missing: string[] = [];
        let hit = 0;
        for (const t of toks) {
          // 既要严格相等, 也要接受 ASR 把两词粘一起 (如 "chileaves" 覆盖 "chili"+"leaves")
          // 处理: 遍历 asrTokens, 若 asrToken 包含 toks 全部子串也算命中
          let matched = asrTokens.has(t);
          if (!matched) {
            for (const at of asrTokens) {
              if (at !== t && at.length > t.length && at.includes(t)) { matched = true; break; }
            }
          }
          if (matched) hit++;
          else missing.push(t);
        }
        return { phrase: p, recall: hit / toks.length, missing };
      });
      const hitAll = phrases.length > 0 && phraseReport.every((r) => r.recall >= FUZZY_THRESHOLD);
      // 总体: 通过的关键短语的平均召回率 (用于反馈)
      const avgRecall = phrases.length
        ? phraseReport.reduce((s, r) => s + r.recall, 0) / phrases.length
        : 0;
      const missingWords = Array.from(new Set(phraseReport.flatMap((r) => r.missing))).slice(0, 6);
      // DEBUG
      // eslint-disable-next-line no-console
      console.log('[VideoLab SPEECH]', { text, phrases, phraseReport, hitAll, avgRecall, durMs, minMs, asrError });
      // ASR 软失败: 录音时长够, 但识别服务没拿到文字 — 走 Web Speech 兜底或人工确认
      if (!text && asrError) {
        setScoreInfo({
          passed: false,
          asrText: '',
          reason: `Recognition service unavailable (${asrError}). Please try again.`,
        });
        return;
      }
      setScoreInfo({
        passed: hitAll,
        asrText: text,
        reason: hitAll
          ? `✓ Passed (avg ${Math.round(avgRecall * 100)}% of key words)`
          : phrases.length === 0
            ? 'No key phrases configured — failing by default'
            : missingWords.length > 0
              ? `Missing key word(s): ${missingWords.join(', ')} (avg ${Math.round(avgRecall * 100)}%)`
              : `Didn\'t catch all key phrases (avg ${Math.round(avgRecall * 100)}%)`,
      });
    } catch (e) {
      console.warn('[VideoLab grade]', e);
      const msg = String((e as Error)?.message ?? e);
      // Backend error format: API 502: {"error":"asr failed","raw":{...}}
      let friendly = 'Grading failed: ' + msg;
      if (msg.includes('SUCCESS_WITH_NO_VALID_FRAGMENT')) {
        friendly = 'Couldn\'t hear you clearly (audio invalid). Please speak louder, closer to the mic, and try again.';
      } else if (msg.includes('"error":"asr failed"')) {
        friendly = 'Recognition failed. Please try again.';
      } else if (msg.includes('asr timeout')) {
        friendly = 'Recognition timed out. Please try again.';
      } else if (msg.includes('DASHSCOPE_API_KEY')) {
        friendly = 'Recognition service is not configured. Please contact your teacher.';
      }
      setScoreInfo({ passed: false, asrText: '', reason: friendly });
    } finally {
      setScoring(false);
    }
  }

  function stopRecording() {
    recorder.current?.stop();
  }

  function onRecordPress() {
    if (recording) stopRecording();
    else startRecording();
  }

  function onRecordKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onRecordPress();
    }
  }

  // 不再渲染 phase==='done' 弹窗: 最后一题答完直接调 onDone, 父组件处理 lesson 总结

  return (
    <div className="space-y-4">
      {/* 顶部进度 */}
      <div className="flex items-center gap-3">
        <div className="text-amber-700 font-extrabold">
          {idx + 1} / {total}
        </div>
        <div className="flex-1 h-3 bg-white/70 rounded-full overflow-hidden border border-amber-300">
          <div
            className="h-full bg-gradient-to-r from-brand-yellow to-brand-orange transition-all"
            style={{ width: `${(idx / total) * 100}%` }}
          />
        </div>
        <div className="text-xs text-amber-700 font-extrabold">
          Answered {done.size} / {total}
        </div>
      </div>

      {/* 直接渲染内容，去掉外层步骤卡包裹（卡片由 lesson play 父页面提供） */}
        {v.videoUrl ? (
          /* 有视频：保持 16:9 黑底视频区（与项目内其它 step 风格一致） */
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
            <video
              ref={videoRef}
              src={mediaProxy(v.videoUrl)}
              controls
              playsInline
              onEnded={onVideoEnded}
              className="w-full h-full"
            />
            {v.fallbackAudioUrl && (
              <audio
                ref={fallbackAudioRef}
                src={mediaProxy(v.fallbackAudioUrl)}
                loop
                preload="auto"
              />
            )}
          </div>
        ) : v.micRequired ? (
          /* 无视频 + 需要口语：扁平白底卡 / 图 / 题干 / 麦克风（一步到位） */
          <div className="rounded-2xl bg-[#F6F2FF] p-4 sm:p-5 flex flex-col gap-4">
            {/* 题图：原图大小，不加边框和背景（object-contain 已保比例） */}
            {(v.referenceImageUrl || v.coverImageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaProxy(v.referenceImageUrl || v.coverImageUrl!)}
                alt={v.name}
                className="w-full max-h-[40vh] object-contain"
              />
            )}
            {/* 题干 */}
            {v.prompt && (
              <div className="text-2xl sm:text-3xl font-extrabold text-[#1F1838] text-center leading-snug">
                {v.prompt}
              </div>
            )}
            {/* 兜底音频（如有）—— 进入 watch 时自动播一次 */}
            {v.fallbackAudioUrl && (
              <audio
                ref={fallbackAudioRef}
                src={mediaProxy(v.fallbackAudioUrl)}
                preload="auto"
              />
            )}
            {/* 题目音频（无 UI 按钮；进入 watch 时自动播一次，浏览器拦截时静默忽略） */}
            {v.promptAudioUrl && (
              <audio
                ref={promptAudioRef}
                src={mediaProxy(v.promptAudioUrl)}
                preload="auto"
                onEnded={() => setModelAudioPlaying(false)}
              />
            )}
            {/* 答案音频（评分失败时自动播；UI 上"听标准音"按钮可重听） */}
            {v.answerAudioUrl && (
              <audio
                ref={answerAudioRef}
                src={mediaProxy(v.answerAudioUrl)}
                preload="auto"
                onEnded={() => setModelAudioPlaying(false)}
              />
            )}
            {/* 录音动效条（录音中才显示） */}
            {recording && (
              <div className="flex items-center justify-center gap-1 h-8">
                {Array.from({ length: 9 }).map((_, i) => (
                  <span
                    key={i}
                    className="inline-block w-1.5 rounded-full bg-[#FF8A5C]"
                    style={{
                      height: '100%',
                      animation: `voice-bar 700ms ease-in-out ${i * 70}ms infinite alternate`,
                    }}
                  />
                ))}
              </div>
            )}
            {/* 录音按钮（扁平，无外框容器） */}
            <div className="px-2 py-3 flex flex-col items-center gap-2">
              <button
                ref={recordBtnRef}
                type="button"
                onClick={onRecordPress}
                onKeyDown={onRecordKey}
                disabled={scoring || (!scoreInfo?.passed && modelAudioPlaying)}
                className={
                  'btn-kid w-full sm:w-auto text-lg sm:text-xl py-4 sm:py-5 px-8 sm:px-10 ' +
                  (recording ? '!bg-[#FF8A5C]' : '!bg-[#7CC77B]') +
                  (scoring ? ' opacity-60 cursor-wait' : '')
                }
                aria-label={recording ? 'Stop recording' : 'Start recording'}
              >
                {scoring ? '⏳ Grading…' : recording ? '⏹ Stop' : '🎙 Start'}
              </button>
              <div className="text-[10px] text-[#4A3F70] font-extrabold">
                Tip: press <kbd className="px-1.5 py-0.5 bg-white border border-[#E5DFF5] rounded text-[#1F1838]">Space</kbd> to start / stop
              </div>
            </div>
            {/* 错误信息 */}
            {error && (
              <div className="rounded-2xl bg-[#FF8FA3]/15 text-[#B13E5A] text-xs font-extrabold px-3 py-2">
                {error}
              </div>
            )}
            {/* 评分结果 */}
            {scoreInfo && !scoring && (
              <div
                className={
                  'rounded-2xl text-xs font-extrabold px-3 py-2.5 text-left ' +
                  (scoreInfo.passed
                    ? 'bg-[#7CC77B]/15 text-[#3F8E3F]'
                    : 'bg-[#FF8FA3]/15 text-[#B13E5A]')
                }
              >
                <div className="flex items-center gap-1">
                  <span className="text-base">{scoreInfo.passed ? '🎉' : '😢'}</span>
                  <span>{scoreInfo.reason}</span>
                </div>
                {scoreInfo.asrText && (
                  <div className="mt-1.5 text-[10px] text-[#4A3F70] leading-relaxed font-bold">
                    Heard: <span className="italic">"{scoreInfo.asrText}"</span>
                  </div>
                )}
                {/* 听标准音按钮: 失败时已自动播一次, 学员可手动重听
                    数据源: answerAudioUrl (新建, 答错时播), 缺省回退 promptAudioUrl (老数据兼容)
                    限制: 播放期间禁止点 Start, 等音频播完才解锁 */}
                {(v.answerAudioUrl || v.promptAudioUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      const a = v.answerAudioUrl ? answerAudioRef.current : promptAudioRef.current;
                      if (a) {
                        setModelAudioPlaying(true);
                        a.currentTime = 0;
                        a.play().catch(() => setModelAudioPlaying(false));
                      }
                    }}
                    className="mt-2 btn-kid w-full !bg-white !text-[#4A3F70] !border-2 !border-[#4A3F70]/30"
                  >
                    🔊 Listen to model {modelAudioPlaying ? '…' : ''}
                  </button>
                )}
                {/* Next 按钮：只在答对时才出现 (失败时让学员停留在反馈区,
                    自己决定是再听标准音重试, 还是点页面顶部的 Back 退到上一步) */}
                {scoreInfo.passed && (
                  <button
                    type="button"
                    onClick={advance}
                    className="mt-2 btn-kid w-full !bg-[#FF8A5C]"
                  >
                    {isLast ? 'Finish step →' : 'Next →'}
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* 无视频 + 仅观看：纵向卡（不需要麦克风） */
          <div className="rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-purple-50 to-amber-50 p-4 sm:p-5 flex flex-col items-center gap-4">
            {v.coverImageUrl && (
              <div className="rounded-2xl overflow-hidden border-2 border-amber-200 bg-white w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaProxy(v.coverImageUrl)}
                  alt={v.name}
                  className="w-full max-h-[50vh] object-contain bg-white"
                />
              </div>
            )}
            {v.prompt && (
              <div className="text-2xl font-extrabold text-[#1F1838] text-center leading-snug">
                {v.prompt}
              </div>
            )}
            {v.fallbackAudioUrl && (
              <audio
                ref={fallbackAudioRef}
                src={mediaProxy(v.fallbackAudioUrl)}
                loop
                preload="auto"
              />
            )}
            {!v.coverImageUrl && !v.prompt && (
              <div className="text-center text-[#4A3F70] py-4">
                <div className="text-5xl mb-2">👀</div>
                <div className="font-extrabold">No action needed for this video</div>
              </div>
            )}
            <button
              type="button"
              onClick={advance}
              className="btn-kid w-full sm:w-auto text-lg py-4 px-8 !bg-[#7CC77B]"
            >
              {isLast ? 'Finish step →' : 'Next →'}
            </button>
          </div>
        )}

        {/* 题号缩略队列（可点击切换；当前题/已做/未做都可点） */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {content.videos.map((it, i) => {
            const isCurrent = i === idx;
            const isDone = done.has(it.id);
            return (
              <button
                type="button"
                key={it.id}
                onClick={() => {
                  if (i === idx) return; // 当前题：啥也不做
                  setIdx(i);
                }}
                className={
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold transition active:scale-95 ' +
                  (isCurrent
                    ? 'bg-[#FFCE4D] text-[#1F1838]'
                    : isDone
                      ? 'bg-[#7CC77B]/20 text-[#3F8E3F]'
                      : 'bg-white text-[#4A3F70] border border-[#E5DFF5]')
                }
                title={isCurrent ? 'Current' : isDone ? 'Done — tap to review' : 'Tap to jump to this one'}
              >
                {isDone ? '✓' : i + 1} {it.name.slice(0, 12)}
              </button>
            );
          })}
        </div>
    </div>
  );
}
