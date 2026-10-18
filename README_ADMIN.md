# 莫莫英语 · 管理后台使用说明

后台地址：<http://localhost:3010/admin>

## 1. 登录

- 邮箱：`ADMIN_DEFAULT_EMAIL`（默认 `admin@example.com`）
- 密码：`ADMIN_DEFAULT_PASSWORD`（默认 `ChangeMe123!`）
- 这两个值写在 `server/.env`
- 登录后凭据存在浏览器 localStorage（`hongen.adminEmail` / `hongen.adminPwd`），点右上角"退出"清除

> ⚠️ 当前是**单管理员明文密码**方案（只适合内网/单开发者）。上公网前请改成 JWT 或 session 方案。

## 2. 功能矩阵

| 路径 | 功能 | 鉴权 |
|---|---|---|
| `/admin` | 仪表盘（课程数量 / 快速入口） | ✓ |
| `/admin/courses` | 课程增删改 | ✓ |
| `/admin/lessons` | 课时增删改 + **icon 上传** | ✓ |
| `/admin/steps` | 步骤增删改 | ✓ |
| `/admin/login` | 登录页 | — |

### 课程可配字段
- 标题、等级（K1~P2）、简介、封面图、**关键词**（InfoBubble 上的胶囊）、排序

### 课时可配字段
- 标题、**Icon 图（七牛直传）**、排序、奖励星星

## 3. 七牛上传机制

前端 → `POST /api/admin/upload-token` 拿 token+key
→ 浏览器直接 `POST <host>` 到七牛（不经过我们的服务器）
→ 拿到返回的 key，拼上 `QINIU_URL` 得到公网 URL
→ `PATCH /api/admin/lessons/:id` 时把这个 URL 写到 `Lesson.iconUrl`

### 必填的 .env 字段
```env
QINIU_URL=https://trainspace.ashgso.com          # 公网访问域名
QINIU_BUCKET=trainspace                          # 空间名
QINIU_ACCESS_KEY=...                             # AK
QINIU_SECRET_KEY=...                             # SK
QINIU_UPLOAD_HOST=https://upload.qiniup.com      # 上传入口（华东）
```

> 不同区域（华东/华北/华南）对应不同 `upload.qiniup.com` 子域，详见七牛文档。

## 4. 一次性 SQL 迁移

`HongenLesson` 加了 `iconUrl VARCHAR(512)`，`HongenCourse` 加了 `keywords TEXT`。
迁移脚本：`server/prisma/migrate-add-icon-keywords.ts`（已执行，幂等）。

如需重跑：
```bash
cd server && npx ts-node prisma/migrate-add-icon-keywords.ts
```

## 5. API 端点

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| `POST` | `/api/admin/login` | ✗ | 登录校验 |
| `POST` | `/api/admin/upload-token` | ✓ | 七牛直传 token |
| `GET`  | `/api/admin/courses` | ✓ | 全部课程（含 keywords 数组） |
| `POST/PATCH/DELETE` | `/api/admin/courses/:id` | ✓ | 课程增改删 |
| `GET`  | `/api/admin/lessons` | ✓ | 全部课时 |
| `POST/PATCH/DELETE` | `/api/admin/lessons/:id` | ✓ | 课时增改删（iconUrl 传 `""` 表示清空） |
| `GET`  | `/api/courses` | ✗ | 前台公开接口，已自动返回 `keywords[]` |
| `GET`  | `/api/lessons` | ✗ | 前台公开接口，Prisma 全字段返回（含 `iconUrl`） |

## 6. 前台自动消费

- `app/page.tsx` 把 `course.keywords` 传给 `InfoBubble` 替代写死的 `['Hello','Name','Happy']`
- `app/page.tsx` 把 `lesson.iconUrl` 传给 `LessonNode`，有 URL 时直接 `<img>` 渲染，没传时回退默认占位图

无需改动前台代码即可立即生效。
