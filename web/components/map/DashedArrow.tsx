'use client';
// 学生端虚线指路箭头：黑色虚线 + 黑色三角箭头（参考 KhanKids 指路牌风）
export function DashedArrow({
  className = '',
  rotate = 0,
}: {
  className?: string;
  rotate?: 0 | 180;
}) {
  return (
    <svg
      width="34"
      height="18"
      viewBox="0 0 34 18"
      fill="none"
      className={className}
      style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}
      aria-hidden="true"
    >
      <path
        d="M2 9 H28"
        stroke="#2A1F1A"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="4 4"
      />
      <path
        d="M24 3 L31 9 L24 15"
        stroke="#2A1F1A"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
0    </svg>
  );
}
