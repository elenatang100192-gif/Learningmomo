'use client';
// VIDEO 步骤的"弹题点 (interrupt)"编辑器
// - 时间点 atSec
// - 题型：SPEECH / SINGLE / MULTI / FILL
// - 题面支持 promptAudioUrl
// - 复用 MediaUploader 上传音频
import { Plus, Trash2, ChevronUp, ChevronDown, X, Headphones, Mic, CheckSquare, Square, Circle, ListChecks, MapPin } from 'lucide-react';
import { MediaUploader } from './MediaUploader';
import { TestBuilder } from './TestBuilder';
import { ImageSafariBuilder } from './ImageSafariBuilder';
import type { TestContent, ImageSafariContent } from '@/lib/stepContents';
import type { VideoInterrupt, InterruptQuestion, InterruptOption, InterruptQuestionType } from '@/lib/adminApi';

const TYPES: { value: InterruptQuestionType; label: string; icon: any; cls: string; desc: string }[] = [
  { value: 'SPEECH', label: '口语练习', icon: Mic,            cls: 'bg-rose-50 text-rose-700 border-rose-200',          desc: '学员开口录音' },
  { value: 'SINGLE', label: '单选',     icon: Circle,        cls: 'bg-sky-50 text-sky-700 border-sky-200',              desc: '选 1 个正确答案' },
  { value: 'MULTI',  label: '多选',     icon: CheckSquare,   cls: 'bg-amber-50 text-amber-800 border-amber-200',       desc: '选多个正确答案' },
  { value: 'FILL',   label: '填空',     icon: Square,        cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', desc: '输入文本' },
  { value: 'QUIZ',   label: '多题测验', icon: ListChecks,    cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',    desc: '复用多题测验的题目' },
  { value: 'SAFARI', label: '超市探险', icon: MapPin,        cls: 'bg-pink-50 text-pink-700 border-pink-200',           desc: '复用超市探险的场景' },
];

function cid(): string {
  return 'it_' + Math.random().toString(36).slice(2, 10);
}

function makeQuestion(type: InterruptQuestionType): InterruptQuestion {
  if (type === 'SPEECH') return { type, prompt: '', promptImageUrl: '', promptAudioUrl: '', minSeconds: 3, passSentences: [], languageHints: ['en', 'zh'] };
  if (type === 'FILL')   return { type, prompt: '', promptAudioUrl: '', answer: '', caseSensitive: false };
  if (type === 'QUIZ')   return { type, test: { questions: [] } as TestContent };
  if (type === 'SAFARI') return { type, safari: { tags: [] } as ImageSafariContent };
  // SINGLE / MULTI
  return {
    type,
    prompt: '',
    promptAudioUrl: '',
    options: [
      { id: cid(), text: '', correct: true },
      { id: cid(), text: '', correct: false },
    ],
  };
}

function emptyInterrupt(): VideoInterrupt {
  return { id: cid(), atSec: 5, question: makeQuestion('SINGLE') };
}

export function InterruptBuilder({
  value,
  onChange,
  durationSec,
}: {
  value: VideoInterrupt[];
  onChange: (v: VideoInterrupt[]) => void;
  durationSec?: number;
}) {
  const list = value ?? [];
  const max = Math.max(1, durationSec ?? 60);

  const setAll = (next: VideoInterrupt[]) => onChange(next);
  const add = () => setAll([...list, emptyInterrupt()]);
  const remove = (idx: number) => setAll(list.filter((_, i) => i !== idx));
  const move = (idx: number, delta: number) => {
    const j = idx + delta;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[idx], next[j]] = [next[j], next[idx]];
    setAll(next);
  };
  const patch = (idx: number, p: Partial<VideoInterrupt>) => {
    const next = [...list];
    next[idx] = { ...next[idx], ...p };
    setAll(next);
  };
  const setQuestion = (idx: number, q: InterruptQuestion) => patch(idx, { question: q });
  const setType = (idx: number, type: InterruptQuestionType) => setQuestion(idx, makeQuestion(type));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-extrabold text-stone-800 flex items-center gap-2">
            <Headphones className="w-4 h-4 text-brand-purple" />
            视频中的弹题点
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            学员播放到设定秒数会暂停，弹出题目。回答完点"继续"接着看。
          </div>
        </div>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-brand-purple to-brand-blue text-white px-3 py-1.5 text-sm font-extrabold shadow-pop hover:opacity-90"
        >
          <Plus className="w-4 h-4" /> 新增弹题点
        </button>
      </div>

      {list.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-4 text-center text-sm text-stone-500">
          还没有弹题点 — 视频会一口气播完。
        </div>
      )}

      <div className="space-y-2">
        {list.map((it, idx) => (
          <InterruptCard
            key={it.id}
            interrupt={it}
            maxSec={max}
            onRemove={() => remove(idx)}
            onUp={() => move(idx, -1)}
            onDown={() => move(idx, +1)}
            onChangeType={(t) => setType(idx, t)}
            onChangeAtSec={(sec) => patch(idx, { atSec: sec })}
            onChangeQuestion={(q) => setQuestion(idx, q)}
          />
        ))}
      </div>
    </div>
  );
}

function InterruptCard(props: {
  interrupt: VideoInterrupt;
  maxSec: number;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
  onChangeType: (t: InterruptQuestionType) => void;
  onChangeAtSec: (sec: number) => void;
  onChangeQuestion: (q: InterruptQuestion) => void;
}) {
  const { interrupt: it, maxSec, onRemove, onUp, onDown, onChangeType, onChangeAtSec, onChangeQuestion } = props;
  const q = it.question;

  return (
    <div className="rounded-2xl border-2 border-amber-200 bg-white p-3 space-y-3">
      {/* 头部：序号 / 时间 / 操作 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="w-7 h-7 rounded-full bg-gradient-to-r from-brand-purple to-brand-blue text-white font-extrabold flex items-center justify-center text-sm">
          {1 + 0}
        </div>
        <div className="text-sm font-extrabold text-stone-800">弹题点 #{it.id.slice(-4)}</div>
        <div className="flex-1" />
        <button type="button" onClick={onUp} className="rounded-lg p-1.5 hover:bg-amber-50 text-stone-500" title="上移">
          <ChevronUp className="w-4 h-4" />
        </button>
        <button type="button" onClick={onDown} className="rounded-lg p-1.5 hover:bg-amber-50 text-stone-500" title="下移">
          <ChevronDown className="w-4 h-4" />
        </button>
        <button type="button" onClick={onRemove} className="rounded-lg p-1.5 hover:bg-rose-50 text-rose-500" title="删除">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 时间点 + 题型 */}
      <div className="grid grid-cols-2 gap-2">
        <Field label="触发时间（秒）" hint={`0 – ${maxSec}`}>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={maxSec}
              value={it.atSec}
              onChange={(e) => onChangeAtSec(Math.max(0, Math.min(maxSec, Number(e.target.value) || 0)))}
              className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
            />
            <span className="text-xs text-stone-500 whitespace-nowrap">第 {formatSec(it.atSec)}</span>
          </div>
        </Field>
        <Field label="题型">
          <div className="grid grid-cols-3 gap-1">
            {TYPES.map((t) => {
              const active = t.value === q.type;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onChangeType(t.value)}
                  className={
                    'rounded-xl px-2 py-1.5 text-xs font-extrabold border-2 transition flex items-center gap-1 justify-center ' +
                    (active ? t.cls + ' shadow-pop' : 'bg-white text-stone-600 border-amber-200 hover:border-brand-purple')
                  }
                  title={t.desc}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      {/* 题面（仅对内置基础题型展示；QUIZ/SAFARI 在各自块内已有题面编辑） */}
      {q.type !== 'QUIZ' && q.type !== 'SAFARI' && (
        <>
          <Field label="题目（可空）" hint="显示在弹窗顶部；空则只显示图片/音频/选项">
            <textarea
              value={q.prompt}
              onChange={(e) => onChangeQuestion({ ...q, prompt: e.target.value } as InterruptQuestion)}
              rows={2}
              className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
              placeholder="例如：视频里的小朋友说了什么？"
            />
          </Field>
          <Field label="题目配图（可空）" hint="显示在题面下方，便于看图答题">
            <MediaUploader
              value={(q as any).promptImageUrl || ''}
              onChange={(url) => onChangeQuestion({ ...q, promptImageUrl: url ?? '' } as InterruptQuestion)}
              type="image"
              compact
            />
          </Field>
          <Field label="题目音频（可空）" hint="用于听力题/示范读音；学员先听后答">
            <div className="flex items-center gap-2">
              <MediaUploader
                value={q.promptAudioUrl || ''}
                onChange={(url) => onChangeQuestion({ ...q, promptAudioUrl: url ?? '' } as InterruptQuestion)}
                type="audio"
              />
            </div>
          </Field>
        </>
      )}

      {/* 题型特有字段 */}
      {q.type === 'SPEECH' && (
        <>
          <Field label="参考图片（可空）" hint="显示在录音区上方，帮助学生看图说话">
            <MediaUploader
              value={(q as any).promptImageUrl || ''}
              onChange={(url) => onChangeQuestion({ ...q, promptImageUrl: url ?? '' } as InterruptQuestion)}
              type="image"
              compact
            />
          </Field>
          <Field label="最少录音（秒）" hint="少于该秒数算未达标（score 60）">
            <input
              type="number"
              min={0}
              max={60}
              value={q.minSeconds ?? 0}
              onChange={(e) => onChangeQuestion({ ...q, minSeconds: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
            />
          </Field>
          <Field label="语音识别语言" hint="决定 qwen 语音识别优先哪个语言；多选时按顺序优先">
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'en', label: '🇬🇧 英文', color: 'sky' },
                { value: 'zh', label: '🇨🇳 中文', color: 'rose' },
                { value: 'ja', label: '🇯🇵 日语', color: 'amber' },
                { value: 'ko', label: '🇰🇷 韩语', color: 'violet' },
              ].map((lang) => {
                const selected = (q as any).languageHints?.includes(lang.value) ?? false;
                return (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => {
                      const cur: string[] = (q as any).languageHints ?? [];
                      const next = selected
                        ? cur.filter((l) => l !== lang.value)
                        : [...cur, lang.value];
                      onChangeQuestion({ ...q, languageHints: next.length ? next : undefined } as InterruptQuestion);
                    }}
                    className={
                      'rounded-xl px-3 py-1.5 text-xs font-extrabold border-2 transition ' +
                      (selected
                        ? `bg-${lang.color}-50 text-${lang.color}-700 border-${lang.color}-300`
                        : 'bg-white text-stone-500 border-amber-200 hover:border-brand-purple')
                    }
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field
            label="通过句子（每行一句 · 全部命中才算通过）"
            hint="ASR 识别结果需包含每一句的核心词。例：I like apples → 学员说 I really like apples 即命中。空配置 = 必不通过。"
          >
            <div className="space-y-1.5">
              {(q.passSentences ?? []).map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="shrink-0 w-5 h-5 rounded-md bg-rose-100 text-rose-600 grid place-items-center text-[10px] font-extrabold">
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={s}
                    onChange={(e) => {
                      const next = [...(q.passSentences ?? [])];
                      next[i] = e.target.value;
                      onChangeQuestion({ ...q, passSentences: next } as InterruptQuestion);
                    }}
                    placeholder="例如：I like apples"
                    className="flex-1 rounded-xl border-2 border-amber-200 bg-white px-3 py-1.5 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => onChangeQuestion({ ...q, passSentences: (q.passSentences ?? []).filter((_, j) => j !== i) } as InterruptQuestion)}
                    className="shrink-0 rounded-lg p-1.5 hover:bg-rose-50 text-rose-500"
                    title="删除这一句"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChangeQuestion({ ...q, passSentences: [...(q.passSentences ?? []), ''] } as InterruptQuestion)}
                className="rounded-xl border-2 border-dashed border-amber-300 text-stone-500 text-xs font-extrabold py-1.5 w-full hover:border-brand-purple hover:text-brand-purple"
              >
                <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> 加一句
              </button>
              <div className="text-[11px] text-stone-500 leading-relaxed pt-0.5">
                匹配规则：把每句拆词后和学员 ASR 文本做包含检查（去标点、大小写无关）。学员说得啰嗦/追加词都不影响命中。
              </div>
            </div>
          </Field>

          {/* 答案音频：紧贴"通过句子"下方。学员答题识别错误时自动播放。
              与上方"题目音频"区分：题目音频是学员点开弹题时引导/听力，
                                本字段是答错时对照示范。 */}
          <Field
            label="答案音频（可空）"
            hint="学员答题识别错误时自动播放这段音频。管理员自己念一遍标准答案放这里即可。"
          >
            <MediaUploader
              value={(q as any).answerAudioUrl || ''}
              onChange={(url) => onChangeQuestion({ ...q, answerAudioUrl: url ?? '' } as InterruptQuestion)}
              type="audio"
            />
          </Field>
        </>
      )}

      {(q.type === 'SINGLE' || q.type === 'MULTI') && (
        <Field label={q.type === 'SINGLE' ? '选项（单选）' : '选项（多选 — 标记所有正确答案）'}>
          <div className="space-y-1.5">
            {q.options.map((opt, i) => (
              <OptionRow
                key={opt.id}
                index={i}
                option={opt}
                multi={q.type === 'MULTI'}
                onChange={(o) => {
                  const next = [...q.options];
                  next[i] = o;
                  onChangeQuestion({ ...q, options: next } as InterruptQuestion);
                }}
                onRemove={() => {
                  if (q.options.length <= 1) return;
                  onChangeQuestion({ ...q, options: q.options.filter((_, j) => j !== i) } as InterruptQuestion);
                }}
              />
            ))}
            <button
              type="button"
              onClick={() =>
                onChangeQuestion({ ...q, options: [...q.options, { id: cid(), text: '', correct: false }] } as InterruptQuestion)
              }
              className="rounded-xl border-2 border-dashed border-amber-300 text-stone-500 text-xs font-extrabold py-1.5 w-full hover:border-brand-purple hover:text-brand-purple"
            >
              <Plus className="w-3.5 h-3.5 inline -mt-0.5" /> 加一个选项
            </button>
          </div>
        </Field>
      )}

      {q.type === 'FILL' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="正确答案" hint="学员答对即可">
            <input
              type="text"
              value={q.answer}
              onChange={(e) => onChangeQuestion({ ...q, answer: e.target.value } as InterruptQuestion)}
              className="w-full rounded-xl border-2 border-amber-200 bg-white px-3 py-2 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
            />
          </Field>
          <Field label="大小写">
            <label className="flex items-center gap-2 mt-2 text-sm font-bold text-stone-700">
              <input
                type="checkbox"
                checked={!!q.caseSensitive}
                onChange={(e) => onChangeQuestion({ ...q, caseSensitive: e.target.checked } as InterruptQuestion)}
                className="w-4 h-4 accent-brand-purple"
              />
              区分大小写
            </label>
          </Field>
        </div>
      )}

      {q.type === 'QUIZ' && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/30 p-3">
          <div className="text-xs font-extrabold text-indigo-700 mb-2 flex items-center gap-1">
            <ListChecks className="w-3.5 h-3.5" />
            多题测验题目（与 step=多题测验 一致 — 可加多道题、可上传题前视频）
          </div>
          <TestBuilder
            value={q.test as TestContent}
            onChange={(next) => onChangeQuestion({ ...q, test: next } as InterruptQuestion)}
          />
        </div>
      )}

      {q.type === 'SAFARI' && (
        <div className="rounded-2xl border-2 border-pink-200 bg-pink-50/30 p-3">
          <div className="text-xs font-extrabold text-pink-700 mb-2 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            超市探险场景（与 step=超市探险 一致）
          </div>
          <ImageSafariBuilder
            value={q.safari as ImageSafariContent}
            onChange={(next) => onChangeQuestion({ ...q, safari: next } as InterruptQuestion)}
          />
        </div>
      )}
    </div>
  );
}

function OptionRow({
  option, index, multi, onChange, onRemove,
}: {
  option: InterruptOption;
  index: number;
  multi: boolean;
  onChange: (o: InterruptOption) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border-2 border-amber-200 bg-white p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ ...option, correct: !option.correct })}
          className={
            'shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border-2 transition ' +
            (option.correct
              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-white border-emerald-300'
              : 'bg-white text-stone-300 border-amber-200 hover:border-emerald-300')
          }
          title={option.correct ? '已设为正确答案' : '点击设为正确答案'}
        >
          {multi
            ? option.correct ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />
            : option.correct ? <Circle className="w-4 h-4 fill-current" /> : <Circle className="w-4 h-4" />}
        </button>
        <span className="text-xs text-stone-400 w-4">{String.fromCharCode(65 + index)}</span>
        <input
          type="text"
          value={option.text}
          onChange={(e) => onChange({ ...option, text: e.target.value })}
          placeholder={`选项 ${String.fromCharCode(65 + index)}`}
          className="flex-1 rounded-xl border-2 border-amber-200 bg-white px-3 py-1.5 outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 font-bold"
        />
        <button type="button" onClick={onRemove} className="rounded-lg p-1.5 hover:bg-rose-50 text-rose-500" title="删除">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="pl-9">
        <MediaUploader
          value={option.imageUrl || ''}
          onChange={(url) => onChange({ ...option, imageUrl: url ?? '' })}
          type="image"
          compact
        />
      </div>
      <div className="pl-9">
        <MediaUploader
          value={option.audioUrl || ''}
          onChange={(url) => onChange({ ...option, audioUrl: url ?? '' })}
          type="audio"
          compact
        />
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-extrabold text-stone-700 mb-1">
        {label}
        {hint && <span className="ml-2 text-stone-400 font-normal">· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
