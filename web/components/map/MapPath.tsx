'use client';
// 学习路径：Figma 风的紫黑色波浪虚线（连接圆形节点）
// 节点槽位 (left% , top%) 与 page.tsx 同步
// 路径端点 = 第一个节点 → 最后一个节点 之间的曲线（不再甩到外面）
// padding* 控制端点距离 SVG 边缘的内边距（px），确保节点不溢出

const SLOTS = [
  { left: 4,  top: 70 },
  { left: 24, top: 8  },
  { left: 47, top: 65 },
  { left: 70, top: 5  },
  { left: 90, top: 45 },
];

export function MapPath({
  width = 860,
  height = 520,
  nodeCount = 5,
  paddingTop = 70,
  paddingBottom = 70,
  paddingLeft = 70,
  paddingRight = 70,
}: {
  width?: number;
  height?: number;
  nodeCount?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}) {
  const n = Math.max(2, Math.min(nodeCount, SLOTS.length));
  const start = SLOTS[0];
  const end = SLOTS[n - 1];

  // 水平方向：left% 映射到 (paddingLeft ~ width-paddingRight)
  const drawableW = width - paddingLeft - paddingRight;
  const drawableH = height - paddingTop - paddingBottom;

  const sx = paddingLeft + (start.left / 100) * drawableW;
  const sy = paddingTop + (start.top / 100) * drawableH;
  const ex = paddingLeft + (end.left / 100) * drawableW;
  const ey = paddingTop + (end.top / 100) * drawableH;

  // 中间控制点：垂直拉到绘图区上部
  const mx = (sx + ex) / 2;
  const my = paddingTop + drawableH * 0.15;

  const d = `M ${sx} ${sy}
             C ${mx} ${my}, ${mx} ${my}, ${ex} ${ey}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="pointer-events-none absolute inset-0"
      preserveAspectRatio="none"
    >
      <path
        d={d}
        stroke="#3C3293"
        strokeOpacity="0.85"
        strokeWidth="18"
        strokeLinecap="round"
        strokeDasharray="2 28"
      />
    </svg>
  );
}
