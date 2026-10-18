import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CourseModule } from './modules/course/course.module';
import { LessonModule } from './modules/lesson/lesson.module';
import { StepModule } from './modules/step/step.module';
import { StepAttemptModule } from './modules/step/step-attempt.module';
import { ProgressModule } from './modules/progress/progress.module';
import { QuizModule } from './modules/quiz/quiz.module';
import { UserModule } from './modules/user/user.module';
import { ParentModule } from './modules/parent/parent.module';
import { AdminModule } from './modules/admin/admin.module';
import { StudentModule } from './modules/student/student.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CourseModule,
    LessonModule,
    StepModule,
    StepAttemptModule,
    ProgressModule,
    QuizModule,
    UserModule,
    ParentModule,
    AdminModule,
    StudentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
