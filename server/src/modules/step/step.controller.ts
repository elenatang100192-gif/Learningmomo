import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { StepService } from './step.service';

@Controller()
export class StepController {
  constructor(private readonly svc: StepService) {}

  @Get('lessons/:lessonId/steps')
  list(@Param('lessonId') lessonId: string) {
    return this.svc.listByLesson(lessonId);
  }

  @Post('lessons/:lessonId/steps')
  create(
    @Param('lessonId') lessonId: string,
    @Body() body: { type: string; sortOrder: number; content: any },
  ) {
    return this.svc.create(lessonId, body);
  }

  @Delete('steps/:id')
  del(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
