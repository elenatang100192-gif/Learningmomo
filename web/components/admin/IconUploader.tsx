'use client';
// 通用图标上传器：拿 token → 直传七牛 → 返回 publicUrl
import { useRef, useState } from 'react';
import { adminApi } from '@/lib/adminApi';

export function IconUploader({
  value,
  onChange,
  dir = 'hongen/lesson-icon',
  size = 96,
  hint = 'PNG / JPG / WebP · 建议方形',
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  dir?: string;
  size?: number;
  hint?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setErr(null);
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const t = await adminApi.issueUploadToken(dir, ext);
      const form = new FormData();
      form.append('token', t.token);
      form.append('key', t.key);
      form.append('file', file);
      const res = await fetch(t.host, { method: 'POST', body: form });
      if (!res.ok) throw new Error(`七牛返回 ${res.status}: ${await res.text()}`);
      const json = await res.json();
      // 七牛返回的 json.key 已包含在 t.publicUrl 里, 不要重复拼.
      // (qiniu.service.ts 拼的 publicUrl = baseUrl + key, 已完整)
      const url = t.publicUrl;
      onChange(url);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="rounded-2xl border-2 border-amber-200 bg-white grid place-items-center overflow-hidden flex-shrink-0"
        style={{ width: size, height: size }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="icon" className="w-full h-full object-contain" />
        ) : (
          <span className="text-stone-300 text-2xl">🖼</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-2xl bg-brand-sky text-stone-800 border-2 border-amber-700 px-3 py-2 font-extrabold text-sm shadow-pop disabled:opacity-50"
          >
            {uploading ? '上传中…' : value ? '🔄 换图' : '⬆️ 上传图片'}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-2xl bg-stone-300 text-stone-800 border-2 border-stone-400 px-3 py-2 font-extrabold text-sm"
            >
              🗑 清除
            </button>
          )}
        </div>
        {value && (
          <div className="mt-1 text-[10px] text-stone-400 break-all">{value}</div>
        )}
        <div className="mt-1 text-[11px] text-stone-400">{hint}</div>
        {err && <div className="mt-1 text-xs text-rose-600">{err}</div>}
      </div>
    </div>
  );
}
