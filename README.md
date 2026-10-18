# 莫莫英语 - 互动视频学习平台

> 一款面向小学生（K1-P6）的游戏化、闯关式英语学习平台。通过卡通化 UI、顺序解锁机制和互动视频/练习，让孩子爱上英语。

![Status](https://img.shields.io/badge/status-MVP-blue) ![License](https://img.shields.io/badge/license-Internal-orange) ![Stack](https://img.shields.io/badge/stack-Next.js%20%2B%20NestJS-success)

---

## 📑 目录

- [1. 项目简介](#1-项目简介)
- [2. 核心特性](#2-核心特性)
- [3. 技术栈](#3-技术栈)
- [4. 系统架构](#4-系统架构)
- [5. 目录结构](#5-目录结构)
- [6. 快速开始](#6-快速开始)
- [7. 数据库设计](#7-数据库设计)
- [8. API 接口设计](#8-api-接口设计)
- [9. 核心业务逻辑：解锁机制](#9-核心业务逻辑解锁机制)
- [10. UI / UX 设计规范](#10-ui--ux-设计规范)
- [11. 关键页面与组件](#11-关键页面与组件)
- [12. 管理后台](#12-管理后台)
- [13. 开发路线图](#13-开发路线图)
- [14. 部署说明](#14-部署说明)
- [15. 贡献指南](#15-贡献指南)
- [16. 许可证与版权](#16-许可证与版权)

---

## 1. 项目简介

**莫莫英语互动学习平台** 是一款面向 K1 至 P6 阶段学生的卡通风格英语学习产品。

- 🎯 **目标用户**：小学生（K1-P6），重点覆盖启蒙英语（K1-K3）和小学英语（P1-P3）
- 🎮 **核心玩法**：以"主题课程 → 课时关卡 → 步骤内容"为骨架，学生通过"观看视频 → 完成练习 → 累积星星 → 解锁下一关"完成学习闭环
- 🎨 **设计风格**：扁平卡通 + 高饱和度（天蓝/暖黄/粉色）+ 大圆角 + 漂浮云朵 + 圆胖字体
- 🧩 **核心能力**：支持后台可视化配置课程、课节、多步骤内容（视频/图片/练习题），并自动维护学生进度和解锁关系

---

## 2. 核心特性

| 模块 | 能力 |
| --- | --- |
| 📚 课程体系 | 按级别（K1/P1…）组织课程，每个课程下包含按顺序解锁的课时关卡 |
| 🗺️ 学习地图 | 云端节点式 UI，已完成/当前/未解锁三态可视化，含动画、闪烁光环、烟花特效 |
| 🎬 互动视频 | 接入视频播放器（Video.js / React Player），自动播放并衔接下一步 |
| ❓ 多题型练习 | 支持填空题（拖拽/字母键盘）、单选题、多选题，含对错反馈和星星奖励 |
| 🔓 顺序解锁 | 前一个课时完成后自动解锁下一个，第一个课时默认解锁 |
| ⭐ 星星奖励 | 每课时完成获得星星，星星数可累加用于排行榜/兑换 |
| 🛠️ 后台管理 | 课程/课时/步骤的可视化配置，支持视频和图片上传，支持拖拽排序 |
| 👨‍👩‍👧 家长侧入口 | 提供"家长中心"和"专享优惠"等运营入口 |

---

## 3. 技术栈

### 3.1 前端
- **框架**：React 18 + [Next.js](https://nextjs.org/)（App Router）
- **样式**：[Tailwind CSS](https://tailwindcss.com/)（配自定义 token：色板/圆角/阴影）
- **动画**：[Framer Motion](https://www.framer.com/motion/)（按钮缩放、页面切换、烟花/星星特效）
- **状态管理**：[Zustand](https://zustand-demo.pmnd.rs/)（轻量首选，可按需切换 Redux Toolkit）
- **视频播放**：[Video.js](https://videojs.com/) 或 [React Player](https://github.com/cookpete/react-player)

### 3.2 后端
- **运行时**：Node.js 20 LTS
- **框架**：[NestJS](https://nestjs.com/)（模块化、依赖注入、Guard/Interceptor 开箱即用）
- **ORM**：[Prisma](https://www.prisma.io/)
- **数据库**：PostgreSQL 15+
- **校验**：`class-validator` + `class-transformer`
- **鉴权**：JWT（家长端/管理端）+ 简易设备号（学生端匿名起步）

### 3.3 基础设施
- **存储**：AWS S3 或 阿里云 OSS（视频/图片）
- **对象上传**：服务端签名直传，避免大文件穿透后端
- **CI/CD**：GitHub Actions（lint / test / build）

> 💡 **备选方案**：后端亦可使用 Python [FastAPI](https://fastapi.tiangolo.com/) + SQLModel，本仓库默认 NestJS。

---

## 4. 系统架构

```
┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
│   学生端 Web     │  HTTPS │   NestJS API     │   SQL  │   PostgreSQL     │
│ (Next.js + TW)   │ ─────▶ │ (REST + JWT)     │ ◀────▶ │   + Prisma ORM   │
│  Framer Motion   │        │  进度/解锁逻辑    │        │                  │
└──────────────────┘        └──────────────────┘        └──────────────────┘
                                       │
                                       │ 预签名 URL
                                       ▼
                              ┌──────────────────┐
                              │  OSS / S3 存储    │
                              │  视频 / 图片      │
                              └──────────────────┘
                                       ▲
                                       │
┌──────────────────┐        ┌──────────────────┐
│  管理后台 Web    │ ─────▶ │   同一套 API      │
│ (Next.js Admin)  │        │  + Admin Guard   │
└──────────────────┘        └──────────────────┘
```

---

## 5. 目录结构

```
hongen/
├─ apps/
│  ├─ web/                    # 学生端 Next.js
│  │  ├─ app/
│  │  │  ├─ (student)/
│  │  │  │  ├─ map/           # 学习地图
│  │  │  │  └─ lesson/[id]/   # 课时学习
│  │  │  ├─ layout.tsx        # 全局布局（云朵背景、底部导航）
│  │  │  └─ globals.css       # Tailwind + 自定义样式
│  │  ├─ components/
│  │  │  ├─ map/              # 节点、解锁光环、指路牌
│  │  │  ├─ lesson/           # 视频/图片/练习渲染器
│  │  │  └─ ui/               # 卡通按钮、气泡卡片
│  │  ├─ lib/                 # api 请求封装
│  │  └─ store/               # Zustand stores
│  └─ admin/                  # 管理后台 Next.js（同仓库）
├─ server/                    # NestJS 后端
│  ├─ src/
│  │  ├─ modules/
│  │  │  ├─ course/
│  │  │  ├─ lesson/
│  │  │  ├─ step/
│  │  │  └─ progress/
│  │  ├─ common/              # guards, filters, decorators
│  │  └─ prisma/              # prisma.service.ts
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ migrations/
│  └─ test/
├─ packages/
│  └─ shared-types/           # 前后端共享 TypeScript 类型
├─ infra/                     # docker-compose、nginx 配置
├─ .github/workflows/         # CI
├─ tailwind.config.ts
├─ package.json               # pnpm workspaces
└─ README.md
```

> 当前仓库使用 **pnpm workspaces + Turborepo** 组织多包。如不需要可拆分为独立仓库。

---

## 6. 快速开始

### 6.1 环境要求
- Node.js ≥ 20
- pnpm ≥ 8（或 npm/yarn 自选）
- PostgreSQL ≥ 15（或使用 Docker 启动）
- 一个 OSS/S3 存储桶（也可用本地 `uploads/` 目录做 MVP）

### 6.2 安装依赖
```bash
pnpm install
```

### 6.3 启动数据库（Docker）
```bash
docker run --name hongen-pg -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 -d postgres:15
```

### 6.4 配置环境变量
在 `server/` 下新建 `.env`：
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hongen"
JWT_SECRET="change-me"
OSS_ACCESS_KEY_ID=""
OSS_ACCESS_KEY_SECRET=""
OSS_BUCKET=""
OSS_REGION=""
```

在 `apps/web/` 下新建 `.env.local`：
```env
NEXT_PUBLIC_API_BASE="http://localhost:3001"
```

### 6.5 数据库初始化
```bash
cd server
pnpm prisma migrate dev --name init
pnpm prisma db seed   # 可选：写入示例课程
```

### 6.6 启动开发服务
```bash
# 终端 1：后端
pnpm --filter server dev

# 终端 2：学生端
pnpm --filter web dev

# 终端 3：管理后台（如启用）
pnpm --filter admin dev
```

打开浏览器：
- 学生端：http://localhost:3000
- 管理后台：http://localhost:3002
- API 健康检查：http://localhost:3001/health

---

## 7. 数据库设计

Prisma Schema 完整定义如下（节选自 PRD）：

```prisma
// prisma/schema.prisma

// 课程表
model Course {
  id          String    @id @default(uuid())
  title       String    // 例如 "Topic 1 Animals"
  level       String    // 例如 "K1"
  description String?
  coverImage  String?
  sortOrder   Int       // 课程排序
  isActive    Boolean   @default(true)
  lessons     Lesson[]
  createdAt   DateTime  @default(now())
}

// 课时表（闯关节点）
model Lesson {
  id           String         @id @default(uuid())
  courseId     String
  title        String         // 例如 "1. cat"
  sortOrder    Int            // 课时顺序 (决定解锁顺序)
  rewardStars  Int            @default(3) // 完成后奖励星星数
  steps        Step[]
  course       Course         @relation(fields: [courseId], references: [id])
  userProgress UserProgress[]
}

// 步骤表（视频、练习、图片）
model Step {
  id        String  @id @default(uuid())
  lessonId  String
  type      String  // "VIDEO" | "QUIZ" | "IMAGE"
  sortOrder Int     // 步骤执行顺序
  content   Json    // 存储具体内容
  lesson    Lesson  @relation(fields: [lessonId], references: [id])
}

// 用户进度表（用于解锁逻辑）
model UserProgress {
  id          String  @id @default(uuid())
  userId      String
  lessonId    String
  status      String  // "LOCKED" | "UNLOCKED" | "COMPLETED"
  starsEarned Int     @default(0)
  lesson      Lesson  @relation(fields: [lessonId], references: [id])

  @@unique([userId, lessonId])
  @@index([userId])
}
```

### 7.1 `Step.content` 内容约定（JSON）

```jsonc
// VIDEO
{ "url": "https://cdn.xxx/lesson1/video.mp4", "poster": "https://...", "duration": 92 }

// IMAGE
{ "url": "https://cdn.xxx/lesson1/word.png", "caption": "cat /kæt/", "audio": "https://..." }

// QUIZ - 填空
{
  "kind": "FILL",
  "prompt": "A ___ sat on the mat.",
  "answer": ["cat", "dog"],          // 支持多个正确答案
  "inputMode": "LETTERS"             // LETTERS | DRAG_WORDS
}

// QUIZ - 单选
{
  "kind": "SINGLE",
  "prompt": "Which one says 'woof'?",
  "options": [
    { "id": "a", "text": "cat",  "image": "..." },
    { "id": "b", "text": "dog",  "image": "..." }
  ],
  "answer": ["b"]
}

// QUIZ - 多选
{
  "kind": "MULTI",
  "prompt": "Choose all animals.",
  "options": [ { "id": "a", "text": "cat" }, { "id": "b", "text": "car" } ],
  "answer": ["a"]
}
```

---

## 8. API 接口设计

所有响应统一为：

```json
{ "code": 0, "data": {}, "message": "ok" }
```

### 8.1 课程与课时

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/courses?level=K1` | 获取课程列表（含课时及每个课时的解锁状态） |
| GET | `/api/lessons/:id` | 获取课时详情及步骤列表 |

### 8.2 进度与练习

| Method | Path | 说明 |
| --- | --- | --- |
| POST | `/api/progress/complete` | 提交课时完成，触发下一节解锁 |
| POST | `/api/progress/quiz` | 提交练习题答案，返回 `{ correct, stars }` |
| GET  | `/api/user/stars` | 获取用户总星星数 |

### 8.3 管理后台（需 `AdminGuard`）

| Method | Path | 说明 |
| --- | --- | --- |
| POST/PUT/DELETE | `/api/admin/courses` | 课程 CRUD |
| POST/PUT/DELETE | `/api/admin/lessons` | 课时 CRUD |
| POST/PUT/DELETE | `/api/admin/steps` | 步骤 CRUD（含拖拽排序） |
| POST | `/api/admin/uploads/sign` | 返回 OSS/S3 直传签名 URL |

### 8.4 请求示例

```bash
# 获取 K1 课程地图
curl 'http://localhost:3001/api/courses?level=K1'

# 提交练习题
curl -X POST http://localhost:3001/api/progress/quiz \
  -H 'Content-Type: application/json' \
  -d '{ "stepId":"...", "answer":["b"] }'

# 提交课时完成
curl -X POST http://localhost:3001/api/progress/complete \
  -H 'Content-Type: application/json' \
  -d '{ "lessonId":"...", "starsEarned":3 }'
```

---

## 9. 核心业务逻辑：解锁机制

`GET /api/courses` 返回的每个课时需附带状态字段，规则如下：

```ts
function calcLessonStatus(progress: UserProgress[], all: Lesson[], lesson: Lesson): Status {
  // 1) 已完成
  const me = progress.find(p => p.lessonId === lesson.id);
  if (me?.status === 'COMPLETED') return 'COMPLETED';

  // 2) 第一个课时默认解锁
  const sorted = all
    .filter(l => l.courseId === lesson.courseId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted[0]?.id === lesson.id) return 'UNLOCKED';

  // 3) 前一个 sortOrder 完成 ⇒ 当前解锁
  const prev = sorted[sorted.findIndex(l => l.id === lesson.id) - 1];
  const prevProgress = progress.find(p => p.lessonId === prev?.id);
  return prevProgress?.status === 'COMPLETED' ? 'UNLOCKED' : 'LOCKED';
}
```

要点：
- 解锁是**派生状态**，不长期落库为 `LOCKED`，仅记录 `COMPLETED` 与 `UNLOCKED` 实际写入。
- 提交 `complete` 时立即计算下一个课时的 `UNLOCKED` 行并插入。
- 取消/重置进度时应同时清空下游 `UNLOCKED` 行，避免脏数据。

---

## 10. UI / UX 设计规范

### 10.1 颜色

| Token | Hex | 用途 |
| --- | --- | --- |
| `--sky-200` | `#BAE6FD` | 主背景渐变起始 |
| `--sky-400` | `#38BDF8` | 主背景渐变结束 |
| `--sun-300` | `#FCD34D` | 强调按钮 / 已完成外圈 |
| `--pink-300` | `#F9A8D4` | 当前解锁闪烁光环 |
| `--ink-900` | `#1F2937` | 主文字（带白色描边/阴影） |

### 10.2 形状与阴影
- 卡片/按钮：`border-radius: 20px+`，大圆角
- 阴影：`box-shadow: 0 6px 0 rgba(0,0,0,.15)` 模拟卡通按钮"厚度"
- 字体：`Varela Round` / `Baloo 2` / 中文 `ZCOOL KuaiLe`

### 10.3 动效
- 按钮按下：`scale(0.95)` + `transition: 80ms`
- 页面切换：`AnimatePresence` + `fade` + `y: 12`
- 解锁下一课：烟花粒子 + 星星下落（`canvas-confetti` 或 `framer-motion`）
- 节点闪烁：外圈使用 `box-shadow` 颜色循环动画

---

## 11. 关键页面与组件

### 11.1 学习地图（`/map`）
- 顶部栏：等级标识、SVIP 头像、家长中心入口、`0.8元/每节` 优惠横幅
- 信息气泡：`Topic N - Animals`，核心词 / 核心句 / 日常表达
- 节点路径：云朵上的圆形关卡，状态映射：
  - 已完成 → 🟡 金色外圈 + 高亮动物图标 + `1.cat`
  - 当前 → 🌈 闪烁光环
  - 未解锁 → ⚫ 灰蒙版 + 锁图标
  - 特殊 → `BBC` 标识（口语练习节点）
- 背景：巨型橙色小怪兽吉祥物，手里拿星星
- 指路牌：左侧 `聚焦学习`，右侧 `主题复习`
- 底部导航：`K1-3 启蒙 / P1-3 小学` 切换；`词句库`、`口语城`、`我的房间`

### 11.2 课时学习（`/lesson/[id]`）
- 顶部进度条：`1/5`，节点状态条形图
- 渲染器按 `step.type` 动态加载：
  - `VIDEO` → 全屏视频，自动 next
  - `IMAGE` → 全屏图片 + 文字/音频
  - `QUIZ` → 渲染对应题型组件
- 完成页：星星结算，"太棒了！"鼓励语，返回地图触发下一节解锁

### 11.3 练习题组件
- **FILL**：字母键盘 / 拖拽词库；输入完成后提交校验（支持多答案）
- **SINGLE**：大按钮选项，选中高亮；提交后绿色 ✓ + 星星 / 红色 ✗ + 震动 `shake`
- **MULTI**：多按钮 + "提交" 按钮，全部勾选后再判分

---

## 12. 管理后台

`apps/admin` 提供：
- **课程列表**：表格 + 排序、上下架
- **课时管理**：拖拽排序（基于 `dnd-kit`）、奖励星星数
- **步骤构建器**：横向步骤列表，支持：
  - 添加视频（文件上传或粘贴 URL → OSS 预签名直传）
  - 添加图片（文件上传 + 描述）
  - 添加练习题（题型选择、选项、正确答案）
- **预览模式**：以学生身份实时预览本课时

权限：
- 路由层 `AdminGuard` 拦截 `/api/admin/*`，前端使用 BFF 调用，不暴露签名密钥。

---

## 13. 开发路线图

> 与 PRD 中"AI Coding 特别指令"对齐。

- [x] ✅ **Step 1**：初始化项目（Next.js + NestJS + pnpm workspaces）
- [x] ✅ **Step 2**：Prisma Schema 定义 + 生成首个迁移
- [ ] 🚧 **Step 3**：实现核心 API（课程列表、课时详情、进度提交、解锁逻辑）
- [ ] 🚧 **Step 4**：Tailwind 全局样式（云朵背景、圆角按钮、字体）
- [ ] 🚧 **Step 5**：前端页面（学习地图 + 课时学习 + 练习题组件）
- [ ] 🚧 **Step 6**：管理后台（课程/课时/步骤配置 + 媒体上传）
- [ ] 🚧 **Step 7**：Framer Motion 动效（按钮、页面切换、解锁烟花）
- [ ] 🔜 **Step 8**：鉴权（家长端登录、SVIP 权益位）
- [ ] 🔜 **Step 9**：埋点 & 数据分析（云朵节点点击、完成率、停留时长）
- [ ] 🔜 **Step 10**：P1-3 小学英语内容扩展 + BBC 口语课专题

---

## 14. 部署说明

### 14.1 生产构建
```bash
pnpm -r build
```

### 14.2 Docker
仓库根目录提供 `docker-compose.yml`，一键启动：
```bash
docker compose up -d
```
服务：
- `web` （学生端，Next.js standalone）
- `admin`
- `api` （NestJS）
- `postgres`
- `nginx` （反向代理 + 静态资源）

### 14.3 推荐托管
- 前端：Vercel / 阿里云函数计算
- 后端：阿里云 ECS / Railway
- 数据库：阿里云 RDS PostgreSQL
- 存储：阿里云 OSS 或 AWS S3

---

## 15. 贡献指南

1. Fork & 新建分支：`feat/<scope>` 或 `fix/<scope>`
2. Commit 规范：`<type>(<scope>): <subject>`，例如 `feat(map): add unlock glow animation`
3. 提交前：`pnpm lint && pnpm test`
4. PR 需附：变更说明 / 截图（涉及 UI）/ 关联 Issue

代码风格：
- ESLint + Prettier（仓库已配置）
- TypeScript 严格模式 `strict: true`
- 提交前自动格式化（lint-staged + husky）

---

## 16. 许可证与版权

本项目为内部使用，版权归 **莫莫英语** 所有。

- 学生端 UI 资产（含吉祥物、云朵、星星等卡通素材）仅限本项目内使用
- 第三方字体请遵循其各自的 License（Varela Round: OFL / Baloo 2: OFL）
- 视频与图片版权归内容制作方所有，未经授权不得外传

---

> Made with ❤️ for kids learning English. 让孩子在云朵上学会英语。
