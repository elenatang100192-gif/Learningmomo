// 同源视频代理：把公网七牛 / 任意 URL 转成同源（localhost）的字节流，
// 绕过 Chrome 的 Private Network Access (PNA) 拦截。
//
// 用法：<video src="/api/media?u=<encoded-original-url>" />
//       <img src="/api/media?u=<encoded-original-url>" />
//
// 支持 Range requests（视频拖动 / 跳播），不缓存，对所有 2xx/206 返回原始 content-type。
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // 需要 node 原生 fetch + ReadableStream

// 简单白名单：只允许 http(s)
function isAllowedUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u');
  if (!u) {
    return new Response(JSON.stringify({ error: 'missing u' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!isAllowedUrl(u)) {
    return new Response(JSON.stringify({ error: 'disallowed scheme/host' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // 透传 Range
  const range = req.headers.get('range');
  const upstreamHeaders: Record<string, string> = {
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 hongen-media-proxy',
    'accept': '*/*',
  };
  if (range) upstreamHeaders['range'] = range;

  let upstream: Response;
  try {
    upstream = await fetch(u, { headers: upstreamHeaders, cache: 'no-store' });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: 'upstream fetch failed', detail: String(e?.message ?? e) }),
      { status: 502, headers: { 'content-type': 'application/json' } },
    );
  }

  // 关键：把上游 content-type 原样回传，video/audio 才能识别。
  // 注意：Range 视频代理里，content-length 必须严格等于这一段实际字节数，
  // 否则浏览器会 ERR_CONTENT_LENGTH_MISMATCH 206。
  // 最稳的做法：让上游用 stream 直接流过来，不预设 content-length,
  // 浏览器会按实际收到字节结束请求。
  const outHeaders = new Headers();
  const ct = upstream.headers.get('content-type');
  if (ct) outHeaders.set('content-type', ct);
  const cr = upstream.headers.get('content-range');
  if (cr) outHeaders.set('content-range', cr);
  const ar = upstream.headers.get('accept-ranges');
  if (ar) outHeaders.set('accept-ranges', ar);
  // 关闭缓存，否则 Range 行为会乱
  outHeaders.set('cache-control', 'no-store');
  // 给个 PNA-friendly 的 cors（虽然是同源，加上不亏）
  outHeaders.set('access-control-allow-origin', '*');
  // 关键：不主动设置 content-length — 让 Node 用 chunked transfer 转发上游 stream
  // 否则可能因为上游 content-length 和实际 body 字节数不一致而 ERR_CONTENT_LENGTH_MISMATCH

  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}
