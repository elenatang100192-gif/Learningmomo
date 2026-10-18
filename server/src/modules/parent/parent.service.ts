import { Injectable, BadRequestException, UnauthorizedException, ConflictException, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

function hashPassword(plain: string, salt?: string) {
  const s = salt || randomBytes(8).toString('hex');
  const h = createHash('sha256').update(s + plain).digest('hex');
  return `${s}:${h}`;
}

function verifyPassword(plain: string, stored: string) {
  const [s, h] = stored.split(':');
  if (!s || !h) return false;
  const cmp = createHash('sha256').update(s + plain).digest('hex');
  return cmp === h;
}

@Injectable()
export class ParentService {
  constructor(private prisma: PrismaService) {}

  // 简单 token：base64(parentId + ts + random)
  private makeToken(parentId: string) {
    const raw = `${parentId}.${Date.now()}.${randomBytes(6).toString('hex')}`;
    return Buffer.from(raw).toString('base64url');
  }

  verifyToken(token: string): string | null {
    try {
      const raw = Buffer.from(token, 'base64url').toString();
      const [parentId] = raw.split('.');
      return parentId || null;
    } catch {
      return null;
    }
  }

  async register(phone: string, password: string, nickname?: string) {
    if (!/^1[3-9]\d{9}$/.test(phone)) throw new BadRequestException('手机号格式不正确');
    if (!password || password.length < 6) throw new BadRequestException('密码至少 6 位');
    const exists = await this.prisma.parent.findUnique({ where: { phone } });
    if (exists) throw new ConflictException('手机号已注册');
    const parent = await this.prisma.parent.create({
      data: { phone, passwordHash: hashPassword(password), nickname },
    });
    return { parentId: parent.id, token: this.makeToken(parent.id) };
  }

  async login(phone: string, password: string) {
    const parent = await this.prisma.parent.findUnique({ where: { phone } });
    if (!parent || !verifyPassword(password, parent.passwordHash))
      throw new UnauthorizedException('账号或密码错误');
    return { parentId: parent.id, token: this.makeToken(parent.id) };
  }

  // 验证码注册：家长 + 孩子一起创建
  async verifyRegister(phone: string, childNickname: string, childAge?: number) {
    // 如果手机号已存在，直接创建孩子
    let parent = await this.prisma.parent.findUnique({ where: { phone } });
    if (!parent) {
      // 无密码注册，生成随机密码（家长不可用密码登录，只能短信验证）
      const randomPwd = randomBytes(8).toString('hex');
      parent = await this.prisma.parent.create({
        data: { phone, passwordHash: hashPassword(randomPwd) },
      });
    }
    // 创建孩子
    const child = await this.prisma.child.create({
      data: {
        parentId: parent.id,
        nickname: childNickname,
        ageYears: childAge,
      },
    });
    return {
      parentId: parent.id,
      token: this.makeToken(parent.id),
      childId: child.id,
    };
  }

  async addChild(token: string, dto: { nickname: string; ageYears?: number; level?: string; avatar?: string }) {
    const parentId = this.verifyToken(token);
    if (!parentId) throw new UnauthorizedException('token 无效');
    return this.prisma.child.create({
      data: {
        parentId,
        nickname: dto.nickname,
        ageYears: dto.ageYears,
        level: dto.level,
        avatar: dto.avatar,
      },
    });
  }

  async listChildren(token: string) {
    const parentId = this.verifyToken(token);
    if (!parentId) throw new UnauthorizedException('token 无效');
    const children = await this.prisma.child.findMany({
      where: { parentId },
      include: { _count: { select: { childLessons: true } } },
    });
    // 每个孩子算一下累计星星
    const withStars = await Promise.all(
      children.map(async (c) => {
        const agg = await this.prisma.childLesson.aggregate({
          where: { childId: c.id, status: 'COMPLETED' },
          _sum: { starsEarned: true },
        });
        const completed = await this.prisma.childLesson.count({
          where: { childId: c.id, status: 'COMPLETED' },
        });
        return { ...c, totalStars: agg._sum.starsEarned || 0, completedLessons: completed };
      }),
    );
    return withStars;
  }

  async removeChild(token: string, childId: string) {
    const parentId = this.verifyToken(token);
    if (!parentId) throw new UnauthorizedException('token 无效');
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.parentId !== parentId) throw new NotFoundException('孩子不存在');
    await this.prisma.child.delete({ where: { id: childId } });
    return { ok: true };
  }

  // 学习报告：每个孩子 × 每门课
  async report(token: string, childId: string) {
    const parentId = this.verifyToken(token);
    if (!parentId) throw new UnauthorizedException('token 无效');
    const child = await this.prisma.child.findUnique({ where: { id: childId } });
    if (!child || child.parentId !== parentId) throw new NotFoundException('孩子不存在');

    const courses = await this.prisma.course.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });
    const lessons = await this.prisma.childLesson.findMany({ where: { childId } });
    const map = new Map(lessons.map((l) => [l.lessonId, l]));

    const summary = courses.map((c) => {
      let completed = 0;
      let stars = 0;
      const total = c.lessons.length;
      for (const l of c.lessons) {
        const m = map.get(l.id);
        if (m?.status === 'COMPLETED') {
          completed++;
          stars += m.starsEarned;
        }
      }
      return {
        courseId: c.id,
        title: c.title,
        level: c.level,
        total,
        completed,
        stars,
        rate: total ? Math.round((completed / total) * 100) : 0,
      };
    });

    const totalStars = summary.reduce((s, x) => s + x.stars, 0);
    return { child, summary, totalStars };
  }
}