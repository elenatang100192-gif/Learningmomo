'use client';
// 角色组件：内联 SVG 版本
// 直接把 owl.svg 的 <svg>...</svg> 整段贴进组件，这样：
//   1. CSS 类 .mascot-eye / .mascot-mouth 真实存在于 DOM，CSS 才能动画它们
//   2. 父级 is-speaking 状态可以驱动嘴动
//
// 关键点：用 <div> 包（不要用 <span>，inline-block 在 Safari 对
// width/height 解析不一致），并把 SVG 自带的 width/height 属性剥掉，
// 让它跟随外层容器。

import { useEffect, useRef, useState } from 'react';

export type MascotState = 'idle' | 'speaking' | 'happy';

export function Mascot({
  state = 'idle',
  size = 200,
  className = '',
}: {
  state?: MascotState;
  size?: number;
  className?: string;
}) {
  const [svgText, setSvgText] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // 第一次挂载：fetch owl.svg 源码，注入到 wrapper
  useEffect(() => {
    let cancelled = false;
    fetch('/mascot/owl.svg')
      .then((r) => {
        if (!r.ok) throw new Error(`mascot svg: ${r.status}`);
        return r.text();
      })
      .then((txt) => {
        if (!cancelled) setSvgText(txt);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[Mascot] svg load failed:', err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 父级 class：
  // - 说话：'is-speaking'（CSS 选择器据此触发嘴动）
  // - 开心：'is-happy'（预留位）
  // - 待机：'mascot-wrap--idle'
  const stateClass =
    state === 'speaking' ? 'is-speaking' : state === 'happy' ? 'is-happy' : 'mascot-wrap--idle';

  // 重要：剥掉 SVG 自带的 width/height 属性，强制它继承父容器的 100%×100%
  // 否则浏览器会按 360×420 显示，导致"撑爆"或"被裁"
  const cleanedSvg = svgText
    ? svgText.replace(/<svg([^>]*)>/, (_m, attrs) => {
        // 去掉 width / height / preserveAspectRatio 属性
        const cleaned = attrs
          .replace(/\swidth="[^"]*"/g, '')
          .replace(/\sheight="[^"]*"/g, '')
          .replace(/\spreserveAspectRatio="[^"]*"/g, '');
        return `<svg${cleaned} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block;">`;
      })
    : null;

  return (
    <div
      ref={wrapRef}
      className={`mascot-wrap ${stateClass} ${className}`}
      style={{
        display: 'block',
        width: size,
        height: size,
        // 兜底：即使父容器 overflow:hidden，也确保 svg 不被裁坏关键表情
        overflow: 'visible',
      }}
      aria-label={`mascot-${state}`}
      dangerouslySetInnerHTML={
        cleanedSvg
          ? { __html: cleanedSvg }
          : // 占位（资源没到时）：浅色圆
            {
              __html:
                '<div style="width:100%;height:100%;border-radius:9999px;background:rgba(99,102,241,0.15);"></div>',
            }
      }
    />
  );
}
