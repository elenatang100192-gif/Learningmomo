'use client';
// 学生端顶部 bar：大圆角色块 Logo + 品牌名 + Weekly 星条 + Streak + 头像
// 风格：可汗儿童版风（扁平矢量 · 圆角 · 淡紫 + 暖黄 + 桃粉 · 几乎无阴影）
export function TopBar({
  stars = 0,
  weeklyGoal = 25,
  streak = 0,
}: {
  stars?: number;
  weeklyGoal?: number;
  streak?: number;
}) {
  const pct = Math.min(100, Math.round((stars / weeklyGoal) * 100));
  return (
    <header className="page-grid flex items-center gap-3 sm:gap-4 pt-5 pb-3">
      {/* Logo: 大圆桃粉 + "L" 白色字 */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="size-12 sm:size-14 rounded-full grid place-items-center font-extrabold text-white text-2xl"
          style={{
            background: 'var(--stu-rose)',
            boxShadow: 'none',
          }}
        >
          L
        </div>
        <div className="min-w-0">
          <div className="text-[var(--stu-ink)] text-xl sm:text-2xl font-extrabold leading-none tracking-tight">
            LingoLand
          </div>
          <div className="text-[var(--stu-ink-soft)] text-[10px] sm:text-[11px] font-extrabold uppercase tracking-[0.18em] mt-1">
            Play · Speak · Shine
          </div>
        </div>
      </div>

      {/* Weekly stars 进度：淡紫胶囊 */}
      <div className="hidden sm:flex rounded-full p-1.5 pl-1.5 items-center gap-2 min-w-[230px]"
           style={{
             background: 'var(--stu-paper)',
             border: '1px solid var(--stu-line)',
             boxShadow: 'none',
           }}>
        <div className="size-9 rounded-full grid place-items-center text-lg"
             style={{
               background: 'var(--stu-yellow)',
               boxShadow: 'none',
             }}>
          ⭐
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex justify-between text-[11px]">
            <span style={{ color: 'var(--stu-ink-soft)', fontWeight: 700 }}>Weekly stars</span>
            <span style={{ color: 'var(--stu-ink)', fontWeight: 800 }}>{stars} / {weeklyGoal}</span>
          </div>
          <div className="mt-1 h-2 rounded-full overflow-hidden"
               style={{ background: 'var(--stu-line)' }}>
            <div className="h-full rounded-full"
                 style={{
                   width: `${pct}%`,
                   background: 'var(--stu-purple)',
                 }} />
          </div>
        </div>
      </div>

      {/* Streak: 暖橙胶囊 */}
      <div className="hidden md:flex rounded-full pl-2 pr-3 items-center gap-2 h-[48px]"
           style={{
             background: 'var(--stu-orange)',
             boxShadow: 'none',
           }}>
        <span className="text-xl">🔥</span>
        <div>
          <div className="text-white text-xl font-extrabold leading-none">{streak}</div>
          <div className="text-white/80 text-[10px] -mt-0.5 font-extrabold tracking-wider uppercase">day streak</div>
        </div>
      </div>

      {/* 头像：草绿圆 + 白色字 */}
      <button
        className="size-12 sm:size-14 rounded-full grid place-items-center"
        style={{
          background: 'linear-gradient(135deg, #FF8FA3 0%, #FFCE4D 100%)',
          boxShadow: 'none',
        }}
      >
        <span className="text-2xl">👧</span>
        <span className="absolute mt-7 ml-7 size-3.5 rounded-full"
              style={{ background: 'var(--stu-green)' }} />
      </button>
    </header>
  );
}
