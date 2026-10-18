-- Hongen 系统 - Tag 画布模式 加表 + 加列
-- 适配已有数据，幂等（IF NOT EXISTS），无 prisma db push

-- 1) 给 lesson 表加 2 列
ALTER TABLE HongenLesson
  ADD COLUMN IF NOT EXISTS mode          VARCHAR(16)  NOT NULL DEFAULT 'PATH' AFTER rewardStars,
  ADD COLUMN IF NOT EXISTS sceneImageUrl VARCHAR(512) NULL AFTER iconUrl;

-- 2) 建 tag 表
CREATE TABLE IF NOT EXISTS HongenLessonTag (
  id         CHAR(36)     NOT NULL,
  lessonId   CHAR(36)     NOT NULL,
  label      VARCHAR(64)  NOT NULL,
  x          DOUBLE       NOT NULL,
  y          DOUBLE       NOT NULL,
  audioUrl   VARCHAR(512) NULL,
  color      VARCHAR(16)  NULL,
  sortOrder  INT          NOT NULL DEFAULT 0,
  createdAt  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_HongenLessonTag_lessonId_sortOrder (lessonId, sortOrder),
  CONSTRAINT fk_HongenLessonTag_lesson
    FOREIGN KEY (lessonId) REFERENCES HongenLesson(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
