import { Module } from '@nestjs/common';
import { LessonController, LessonAdminController } from './lesson.controller';
import { LessonService } from './lesson.service';
import { AdminGuard } from '../../common/admin.guard';

@Module({
  controllers: [LessonController, LessonAdminController],
  providers: [LessonService, AdminGuard],
})
export class LessonModule {}