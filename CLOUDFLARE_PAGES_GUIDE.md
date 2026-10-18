# Cloudflare Pages 部署指南（莫莫英语前端）

> 本文是 `HONGEN_CN_DEPLOY.md` 第 3 步的**详细版**
>
> **目标**：把 Next.js 前端部署到 Cloudflare Pages，**国内访问 50-150ms**
>
> **前置**：你已经看了 HONGEN_CN_DEPLOY.md 的 0/1/2 步

---

## 1. 准备工作

### 1.1 注册 Cloudflare 账号

- 打开 [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
- 邮箱 + 密码注册（**不用信用卡**）
- 验证邮箱

### 1.2 把 GitHub 仓库授权给 Cloudflare

- 左边栏 **Workers & Pages** → 第一次会让你连 GitHub
- 授权 Cloudflare 访问你的 GitHub（**只勾选 `Learningmomo` 仓库**，别给全部权限）

---

## 2. 创建 Cloudflare Pages 项目

### 2.1 新建项目

1. Cloudflare Dashboard 左边栏 **Workers & Pages**
2. **Create application** → **Pages** → **Connect to Git**
3. 选 **GitHub** → 选 `elenatang100192-gif/Learningmomo` 仓库
4. 点 **Begin setup**

### 2.2 配置构建参数

| 字段 | 填什么 | 说明 |
|---|---|---|
| **Project name** | `momo-web` | 会得到 `momo-web.pages.dev` 子域名 |
| **Production branch** | `main` | main 分支 push 自动部署 |
| **Framework preset** | `Next.js` | 自动用最优配置 |

**Build settings（展开 Advanced）**：

| 字段 | 填什么 |
|---|---|
| **Build command** | `cd web && npm install && npm run build` |
| **Build output directory** | `web/.next` |
| **Root directory** | **留空**（不要填！） |

> ⚠️ **常见错误**：Root directory 留空，build command 用 `cd web && ...`。
> 如果填 `web` 作为 Root directory，build command 就不用 `cd web` 了 —— 但你**两个不要同时配置**，会冲突。

### 2.3 配置环境变量

点 **Environment variables (advanced)** → **Add variable**：

| Variable name | Value | Environment |
|---|---|---|
| `NEXT_PUBLIC_API_ORIGIN` | `https://api.example.com` | Production |
| `NODE_VERSION` | `20` | Production |
| `NPM_FLAGS` | `--legacy-peer-deps` | Production |

> 暂时没域名时，`NEXT_PUBLIC_API_ORIGIN` 填 `http://你的腾讯云服务器IP`，比如 `http://43.123.45.67`

### 2.4 点 Save and Deploy

第一次构建会**慢一些（3-5 分钟）**：
- 拉取代码
- 安装 npm 依赖（~1-2 分钟）
- Next.js build（~30 秒）
- 部署到全球 CDN

可以在 **View build** 看实时日志。

---

## 3. 验证部署成功

### 3.1 得到临时域名

部署成功后会显示：
```
✅ Your site is live!
https://momo-web.pages.dev
```

### 3.2 测试访问

浏览器打开 `https://momo-web.pages.dev`，应该能看到你的主页。

### 3.3 测试 API 调用

1. 打开浏览器 DevTools → Network 标签
2. 刷新页面
3. 找一个 API 请求（比如登录、加载课程）
4. 看 Request URL 是不是 `https://momo-web.pages.dev/api/xxx`
5. 看 Status 是不是 200

如果 API 请求是 **404** 或 **CORS 错误**：
- 检查 `NEXT_PUBLIC_API_ORIGIN` 环境变量设了没
- 检查后端 `WEB_ORIGIN` 包不包含 `https://momo-web.pages.dev`

---

## 4. 绑定自定义域名（强烈推荐）

### 4.1 在 Cloudflare 注册或转入域名

**方案 A：直接 Cloudflare 注册（最简单）**

1. Cloudflare Dashboard → **Domain Registration** → **Register Domains**
2. 搜索想要的域名（试试 `momo-english.com` `momo-study.com` 之类）
3. 选年付（`.com` ~¥70/年，`.cn` ~¥30/年）
4. 付款，**自动添加到你的 Cloudflare 账号**

**方案 B：从阿里云/腾讯云转入**

1. 在原注册商解锁域名 + 获取转移码
2. Cloudflare Dashboard → **Domain Registration** → **Transfer Domains**
3. 填域名 + 转移码，付一年费（按 Cloudflare 成本价）

### 4.2 把域名加到 Cloudflare DNS

1. Cloudflare Dashboard → 选你的域名
2. 自动进到 **DNS** 页面
3. 添加记录：

| 类型 | 名称 | 内容 | 代理状态 |
|---|---|---|---|
| A | `@` | `192.0.2.1`（占位 IP） | DNS only |
| CNAME | `www` | `momo-web.pages.dev` | Proxied |

> 实际上 Cloudflare Pages 加自定义域名时会**自动加 CNAME**，你也可以跳到 4.3 让它自动加。

### 4.3 在 Cloudflare Pages 绑域名

1. 回到 **Workers & Pages** → `momo-web` 项目
2. **Custom domains** 标签 → **Set up a custom domain**
3. 输入 `momo.example.com` → **Continue**
4. Cloudflare 自动验证 + 加 DNS 记录
5. 等 1-5 分钟

成功后你的网站可以通过 `https://momo.example.com` 访问。

### 4.4 改后端 CORS + 环境变量

**后端服务器上**：

```bash
nano /opt/momo/app/server/.env
# 改成：
# WEB_ORIGIN=https://momo.example.com
# ADMIN_ORIGIN=https://admin.example.com
pm2 restart momo-api
```

**Cloudflare Pages**：

Settings → Environment variables → `NEXT_PUBLIC_API_ORIGIN` 改成 `https://api.example.com` → 触发重新部署。

---

## 5. 性能优化

### 5.1 启用 Cloudflare 缓存

Cloudflare Pages 默认缓存静态资源，**但 SSR 渲染的 HTML 不会缓存**。要缓存可以加 Cache Rules（免费计划支持）：

1. Cloudflare Dashboard → 你的域名 → **Caching** → **Cache Rules**
2. Add rule：
   - Name: `Cache static assets`
   - Match: `URI Path` contains `/static/` OR `File extension` is `js, css, png, jpg, jpeg, gif, svg, ico, woff, woff2`
   - Action: **Cache eligible** + Edge TTL 1 month

### 5.2 启用 HTTP/3 + Brotli

1. **Network** 标签 → 启用 **HTTP/3 (QUIC)**
2. 已经是默认开 Brotli 压缩

### 5.3 启用 Auto Minify

1. **Speed** → **Optimization** → Auto Minify: ✅ HTML ✅ CSS ✅ JavaScript

### 5.4 国内访问加速

Cloudflare 在国内有 **17 个节点**（通过和京东/白山的合作），大部分情况下 50-150ms。

如果某些地区慢：
- 加 Argo Smart Routing（付费，$5/月，按量）
- 或者用 Cloudflare for China 商业版

---

## 6. 监控和告警

### 6.1 Cloudflare Analytics

Pages → 你的项目 → **Analytics** 标签：

- Requests（请求数）
- Bandwidth（流量）
- Errors（错误率）

### 6.2 外加 Uptime 监控（推荐，免费）

用 [UptimeRobot](https://uptimerobot.com)（免费）：

1. 注册账号
2. Add New Monitor → HTTP(s)
3. URL: `https://momo.example.com/api/health`
4. Monitoring Interval: 5 minutes
5. Alert Contacts: 加你的邮箱/微信

挂了会立刻通知你。

---

## 7. 自动部署流程

**已经默认开启**，不用配置：

```
你 push 代码到 main 分支
       ↓
GitHub 通知 Cloudflare
       ↓
Cloudflare 拉代码 + 跑 build
       ↓
build 成功 → 部署到 CDN
build 失败 → 邮件通知你
       ↓
用户访问 https://momo.example.com 看到新版本
```

**预览部署**：每个 PR 会得到一个临时 URL（比如 `momo-web-pr-42.pages.dev`），可以给团队 review。

---

## 8. 故障排查

### 错误 1: Build failed - "Module not found"

**原因**：依赖没装全。

**修复**：
- 检查 `web/package.json` 是不是有所有 import 的包
- 在 Cloudflare Pages 设置 → **Environment variables**：
  - 加 `NPM_FLAGS=--legacy-peer-deps`

### 错误 2: Build failed - "Cannot find module 'next'"

**原因**：npm install 没在 `web/` 目录跑。

**修复**：
- Build command 改成：`cd web && npm install && npm run build`

### 错误 3: 部署成功但页面 404

**原因**：Next.js App Router 路由没识别。

**修复**：
- Build output directory 必须是 `web/.next`（不是 `web/out`）
- 检查 `web/app/` 目录结构

### 错误 4: API 请求 CORS 错误

**原因**：后端没允许前端的域名。

**修复**：
- 后端 .env 的 `WEB_ORIGIN` 改成前端域名
- `pm2 restart momo-api`

### 错误 5: 部署后页面空白

**原因**：构建时环境变量没生效。

**修复**：
- Settings → Environment variables → 确认 `NEXT_PUBLIC_API_ORIGIN` 设了
- 触发 Redeploy

---

## 9. 成本

| 项目 | 费用 |
|---|---|
| Cloudflare Pages | **免费**（无限请求，无限带宽，500 次 build/月） |
| 自定义域名 | ¥30-100/年（按域名） |
| Cloudflare DNS | 免费 |
| Cloudflare Analytics | 免费 |
| UptimeRobot | 免费（50 个监控点） |
| **合计** | **基本只有域名费** |

---

## 10. 下一步

- ✅ 自动部署已经默认开启
- 🔄 想要 GitHub Actions 同步部署后端？告诉我
- 📧 想要邮件通知 build 失败？告诉我
- 📊 想要更详细的访问分析？告诉我

---

**部署成功后，记得**：
- [ ] 测试注册/登录
- [ ] 测试所有 API
- [ ] 测试移动端（手机浏览器打开看样式）
- [ ] 用 PageSpeed Insights 测速：https://pagespeed.web.dev/
