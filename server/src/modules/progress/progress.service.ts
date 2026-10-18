import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private prisma: PrismaService) {}

  // GET /api/progress?userId=xxx&level=K1
  async list(userId: string, level?: string) {
    if (!userId) throw new BadRequestException('missing x-user-id');
    const progress = await this.prisma.userProgress.findMany({
      where: { userId },
      include: { lesson: true },
    });
    const lessonIds = progress.map((p) => p.lessonId);
    const courses = await this.prisma.course.findMany({
      where: {
        ...(level ? { level } : {}),
        lessons: { some: { id: { in: lessonIds } } },
      },
      include: { lessons: true },
    });
    return { progress, courses };
  }

  // POST /api/progress/complete
  // body: { userId, lessonId, starsEarned }
  async complete(userId: string, lessonId: string, starsEarned: number) {
    if (!userId || !lessonId) throw new BadRequestException('userId and lessonId required');
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const existing = await this.prisma.userProgress.findUnique({
      where: { userId_lessonId: { userId, lessonId } },
    });

    const updated = await this.prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        status: 'COMPLETED',
        // 已有记录：取最高星星
        starsEarned: Math.max(existing?.starsEarned || 0, starsEarned || 0),
      },
      create: {
        userId,
        lessonId,
        status: 'COMPLETED',
        starsEarned,
      },
    });

    // 自动解锁下一关（如果存在）
    const siblings = await this.prisma.lesson.findMany({
      where: { courseId: lesson.courseId },
      orderBy: { sortOrder: 'asc' },
    });
    const idx = siblings.findIndex((s) => s.id === lessonId);
    const next = siblings[idx + 1];
    if (next) {
      await this.prisma.userProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: next.id } },
        update: { status: 'UNLOCKED' },
        create: { userId, lessonId: next.id, status: 'UNLOCKED', starsEarned: 0 },
      });
    }

    return updated;
  }
}