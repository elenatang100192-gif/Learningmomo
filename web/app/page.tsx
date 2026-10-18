'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, CourseDTO, LessonWithStatus } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { TopBar } from '@/components/layout/TopBar';
import { LessonNode } from '@/components/map/LessonNode';
import { UnitTabs, Unit } from '@/components/map/UnitTabs';
import { SpeakingCard } from '@/components/lesson/SpeakingCard';
import { DashedArrow } from '@/components/map/DashedArrow';
import { GrassHill } from '@/components/layout/SkyDecor';

const proxyMedia = (url: string) =>
  url.startsWith('http') ? `/api/media?u=${encodeURIComponent(url)}` : url;

export default function MapPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseDTO[] | null>(null);
  const [stars, setStars] = useState(0);
  const [activeTab, setActiveTab] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tagAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [playingLessonId, setPlayingLessonId] = useState<string | null>(null);

  useEffect(() => {
    api.listCourses().then((all) => {
      setCourses(all);
    }).catch(console.error);
    api.getMyStars().then((r) => setStars(r.total)).catch(() => {});
  }, []);

  // 把 audio 的播放状态同步到 React state，
  // 让 SpeakingCard 知道现在该不该让嘴"动起来"
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setIsSpeaking(true);
    const onPauseOrEnd = () => setIsSpeaking(false);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPauseOrEnd);
    el.addEventListener('ended', onPauseOrEnd);
    el.addEventListener('emptied', onPauseOrEnd);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPauseOrEnd);
      el.removeEventListener('ended', onPauseOrEnd);
      el.removeEventListener('emptied', onPauseOrEnd);
    };
  }, []);

  const course = useMemo(() => courses?.[activeTab], [courses, activeTab]);
  const lessons = useMemo(() => course?.lessons ?? [], [course]);
  const useScene = !!course?.sceneImageUrl;

  // 学员端：点画布上的 lesson 气泡 → 播音频 → 跳 lesson 详情
  const playLessonTag = (l: LessonWithStatus) => {
    if (l.status === 'LOCKED') return;
    const audio = l.placement?.audioUrl;
    // 互斥：点新 lesson 之前，先停掉所有可能还在播的音频
    // （1）课程介绍 audio；（2）上一个 lesson 标签 audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.removeAttribute('src');
      audioRef.current.load();
    }
    if (tagAudioRef.current) {
      tagAudioRef.current.pause();
      tagAudioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);

    const a = tagAudioRef.current;
    setPlayingLessonId(l.id);
    if (audio && a) {
      a.src = proxyMedia(audio);
      a.currentTime = 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => goLesson(l));
    } else {
      // 没音频就直接进
      goLesson(l);
    }
  };
  const goLesson = (l: LessonWithStatus) => {
    setPlayingLessonId(null);
    router.push(`/lesson/${l.id}/play`);
  };

  // 每次切换 tab（或者首次加载到含音频的课程），自动播放课程介绍音频
  useEffect(() => {
    const url = course?.introAudioUrl;
    // 切 tab 时也确保 lesson 标签音频不再播
    if (tagAudioRef.current) {
      tagAudioRef.current.pause();
      tagAudioRef.current.currentTime = 0;
    }
    if (!url || !audioRef.current) return;
    const el = audioRef.current;
    el.src = url;
    el.currentTime = 0;
    el.volume = 0.85;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      // 浏览器自动播放策略可能导致失败，吞掉即可（不打扰用户）
      p.catch(() => { /* 用户首次交互前可能拒绝，静默 */ });
    }
  }, [course?.id, course?.introAudioUrl]);

  // 喂给 UnitTabs 的数据
  const units: Unit[] = useMemo(() => {
    if (!courses) return [];
    return courses.map((c) => ({
      id: c.id,
      name: c.title,
      done: c.lessons.filter((l) => l.status === 'COMPLETED').length,
      total: c.lessons.length,
    }));
  }, [courses]);

  // 当前关卡：第一个 UNLOCKED 的；用于高亮黄色光晕
  const currentLessonIndex = useMemo(() => {
    const i = lessons.findIndex((l) => l.status === 'UNLOCKED');
    return i === -1 ? Math.max(0, lessons.length - 1) : i;
  }, [lessons]);

  return (
    <AppShell>
      {/* 顶部 bar */}
      <TopBar stars={Math.min(stars, 25)} weeklyGoal={25} streak={7} />

      {/* Topic 切换 tab（UNIT 1, 2, 3, 4…） */}
      {units.length > 0 && (
        <div className="page-grid mt-4">
          <UnitTabs units={units} activeIndex={activeTab} onChange={setActiveTab} />
        </div>
      )}

      {/* 课程语音播报卡片（紫书角色 + 引语气泡 + 跳动音频条） */}
      <section className="page-grid mt-4 sm:mt-6">
        <SpeakingCard course={course ?? null} isSpeaking={isSpeaking} />
      </section>

      {/* 学习路径图：场景图直接显示（无外层白底卡） */}
      <section className="page-grid mt-4 sm:mt-6">
        <div
          className="relative max-w-[960px] mx-auto"
        >
          {!course && (
            <div className="grid place-items-center min-h-[400px] font-extrabold" style={{ color: 'var(--stu-ink-soft)' }}>
              Loading…
            </div>
          )}

          {course && lessons.length > 0 && useScene && (
            <CourseSceneView
              course={course}
              playingLessonId={playingLessonId}
              onPick={playLessonTag}
            />
          )}

          {course && lessons.length > 0 && !useScene && (
            <div
              className="relative mx-auto py-8"
              style={{ width: '100%', maxWidth: 920 }}
            >
              <div className="grid grid-cols-4 gap-x-2 sm:gap-x-3 items-start">
                {lessons.map((l, i) => {
                  const cleanTitle = l.title.replace(/^\d+[\.\s、]?\s*/, '');
                  const isLast = i === lessons.length - 1;
                  return (
                    <div key={l.id} className="relative flex flex-col items-center">
                      {!isLast && (
                        <DashedArrow className="absolute top-[42%] -right-3 sm:-right-5 z-10 pointer-events-none" />
                      )}
                      <LessonNode
                        index={i + 1}
                        title={cleanTitle}
                        status={l.status}
                        iconUrl={l.iconUrl ?? null}
                        href={l.status === 'LOCKED' ? undefined : `/lesson/${l.id}/play`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {course && lessons.length === 0 && (
            <div className="grid place-items-center min-h-[400px] font-extrabold" style={{ color: 'var(--stu-ink-soft)' }}>
              No courses yet. Stay tuned!
            </div>
          )}
        </div>
      </section>

      <GrassHill />
      {/* 隐藏的播放器：tab 介绍 + 学员点 lesson 气泡后播音频 */}
      <audio
        ref={tagAudioRef}
        preload="auto"
        onEnded={(e) => {
          const id = playingLessonId;
          if (id) {
            const l = lessons.find((x) => x.id === id);
            if (l) goLesson(l);
          }
        }}
      />
      <audio ref={audioRef} preload="auto" />
    </AppShell>
  );
}

// ===== 课程场景画布学员端组件 =====
function CourseSceneView({
  course,
  playingLessonId,
  onPick,
}: {
  course: CourseDTO;
  playingLessonId: string | null;
  onPick: (l: LessonWithStatus) => void;
}) {
  const placed = course.lessons.filter((l) => !!l.placement);
  return (
    <div className="relative mx-auto py-4" style={{ width: '100%', maxWidth: 920 }}>
      <div
        className="relative w-full mx-auto overflow-hidden"
        style={{ aspectRatio: '16 / 10' }}
      >
        {course.sceneImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={proxyMedia(course.sceneImageUrl)}
            alt={course.title}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        )}
        {placed.map((l) => {
          const p = l.placement!;
          const locked = l.status === 'LOCKED';
          const isPlaying = playingLessonId === l.id;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => onPick(l)}
              disabled={locked}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).blur(); }}
              onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).blur(); }}
              className={[
                'absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer',
                'rounded-full px-3 py-1.5 text-white text-xs sm:text-base font-extrabold whitespace-nowrap',
                'flex items-center gap-1.5',
                'transition-[box-shadow,transform,filter] duration-200 ease-out',
                'shadow-[0_0_0_3px_rgba(255,255,255,0.85),0_6px_18px_rgba(0,0,0,0.25)]',
                'hover:-translate-y-[2px] hover:scale-[1.06]',
                'hover:shadow-[0_0_0_4px_rgba(255,255,255,1),0_0_24px_rgba(255,255,255,0.6),0_8px_20px_rgba(0,0,0,0.3)]',
                'active:translate-y-px active:scale-[1.02]',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white',
                'animate-pulse-slow',
                locked
                  ? 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:scale-100 hover:shadow-[0_0_0_3px_rgba(255,255,255,0.85),0_6px_18px_rgba(0,0,0,0.25)] animate-none'
                  : isPlaying
                    ? 'ring-2 ring-white scale-110 shadow-[0_0_0_4px_rgba(255,255,255,1),0_0_30px_rgba(255,255,255,0.7),0_10px_24px_rgba(0,0,0,0.35)] animate-none'
                    : '',
              ].join(' ')}
              style={{
                left: `${p.x * 100}%`,
                top: `${p.y * 100}%`,
                background: locked ? '#8B7BAD' : (p.color || '#A48AF0'),
                border: 'none',
              }}
              title={locked ? 'Locked' : (p.audioUrl ? 'Tap to play' : 'No audio configured')}
            >
              {locked ? (
                <span aria-hidden className="text-base leading-none">🔒</span>
              ) : null}
              <span className="inline-flex items-center gap-1.5">
                {isPlaying && (
                  <svg viewBox="0 0 1024 1024" className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden>
                    <path d="M385.237333 228.266667l350.933334 210.56c55.253333 33.152 55.253333 113.194667 0 146.346666L385.28 795.733333c-40.789333 24.490667-89.6 10.325333-113.92-24.149333l-0.042667 0.042667a42.666667 42.666667 0 1 0-73.216 43.946666l-0.085333 0.042667c47.36 72.533333 147.626667 103.424 231.168 53.333333l350.933333-210.602666c110.506667-66.304 110.506667-226.389333 0-292.693334l-350.933333-210.56C315.392 86.826667 170.666667 168.746667 170.666667 301.44V640a42.666667 42.666667 0 1 0 85.333333 0V301.44C256 235.093333 328.362667 194.133333 385.237333 228.266667z" fill="currentColor" />
                  </svg>
                )}
                <span>{l.title.replace(/^\d+[\.\s、]?\s*/, '')}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
