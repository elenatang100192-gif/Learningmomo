import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    // 自愈：表/列不存在就建（不影响已有数据）
    await this.ensureSchema();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * 自愈建表 / 删表 / 改列。
   * 注：MySQL < 8.0.29 不支持 ALTER ... ADD COLUMN IF NOT EXISTS，
   *     所以先查 information_schema 再决定要不要 ALTER。
   */
  private async ensureSchema() {
    try {
      // 0) 旧版的 LessonTag（之前那一版做错）已弃用，直接删（如果存在）
      await this.$executeRawUnsafe(`DROP TABLE IF EXISTS HongenLessonTag`);

      // 1) Lesson 表：删掉废弃的 mode / sceneImageUrl 列（如果存在），加 placement 一对一关系
      const lessonCols = await this.$queryRawUnsafe<any[]>(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'HongenLesson'
      `);
      const lessonColSet = new Set(lessonCols.map((r: any) => r.COLUMN_NAME));
      if (lessonColSet.has('mode')) {
        await this.$executeRawUnsafe(`ALTER TABLE HongenLesson DROP COLUMN mode`);
      }
      if (lessonColSet.has('sceneImageUrl')) {
        await this.$executeRawUnsafe(`ALTER TABLE HongenLesson DROP COLUMN sceneImageUrl`);
      }

      // 2) Course 表加 sceneImageUrl（场景大图）
      const courseCols = await this.$queryRawUnsafe<any[]>(`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'HongenCourse'
      `);
      const courseColSet = new Set(courseCols.map((r: any) => r.COLUMN_NAME));
      if (!courseColSet.has('sceneImageUrl')) {
        await this.$executeRawUnsafe(
          `ALTER TABLE HongenCourse ADD COLUMN sceneImageUrl VARCHAR(512) NULL AFTER introAudioUrl`,
        );
      }

      // 3) 建 LessonPlacement 表（lesson 气泡摆位）
      await this.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS HongenLessonPlacement (
          id         CHAR(36)     NOT NULL,
          lessonId   CHAR(36)     NOT NULL,
          courseId   CHAR(36)     NOT NULL,
          x          DOUBLE       NOT NULL,
          y          DOUBLE       NOT NULL,
          audioUrl   VARCHAR(512) NULL,
          color      VARCHAR(16)  NULL,
          createdAt  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updatedAt  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
          PRIMARY KEY (id),
          UNIQUE KEY uk_HongenLessonPlacement_lessonId (lessonId),
          KEY idx_HongenLessonPlacement_courseId (courseId),
          CONSTRAINT fk_HongenLessonPlacement_lesson
            FOREIGN KEY (lessonId) REFERENCES HongenLesson(id) ON DELETE CASCADE,
          CONSTRAINT fk_HongenLessonPlacement_course
            FOREIGN KEY (courseId) REFERENCES HongenCourse(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      this.log.log('Schema 自愈完成（Course.sceneImageUrl + HongenLessonPlacement；旧 LessonTag 已弃）');
    } catch (e: any) {
      this.log.warn(`Schema 自愈失败（不影响主流程）：${e?.message ?? e}`);
    }
  }
}
