// 莫莫英语 - 前端 API 客户端
// 自动从 localStorage 注入 x-user-id
// 学生登录后 x-user-id = `student:<phone>`，实现进度按账号隔离。
import { getStudentToken, getStudentUserId } from './auth';

const STORAGE_KEY = 'hongen.userId';

export function getUserId(): string {
  if (typeof window === 'undefined') return '';
  // 已登录学生端 → 走 student:<phone>，所有进度按账号隔离
  const sid = getStudentUserId();
  if (sid) return sid;
  // 否则用匿名 id（localStorage 持久化，避免清除浏览器数据后进度丢失）
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
    ...(init.headers as Record<string, string> | undefined),
  };
  const studentToken = getStudentToken();
  if (studentToken) headers['x-student-token'] = studentToken;

  // HMR 死窗保护：empty response / network error 自动重试 3 次
  const isWrite = init.method && !/^(GET|HEAD)$/i.test(init.method);
  const maxRetries = isWrite ? 1 : 3;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(path, { ...init, headers });
      if (!res.ok) {
        // 4xx 不重试
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`API ${res.status}: ${await res.text()}`);
        }
        throw new Error(`API ${res.status}: ${await res.text()}`);
      }
      return res.json();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      const isEmptyResponse =
        msg.includes('Failed to fetch') ||
        msg.includes('ERR_EMPTY_RESPONSE') ||
        msg.includes('NetworkError') ||
        msg.includes('aborted');
      if (msg.startsWith('API 4')) throw e;
      if (isWrite || !isEmptyResponse) {
        if (attempt >= maxRetries) throw e;
      }
      const wait = 300 * (attempt + 1);
      // eslint-disable-next-line no-console
      console.warn(`[api] ${path} 第 ${attempt + 1} 次失败 (${msg})，${wait}ms 后重试`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error('request failed');
}

export const api = {
  listCourses: (level?: string) =>
    request<CourseDTO[]>(`/api/courses${level ? `?level=${encodeURIComponent(level)}` : ''}`),
  getLesson: (id: string) => request<LessonDTO>(`/api/lessons/${id}`),
  gradeQuiz: (stepId: string, answers: string[]) =>
    request<{ correct: boolean; expected: string[]; starsEarned: number; total?: number; cursor?: number }>(`/api/quiz/grade`, {
      method: 'POST',
      body: JSON.stringify({ stepId, answers }),
    }),
  completeLesson: (lessonId: string, starsEarned: number) =>
    request<unknown>(`/api/progress/complete`, {
      method: 'POST',
      body: JSON.stringify({ lessonId, starsEarned }),
    }),
  // 拉取当前 userId 的全部学习进度（含 lesson 详情）
  listProgress: (level?: string) =>
    request<{
      progress: Array<{
        id: string;
        userId: string;
        lessonId: string;
        status: 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
        starsEarned: number;
        updatedAt: string;
        lesson: {
          id: string;
          title: string;
          courseId: string;
          level: string;
          unitNo: number;
          lessonNo: number;
        };
      }>;
      courses: Array<{ id: string; title: string; level: string; coverUrl?: string | null; lessons: Array<{ id: string }> }>;
    }>(`/api/progress${level ? `?level=${encodeURIComponent(level)}` : ''}`),
  getMyStars: () => request<{ total: number }>(`/api/user/stars`),
  getMe: () => request<{ userId: string }>(`/api/user/me`),

  // ===== qwen paraformer-v2 语音识别 =====
  // 把已上传到七牛（公网可访问）的音频 URL 交给后端去做识别
  // - audioUrl: 七牛 publicUrl（必填）
  // - languageHints: ['en'] / ['zh'] / ['en','zh'] 等，默认英文+中文双语
  transcribeAudio: (audioUrl: string, languageHints?: string[]) =>
    request<{ text: string; durationMs?: number }>(`/api/asr`, {
      method: 'POST',
      body: JSON.stringify({ audioUrl, languageHints }),
    }),

  // ===== 学生端（后台分配账号登录）=====
  // 发送验证码；手机号必须在 HongenStudentAccount 中且 status=ACTIVE
  studentSendCode: (phone: string) =>
    request<{ ok: boolean }>(`/api/student/send-code`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  // 验证码登录（123456）
  studentLogin: (phone: string, code: string) =>
    request<{ token: string; phone: string; name: string | null; userId: string; id: string }>(
      `/api/student/login`,
      { method: 'POST', body: JSON.stringify({ phone, code }) },
    ),
  // 补填姓名
  studentUpdateName: (name: string) =>
    request<{ name: string | null }>(`/api/student/profile`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
      headers: { 'x-student-token': getStudentToken() },
    }),
  // 获取当前学生信息（学员端"我的"页面用）
  studentGetMe: () =>
    request<{ id: string; phone: string; name: string | null; grade: string | null }>(
      `/api/student/me`,
      { headers: { 'x-student-token': getStudentToken() } },
    ),

  // ===== 学习记录和总结 =====
  // 保存学习记录并获取 AI 生成的学习总结
  saveLearningRecord: (lessonId: string, lessonTitle: string, stepAnswers: StepAnswerDTO[]) =>
    request<{ success: boolean; summary: LearningSummaryDTO; answers: StepAnswerDTO[] }>(`/api/learning-summary`, {
      method: 'POST',
      body: JSON.stringify({ 
        userId: getUserId(), 
        lessonId, 
        lessonTitle, 
        stepAnswers 
      }),
    }),
  // 获取学习总结
  getLearningSummary: (lessonId: string) =>
    request<{ summary: LearningSummaryDTO | null; answers: StepAnswerDTO[] }>(
      `/api/learning-summary?userId=${encodeURIComponent(getUserId())}&lessonId=${encodeURIComponent(lessonId)}`
    ),
  // 获取所有学习总结
  getAllLearningSummaries: () =>
    request<{ 
      summaries: LearningSummaryDTO[]; 
      totalLessons: number; 
      totalStars: number 
    }>(`/api/learning-summary?userId=${encodeURIComponent(getUserId())}`),
};

// ===== DTO 类型 =====
export type LessonStatus = 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
// Step types now include the new Test/Video Lab/Image Safari kinds. Older
// VIDEO/IMAGE/QUIZ/BRIDGE are still routed to their legacy components.
export type StepType =
  | 'VIDEO'
  | 'IMAGE'
  | 'QUIZ'
  | 'BRIDGE'
  | 'TEST'
  | 'VIDEO_LAB'
  | 'IMAGE_SAFARI'
  | 'TRACE';

export interface CourseDTO {
  id: string;
  title: string;
  level: string;
  description: string | null;
  coverImage: string | null;
  introAudioUrl: string | null;
  sceneImageUrl: string | null;   // 【场景画布】课程大图，lesson 气泡摆在这张图上
  keywords: string[];          // 来自后端 JSON 解析
  sortOrder: number;
  lessons: LessonWithStatus[];
}

export interface LessonWithStatus extends LessonDTO {
  status: LessonStatus;
}

export interface LessonPlacementDTO {
  id: string;
  lessonId: string;
  courseId: string;
  x: number;
  y: number;
  audioUrl: string | null;
  color: string | null;
}

export interface LessonDTO {
  id: string;
  courseId: string;
  title: string;
  iconUrl: string | null;     // 自定义关卡 icon（七牛）
  sortOrder: number;
  rewardStars: number;
  steps: StepDTO[];
  placement?: LessonPlacementDTO | null;  // 学员端画布坐标
  course?: { id: string; title: string };
}

export interface StepDTO {
  id: string;
  lessonId: string;
  type: StepType;
  name?: string | null;     // 步骤名称（学员端进度条展示用）
  sortOrder: number;
  content: any;
}

// ===== Learning Summary DTO =====
export interface LearningSummaryDTO {
  id: string;
  lessonId: string;
  lessonTitle: string;
  totalStars: number;
  maxStars: number;
  completedAt: string;
  stepResults: StepAnswerDTO[];
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  speakingAnalysis?: {
    averageScore: number;
    commonIssues: string[];
    tips: string[];
  };
  summaryText: string;
}

export interface StepAnswerDTO {
  stepId: string;
  stepType: StepType;
  stepName: string;
  answer: string | string[];
  correct?: boolean;
  starsEarned: number;
  timestamp: number;
  asrText?: string;
  speakingScore?: number;
  speakingFeedback?: string;
}
