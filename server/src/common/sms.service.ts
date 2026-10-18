import { BadRequestException } from '@nestjs/common';

// 内存存储验证码（开发用，生产请换 Redis）
const codeStore = new Map<string, { code: string; expiresAt: number }>();

export function sendVerifyCode(phone: string): void {
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new BadRequestException('手机号格式不正确');
  // 模拟：固定 123456，3 分钟有效
  codeStore.set(phone, { code: '123456', expiresAt: Date.now() + 3 * 60 * 1000 });
}

export function verifyCode(phone: string, code: string): boolean {
  const record = codeStore.get(phone);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    codeStore.delete(phone);
    return false;
  }
  const ok = record.code === code;
  if (ok) codeStore.delete(phone); // 一次性
  return ok;
}
