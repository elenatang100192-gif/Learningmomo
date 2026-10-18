'use client';
// 统一的 UI 元件：徽章、按钮、Toast、空态、Drawer、PageHeader、StatCard
// 设计参考附件 UI：紫蓝渐变 + 圆胖白卡 + 软阴影 + lucide 线性图标
import { useEffect, useState, ReactNode, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2, XCircle, Info, X, Pencil, Trash2, Plus, Search, RefreshCw, Sparkles, BookOpen, type LucideIcon,
} from 'lucide-react';

// ========== 状态徽章 ==========
export function StatusBadge({ active }: { active?: boolean }) {
  if (active === undefined) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-500 px-2.5 py-0.5 text-xs font-bold">
        未设置
      </span>
    );
  }
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-xs font-bold border border-emerald-200">
      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
      启用
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 text-stone-500 px-2.5 py-0.5 text-xs font-bold border border-stone-200">
      <XCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
      草稿
    </span>
  );
}

// ========== 操作按钮组 ==========
export function RowActions({
  onEdit,
  onDelete,
  deleteConfirm,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
  deleteConfirm?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {onEdit && (
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-xl bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 px-2.5 py-1.5 text-xs font-extrabold transition"
          title="编辑"
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span className="hidden sm:inline">编辑</span>
        </button>
      )}
      {onDelete && (
        <button
          onClick={() => {
            if (deleteConfirm && !confirm(deleteConfirm)) return;
            onDelete();
          }}
          className="inline-flex items-center gap-1 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 text-xs font-extrabold transition"
          title="删除"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2.5} />
          <span className="hidden sm:inline">删除</span>
        </button>
      )}
    </div>
  );
}

// ========== 主按钮 ==========
export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  variant = 'green',
  size = 'md',
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  variant?: 'green' | 'orange' | 'sky' | 'rose' | 'stone' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
}) {
  const bg = {
    green: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700',
    orange: 'bg-brand-orange text-white border-amber-700',
    sky: 'bg-brand-sky text-stone-800 border-amber-700',
    rose: 'bg-rose-500 text-white border-rose-700',
    stone: 'bg-stone-200 text-stone-700 border-stone-300',
    purple: 'bg-brand-purple text-white border-brand-ink/40',
  }[variant];

  const sz = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }[size];

  const Icon = icon;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-2xl font-extrabold border-2 ${bg} ${sz} shadow-pop disabled:opacity-40 disabled:cursor-not-allowed transition`}
    >
      {Icon ? <Icon className="w-4 h-4" strokeWidth={2.5} /> : null}
      {children}
    </button>
  );
}

// ========== 图标按钮（带 hover 提示） ==========
export function IconButton({
  icon: Icon,
  onClick,
  label,
  variant = 'stone',
  size = 'md',
}: {
  icon: LucideIcon;
  onClick?: () => void;
  label: string;
  variant?: 'stone' | 'rose' | 'amber' | 'green' | 'sky' | 'purple';
  size?: 'sm' | 'md';
}) {
  const map = {
    stone: 'bg-stone-100 text-stone-600 hover:bg-stone-200 border-stone-200',
    rose: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200',
    amber: 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200',
    green: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
    sky: 'bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-200',
    purple: 'bg-brand-purple/10 text-brand-purple hover:bg-brand-purple/20 border-brand-purple/30',
  }[variant];
  const sz = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-grid place-items-center rounded-xl border ${map} ${sz} transition`}
    >
      <Icon className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} strokeWidth={2.5} />
    </button>
  );
}

// ========== 输入域包装 ==========
export function Field({
  label,
  required,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-extrabold text-stone-700 flex items-center gap-1.5">
        {Icon ? <Icon className="w-4 h-4 text-brand-purple" strokeWidth={2.5} /> : null}
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/25 transition';

// ========== 空态卡 ==========
export function EmptyState({ icon: Icon, title, hint, action }: { icon?: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      {Icon && (
        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-purple/15 to-brand-cyan/15 border-2 border-white shadow-pop grid place-items-center mb-3">
          <Icon className="w-8 h-8 text-brand-purple" strokeWidth={2} />
        </div>
      )}
      <div className="font-extrabold text-stone-700 text-lg">{title}</div>
      {hint && <div className="text-sm text-stone-500 mt-1">{hint}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

// ========== Toast ==========
type Toast = { id: number; type: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<((t: Omit<Toast, 'id'>) => void) | null>(null);

export function useToast() {
  const fn = useContext(ToastCtx);
  if (!fn) throw new Error('useToast must be used inside <ToastProvider>');
  return fn;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // 客户端 mount 后才挂 portal, 避免 SSR 渲染 / 客户端多 1 个 div 的 hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  function push(t: Omit<Toast, 'id'>) {
    const id = Date.now() + Math.random();
    setToasts((cur) => [...cur, { ...t, id }]);
    setTimeout(() => {
      setToasts((cur) => cur.filter((x) => x.id !== id));
    }, 3200);
  }

  return (
    <ToastCtx.Provider value={push}>
      {children}
      {mounted &&
        createPortal(
          <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
            {toasts.map((t) => {
              const map = {
                success: { bg: 'bg-emerald-600', Icon: CheckCircle2 },
                error: { bg: 'bg-rose-600', Icon: XCircle },
                info: { bg: 'bg-brand-purple', Icon: Info },
              }[t.type];
              const ToastIcon = map.Icon;
              return (
                <div
                  key={t.id}
                  className={`${map.bg} text-white rounded-2xl shadow-pop px-4 py-2.5 text-sm font-extrabold pointer-events-auto animate-popIn flex items-center gap-2 border-2 border-white/30`}
                >
                  <ToastIcon className="w-4 h-4 flex-shrink-0" strokeWidth={2.5} />
                  {t.text}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastCtx.Provider>
  );
}

// ========== Drawer（侧边抽屉） ==========
export function Drawer({
  open,
  onClose,
  title,
  icon: Icon,
  children,
  footer,
  width = 560,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 等客户端 mount 后再考虑渲染 portal — 避免 SSR/客户端 DOM 数量不一致
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-40 transition ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      {/* 遮罩 */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-stone-900/45 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* 抽屉本体 */}
      <div
        className={`absolute right-0 top-0 h-full bg-white shadow-pop overflow-y-auto transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: 'min(100%, ' + width + 'px)' }}
      >
        {/* 紫蓝渐变头 */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-purple/95 via-brand-blue/95 to-brand-cyan/95 text-white border-b-2 border-white/30">
          <div className="px-5 py-4 flex items-center gap-3">
            {Icon ? (
              <span className="inline-grid place-items-center w-9 h-9 rounded-xl bg-white/20 border border-white/30">
                <Icon className="w-5 h-5" strokeWidth={2.5} />
              </span>
            ) : null}
            <h2 className="text-lg font-extrabold flex-1">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 w-9 h-9 grid place-items-center font-extrabold transition"
              aria-label="关闭"
            >
              <X className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
        <div className="p-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-white border-t-2 border-amber-200 px-5 py-3 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ========== PageHeader（页面顶部标题区） ==========
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  actions,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}) {
  return (
    <div className="relative rounded-3xl bg-white/85 border-2 border-white shadow-pop overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-brand-purple/12 via-brand-blue/8 to-brand-cyan/12 pointer-events-none" />
      <div className="relative px-5 sm:px-6 py-4 flex items-center gap-4 flex-wrap">
        {Icon ? (
          <div className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-purple to-brand-cyan text-white shadow-pop border-2 border-white">
            <Icon className="w-6 h-6" strokeWidth={2.5} />
          </div>
        ) : null}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-extrabold text-stone-800 leading-tight">{title}</h1>
          {subtitle ? <p className="text-xs md:text-sm text-stone-600 mt-0.5">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
      </div>
    </div>
  );
}

// ========== StatCard（统计卡） ==========
export function StatCard({
  label,
  value,
  icon: Icon,
  href,
  variant = 'purple',
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  href?: string;
  variant?: 'purple' | 'orange' | 'sky' | 'green' | 'pink' | 'cyan';
}) {
  const map = {
    purple: 'from-brand-purple to-brand-blue text-white',
    orange: 'from-brand-orange to-brand-sun text-stone-800',
    sky: 'from-brand-cyan to-brand-sky text-stone-800',
    green: 'from-emerald-500 to-emerald-700 text-white',
    pink: 'from-rose-400 to-pink-500 text-white',
    cyan: 'from-cyan-400 to-teal-500 text-white',
  }[variant];

  const Wrap: any = href ? 'a' : 'div';
  return (
    <Wrap
      {...(href ? { href } : {})}
      className="relative rounded-3xl bg-white/90 border-2 border-white shadow-pop p-4 sm:p-5 overflow-hidden group hover:-translate-y-0.5 transition cursor-pointer"
    >
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${map} opacity-15 group-hover:opacity-25 transition`} />
      <div className="relative flex items-start gap-3">
        <div className={`inline-grid place-items-center w-12 h-12 rounded-2xl bg-gradient-to-br ${map} border-2 border-white shadow-pop flex-shrink-0`}>
          <Icon className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-extrabold text-stone-800 leading-none">{value}</div>
          <div className="mt-1 text-sm text-stone-600 font-extrabold">{label}</div>
        </div>
      </div>
    </Wrap>
  );
}

// ========== 搜索/筛选条 ==========
export function Toolbar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/85 border-2 border-white shadow-pop px-3 sm:px-4 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
      {children}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 min-w-[180px] max-w-sm">
      <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={2.5} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '搜索…'}
        className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-amber-200 bg-white outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 transition text-sm font-bold placeholder:text-stone-400"
      />
    </div>
  );
}

export function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-xl bg-white border-2 border-amber-200 hover:border-brand-purple hover:text-brand-purple text-stone-600 px-3 py-1.5 text-xs font-extrabold transition"
    >
      <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.5} />
      刷新
    </button>
  );
}

// ========== 通用占位（避免未使用警告） ==========
export { Plus, Sparkles, BookOpen };
