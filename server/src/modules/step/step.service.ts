import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StepService {
  constructor(private prisma: PrismaService) {}

  listByLesson(lessonId: string) {
    return this.prisma.step.findMany({ where: { lessonId }, orderBy: { sortOrder: 'asc' } });
  }

  async get(id: string) {
    const s = await this.prisma.step.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Step not found');
    return s;
  }

  create(lessonId: string, dto: { type: string; sortOrder: number; content: any; name?: string | null }) {
    return this.prisma.step.create({
      data: {
        lessonId,
        type: dto.type,
        sortOrder: dto.sortOrder,
        content: dto.content,
        // 空字符串归一为 null，存库里保持干净
        name: dto.name && dto.name.trim() ? dto.name.trim() : null,
      },
    });
  }

  async update(id: string, dto: Partial<{ type: string; sortOrder: number; content: any; name?: string | null }>) {
    await this.get(id);
    // 允许显式把 name 设为 null/空（清空）；空字符串也归一为 null
    let patch: any = { ...dto };
    if ('name' in patch) {
      patch.name = patch.name && String(patch.name).trim() ? String(patch.name).trim() : null;
    }
    return this.prisma.step.update({ where: { id }, data: patch });
  }

  async delete(id: string) {
    await this.get(id);
    await this.prisma.step.delete({ where: { id } });
    return { ok: true };
  }
}
