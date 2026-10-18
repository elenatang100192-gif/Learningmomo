import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StepService } from './step.service';
import { AdminGuard } from '../../common/admin.guard';

@UseGuards(AdminGuard)
@Controller('admin/steps')
export class StepAdminController {
  constructor(private readonly svc: StepService) {}

  // 列出某个课时下的所有步骤
  @Get()
  list(@Query('lessonId') lessonId: string) {
    return this.svc.listByLesson(lessonId);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(
    @Body() body: { lessonId: string; type: string; sortOrder: number; content: any; name?: string | null },
  ) {
    return this.svc.create(body.lessonId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() body: { type?: string; sortOrder?: number; content?: any; name?: string | null },
  ) {
    return this.svc.update(id, body);
  }

  @Delete(':id')
  del(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
