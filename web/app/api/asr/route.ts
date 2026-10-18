// qwen paraformer-v2 语音识别代理
// 浏览器上传到七牛拿到公网 URL → 把 URL 交给 dashscope 异步任务 → 轮询结果 → 拿文字。
// 这样：
//   - DASHSCOPE_API_KEY 只在服务端用，不暴露到前端
//   - dashscope 不支持直接吃文件，只能吃公网 HTTPS URL
//   - 学员每次录音后由前端把音频上传七牛，拿到 URL 后调这个接口
//
// 入参：{ audioUrl: string, languageHints?: string[] }
// 出参：{ text: string, durationMs?: number, raw?: any }
//
// 失败：{ error: string, detail?: string }
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// dashscope 任务轮询最多给 25 秒 (5s × 5 次) 还没好就让前端重试
export const maxDuration = 30;

const SUBMIT_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription';
const QUERY_URL_BASE = 'https://dashscope.aliyuncs.com/api/v1/tasks';

function getApiKey(): string | null {
  // Next.js 会把 .env 自动注入到 process.env；服务器端专属变量要写在 .env，
  // 但 Next.js 默认也会暴露以 NEXT_PUBLIC_ 开头的变量到客户端。这里只用服务端 key。
  const k = process.env.DASHSCOPE_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

async function submitTask(audioUrl: string, languageHints: string[], apiKey: string): Promise<string> {
  const body = {
    model: 'paraformer-v2',
    input: { file_urls: [audioUrl] },
    parameters: {
      channel_id: [0],
      language_hints: languageHints.length ? languageHints : ['zh', 'en'],
      // 不要做敏感词替换
      special_word_filter: JSON.stringify({ system_reserved_filter: false }),
      // 不做语气词过滤 — 学员说口语时 "uh/um" 保留也行, 让家长能看到完整识别
      disfluency_removal_enabled: false,
    },
  };
  const res = await fetch(SUBMIT_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error('submit ' + res.status + ': ' + (await res.text()).slice(0, 300));
  }
  const j: any = await res.json();
  const taskId = j?.output?.task_id;
  if (!taskId) throw new Error('submit: no task_id, body=' + JSON.stringify(j).slice(0, 300));
  return taskId;
}

async function queryTask(taskId: string, apiKey: string): Promise<any> {
  const res = await fetch(QUERY_URL_BASE + '/' + taskId, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error('query ' + res.status + ': ' + (await res.text()).slice(0, 300));
  }
  return res.json();
}

async function fetchTranscript(url: string): Promise<{ text: string; durationMs: number }> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('transcript fetch ' + res.status);
  const j: any = await res.json();
  const transcripts: any[] = j?.transcripts ?? [];
  if (transcripts.length === 0) return { text: '', durationMs: 0 };
  const t0 = transcripts[0];
  // 优先用顶层 text; 退而求其次把 sentences 拼起来
  let text = (t0?.text ?? '').toString().trim();
  if (!text && Array.isArray(t0?.sentences)) {
    text = t0.sentences.map((s: any) => s?.text ?? '').join('').trim();
  }
  const durationMs = Number(t0?.content_duration_in_milliseconds ?? 0) || 0;
  return { text, durationMs };
}

export async function POST(req: NextRequest) {
  const apiKey = getApiKey();
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'DASHSCOPE_API_KEY not configured' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }

  const audioUrl: string = (body?.audioUrl ?? '').toString().trim();
  const languageHints: string[] = Array.isArray(body?.languageHints) && body.languageHints.length
    ? body.languageHints.map((s: any) => String(s).toLowerCase())
    : ['en', 'zh'];

  if (!audioUrl) {
    return new Response(JSON.stringify({ error: 'audioUrl required' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }
  if (!/^https?:\/\//i.test(audioUrl)) {
    return new Response(JSON.stringify({ error: 'audioUrl must be http(s)' }), {
      status: 400, headers: { 'content-type': 'application/json' },
    });
  }

  // 1) 提交任务
  let taskId: string;
  try {
    taskId = await submitTask(audioUrl, languageHints, apiKey);
  } catch (e: any) {
    // 软失败: 提交失败时不要直接 502，让前端知道后走 Web Speech 兜底
    return new Response(
      JSON.stringify({ text: '', error: 'submit failed', detail: String(e?.message ?? e) }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  // 2) 轮询结果 (5s × 5 次 = 25s 上限)
  const POLL_MS = 1500;
  const MAX_POLLS = 18;  // ~27s
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    let q: any;
    try {
      q = await queryTask(taskId, apiKey);
    } catch (e: any) {
      // 单次轮询失败不直接挂, 继续下一次
      console.warn('[asr] poll error', e?.message ?? e);
      continue;
    }
    const status = q?.output?.task_status as string;
    if (status === 'SUCCEEDED') {
      const results: any[] = q?.output?.results ?? [];
      const ok = results.find((r) => r?.subtask_status === 'SUCCEEDED');
      if (!ok?.transcription_url) {
        return new Response(
          JSON.stringify({ error: 'succeeded but no transcription_url', raw: q }),
          { status: 502, headers: { 'content-type': 'application/json' } },
        );
      }
      try {
        const t = await fetchTranscript(ok.transcription_url);
        return new Response(
          JSON.stringify({ text: t.text, durationMs: t.durationMs }),
          { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } },
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: 'transcript fetch failed', detail: String(e?.message ?? e) }),
          { status: 502, headers: { 'content-type': 'application/json' } },
        );
      }
    }
    if (status === 'FAILED') {
      // 软失败: 让前端能拿到结果走兜底, 不要阻塞学员
      return new Response(
        JSON.stringify({ text: '', error: 'asr failed' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    // PENDING / RUNNING → 继续轮询
  }
  // 软失败: 超时也返回 200, 让前端能走兜底
  return new Response(
    JSON.stringify({ text: '', error: 'asr timeout', taskId }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}
