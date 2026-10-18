// Shared content shapes for the new step kinds: Test, Video Lab, Image Safari.
// Everything is stored in `Step.content` (JSON) — no DB migration required.
//
// Compatibility: legacy QUIZ/VIDEO/IMAGE shapes keep working untouched.

export type QuizOption = {
  id: string;
  text?: string;
  image?: string;
  audioUrl?: string;
};

// QuizContent 是 step=多题测验 (QUIZ) 的题目结构。也复用于视频中断题（type=QUIZ）。
// 与 components/admin/QuizBuilder.tsx 中 QuizContent 保持一致
// （kind: 'SINGLE' | 'MULTIPLE' | 'BLANK'）。
export type QuizContent =
  | { kind: 'SINGLE';   prompt: string; image?: string; promptAudioUrl?: string; options: QuizOption[]; answer: string[] }
  | { kind: 'MULTIPLE'; prompt: string; image?: string; promptAudioUrl?: string; options: QuizOption[]; answer: string[] }
  | { kind: 'BLANK';    prompt: string; image?: string; promptAudioUrl?: string; answer: string[]; answerImages?: { id: string; image: string; audioUrl?: string }[] };

export type FillMode = 'LETTERS' | 'FREE';

// A single question inside a Test step. A Test step can contain 1+ of these.
export type TestQuestionContent =
  | {
      kind: 'SINGLE';
      prompt: string;
      image?: string;
      promptAudioUrl?: string;
      options: QuizOption[];
      // legacy schema: answer is a string[]; for SINGLE we treat it as [optionId]
      answer: string[];
    }
  | {
      kind: 'MULTIPLE';
      prompt: string;
      image?: string;
      promptAudioUrl?: string;
      options: QuizOption[];
      answer: string[];
    }
  | {
      kind: 'FILL';
      prompt: string;
      image?: string;
      promptAudioUrl?: string;
      // Multiple accepted words, case-insensitive
      answer: string[];
      inputMode?: FillMode;
      // legacy field — kept here so old seed data still parses
      answerImages?: { id: string; image: string; audioUrl?: string }[];
    };

// A whole Test step: an optional intro video that plays above all questions,
// followed by a list of questions graded together.
export interface TestContent {
  introVideoUrl?: string;
  introVideoName?: string;
  questions: TestQuestionContent[];
}

// A single video inside a Video Lab step.
export interface VideoLabItem {
  id: string;
  name: string;
  videoUrl?: string;
  videoName?: string;
  // When true, students must record a spoken answer after the video.
  micRequired: boolean;
  // Question prompt the student is asked to answer aloud.
  prompt: string;
  // 题目音频（可空）—— 学员进入 answer 阶段时自动播放一遍，用于示范读音/听力题
  promptAudioUrl?: string;
  promptAudioName?: string;
  // 正确答案音频（可空）—— 学员答题识别错误时自动播放，用于"对照正确示范"
  // 与 promptAudioUrl 区分: promptAudioUrl 是"题面引导音", 本字段是"答案参考音"
  answerAudioUrl?: string;
  answerAudioName?: string;
  // ─── 口语评分相关（可选，向后兼容老数据） ───────────────────
  // 参考图片 URL（学生录音时可见提示图，例如句型图解）
  referenceImageUrl?: string;
  // 最少录音时长（毫秒），不到则判失败。默认 3000
  minRecordingMs?: number;
  // 语音识别允许的语言（BCP-47，如 'en-US'、'zh-CN'）
  speechLanguages?: string[];
  // 通过短语：学生说的内容里出现任一短语即视为通过
  passPhrases?: string[];
  // 兜底封面图（当 videoUrl 为空时，学员端显示这张图）
  coverImageUrl?: string;
  // 兜底音频（当 videoUrl 为空时，学员端自动播放这段音频，可循环）
  fallbackAudioUrl?: string;
  fallbackAudioName?: string;
}

export interface VideoLabContent {
  // Optional list of teacher videos. Empty list is allowed (degenerate step).
  videos: VideoLabItem[];
}

// A tag placed on the safari image. Coords are 0–100 percentages.
export interface ImageTag {
  id: string;
  x: number;
  y: number;
  label: string;
  // optional reading of the tag
  hint?: string;
  color: string;
  // display size multiplier (0.7~1.6, default 1)
  scale?: number;
  // optional custom image shown instead of the circle+text chip
  imageUrl?: string;
  // 两段可选音频：点击 tag 图片后依次播放 audio1 → audio2（TTS 仍按 label 朗读，
  // 音频与 TTS 同时启动；audio 缺失或空字符串则只播 TTS）。无 audio 时 silent 跳过。
  audioUrl1?: string;
  audioUrl2?: string;
}

export interface ImageSafariContent {
  // 题目文字 / 题面配图 / 题面音频：进入场景时显示在顶部并自动播放音频（学员可点 ♪ 重听）。
  // 与多题测验、超市探险/中断弹窗的 SAFARI 共用同一套字段，保持一致体验。
  prompt?: string;
  promptImageUrl?: string;
  promptAudioUrl?: string;
  // Background scene image (url or /img path).
  imageUrl?: string;
  imageName?: string;
  // Optional mascot image drawn on top of the scene.
  mascotUrl?: string;
  mascotName?: string;
  // Mascot position on the background, 0–100 percentages. Defaults to bottom-center
  // (~50, 85) when unset so old content still renders.
  mascotX?: number;
  mascotY?: number;
  // Display size multiplier for the mascot (0.5~2, default 1).
  mascotScale?: number;
  // Optional "active/clicked" state image for the mascot. When set, the player
  // swaps to this image after the student clicks a tag and keeps it (does not
  // revert). If unset, the mascot stays as-is.
  mascotActiveUrl?: string;
  // When enabled, clicking an image-style tag triggers a small flight animation:
  // a copy of the tag image lifts off from the tag and flies toward the mascot
  // (arc path + shrinking scale). Defaults to true for new content; old content
  // without this field falls back to true so existing lessons keep the new behavior.
  flyToMascot?: boolean;
  // Legacy fields (still honored by the player).
  url?: string;
  caption?: string;
  audio?: string;
  pages?: { url: string; caption?: string; audio?: string }[];
  tags: ImageTag[];
}

// ===== 手描 (step=TRACE) =====
// 一次进入展示一个单词。后台可为每个单词上传：
//  - templateImage: 描摹底图（如透明背景的字迹模板 png）。前台按原图大小淡色显示，
//    并据此算 95% 笔画覆盖完成。
//  - referenceMedia: 参考媒体（图片 / 音频 / 视频 任选）。前台原样展示，不加背景。
//  - referenceAudio: 与参考图配套的可选独立音频（图片/视频时也能单独听发音）。
export interface TraceWordItem {
  id: string;
  word: string;
  templateImage?: string;     // url
  referenceMedia?: string;    // url
  referenceKind?: 'image' | 'audio' | 'video';  // 必传，后台上传什么展示什么
  referenceAudio?: string;    // 可选独立音频（与 referenceMedia 配图/视频配合使用）
}

export interface TraceContent {
  prompt?: string;             // 题面文字，可选
  promptAudioUrl?: string;     // 题面音频
  words: TraceWordItem[];      // 多个单词时顺序解锁：上一个 100% 完成才允许切下一个
  // 笔画覆盖阈值（0-1）。前端判定 100% 完成使用该值（默认 0.95）
  threshold?: number;
}

// Type guards so other modules can narrow content reliably.
export function isTestContent(c: any): c is TestContent {
  return c && Array.isArray(c.questions);
}
export function isVideoLabContent(c: any): c is VideoLabContent {
  return c && Array.isArray(c.videos);
}
export function isImageSafariContent(c: any): c is ImageSafariContent {
  return c && Array.isArray(c.tags);
}
export function isTraceContent(c: any): c is TraceContent {
  return c && Array.isArray(c.words);
}
