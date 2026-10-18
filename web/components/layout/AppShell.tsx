'use client';
import { BottomTab } from './BottomTab';

// 学生端外壳：纯色奶油黄背景，无装饰元素
// 仅留 page-grid 内容区 + 底部导航
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="student-theme">
      <div className="page-bg pb-32">
        {children}
        <BottomTab />
      </div>
    </div>
  );
}
