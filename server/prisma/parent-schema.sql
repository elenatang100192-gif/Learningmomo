-- 莫莫英语 - 家长端与多孩子表
-- 这 3 张表同样在 nexusmind 库内，不影响旧项目。重复执行幂等。

CREATE TABLE IF NOT EXISTS `HongenParent` (
  id            CHAR(36)        NOT NULL,
  phone         VARCHAR(20)     NOT NULL,
  nickname      VARCHAR(64)     NULL,
  passwordHash  VARCHAR(255)    NOT NULL,
  createdAt     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uniq_HongenParent_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='莫莫英语 - 家长账号';

CREATE TABLE IF NOT EXISTS `HongenChild` (
  id            CHAR(36)        NOT NULL,
  parentId      CHAR(36)        NOT NULL,
  nickname      VARCHAR(64)     NOT NULL,
  avatar        VARCHAR(512)    NULL,
  ageYears      INT             NULL,
  level         VARCHAR(16)     NULL,
  createdAt     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_HongenChild_parent (parentId),
  CONSTRAINT fk_HongenChild_parent FOREIGN KEY (parentId) REFERENCES `HongenParent`(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='莫莫英语 - 孩子档案';

CREATE TABLE IF NOT EXISTS `HongenChildLesson` (
  id            CHAR(36)        NOT NULL,
  childId       CHAR(36)        NOT NULL,
  lessonId      CHAR(36)        NOT NULL,
  status        VARCHAR(16)     NOT NULL DEFAULT 'LOCKED',
  starsEarned   INT             NOT NULL DEFAULT 0,
  lastSeenAt    DATETIME(3)     NULL,
  createdAt     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt     DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uniq_HongenChildLesson_child_lesson (childId, lessonId),
  CONSTRAINT fk_HongenChildLesson_child FOREIGN KEY (childId) REFERENCES `HongenChild`(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='莫莫英语 - 孩子课时进度';
