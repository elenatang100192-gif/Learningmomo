'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, BookOpen, GraduationCap, ListChecks, LogOut, Eye, Cloud, Users,
} from 'lucide-react';
import { clearAdminSession, getAdminEmail, getAdminPwd } from '@/lib/adminApi';
import { ToastProvider } from '@/components/admin/AdminUI';

type NavKey = 'home' | 'courses' | 'lessons' | 'steps' | 'students';
const NAV: { key: NavKey; href: string; label: string; icon: any; match: (p: string) => boolean }[] = [
  { key: 'home',     href: '/admin',         label: '仪表盘', icon: LayoutDashboard, match: (p) => p === '/admin' },
  { key: 'courses',  href: '/admin/courses', label: '课程',   icon: BookOpen,        match: (p) => p.startsWith('/admin/courses') },
  { key: 'lessons',  href: '/admin/lessons', label: '课时',   icon: GraduationCap,   match: (p) => p.startsWith('/admin/lessons') },
  { key: 'steps',    href: '/admin/steps',   label: '步骤',   icon: ListChecks,      match: (p) => p.startsWith('/admin/steps') },
  { key: 'students', href: '/admin/students', label: '学生账号', icon: Users,        match: (p) => p.startsWith('/admin/students') },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/admin';
  const router = useRouter();
  const isLoginPage = pathname === '/admin/login';

  // 客户端 mount 后才从 localStorage 读 email — 避免 SSR / 客户端不一致导致 hydration error
  const [adminEmail, setAdminEmail] = useState<string>('');
  useEffect(() => {
    if (isLoginPage) return;
    const email = getAdminEmail();
    const pwd = getAdminPwd();
    if (!email || !pwd) {
      router.replace('/admin/login');
    } else {
      setAdminEmail(email);
    }
  }, [isLoginPage, router, pathname]);

  // 登录页：极简 layout，不显示侧栏
  if (isLoginPage) {
    return <div className="min-h-[100dvh]">{children}</div>;
  }

  return (
    <ToastProvider>
      <div className="relative min-h-[100dvh] page-bg">
        <Cloud className="absolute top-12 left-6 w-32 animate-floatY opacity-80 pointer-events-none" />
        <Cloud className="absolute top-24 left-32 w-24 animate-floatY opacity-50 pointer-events-none" />
        <div aria-hidden className="deco-circle-outline hidden md:block" style={{ width: 280, height: 280, top: 60, right: -80 }} />
        <div aria-hidden className="deco-circle-outline hidden md:block" style={{ width: 140, height: 140, top: 320, right: 60 }} />

        <div className="mx-auto w-full max-w-[1280px] px-4 sm:px-6 md:px-8 lg:px-10 pt-6 relative z-10">
          {/* 顶栏：紫蓝渐变胶囊 */}
          <header className="relative rounded-3xl bg-gradient-to-r from-brand-purple/95 via-brand-blue/95 to-brand-cyan/95 border-2 border-white/30 shadow-pop overflow-hidden">
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/15 blur-2xl pointer-events-none" />
            <div className="absolute -left-6 -bottom-10 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="relative px-5 py-4 flex items-center gap-3 text-white">
              <Link href="/admin" className="flex items-center gap-2 group">
                <span className="inline-grid place-items-center w-10 h-10 rounded-2xl bg-white/20 border border-white/30 group-hover:scale-105 transition">
                  <LayoutDashboard className="w-5 h-5" strokeWidth={2.5} />
                </span>
                <span className="text-xl font-extrabold tracking-wide">MOMO</span>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="text-base sm:text-lg font-extrabold">莫莫英语 · 管理后台</div>
                <div className="text-[11px] sm:text-xs text-white/80 flex items-center gap-1.5 flex-wrap">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  {adminEmail || '已登录'} ·
                  <button
                    onClick={() => {
                      clearAdminSession();
                      router.replace('/admin/login');
                    }}
                    className="underline underline-offset-2 hover:text-white inline-flex items-center gap-0.5"
                  >
                    <LogOut className="w-3 h-3" strokeWidth={2.5} />
                    退出
                  </button>
                </div>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-1 rounded-2xl bg-white/20 hover:bg-white/30 text-white border border-white/30 px-3 py-1.5 text-xs font-extrabold transition"
              >
                <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
                <span className="hidden sm:inline">看前台</span>
              </Link>
            </div>
          </header>

          {/* 主区：侧栏 + 内容 */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 pb-16">
            <aside className="md:sticky md:top-4 md:self-start">
              <div className="rounded-3xl bg-white/90 border-2 border-white shadow-pop p-3">
                <nav className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible">
                  {NAV.map((n) => {
                    const active = n.match(pathname);
                    const Icon = n.icon;
                    return (
                      <Link
                        key={n.key}
                        href={n.href}
                        className={
                          'group relative whitespace-nowrap rounded-2xl px-3.5 py-3 font-extrabold text-sm md:text-[15px] border-2 transition flex items-center gap-2.5 flex-shrink-0 ' +
                          (active
                            ? 'bg-gradient-to-r from-brand-purple to-brand-blue text-white border-white/40 shadow-pop'
                            : 'bg-white text-stone-700 border-amber-200 hover:border-brand-purple hover:text-brand-purple')
                        }
                      >
                        <span
                          className={
                            'inline-grid place-items-center w-8 h-8 rounded-xl border ' +
                            (active
                              ? 'bg-white/20 border-white/30'
                              : 'bg-brand-purple/10 border-brand-purple/15 group-hover:bg-brand-purple/20')
                          }
                        >
                          <Icon className="w-4 h-4" strokeWidth={2.5} />
                        </span>
                        <span className="flex-1">{n.label}</span>
                        {active ? (
                          <span className="hidden md:inline-block w-1.5 h-5 rounded-full bg-white/70" />
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
