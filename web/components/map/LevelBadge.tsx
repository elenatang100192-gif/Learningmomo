'use client';
// 等级徽章（如 "K1 学习体系"）
export function LevelBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/85 border-2 border-amber-400 text-amber-700 text-xs md:text-sm font-extrabold shadow">
      <span className="bg-amber-400 text-white rounded-full w-5 h-5 inline-flex items-center justify-center text-[10px]">
        {level}
      </span>
      <span>Curriculum</span>
    </span>
  );
}

// 木质指路牌
export function WoodSign({ label, direction = 'left' }: { label: string; direction?: 'left' | 'right' }) {
  return (
    <div className={`flex items-center ${direction === 'right' ? 'flex-row-reverse' : ''} gap-2`}>
      <div className="w-2 h-24 bg-amber-900 rounded-sm" />
      <div className="bg-amber-700 text-white px-3 py-2 rounded-lg shadow border-2 border-amber-900 font-bold text-sm">
        {label}
      </div>
    </div>
  );
}