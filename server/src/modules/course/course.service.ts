import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type LessonStatus = 'LOCKED' | 'UNLOCKED' | 'COMPLETED';

function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  async list(level?: string, userId?: string) {
    const courses = await this.prisma.course.findMany({
      where: { isActive: true, ...(level ? { level } : {}) },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      include: {
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: { placement: true },
        },
        placements: true,
      },
    });

    const progress = userId
      ? await this.prisma.userProgress.findMany({ where: { userId } })
      : [];
    const progressMap = new Map(progress.map((p) => [p.lessonId, p.status as LessonStatus]));

    return courses.map((c) => {
      const lessons = c.lessons.map((l, idx) => {
        const me = progressMap.get(l.id);
        let status: LessonStatus = 'LOCKED';
        if (me === 'COMPLETED') status = 'COMPLETED';
        else if (idx === 0) status = 'UNLOCKED';
        else {
          const prev = c.lessons[idx - 1];
          const prevStatus = progressMap.get(prev.id);
          status = prevStatus === 'COMPLETED' ? 'UNLOCKED' : 'LOCKED';
        }
        return { ...l, status };
      });
      // keywords 从 JSON 字符串还原成数组
      const keywords: string[] = c.keywords ? safeJsonArray(c.keywords) : [];
      return { ...c, keywords, lessons };
    });
  }

  async findOne(id: string) {
    const c = await this.prisma.course.findUnique({
      where: { id },
      include: {
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: { placement: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Course not found');
    return c;
  }

  create(dto: {
    title: string;
    level: string;
    description?: string;
    coverImage?: string;
    introAudioUrl?: string;
    keywords?: string[];
    sceneImageUrl?: string;
    sortOrder?: number;
  }) {
    return this.prisma.course.create({
      data: {
        title: dto.title,
        level: dto.level,
        description: dto.description,
        coverImage: dto.coverImage,
        introAudioUrl: dto.introAudioUrl,
        keywords: dto.keywords ? JSON.stringify(dto.keywords) : null,
        sceneImageUrl: dto.sceneImageUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{
      title: string;
      level: string;
      description: string;
      coverImage: string;
      introAudioUrl: string;
      sceneImageUrl: string | null;
      keywords: string[];
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    const c = await this.prisma.course.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Course not found');
    // keywords 是 JSON 数组，序列化成字符串后存
    const data: any = { ...dto };
    if (dto.keywords !== undefined) {
      data.keywords = dto.keywords ? JSON.stringify(dto.keywords) : null;
    }
    if (dto.sceneImageUrl === '') data.sceneImageUrl = null;
    return this.prisma.course.update({ where: { id }, data });
  }

  async delete(id: string) {
    const c = await this.prisma.course.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Course not found');
    await this.prisma.course.delete({ where: { id } });
    return { ok: true };
  }

  // ===== 场景画布：lesson 位置摆放 =====

  // 一次性替换某 course 下所有 lesson 的 placement（按 lessonId 做 upsert）
  async replacePlacements(
    courseId: string,
    placements: Array<{
      lessonId: string;
      x: number;
      y: number;
      audioUrl?: string | null;
      color?: string | null;
    }>,
  ) {
    const c = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!c) throw new NotFoundException('Course not found');

    // 先校验 lesson 全部属于该 course
    const lessonIds = placements.map((p) => p.lessonId);
    if (lessonIds.length) {
      const ok = await this.prisma.lesson.findMany({
        where: { id: { in: lessonIds }, courseId },
        select: { id: true },
      });
      const okSet = new Set(ok.map((l) => l.id));
      for (const lid of lessonIds) {
        if (!okSet.has(lid)) {
          throw new NotFoundException(`Lesson ${lid} not in course ${courseId}`);
        }
      }
    }

    // 删掉没传上来的 lesson 位置
    await this.prisma.lessonPlacement.deleteMany({
      where: { courseId, NOT: lessonIds.length ? { lessonId: { in: lessonIds } } : undefined },
    });

    // upsert 每个
    for (const p of placements) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      await this.prisma.lessonPlacement.upsert({
        where: { lessonId: p.lessonId },
        create: {
          lessonId: p.lessonId,
          courseId,
          x: Math.max(0, Math.min(1, p.x)),
          y: Math.max(0, Math.min(1, p.y)),
          audioUrl: p.audioUrl ?? null,
          color: p.color ?? null,
        },
        update: {
          x: Math.max(0, Math.min(1, p.x)),
          y: Math.max(0, Math.min(1, p.y)),
          audioUrl: p.audioUrl ?? null,
          color: p.color ?? null,
        },
      });
    }

    return this.prisma.lessonPlacement.findMany({ where: { courseId } });
  }

  async listPlacements(courseId: string) {
    return this.prisma.lessonPlacement.findMany({ where: { courseId } });
  }
}