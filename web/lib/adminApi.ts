// 管理端 API 客户端
// 鉴权：从 localStorage 读 hongen.adminEmail / hongen.adminPwd，
//       每条请求自动加 x-admin-email / x-admin-password
import { getUserId } from './api';
import type { TestContent, ImageSafariContent } from './stepContents';

const K_EMAIL = 'hongen.adminEmail';
const K_PWD = 'hongen.adminPwd';

export function getAdminEmail(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(K_EMAIL) || '';
}
export function getAdminPwd(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(K_PWD) || '';
}
export function setAdminSession(email: string, pwd: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(K_EMAIL, email);
  window.localStorage.setItem(K_PWD, pwd);
}
export function clearAdminSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(K_EMAIL);
  window.localStorage.removeItem(K_PWD);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
    'x-admin-email': getAdminEmail(),
    'x-admin-password': getAdminPwd(),
    ...(init.headers as Record<string, string> | undefined),
  };

  // Next.js dev 模式在 HMR 重启瞬间会返回 ERR_EMPTY_RESPONSE（1-2s 死窗）。
  // 这里加重试：遇 empty response 或 network error 时最多重试 3 次。
  // 只对幂等方法（GET/HEAD）重试；写操作只重试 1 次防止重复。
  const isWrite = init.method && !/^(GET|HEAD)$/i.test(init.method);
  const maxRetries = isWrite ? 1 : 3;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(path, { ...init, headers });
      if (!res.ok) {
        // 401/4xx 不要重试（鉴权失败没意义）
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`API ${res.status}: ${await res.text()}`);
        }
        // 5xx 才考虑重试
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
      // 401/4xx 立刻抛
      if (msg.startsWith('API 4')) throw e;
      // 不可重试的错误（5xx 但只重试 1 次避免重复写）
      if (isWrite || !isEmptyResponse) {
        if (attempt >= maxRetries) throw e;
      }
      // 等一下再试
      const wait = 300 * (attempt + 1);
      // eslint-disable-next-line no-console
      console.warn(`[adminApi] ${path} 第 ${attempt + 1} 次失败 (${msg})，${wait}ms 后重试`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error('request failed');
}

export type StepType =
  | 'VIDEO'
  | 'QUIZ'
  | 'IMAGE'
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
  sceneImageUrl: string | null;
  keywords: string[];            // 来自后端 JSON 解析
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LessonDTO {
  id: string;
  courseId: string;
  title: string;
  iconUrl: string | null;         // 七牛 icon URL
  sortOrder: number;
  rewardStars: number;
  _count?: { steps: number };
  placement?: LessonPlacementDTO | null;
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

export interface StepDTO {
  id: string;
  lessonId: string;
  type: StepType;
  name?: string | null;     // 步骤名称（学员端进度条展示用）
  sortOrder: number;
  content: any;
}

// ============== VIDEO 步骤：弹题点 (interrupt) ==============
export type InterruptQuestionType =
  | 'SPEECH' | 'SINGLE' | 'MULTI' | 'FILL'
  | 'QUIZ'   | 'SAFARI';

export interface InterruptOption {
  id: string;
  text: string;
  imageUrl?: string;   // 选项配图（可空）
  audioUrl?: string;   // 选项音频（可空）— 学员点击可听、选中后自动播放
  correct: boolean;
}

export type InterruptQuestion =
  | { type: 'SPEECH'; prompt: string; promptImageUrl?: string; promptAudioUrl?: string; answerAudioUrl?: string; minSeconds?: number; passSentences?: string[]; languageHints?: string[] }
  | { type: 'SINGLE'; prompt: string; promptImageUrl?: string; promptAudioUrl?: string; options: InterruptOption[] }
  | { type: 'MULTI';  prompt: string; promptImageUrl?: string; promptAudioUrl?: string; options: InterruptOption[] }
  | { type: 'FILL';   prompt: string; promptImageUrl?: string; promptAudioUrl?: string; answer: string; caseSensitive?: boolean }
  // 复用 step=多题测验 (TEST) 的完整结构：可加多题，题前视频，三种 kind (SINGLE/MULTIPLE/FILL)
  | { type: 'QUIZ';   test: TestContent }
  // 复用 step=超市探险 的结构（背景图+吉祥物+若干 tag）
  | { type: 'SAFARI'; safari: ImageSafariContent };

export interface VideoInterrupt {
  id: string;
  atSec: number;     // 第几秒触发弹窗（0..duration）
  question: InterruptQuestion;
}

export interface VideoContent {
  url: string;
  poster?: string;
  duration?: number;        // 秒
  aspect?: '16:9' | '1:1' | '9:16';
  interrupts?: VideoInterrupt[];  // 视频中插入的弹题点
  maxStars?: number;        // 1..3, 学员端通过弹题后可拿的星
}

export interface StepAttemptDTO {
  id: string;
  userId: string;
  stepId: string;
  interruptId: string;
  questionType: InterruptQuestionType;
  isCorrect: boolean;
  score: number;     // 0..100
  createdAt: string;
}

export const adminApi = {
  // ===== 登录 / 上传 =====
  login: (email: string, password: string) =>
    request<{ ok: boolean; email: string }>(`/api/admin/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  issueUploadToken: (dir: string, ext: string) =>
    request<{ token: string; key: string; publicUrl: string; host: string }>(
      `/api/admin/upload-token`,
      { method: 'POST', body: JSON.stringify({ dir, ext }) },
    ),

  // 课程
  listCourses: (level?: string) =>
    request<CourseDTO[]>(`/api/courses${level ? `?level=${encodeURIComponent(level)}` : ''}`),
  createCourse: (body: { title: string; level: string; description?: string; coverImage?: string; introAudioUrl?: string; sceneImageUrl?: string; keywords?: string[]; sortOrder?: number }) =>
    request<CourseDTO>('/api/admin/courses', { method: 'POST', body: JSON.stringify(body) }),
  updateCourse: (id: string, body: Partial<Omit<CourseDTO, 'id' | 'createdAt' | 'updatedAt'>>) =>
    request<CourseDTO>(`/api/admin/courses/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCourse: (id: string) =>
    request<{ ok: true }>(`/api/admin/courses/${id}`, { method: 'DELETE' }),
  // 一次性替换 course 下所有 lesson 的画布位置
  replaceCoursePlacements: (id: string, placements: Array<{ lessonId: string; x: number; y: number; audioUrl?: string | null; color?: string | null }>) =>
    request<LessonPlacementDTO[]>(`/api/admin/courses/${id}/placements`, { method: 'PUT', body: JSON.stringify({ placements }) }),

  // 课时
  listLessons: (courseId: string) =>
    request<LessonDTO[]>(`/api/lessons?courseId=${encodeURIComponent(courseId)}`),
  createLesson: (body: { courseId: string; title: string; iconUrl?: string; sortOrder: number; rewardStars?: number }) =>
    request<LessonDTO>('/api/admin/lessons', { method: 'POST', body: JSON.stringify(body) }),
  updateLesson: (id: string, body: Partial<{ title: string; iconUrl: string | null; sortOrder: number; rewardStars: number }>) =>
    request<LessonDTO>(`/api/admin/lessons/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteLesson: (id: string) =>
    request<{ ok: true }>(`/api/admin/lessons/${id}`, { method: 'DELETE' }),

  // 步骤
  listSteps: (lessonId: string) =>
    request<StepDTO[]>(`/api/admin/steps?lessonId=${encodeURIComponent(lessonId)}`),
  getStep: (id: string) => request<StepDTO>(`/api/admin/steps/${id}`),
  createStep: (body: { lessonId: string; type: StepType; sortOrder: number; content: any; name?: string | null }) =>
    request<StepDTO>('/api/admin/steps', { method: 'POST', body: JSON.stringify(body) }),
  updateStep: (id: string, body: Partial<{ type: StepType; sortOrder: number; content: any; name?: string | null }>) =>
    request<StepDTO>(`/api/admin/steps/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteStep: (id: string) =>
    request<{ ok: true }>(`/api/admin/steps/${id}`, { method: 'DELETE' }),

  // ===== 步骤弹题回答 (学员端写入, admin 可拉回看) =====
  submitStepAttempt: (userId: string, body: { stepId: string; interruptId: string; question: any; answer: any }) =>
    request<{ id: string; isCorrect: boolean; score: number }>(
      `/api/step-attempts?userId=${encodeURIComponent(userId)}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  listStepAttempts: (userId: string, stepId: string) =>
    request<{ total: number; latest: StepAttemptDTO[] }>(
      `/api/step-attempts?userId=${encodeURIComponent(userId)}&stepId=${encodeURIComponent(stepId)}`,
    ),

  // ===== 学生账号管理（学校后台分配） =====
  listStudents: (q?: string) =>
    request<StudentAccountDTO[]>(`/api/admin/students${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createStudent: (body: { phone: string; name?: string; grade?: string; note?: string }) =>
    request<StudentAccountDTO>(`/api/admin/students`, { method: 'POST', body: JSON.stringify(body) }),
  updateStudent: (id: string, body: Partial<{ phone: string; name: string; grade: string; note: string; status: 'ACTIVE' | 'DISABLED' }>) =>
    request<StudentAccountDTO>(`/api/admin/students/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteStudent: (id: string) =>
    request<{ ok: true }>(`/api/admin/students/${id}`, { method: 'DELETE' }),
  getStudentReport: (id: string) =>
    request<StudentReportDTO>(`/api/admin/students/${id}/report`),
};

export interface StudentAccountDTO {
  id: string;
  phone: string;
  name: string | null;
  grade: string | null;
  status: 'ACTIVE' | 'DISABLED';
  note: string | null;
  createdAt: string;
  updatedAt: string;
  progressCount: number;
  completedLessons: number;
  totalStars: number;
  attemptCount: number;
  lastActiveAt: string | null;
}

export interface StudentReportStepDTO {
  stepId: string;
  stepName: string | null;
  stepType: string;
  attemptCount: number;
  correctCount: number;
  lastAt: string | null;
}

export interface StudentReportLessonDTO {
  lessonId: string;
  title: string;
  iconUrl: string | null;
  sortOrder: number;
  status: 'LOCKED' | 'UNLOCKED' | 'COMPLETED';
  starsEarned: number;
  stepCount: number;
  steps: StudentReportStepDTO[];
  lastSeenAt: string | null;
}

export interface StudentReportCourseDTO {
  courseId: string;
  title: string;
  level: string;
  total: number;
  completed: number;
  stars: number;
  rate: number;
  lessons: StudentReportLessonDTO[];
}

export interface StudentReportDTO {
  student: StudentAccountDTO;
  totalStars: number;
  completedLessons: number;
  totalAttempts: number;
  lastActiveAt: string | null;
  summary: StudentReportCourseDTO[];
}
