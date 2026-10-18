'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, AlertCircle, Sparkles, Cloud } from 'lucide-react';
import { adminApi, setAdminSession } from '@/lib/adminApi';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const r = await adminApi.login(email, password);
      if (!r.ok) {
        setErr('账号或密码错误');
        return;
      }
      setAdminSession(email, password);
      router.replace('/admin');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center px-4 page-bg">
      <Cloud className="absolute top-12 left-6 w-32 animate-floatY opacity-80 pointer-events-none" />
      <Cloud className="absolute top-24 right-10 w-24 animate-floatY opacity-50 pointer-events-none" />
      <div aria-hidden className="deco-circle-outline hidden md:block" style={{ width: 240, height: 240, top: 80, left: -90 }} />
      <div aria-hidden className="deco-circle-outline hidden md:block" style={{ width: 140, height: 140, bottom: 80, right: -50 }} />

      <div className="relative w-full max-w-md">
        {/* 紫蓝渐变背板 */}
        <div className="absolute -inset-2 bg-gradient-to-r from-brand-purple via-brand-blue to-brand-cyan rounded-[36px] opacity-30 blur-2xl pointer-events-none" />
        <div className="relative rounded-[32px] bg-white/95 border-2 border-white shadow-pop overflow-hidden">
          {/* 顶部彩色条 */}
          <div className="h-1.5 bg-gradient-to-r from-brand-purple via-brand-blue to-brand-cyan" />

          <div className="p-7 sm:p-8">
            <div className="text-center">
              <div className="mx-auto inline-grid place-items-center w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-purple to-brand-blue text-white shadow-pop border-2 border-white">
                <Sparkles className="w-8 h-8" strokeWidth={2.5} />
              </div>
              <div className="mt-3 text-3xl font-extrabold text-stone-800 tracking-wide">MOMO</div>
              <h1 className="mt-1 text-lg font-extrabold text-stone-700">莫莫英语 · 管理后台</h1>
              <p className="text-xs text-stone-500 mt-1">请用管理员账号登录</p>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-3.5">
              <label className="block">
                <span className="text-sm font-extrabold text-stone-700 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
                  邮箱
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="mt-1.5 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2.5 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 transition font-bold"
                />
              </label>
              <label className="block">
                <span className="text-sm font-extrabold text-stone-700 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-brand-purple" strokeWidth={2.5} />
                  密码
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="mt-1.5 w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2.5 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 transition font-bold"
                />
              </label>

              {err && (
                <div className="rounded-xl bg-rose-50 text-rose-700 border-2 border-rose-200 px-3 py-2 text-sm font-extrabold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-purple to-brand-blue text-white border-2 border-white/40 font-extrabold py-3 shadow-pop disabled:opacity-50 hover:-translate-y-0.5 transition"
              >
                <LogIn className="w-4 h-4" strokeWidth={2.5} />
                {loading ? '验证中…' : '登 录'}
              </button>

              <div className="text-xs text-stone-400 text-center font-bold">
                默认账号密码写在 server/.env 的 ADMIN_DEFAULT_EMAIL / ADMIN_DEFAULT_PASSWORD
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
