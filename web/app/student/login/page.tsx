'use client';
// 学生端登录页（英文）
// 风格：与 home（AppShell + student-theme）一致 —— 淡紫底、白卡、4px 描边、shadow-pop、紫/黄/桃粉 token
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  setStudentAuth,
  isStudentLoggedIn,
  getStudentPhone,
  getStudentName,
  clearStudentAuth,
} from '@/lib/auth';

type Stage = 'phone' | 'code' | 'fillName' | 'done';

export default function StudentLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('phone');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [childName, setChildName] = useState('');
  const [loginResult, setLoginResult] = useState<{
    token: string; phone: string; userId: string; id: string;
  } | null>(null);

  const [loggedPhone, setLoggedPhone] = useState<string | null>(
    isStudentLoggedIn() ? getStudentPhone() : null,
  );
  const [loggedName, setLoggedName] = useState<string>(getStudentName());

  // 关掉浏览器后残留的轮询 timer
  useEffect(() => () => { /* noop */ }, []);

  function validPhone(p: string) {
    return /^1[3-9]\d{9}$/.test(p);
  }

  async function handleSendCode() {
    setErr('');
    if (!validPhone(phone)) {
      setErr('Please enter a valid 11-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      await api.studentSendCode(phone);
      setStage('code');
      setCountdown(60);
      const t = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(t); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not send the code. Is this number registered?');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setErr('');
    if (code.length !== 6) {
      setErr('The code is 6 digits.');
      return;
    }
    setLoading(true);
    try {
      const res = await api.studentLogin(phone, code);
      if (res.name) {
        setStudentAuth({ token: res.token, phone: res.phone, name: res.name, userId: res.userId });
        setLoggedPhone(res.phone);
        setLoggedName(res.name);
        setStage('done');
      } else {
        setLoginResult({ token: res.token, phone: res.phone, userId: res.userId, id: res.id });
        setStage('fillName');
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleFillName() {
    if (!childName.trim()) {
      setErr('Please tell us your name.');
      return;
    }
    setErr('');
    setLoading(true);
    try {
      await api.studentUpdateName(childName.trim());
      if (loginResult) {
        setStudentAuth({
          token: loginResult.token,
          phone: loginResult.phone,
          name: childName.trim(),
          userId: loginResult.userId,
        });
      }
      setLoggedPhone(loginResult?.phone ?? null);
      setLoggedName(childName.trim());
      setStage('done');
    } catch (e: any) {
      setErr(e?.message ?? 'Could not save your name.');
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearStudentAuth();
    setLoggedPhone(null);
    setLoggedName('');
    setPhone('');
    setCode('');
    setChildName('');
    setLoginResult(null);
    setStage('phone');
  }

  // ===== 已登录态 =====
  if (loggedPhone) {
    return (
      <div className="student-theme">
        <div className="page-bg min-h-screen flex flex-col">
          {/* 顶栏（与 home 一致） */}
          <header className="page-grid flex items-center gap-3 pt-5 pb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div
                className="size-12 sm:size-14 rounded-full grid place-items-center font-extrabold text-white text-2xl"
                style={{ background: 'var(--stu-rose)' }}
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
          </header>

          <main className="flex-1 grid place-items-center px-4 py-6">
            <div className="w-full max-w-md rounded-3xl bg-white border-4 border-amber-200 shadow-pop p-7 sm:p-9">
              {/* 头像 */}
              <div className="flex flex-col items-center text-center">
                <div
                  className="size-24 rounded-full grid place-items-center text-5xl border-4 border-amber-200"
                  style={{ background: 'var(--stu-bg-soft)' }}
                  aria-hidden
                >
                  {(loggedName || '🙂').trim()[0]?.toUpperCase() === 'A' ? '🦊'
                    : (loggedName || '🙂').trim()[0]?.toUpperCase() === 'B' ? '🐻'
                    : '🙂'}
                </div>
                <div className="mt-4 text-2xl sm:text-3xl font-extrabold" style={{ color: 'var(--stu-ink)' }}>
                  Hi, {loggedName || 'friend'}!
                </div>
                <div className="mt-1 text-sm font-extrabold uppercase tracking-[0.18em]" style={{ color: 'var(--stu-ink-soft)' }}>
                  Welcome back
                </div>
                <div className="mt-3 px-3 py-1 rounded-full text-xs font-extrabold"
                     style={{ background: 'var(--stu-bg-soft)', color: 'var(--stu-ink-soft)' }}>
                  📱 {loggedPhone}
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => router.push('/')}
                  className="w-full py-4 rounded-2xl bg-amber-400 text-white font-extrabold text-lg shadow-pop hover:scale-[1.02] active:scale-[0.98] transition"
                >
                  Start learning →
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full py-3 rounded-2xl bg-stone-100 font-extrabold text-base transition hover:bg-stone-200"
                  style={{ color: 'var(--stu-ink-soft)' }}
                >
                  Sign out
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // ===== 登录流程 =====
  return (
    <div className="student-theme">
      <div className="page-bg min-h-screen flex flex-col">
        {/* 顶栏（与 home 一致） */}
        <header className="page-grid flex items-center gap-3 pt-5 pb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="size-12 sm:size-14 rounded-full grid place-items-center font-extrabold text-white text-2xl"
              style={{ background: 'var(--stu-rose)' }}
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
        </header>

        <main className="flex-1 grid place-items-center px-4 py-6">
          <div className="w-full max-w-md">
            {/* Hero 插画区（紫书角色 + 标题） */}
            <div className="text-center mb-5">
              <div
                className="mx-auto size-20 rounded-3xl grid place-items-center text-4xl border-4 border-amber-200"
                style={{ background: 'var(--stu-bg-soft)' }}
                aria-hidden
              >
                🎒
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl font-extrabold" style={{ color: 'var(--stu-ink)' }}>
                Welcome to LingoLand
              </h1>
              <p className="mt-1 text-sm font-bold" style={{ color: 'var(--stu-ink-soft)' }}>
                Sign in with the phone number from your school.
              </p>
            </div>

            {/* 主卡：白底 + 4px 描边 + shadow-pop，与 home 卡片视觉一致 */}
            <div className="rounded-3xl bg-white border-4 border-amber-200 shadow-pop p-6 sm:p-8">
              <Stepper stage={stage} />

              {stage === 'phone' && (
                <div className="mt-5 space-y-3">
                  <Label>Phone number</Label>
                  <KidInput
                    inputMode="numeric"
                    maxLength={11}
                    value={phone}
                    onChange={(v) => setPhone(v.replace(/\D/g, ''))}
                    placeholder="11-digit phone number"
                    big
                  />
                  {err && <ErrorText>{err}</ErrorText>}
                  <PrimaryButton onClick={handleSendCode} disabled={loading}>
                    {loading ? 'Sending…' : 'Send code'}
                  </PrimaryButton>
                  <Hint>Demo code is <b>123456</b>.</Hint>
                </div>
              )}

              {stage === 'code' && (
                <div className="mt-5 space-y-3">
                  <p className="text-sm font-bold" style={{ color: 'var(--stu-ink-soft)' }}>
                    We sent a code to{' '}
                    <span style={{ color: 'var(--stu-orange)' }}>{phone}</span>
                  </p>
                  <Label>Verification code</Label>
                  <KidInput
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(v) => setCode(v.replace(/\D/g, ''))}
                    placeholder="6-digit code"
                    big
                    center
                  />
                  {err && <ErrorText>{err}</ErrorText>}
                  <PrimaryButton onClick={handleLogin} disabled={loading}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </PrimaryButton>
                  <div className="flex items-center justify-between text-sm pt-1">
                    <button
                      onClick={() => { setStage('phone'); setCode(''); setErr(''); }}
                      className="font-bold"
                      style={{ color: 'var(--stu-ink-soft)' }}
                    >
                      ← Use a different number
                    </button>
                    <button
                      disabled={countdown > 0 || loading}
                      onClick={handleSendCode}
                      className="font-bold disabled:opacity-50"
                      style={{ color: countdown > 0 ? 'var(--stu-ink-soft)' : 'var(--stu-orange)' }}
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                    </button>
                  </div>
                </div>
              )}

              {stage === 'fillName' && (
                <div className="mt-5 space-y-3">
                  <p className="text-center text-base font-extrabold" style={{ color: 'var(--stu-ink)' }}>
                    One last thing 📝
                  </p>
                  <p className="text-center text-sm font-bold" style={{ color: 'var(--stu-ink-soft)' }}>
                    What is your English name?
                  </p>
                  <Label>English name</Label>
                  <KidInput
                    placeholder="e.g. Amy, Bob, Cici"
                    value={childName}
                    onChange={setChildName}
                    big
                  />
                  {err && <ErrorText>{err}</ErrorText>}
                  <PrimaryButton onClick={handleFillName} disabled={loading}>
                    {loading ? 'Saving…' : 'Finish & play 🎉'}
                  </PrimaryButton>
                </div>
              )}
            </div>

            <p className="mt-5 text-center text-xs font-bold" style={{ color: 'var(--stu-ink-soft)' }}>
              For students of LingoLand schools only.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

// ===== 小组件 =====

function Stepper({ stage }: { stage: Stage }) {
  const steps: Array<{ key: Stage; label: string }> = [
    { key: 'phone', label: '1' },
    { key: 'code', label: '2' },
    { key: 'fillName', label: '3' },
  ];
  const activeIdx = steps.findIndex((s) => s.key === stage);
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => {
        const done = i < activeIdx || stage === 'done';
        const active = i === activeIdx;
        return (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className="size-8 rounded-full grid place-items-center text-sm font-extrabold"
              style={{
                background: done || active ? 'var(--stu-purple)' : 'var(--stu-bg-soft)',
                color: done || active ? '#fff' : 'var(--stu-ink-soft)',
                border: '2px solid',
                borderColor: done || active ? 'var(--stu-purple)' : 'var(--stu-line)',
              }}
            >
              {done ? '✓' : s.label}
            </div>
            {i < steps.length - 1 && (
              <div className="w-6 h-0.5 rounded-full" style={{ background: 'var(--stu-line)' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
      style={{ color: 'var(--stu-ink-soft)' }}
    >
      {children}
    </div>
  );
}

function KidInput({
  big,
  center,
  onChange,
  onFocus,
  onBlur,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  big?: boolean;
  center?: boolean;
  onChange?: (v: string) => void;
}) {
  return (
    <input
      {...rest}
      onChange={(e) => onChange?.(e.target.value)}
      className={[
        'w-full rounded-2xl outline-none',
        big ? 'py-3.5 text-lg' : 'py-3 text-base',
        center ? 'text-center tracking-[0.4em]' : '',
        'font-extrabold px-4',
      ].join(' ')}
      style={{
        background: 'var(--stu-bg-soft)',
        border: '3px solid var(--stu-line)',
        color: 'var(--stu-ink)',
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--stu-purple)';
        onFocus?.(e);
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--stu-line)';
        onBlur?.(e);
      }}
    />
  );
}

function PrimaryButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="w-full py-3.5 rounded-2xl font-extrabold text-base sm:text-lg shadow-pop transition disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
      style={{ background: 'var(--stu-purple)', color: '#fff' }}
    >
      {children}
    </button>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-sm font-extrabold px-3 py-2 rounded-xl"
      style={{ background: 'rgba(255, 143, 163, 0.18)', color: '#C0364E' }}
    >
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-center text-xs font-bold pt-1"
      style={{ color: 'var(--stu-ink-soft)' }}
    >
      {children}
    </p>
  );
}
