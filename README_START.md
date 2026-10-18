# 莫莫英语 - 启动文档

## 目录

```
Hongen/
├─ server/   # NestJS + Prisma 后端 API（端口 3001）
└─ web/      # Next.js 14 学生端（端口 3000，自适应 iPad/手机/桌面）
```

## 一、准备：环境变量

根目录已经留好一份 `.env`（MySQL 凭据）。后端启动时只需 `DATABASE_URL`。

> 凭据以根目录 `.env` 为准；`server/.env.example` / `.env.example` 中只有占位符。

## 二、启动后端

```bash
cd server
cp ../.env .env         # 把根 .env 拷过来，或把 DATABASE_URL 单独配进 server/.env
npm install
npm run prisma:generate
npm run start:dev       # 默认监听 http://localhost:3001/api
```

可选：写入示例课程数据（Topic 1 Animals + 2 个课时）

```bash
npm run prisma:db:seed
```

可选：在 Topic 1 Animals 第一课追加 3 条新类型步骤
（多题测验 / 视频口语实验 / 超市探险），用于联调新功能：

```bash
npm run prisma:db:seed:newtypes
```

## 三、启动前端

```bash
cd ../web
npm install
npm run dev             # http://localhost:3000
```

前端通过 Next.js `rewrites` 把 `/api/*` 代理到 `http://localhost:3001/api/*`。

## 四、API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/user/me` | 返回/分配匿名 `userId`（前端注入 header `x-user-id`） |
| GET | `/api/user/stars?level=K1` | 我的累计星星 |
| GET | `/api/courses?level=K1` | 课程 + 课时（含派生 `status`） |
| GET | `/api/lessons/:id` | 课时详情 + 步骤 |
| POST | `/api/quiz/grade` | 提交答案，返回 `correct` / `starsEarned` |
| POST | `/api/progress/complete` | 完成课时，自动解锁下一关 |

## 五、响应式断点

| 设备 | 断点 | 关键差异 |
| --- | --- | --- |
| 手机 | `< 640px` | 单列纵向滚动，节点 28×28 |
| 平板 | `640–1024px` | 节点 32×32，2 列指路牌 + 推广位 |
| iPad 竖屏 | `768–1024px` | 节点 36×36，推广位移到底部 |
| 桌面 | `>= 1024px` | 节点 40×40，主区+右侧推广位并排 |