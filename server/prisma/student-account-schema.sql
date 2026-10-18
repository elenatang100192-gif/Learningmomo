-- 莫莫英语 - 学校管理员手动添加的学生账号
-- 仅在 nexusmind 库内新增一张表，不影响旧项目。重复执行幂等。

CREATE TABLE IF NOT EXISTS `HongenStudentAccount` (
  id          CHAR(36)        NOT NULL,
  phone       VARCHAR(20)     NOT NULL,
  name        VARCHAR(64)     NULL,
  grade       VARCHAR(32)     NULL,
  status      VARCHAR(16)     NOT NULL DEFAULT 'ACTIVE',
  note        VARCHAR(255)    NULL,
  createdAt   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt   DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uniq_HongenStudentAccount_phone (phone),
  KEY idx_HongenStudentAccount_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='莫莫英语 - 后台分配的学生账号';
