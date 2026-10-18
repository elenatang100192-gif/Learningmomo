import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LessonService } from './lesson.service';
import { AdminGuard } from '../../common/admin.guard';

@Controller('lessons')
export class LessonController {
  constructor(private readonly svc: LessonService) {}

  @Get()
  list(@Query('courseId') courseId?: string) {
    return this.svc.list(courseId);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.svc.detail(id);
  }
}

@UseGuards(AdminGuard)
@Controller('admin/lessons')
export class LessonAdminController {
  constructor(private readonly svc: LessonService) {}

  @Get()
  listAll() {
    return this.svc.list();
  }

  @Post()
  create(
    @Body() body: {
      courseId: string;
      title: string;
      iconUrl?: string;
      sortOrder: number;
      rewardStars?: number;
    },
  ) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      iconUrl?: string | null;
      sortOrder?: number;
      rewardStars?: number;
    },
  ) {
    if (body.iconUrl === '') body.iconUrl = null;
    return this.svc.update(id, body);
  }

  @Delete(':id')
  del(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}