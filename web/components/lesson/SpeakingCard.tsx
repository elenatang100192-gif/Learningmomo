'use client';
// 课程语音播报卡片（可汗儿童版风 · 扁平矢量 · 圆角 · 淡紫）
// - 角色（Mascot，3 状态：idle/speaking/happy）
// - 引语气泡（标题 + 句子）
import { useMemo } from 'react';
import type { CourseDTO } from '@/lib/api';
import { Mascot } from './Mascot';

export function SpeakingCard({
  course,
  isSpeaking = false,
}: {
  course: CourseDTO | null;
  isSpeaking?: boolean;
}) {
  const headline = useMemo(
    () => (course as any)?.introText ?? course?.description ?? course?.title ?? 'What are you going to learn today?',
    [course],
  );

  if (!course) return null;

  const mascotState = isSpeaking ? 'speaking' : 'idle';

  return (
    <div className="mx-auto w-full max-w-[920px] h-[260px] sm:h-[260px] max-h-[540px] relative overflow-hidden rounded-[24px] backdrop-blur-md"
         style={{ background: 'rgba(255,255,255,0.65)', border: '1px solid var(--stu-line)', boxShadow: 'none' }}>
      {/* 背景装饰圆（淡紫/淡黄小圆点，无强烈存在感） */}
      <div className="hidden sm:block size-32 left-[480px] top-[-60px] absolute rounded-full opacity-40"
           style={{ background: '#C9B8F7' }} />
      <div className="hidden sm:block size-24 left-[-30px] top-[240px] absolute rounded-full opacity-30"
           style={{ background: '#FFCE4D' }} />

      {/* 角色 — 内联 SVG，size=220 方容器，按 viewBox 等比 meet 居中 */}
      <div
        className="absolute"
        style={{ left: 0, top: 20, width: 220, height: 220 }}
      >
        <Mascot state={mascotState} size={220} className="mascot-shift" />
      </div>

      {/* 引语气泡 — 钉死在卡片右侧 */}
      <div
        className="left-[180px] sm:left-[230px] right-4 sm:right-6 top-12 sm:top-[90px] absolute
                   bg-white/80 backdrop-blur-sm px-4 sm:px-6 py-4 sm:py-5
                   rounded-tl-2xl rounded-tr-3xl rounded-bl-3xl rounded-br-3xl
                   flex flex-col items-start gap-2.5
                   shadow-[0_18px_40px_-12px_rgba(0,0,0,0.22),0_6px_14px_-6px_rgba(0,0,0,0.10),0_1px_0_rgba(255,255,255,0.9)_inset]
                   ring-1 ring-black/[0.04]"
        style={{ border: '1px solid var(--stu-line)' }}
      >
        <div className="text-[var(--stu-purple)] text-[10px] sm:text-[11px] font-extrabold uppercase leading-3 tracking-[0.18em]">
          Listen carefully
        </div>
        <div className="w-full text-[var(--stu-ink)] text-[15px] sm:text-[19px] font-medium leading-6 sm:leading-7">
          {headline}
        </div>
      </div>
    </div>
  );
}
