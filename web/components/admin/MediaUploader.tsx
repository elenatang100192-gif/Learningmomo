'use client';
// 通用媒体上传器：视频 / 图片 / 音频均可，七牛直传，返回公网 URL
import { useRef, useState } from 'react';
import { adminApi } from '@/lib/adminApi';

export function MediaUploader({
  value,
  onChange,
  type = 'image',
  label,
  hint,
  compact = false,
}: {
  value?: string | null;
  onChange: (url: string | null) => void;
  type?: 'image' | 'video' | 'audio';
  label?: string;
  hint?: string;
  compact?: boolean;  // 紧凑模式：去掉外层间距，专为嵌在卡片里使用
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const accepted =
    type === 'video' ? 'video/mp4,video/quicktime,video/webm'
    : type === 'audio' ? 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/mp4,audio/x-m4a'
    : 'image/png,image/jpeg,image/webp';

  const dir = type === 'video' ? 'hongen/video'
    : type === 'audio' ? 'hongen/audio'
    : 'hongen/media';

  const defaultExt = type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'png';
  const typeLabel = type === 'video' ? '视频' : type === 'audio' ? '音频' : '图片';

  async function upload(file: File) {
    setErr(null);
    setUploading(true);
    try {
      const ext = (file.name.split('.').pop() || defaultExt).toLowerCase();
      const t = await adminApi.issueUploadToken(dir, ext);
      const form = new FormData();
      form.append('token', t.token);
      form.append('key', t.key);
      form.append('file', file);
      const res = await fetch(t.host, { method: 'POST', body: form });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`七牛 ${res.status}: ${txt}`);
      }
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
    <div>
      {!compact && label && <div className="text-xs font-bold text-stone-500 mb-1">{label}</div>}
      {value && type === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className={
            (compact ? 'max-h-20' : 'max-h-32') +
            ' rounded-xl mb-2 object-contain bg-transparent w-full'
          }
        />
      )}
      {value && type === 'video' && (
        <video
          src={value}
          controls
          className={(compact ? 'max-h-24' : 'max-h-40') + ' rounded-xl border-2 border-amber-200 mb-2 w-full'}
        />
      )}
      {value && type === 'audio' && (
        <div className="mb-2 rounded-xl bg-amber-50/30 border-2 border-amber-200 p-2">
          <audio src={value} controls className="w-full h-8" />
        </div>
      )}
      {!compact && value && (
        <div className="mb-2 text-xs text-stone-400 break-all">{value}</div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={accepted}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={
            (compact ? 'rounded-xl px-2.5 py-1 text-xs' : 'rounded-2xl bg-brand-sky text-stone-800 border-2 border-amber-700 px-4 py-2 font-extrabold text-sm shadow-pop') +
            ' font-bold transition disabled:opacity-50 ' +
            (compact
              ? 'bg-amber-100 border-2 border-amber-300 text-amber-800 hover:bg-amber-200'
              : '')
          }
        >
          {uploading ? '上传中…' : value ? `🔄 重新上传` : `📤 上传${typeLabel}`}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={
              (compact ? 'rounded-xl px-2.5 py-1 text-xs' : 'rounded-2xl bg-stone-300 text-stone-800 border-2 border-stone-400 px-4 py-2 font-extrabold text-sm') +
              ' font-bold transition ' +
              (compact
                ? 'bg-stone-100 border-2 border-stone-300 text-stone-600 hover:bg-stone-200'
                : '')
            }
          >
            🗑 清除
          </button>
        )}
      </div>
      {!compact && hint && <div className="mt-1 text-xs text-stone-400">{hint}</div>}
      {err && <div className="mt-1 text-xs text-rose-600">{err}</div>}
    </div>
  );
}
