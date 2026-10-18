import { Module } from '@nestjs/common';
import { CourseController, CourseAdminController } from './course.controller';
import { CourseService } from './course.service';
import { AdminGuard } from '../../common/admin.guard';

@Module({
  controllers: [CourseController, CourseAdminController],
  providers: [CourseService, AdminGuard],
  exports: [CourseService],
})
export class CourseModule {}