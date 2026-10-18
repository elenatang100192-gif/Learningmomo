'use client';
// 学生端底部导航：白底胶囊 + 黑描边 + 暖色渐变圆 + 立体偏移
// 风格：参考 KhanKids 的"按钮浮起来"感
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type TabItem = {
  key: string;
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  gradient: string;
  size: 'xl' | 'md' | 'sm';
};

const items: TabItem[] = [
  {
    key: 'review',
    href: '/review',
    label: 'Review',
    size: 'md',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
        <path d="M4 6.5C4 5.1 5.1 4 6.5 4H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-10z" fill="currentColor" fillOpacity="0.22" />
        <path d="M4 6.5C4 5.1 5.1 4 6.5 4H18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 16.5v-10z" />
        <path d="M9 9h6M9 12h6M9 15h4" />
      </svg>
    ),
    gradient: 'linear-gradient(145deg, #A8E1FF 0%, #4FB7E8 100%)',
  },
  {
    key: 'map',
    href: '/',
    label: 'Learn',
    size: 'xl',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="w-[28px] h-[28px]">
        <path d="M5 4.5h11l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" fill="currentColor" fillOpacity="0.25" />
        <path d="M5 4.5h11l3 3v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
        <path d="M16 4.5v3h3" />
        <path d="M8 12h8M8 16h6" />
      </svg>
    ),
    gradient: 'linear-gradient(145deg, var(--stu-yellow) 0%, var(--stu-orange) 100%)',
  },
  {
    key: 'profile',
    href: '/profile',
    label: 'Me',
    size: 'sm',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
        <circle cx="12" cy="9" r="3.6" fill="currentColor" fillOpacity="0.22" />
        <circle cx="12" cy="9" r="3.6" />
        <path d="M5 20c1.4-3.4 4-5 7-5s5.6 1.6 7 5" fill="currentColor" fillOpacity="0.22" />
        <path d="M5 20c1.4-3.4 4-5 7-5s5.6 1.6 7 5" />
      </svg>
    ),
    gradient: 'linear-gradient(145deg, #FFD4B0 0%, #F58C76 100%)',
  },
];

const SIZE_MAP: Record<TabItem['size'], { box: string; cont: string; top: string }> = {
  sm: { box: 'w-9 h-9',  cont: 'h-[60px]',  top: 'mt-0.5' },
  md: { box: 'w-10 h-10', cont: 'h-[64px]', top: 'mt-1' },
  xl: { box: 'w-12 h-12', cont: 'h-[70px]', top: 'mt-0.5' },
};

export function BottomTab() {
  const path = usePathname();
  if (path?.startsWith('/lesson/')) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <style>{`
        @keyframes tabFloat {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-4px); }
        }
        @keyframes tabSpin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .tab-circle {
          transition: transform .2s ease;
        }
        .tab-item { transition: none; }
        .tab-item:hover { transform: translateY(-2px); }
        .tab-circle:active { transform: translateY(2px) !important; }
        .tab-item.active { animation: tabFloat 2.4s ease-in-out infinite; }
        .tab-icon { transition: transform .25s ease; }
        .tab-item.active .tab-icon { animation: tabSpin 6s linear infinite; transform-origin: 50% 50%; }
      `}</style>

      {/* 居中胶囊：扁平白底 + 淡紫描边（可汗儿童版风） */}
      <div
        className="mx-auto my-3 max-w-[420px] px-2 py-1 flex items-end justify-around gap-1 rounded-full"
        style={{
          background: 'rgba(255, 255, 255, 0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid var(--stu-line)',
          boxShadow: 'none',
        }}
      >
        {items.map((it) => {
          const active = path === it.href;
          const sz = SIZE_MAP[it.size];
          return (
            <Link
              key={it.key}
              href={it.href}
              className={`tab-item relative flex flex-col items-center justify-end shrink-0 gap-1 ${sz.cont}`}
              aria-label={it.label}
            >
              <span
                className={`tab-circle relative ${sz.box} ${sz.top} rounded-full grid place-items-center text-white ${active ? 'active' : ''}`}
                style={{
                  background: active ? it.gradient : 'var(--stu-bg-soft)',
                  border: 'none',
                  boxShadow: 'none',
                  color: active ? '#FFFFFF' : 'var(--stu-ink-soft)',
                }}
              >
                <span className={`tab-icon ${active ? 'active' : ''} block`}>
                  {it.icon(active)}
                </span>
              </span>
              <span
                className={`text-[11px] leading-none whitespace-nowrap ${
                  active ? 'font-extrabold' : 'font-bold'
                }`}
                style={{ color: active ? 'var(--stu-purple-2)' : 'var(--stu-ink-soft)' }}
              >
                {it.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
