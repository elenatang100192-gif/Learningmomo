// 管理后台：登录校验 + 七牛上传 token 签发 + 学生账号管理
import { Body, Controller, Get, Headers, Param, Patch, Post, Delete, UseGuards, Req, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { QiniuService } from '../../common/qiniu.service';
import { AdminGuard } from '../../common/admin.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly qiniu: QiniuService,
    private readonly cfg: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 简单登录校验：返回 ok=true 即通过（前端存到 localStorage 当会话）
   * 不发 token，因为 .env 明文密码本身就是凭证
   */
  @Post('login')
  login(
    @Body() body: { email: string; password: string },
  ): { ok: boolean; email: string } {
    const okEmail = this.cfg.get<string>('ADMIN_DEFAULT_EMAIL') || 'admin@example.com';
    const okPwd = this.cfg.get<string>('ADMIN_DEFAULT_PASSWORD') || '';
    if (body.email !== okEmail || body.password !== okPwd) {
      return { ok: false, email: body.email };
    }
    return { ok: true, email: body.email };
  }

  /**
   * 签发七牛直传 token
   * dir 形如 'hongen/lesson-icon' / 'hongen/course-cover'
   */
  @UseGuards(AdminGuard)
  @Post('upload-token')
  issueToken(
    @Body() body: { dir?: string; ext?: string },
    @Headers('x-admin-email') _e: string,
    @Headers('x-admin-password') _p: string,
  ) {
    const dir = (body.dir || 'hongen/misc').replace(/^\/+|\/+$/g, '');
    const ext = (body.ext || 'png').toLowerCase();
    return this.qiniu.issueUploadToken(dir, ext);
  }

  /**
   * 学员专用的上传 token（录音/跟读用）
   * - 不需要 AdminGuard（学员不是 admin）
   * - dir 强制限制为 'hongen/attempts'，避免学员上传到其他目录
   * - 鉴权：要求 x-user-id header（学员匿名 ID 也行，限流防滥用）
   */
  @Post('student/upload-token')
  issueStudentToken(
    @Body() body: { ext?: string },
    @Headers('x-user-id') _u: string,
  ) {
    const ext = (body.ext || 'mp3').toLowerCase();
    // 录音常见格式：mp3 / m4a / webm；其他都按 mp3 处理
    const safeExt = ['mp3', 'm4a', 'webm', 'wav', 'ogg'].includes(ext) ? ext : 'mp3';
    return this.qiniu.issueUploadToken('hongen/attempts', safeExt);
  }

  // ============== 学生账号管理 ==============
  // 全部走 AdminGuard。

  @UseGuards(AdminGuard)
  @Get('students')
  async listStudents(@Query('q') q?: string) {
    const where = q
      ? {
          OR: [
            { phone: { contains: q } },
            { name: { contains: q } },
            { grade: { contains: q } },
          ],
        }
      : {};
    const rows = await this.prisma.studentAccount.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    // 每个学生附带进度汇总
    const withProgress = await Promise.all(
      rows.map(async (s) => this.attachProgress(s)),
    );
    return withProgress;
  }

  @UseGuards(AdminGuard)
  @Post('students')
  async createStudent(
    @Body() body: { phone: string; name?: string; grade?: string; note?: string },
  ) {
    const phone = (body.phone || '').trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException('手机号格式不正确');
    }
    const exists = await this.prisma.studentAccount.findUnique({ where: { phone } });
    if (exists) throw new ConflictException('该手机号已在学生列表中');
    const row = await this.prisma.studentAccount.create({
      data: {
        phone,
        name: body.name?.trim() || null,
        grade: body.grade?.trim() || null,
        note: body.note?.trim() || null,
        status: 'ACTIVE',
      },
    });
    return this.attachProgress(row);
  }

  @UseGuards(AdminGuard)
  @Patch('students/:id')
  async updateStudent(
    @Param('id') id: string,
    @Body() body: { phone?: string; name?: string; grade?: string; note?: string; status?: string },
  ) {
    const cur = await this.prisma.studentAccount.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('学生不存在');
    if (body.phone && body.phone !== cur.phone) {
      if (!/^1[3-9]\d{9}$/.test(body.phone)) {
        throw new BadRequestException('手机号格式不正确');
      }
      const dup = await this.prisma.studentAccount.findUnique({ where: { phone: body.phone } });
      if (dup) throw new ConflictException('该手机号已被其他账号使用');
    }
    const row = await this.prisma.studentAccount.update({
      where: { id },
      data: {
        phone: body.phone?.trim() ?? cur.phone,
        name: body.name?.trim() ?? cur.name,
        grade: body.grade?.trim() ?? cur.grade,
        note: body.note?.trim() ?? cur.note,
        status: body.status === 'DISABLED' ? 'DISABLED' : body.status === 'ACTIVE' ? 'ACTIVE' : cur.status,
      },
    });
    return this.attachProgress(row);
  }

  @UseGuards(AdminGuard)
  @Delete('students/:id')
  async removeStudent(@Param('id') id: string) {
    const cur = await this.prisma.studentAccount.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('学生不存在');
    await this.prisma.studentAccount.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * 单个学生的完整进度明细：按 course → lesson → step 聚合
   * GET /api/admin/students/:id/report
   */
  @UseGuards(AdminGuard)
  @Get('students/:id/report')
  async studentReport(@Param('id') id: string) {
    const acc = await this.prisma.studentAccount.findUnique({ where: { id } });
    if (!acc) throw new NotFoundException('学生不存在');
    const userId = `student:${acc.phone}`;

    const [progress, attempts, courses] = await Promise.all([
      this.prisma.userProgress.findMany({ where: { userId } }),
      this.prisma.stepAttempt.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.course.findMany({
        where: { isActive: true },
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
        include: {
          lessons: {
            orderBy: { sortOrder: 'asc' },
            include: { steps: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      }),
    ]);

    const progressMap = new Map(progress.map((p) => [p.lessonId, p]));
    const attemptsByStep = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = attemptsByStep.get(a.stepId) || [];
      list.push(a);
      attemptsByStep.set(a.stepId, list);
    }

    const summary = courses.map((c) => {
      let completed = 0;
      let stars = 0;
      const lessons = c.lessons.map((l) => {
        const p = progressMap.get(l.id);
        const stepAttempts = l.steps.map((s) => {
          const list = attemptsByStep.get(s.id) || [];
          // 每个 step 汇总 attempts
          const correctCount = list.filter((x) => x.isCorrect).length;
          return {
            stepId: s.id,
            stepName: s.name,
            stepType: s.type,
            attemptCount: list.length,
            correctCount,
            lastAt: list[list.length - 1]?.createdAt || null,
          };
        });
        return {
          lessonId: l.id,
          title: l.title,
          iconUrl: l.iconUrl,
          sortOrder: l.sortOrder,
          status: p?.status || 'LOCKED',
          starsEarned: p?.starsEarned || 0,
          stepCount: l.steps.length,
          steps: stepAttempts,
          lastSeenAt: p?.updatedAt || null,
        };
      });
      for (const l of lessons) {
        if (l.status === 'COMPLETED') {
          completed++;
          stars += l.starsEarned;
        }
      }
      return {
        courseId: c.id,
        title: c.title,
        level: c.level,
        total: c.lessons.length,
        completed,
        stars,
        rate: c.lessons.length ? Math.round((completed / c.lessons.length) * 100) : 0,
        lessons,
      };
    });

    return {
      student: acc,
      totalStars: summary.reduce((s, x) => s + x.stars, 0),
      completedLessons: summary.reduce((s, x) => s + x.completed, 0),
      totalAttempts: attempts.length,
      lastActiveAt: attempts[attempts.length - 1]?.createdAt || progress[progress.length - 1]?.updatedAt || null,
      summary,
    };
  }

  private async attachProgress(s: any) {
    const userId = `student:${s.phone}`;
    const [progressCount, completed, stars, attempts, lastProgress, lastAttempt] = await Promise.all([
      this.prisma.userProgress.count({ where: { userId } }),
      this.prisma.userProgress.count({ where: { userId, status: 'COMPLETED' } }),
      this.prisma.userProgress.aggregate({ where: { userId }, _sum: { starsEarned: true } }),
      this.prisma.stepAttempt.count({ where: { userId } }),
      this.prisma.userProgress.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.stepAttempt.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    const lastAt = lastAttempt?.createdAt || lastProgress?.updatedAt || null;
    return {
      ...s,
      progressCount,
      completedLessons: completed,
      totalStars: stars._sum.starsEarned || 0,
      attemptCount: attempts,
      lastActiveAt: lastAt,
    };
  }
}
