'use client';
// 蓝天白云背景里的浮云（可汗儿童版风 · 扁平柔和）
export function Cloud({ className = '', opacity = 0.55 }: { className?: string; opacity?: number }) {
  return (
    <svg viewBox="0 0 200 80" className={className} style={{ opacity }} aria-hidden>
      <g fill="white">
        <ellipse cx="40" cy="50" rx="40" ry="22" />
        <ellipse cx="90" cy="40" rx="38" ry="26" />
        <ellipse cx="140" cy="50" rx="38" ry="22" />
        <ellipse cx="70" cy="55" rx="30" ry="16" />
        <ellipse cx="120" cy="55" rx="30" ry="16" />
      </g>
    </svg>
  );
}

// 太阳（扁平柔和黄色，无强光射线）
export function Sun() {
  return (
    <svg viewBox="0 0 80 80" className="absolute right-6 top-4" aria-hidden>
      <circle cx="40" cy="40" r="22" fill="#FFCE4D" opacity="0.85" />
    </svg>
  );
}

// 草山坡（扁平柔和绿，无深色描边）
export function GrassHill() {
  return (
    <svg viewBox="0 0 600 80" preserveAspectRatio="none" className="absolute -bottom-2 left-0 right-0 w-full h-12" aria-hidden>
      <path d="M0 80 L60 30 L160 80 Z" fill="#A8E89A" />
      <path d="M120 80 L220 20 L340 80 Z" fill="#7CC77B" />
      <path d="M280 80 L420 30 L560 80 Z" fill="#A8E89A" />
      <path d="M520 80 L600 50 L600 80 Z" fill="#7CC77B" />
    </svg>
  );
}
