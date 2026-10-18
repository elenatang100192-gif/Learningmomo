'use client';
// 学生端 UNIT 切换胶囊：扁平白底胶囊 + 极淡紫描边；活动项紫色块（无立体偏移）
const dotColors = ['#A48AF0', '#7CC77B', '#FF8A5C', '#FFCE4D'];

export type Unit = {
  id: string;
  name: string;
  done: number;
  total: number;
};

export function UnitTabs({
  units,
  activeIndex,
  onChange,
}: {
  units: Unit[];
  activeIndex: number;
  onChange: (i: number) => void;
}) {
  return (
    <div
      className="rounded-full p-1.5 max-w-[760px] mx-auto"
      style={{
        background: 'var(--stu-paper)',
        border: '1px solid var(--stu-line)',
        boxShadow: 'none',
      }}
    >
      <div className="flex gap-1 overflow-x-auto scrollbar-none snap-x snap-mandatory">
        {units.map((u, i) => {
          const active = i === activeIndex;
          const hasProgress = u.total > 0;
          return (
            <button
              key={u.id}
              onClick={() => onChange(i)}
              className={`flex-shrink-0 snap-center flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2 rounded-full transition`}
              style={{
                minWidth: 'clamp(110px, 30vw, 200px)',
                background: active ? 'var(--stu-purple)' : 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: active ? '#FFFFFF' : 'var(--stu-ink-soft)',
              }}
            >
              <span
                className="size-2.5 rounded-sm"
                style={{
                  background: dotColors[i % dotColors.length],
                }}
              />
              <span
                className={`whitespace-nowrap text-xs sm:text-base ${active ? 'font-extrabold' : 'font-bold'}`}
              >
                {u.name}
              </span>
              {hasProgress && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-extrabold`}
                  style={{
                    background: active ? 'rgba(255,255,255,.25)' : 'var(--stu-bg-soft)',
                    color: active ? '#FFFFFF' : 'var(--stu-ink-soft)',
                  }}
                >
                  {u.done}/{u.total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
