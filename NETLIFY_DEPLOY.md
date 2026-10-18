# Netlify 部署指南

> 目标：把 **莫莫英语** 项目中的 `web/`（Next.js 14 学生端）和 `server/`（NestJS 后端 API）部署到公网。

---

## 0. 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│  用户浏览器                                                    │
└──────────────────────────────────────────────────────────────┘
        │                                          ▲
        │  HTTPS                                   │  HTTPS
        ▼                                          │
┌────────────────────────┐                ┌───────┴────────┐
│  Netlify (web/)        │  /api/*        │  后端 API       │
│  Next.js 14 SSR 站点    │ ──────────────▶│  NestJS +      │
│  公网域名 *.netlify.app │  rewrite       │  Prisma + MySQL │
└────────────────────────┘                └────────────────┘
```

| 模块 | 框架 | 推荐部署平台 | 备注 |
|---|---|---|---|
| `web/` 学生端 | Next.js 14 (App Router) | **Netlify** | 原生支持，开箱即用 |
| `server/` 后端 API | NestJS 10 + Prisma 5 | **Netlify Functions 或 Railway/Render** | 见下文方案对比 |
| MySQL 数据库 | — | PlanetScale / Aiven / 阿里云 RDS | 任何公网可连的 MySQL 5.7+ 都可以 |

> **重要提示**：NestJS 是长连接 Node 服务，**直接部署到 Netlify Functions 不是最佳选择**（Functions 适合短任务、有超时限制）。本指南提供两个方案。

---

## 1. 前置准备

### 1.1 注册 / 登录
- [Netlify](https://app.netlify.com) 账号（用 GitHub 登录最方便）
- 如果要部署后端，再注册一个 [Railway](https://railway.app) 或 [Render](https://render.com) 账号

### 1.2 把项目推到 GitHub（已完成）
仓库：`https://github.com/elenatang100192-gif/Learningmomo.git`

### 1.3 准备外部服务
- **公网 MySQL**：在 PlanetScale / Aiven / 阿里云 RDS 上开一个 MySQL 5.7+ 实例
- **七牛云**：保留现有 bucket 与 AK/SK
- **阿里云 DashScope**：保留 `sk-` key
- **JWT_SECRET**：在 [randomkeygen.com](https://randomkeygen.com) 生成一个 64 位随机串

---

## 2. 方案 A：前端上 Netlify + 后端上 Railway（推荐 ✅）

> **最稳定** 的方案。后端跑在真正的 Node 容器里，可以连 MySQL。

### 2.1 部署后端到 Railway

#### 2.1.1 创建项目
1. 进入 [Railway Dashboard](https://railway.app/dashboard)
2. **New Project** → **Deploy from GitHub repo** → 选 `elenatang100192-gif/Learningmomo`
3. 第一次会扫描整个 monorepo，先 **Cancel** 自动部署

#### 2.1.2 添加 MySQL
1. 在 Project 页面点 **+ New** → **Database** → **MySQL**
2. 创建后点 MySQL 卡片 → **Variables** 标签，复制以下值备用：
   - `MYSQL_HOST`
   - `MYSQL_PORT`
   - `MYSQL_USER`
   - `MYSQL_PASSWORD`
   - `MYSQL_DATABASE`

#### 2.1.3 配置后端服务
1. **+ New** → **GitHub Repo** → 选同一个 repo
2. 进入服务卡片 → **Settings**：

| 字段 | 值 |
|---|---|
| **Root Directory** | `server` |
| **Build Command** | `npm install && npm run prisma:generate && npm run build` |
| **Start Command** | `node dist/main.js` |
| **Healthcheck Path** | `/api/health` |

3. **Variables** 标签，添加：
   ```env
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=mysql://${MYSQL_USER}:${MYSQL_PASSWORD}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}
   JWT_SECRET=<64位随机串>
   JWT_EXPIRES_IN=7d
   QINIU_URL=https://trainspace.ashgso.com
   QINIU_BUCKET=trainspace
   QINIU_ACCESS_KEY=<你的AK>
   QINIU_SECRET_KEY=<你的SK>
   QINIU_UPLOAD_HOST=https://upload.qiniup.com
   DASHSCOPE_API_KEY=sk-<你的key>
   ADMIN_DEFAULT_EMAIL=admin@example.com
   ADMIN_DEFAULT_PASSWORD=<强密码>
   WEB_ORIGIN=https://<你的前端域名>.netlify.app
   ADMIN_ORIGIN=https://<你的前端域名>.netlify.app
   ```
   > Railway 支持 `${VAR}` 引用其他变量，所以 `${MYSQL_USER}` 会自动用 MySQL 服务的连接信息。

4. **Deploy** → 等构建完成。成功后 **Settings** → **Networking** → **Generate Domain** 拿到一个 `*.up.railway.app` 域名，**记下来**，比如 `https://hongen-api.up.railway.app`

5. 验证：`curl https://hongen-api.up.railway.app/api/health` 应返回 `{"status":"ok"}`

6. （可选）导入种子数据：在本地 `DATABASE_URL` 指向 Railway MySQL 的情况下运行：
   ```bash
   cd server
   DATABASE_URL='mysql://...' npm run prisma:db:seed
   ```

---

### 2.2 部署前端到 Netlify

#### 2.2.1 在 Netlify 控制台创建站点
1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
2. **GitHub** → 选 `elenatang100192-gif/Learningmomo`

#### 2.2.2 配置构建设置
| 字段 | 值 |
|---|---|
| **Base directory** | `web` |
| **Build command** | `npm run build` |
| **Publish directory** | `.next` |
| **Functions directory** | _（留空）_ |

#### 2.2.3 配置环境变量
**Site settings → Environment variables → Add a variable**：

| Key | Value | 用途 |
|---|---|---|
| `NEXT_PUBLIC_API_ORIGIN` | `https://hongen-api.up.railway.app` | Next.js rewrite 把 `/api/*` 转发的目标 |

> ⚠️ `next.config.js` 里 `rewrites` 默认就是 `process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:3200'`，所以**只需要这一个变量**就能让前端的 `/api/courses` 等请求被代理到后端。

#### 2.2.4 部署
1. 点 **Deploy hongen-api...** → 等 1-2 分钟
2. 部署成功后 Netlify 会分配一个 `https://<随机名>.netlify.app` 域名

#### 2.2.5 验证
打开分配的 URL，应该看到地图页面。打开 DevTools → Network：
- `GET /api/courses?level=K1` → 状态 200
- `GET /api/health` → 200

#### 2.2.6 （可选）改域名
**Domain settings** → **Add a domain alias** → 填你的 `example.com` → 按提示配 DNS。

---

## 3. 方案 B：前后端都上 Netlify（一体化）

> 适合 demo / 内部演示。**生产环境不推荐**，因为 Netlify Functions 的 10s/26s 超时对数据库事务和长连接不友好。

### 3.1 前端部署（同方案 A 第 2.2 步）

### 3.2 后端打包成 Netlify Function

1. 在 `server/` 下新增 `netlify.toml`（覆盖根目录的）：
   ```toml
   [build]
     base = "server"
     command = "npm run build && npm run build:netlify"
     publish = "dist-public"

   [functions]
     external_node_modules = ["@prisma/client", "mysql2", "qiniu"]
     node_bundler = "esbuild"
   ```

2. `server/src/main.ts` 末尾改成同时导出 `handler`（用 [`@netlify/functions`](https://docs.netlify.com/build/functions/create-functions/)）：
   ```ts
   import { Handler } from '@netlify/functions';
   // ... 现有 bootstrap 逻辑
   export const handler: Handler = async (event, context) => {
     // 把 API Gateway 风格的 event 适配到 Express
   };
   ```

3. 在仓库根新建 `netlify.toml`（让 Netlify 把 `web/` 跑成站点，`server/` 跑成 Functions）：
   ```toml
   [build]
     base = "web"
     command = "npm run build"
     publish = ".next"

   [[redirects]]
     from = "/api/*"
     to = "/.netlify/functions/api/:splat"
     status = 200
   ```

4. 在 Netlify 环境变量里同时配后端需要的：
   - `DATABASE_URL` / `JWT_SECRET` / `QINIU_*` / `DASHSCOPE_API_KEY`

5. 缺点：Prisma 在 Functions 里需要特殊处理（`binaryTargets`、Lambda layer），调试困难。

> **结论**：本项目复杂度高，**强烈推荐方案 A**。

---

## 4. 部署后检查清单

| ✅ | 检查项 | 命令 / 步骤 |
|---|---|---|
| ☐ | 后端 healthcheck | `curl https://hongen-api.up.railway.app/api/health` |
| ☐ | 前端打开地图 | 浏览器打开 `https://<你的域名>.netlify.app` |
| ☐ | 课程数据可见 | Network 标签里 `GET /api/courses?level=K1` 返回 200 |
| ☐ | 课时可进入 | 点一个节点 → 进入学习页 |
| ☐ | ASR 可用 | 在 VideoLab 步骤录音，确认 `POST /api/asr` 返回 |
| ☐ | CORS 没报错 | DevTools Console 无 `Access-Control-Allow-Origin` 警告 |
| ☐ | 学生登录 | `/student/login` 发送验证码 → 123456 登录 |
| ☐ | AI 总结 | 完成一节课时后，`/api/learning-summary` 返回 AI 文案 |
| ☐ | 管理后台 | 访问 `/admin/login` → 管理员登录 |

---

## 5. 常见问题

### 5.1 前端报 `Failed to fetch` / `ERR_EMPTY_RESPONSE`
- 检查 `NEXT_PUBLIC_API_ORIGIN` 是否配错
- 检查后端 `WEB_ORIGIN` 是否包含前端 Netlify 域名（**两边必须互相配对**）
- 浏览器手动访问 `https://hongen-api.up.railway.app/api/health` 验证后端活着

### 5.2 Netlify 构建失败：`Module not found: Can't resolve '@/lib/...'`
- 这是 Next.js 别名问题。确认 `web/tsconfig.json` 里有：
  ```json
  "paths": { "@/*": ["./*"] }
  ```
- 在 Netlify 的 **Clear cache and deploy** 重新构建

### 5.3 Prisma 在 Railway 上找不到
- `package.json` 的 `build` 脚本里确保有 `prisma generate`
- Railway 部署时设置 `PRISMA_GENERATE_DATAPROXY=false`

### 5.4 七牛上传失败
- `QINIU_URL` 必须是 `https://` 开头且末尾**不带斜杠**
- 在七牛后台确认 bucket 的存储区域与 `QINIU_UPLOAD_HOST` 匹配

### 5.5 DashScope 401
- `DASHSCOPE_API_KEY` 失效或欠费
- 在 [DashScope 控制台](https://dashscope.console.aliyun.com) 重新生成

### 5.6 Netlify 域名被墙 / 国内访问慢
- 在 Netlify **Domain settings** → **Add domain alias** 接自己的域名
- 或者同时部署到 **Vercel**（流程几乎一样）
- 国内访问建议：域名备案后接 Cloudflare 代理

---

## 6. 推荐的 GitHub Actions 自动部署（可选）

在 `.github/workflows/deploy.yml`：

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  netlify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
        working-directory: web
      - run: npm run build
        working-directory: web
      - uses: nwtgck/[email protected]
        with:
          publish-dir: web/.next
          production-branch: main
          deploy-hook: ${{ secrets.NETLIFY_DEPLOY_HOOK }}
        env:
          NEXT_PUBLIC_API_ORIGIN: ${{ secrets.NEXT_PUBLIC_API_ORIGIN }}
```

Netlify 控制台 **Site settings → Build & deploy → Build hooks** 拿到 webhook URL，存到 GitHub repo 的 `NETLIFY_DEPLOY_HOOK` Secret。

---

## 7. 回滚

### Netlify
**Deploys** 标签 → 选一个历史版本 → **Publish deploy**

### Railway
**Deployments** 标签 → 选一个 → **Redeploy**

---

## 8. 成本估算（按月）

| 服务 | 免费额度 | 估计月费用 |
|---|---|---|
| Netlify | 100GB 流量 + 300 分钟构建 | $0（demo 够用） |
| Railway | $5 / 500 小时 | $5 起（按用量） |
| PlanetScale MySQL | 1 个 5GB 免费 DB | $0 起 |
| 七牛云 | 10GB 存储 + 10GB CDN | ¥0-30 |
| DashScope | 按 token 计费 | ¥10-50 |
| **合计** | — | **约 ¥20-100 / 月** |

---

> 最后更新：2026-10-18
