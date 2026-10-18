import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { CourseService } from './course.service';
import { AdminGuard } from '../../common/admin.guard';

@Controller('courses')
export class CourseController {
  constructor(private readonly svc: CourseService) {}

  @Get()
  list(@Query('level') level: string | undefined, @Req() req: any) {
    const userId = req.headers['x-user-id'] as string | undefined;
    return this.svc.list(level, userId);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.svc.findOne(id);
  }
}

@UseGuards(AdminGuard)
@Controller('admin/courses')
export class CourseAdminController {
  constructor(private readonly svc: CourseService) {}

  @Get()
  listAll() {
    return this.svc.list();
  }

  @Post()
  create(
    @Body()
    body: {
      title: string;
      level: string;
      description?: string;
      coverImage?: string;
      introAudioUrl?: string;
      sceneImageUrl?: string;
      keywords?: string[];
      sortOrder?: number;
    },
  ) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      level: string;
      description: string;
      coverImage: string;
      introAudioUrl: string;
      sceneImageUrl: string;
      keywords: string[];
      sortOrder: number;
      isActive: boolean;
    }>,
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  del(@Param('id') id: string) {
    return this.svc.delete(id);
  }

  // 一次性替换某 course 下所有 lesson 的画布位置
  @Put(':id/placements')
  putPlacements(
    @Param('id') id: string,
    @Body() body: {
      placements: Array<{ lessonId: string; x: number; y: number; audioUrl?: string | null; color?: string | null }>;
    },
  ) {
    return this.svc.replacePlacements(id, body.placements ?? []);
  }

  @Get(':id/placements')
  getPlacements(@Param('id') id: string) {
    return this.svc.listPlacements(id);
  }
}