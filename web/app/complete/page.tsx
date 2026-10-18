'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Mascot } from '@/components/layout/Mascot';

function CompleteInner() {
  const sp = useSearchParams();
  // 显式处理 0：null/缺失才用兜底 0，否则尊重实际值
  const starsRaw = sp.get('stars');
  const stars = starsRaw == null ? 0 : Number(starsRaw);

  return (
    <AppShell>
      <section className="page-grid mt-12 grid place-items-center text-center">
        <Mascot size={140} />
        <div className="text-3xl md:text-5xl font-extrabold text-amber-600 mt-4">
          Great job! +{stars}★
        </div>
        <div className="text-stone-500 mt-2 max-w-md">
          You finished this lesson. The next one is unlocked. Keep going!
        </div>
        <div className="flex gap-3 mt-6">
          <Link href="/" className="btn-kid bg-brand-orange">Back to Map</Link>
          <Link href="/review" className="btn-kid bg-brand-green">Review</Link>
        </div>
      </section>
    </AppShell>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={<div className="page-grid mt-32 text-stone-500">Loading…</div>}>
      <CompleteInner />
    </Suspense>
  );
}