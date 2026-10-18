'use client';
// LingoLand 猫头鹰吉祥物（PNG 版本，原始 Figma 渲染）
import Image from 'next/image';

export function Mascot({ size = 200 }: { size?: number }) {
  return (
    <Image
      src="/mascot/owl.png"
      alt="LingoLand Owl"
      width={size}
      height={size}
      className="select-none pointer-events-none"
      draggable={false}
    />
  );
}
