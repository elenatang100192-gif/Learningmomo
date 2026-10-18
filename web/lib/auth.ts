// 莫莫英语 - 学生端 Auth 客户端
// 学校后台分配账号后，学员用手机号 + 验证码 123456 登录。
// token 存在 localStorage，userId = `student:<phone>`。

const STUDENT_TOKEN_KEY = 'hongen.student.token';
const STUDENT_PHONE_KEY = 'hongen.student.phone';
const STUDENT_NAME_KEY = 'hongen.student.name';
const STUDENT_USERID_KEY = 'hongen.student.userId';

// ===== 学生端 =====

export function isStudentLoggedIn(): boolean {
  return !!getStudentToken();
}

export function getStudentToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STUDENT_TOKEN_KEY) ?? '';
}

export function getStudentPhone(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STUDENT_PHONE_KEY) ?? '';
}

export function getStudentName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STUDENT_NAME_KEY) ?? '';
}

export function getStudentUserId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STUDENT_USERID_KEY) ?? '';
}

export function setStudentAuth(opts: { token: string; phone: string; name?: string | null; userId: string }) {
  localStorage.setItem(STUDENT_TOKEN_KEY, opts.token);
  localStorage.setItem(STUDENT_PHONE_KEY, opts.phone);
  localStorage.setItem(STUDENT_NAME_KEY, opts.name || '');
  localStorage.setItem(STUDENT_USERID_KEY, opts.userId);
}

export function clearStudentAuth() {
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  localStorage.removeItem(STUDENT_PHONE_KEY);
  localStorage.removeItem(STUDENT_NAME_KEY);
  localStorage.removeItem(STUDENT_USERID_KEY);
}
