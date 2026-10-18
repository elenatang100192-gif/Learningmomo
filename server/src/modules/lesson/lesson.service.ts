import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LessonService {
  constructor(private prisma: PrismaService) {}

  detail(id: string) {
    return this.prisma.lesson.findUnique({
      where: { id },
      include: { steps: { orderBy: { sortOrder: 'asc' } }, course: true, placement: true },
    });
  }

  list(courseId?: string) {
    return this.prisma.lesson.findMany({
      where: courseId ? { courseId } : undefined,
      orderBy: [{ courseId: 'asc' }, { sortOrder: 'asc' }],
      include: { _count: { select: { steps: true } }, placement: true },
    });
  }

  create(dto: { courseId: string; title: string; iconUrl?: string; sortOrder: number; rewardStars?: number }) {
    return this.prisma.lesson.create({
      data: {
        courseId: dto.courseId,
        title: dto.title,
        iconUrl: dto.iconUrl ?? null,
        sortOrder: dto.sortOrder,
        rewardStars: dto.rewardStars ?? 3,
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{ title: string; iconUrl: string | null; sortOrder: number; rewardStars: number }>,
  ) {
    const l = await this.prisma.lesson.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Lesson not found');
    return this.prisma.lesson.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    const l = await this.prisma.lesson.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Lesson not found');
    await this.prisma.lesson.delete({ where: { id } });
    return { ok: true };
  }
}