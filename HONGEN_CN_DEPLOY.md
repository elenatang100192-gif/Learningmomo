# 莫莫英语 · 国内部署完全指南（腾讯云 + Cloudflare）

> **目标**：让国内用户流畅访问，**不需要 ICP 备案**，整套成本 **¥60-100/月**
>
> **架构**：
> ```
> 国内用户
>    ↓ （Cloudflare 国内 CDN 节点，50-150ms）
> [前端] Cloudflare Pages  ──→  [后端] 腾讯云香港服务器
>        (Next.js SSR)                (NestJS + MySQL)
>        免费                            ¥60-100/月
> ```
>
> **总耗时**：1-2 小时（一次性）

---

## 📑 目录

- [0. 准备清单](#0-准备清单)
- [1. 买腾讯云香港轻量服务器（15 分钟）](#1-买腾讯云香港轻量服务器15-分钟)
- [2. 部署后端到服务器（30 分钟）](#2-部署后端到服务器30-分钟)
- [3. 部署前端到 Cloudflare Pages（20 分钟）](#3-部署前端到-cloudflare-pages20-分钟)
- [4. 域名绑定（可选，20 分钟）](#4-域名绑定可选20-分钟)
- [5. 验证和监控](#5-验证和监控)
- [6. 常见问题 FAQ](#6-常见问题-faq)

---

## 0. 准备清单

| 项目 | 说明 | 花费 |
|---|---|---|
| 一个 Cloudflare 账号 | 部署前端 + DNS | 免费 |
| 一个腾讯云账号 | 部署后端 | 需要实名（1 次） |
| 支付宝/微信 | 付服务器费用 | ¥60-100/月 |
| 域名（可选） | 提升可信度 | ¥30-100/年 |
| 你的代码 | 已经在 GitHub | - |

---

## 1. 买腾讯云香港轻量服务器（15 分钟）

### 1.1 选购

1. 打开 [腾讯云轻量应用服务器购买页](https://console.cloud.tencent.com/lighthouse/instance/index)
2. **地域选香港**（关键：不要选大陆，不用备案）
3. **镜像选 Ubuntu 22.04 LTS**
4. **规格选 2核 2G**（够用，省钱）— 约 **¥60-80/月**
5. **带宽 5Mbps 峰值**（小项目够用）
6. **流量包 200GB/月**（够 1-2 万用户访问）
7. 设置 root 密码（**记下来**）
8. 支付，等待 1-3 分钟开通

### 1.2 防火墙放行端口

服务器创建后：

1. 进入 [轻量服务器控制台](https://console.cloud.tencent.com/lighthouse)
2. 点你刚买的服务器 → **防火墙** → **添加规则**

| 协议 | 端口 | 备注 |
|---|---|---|
| TCP | 22 | SSH（默认就有） |
| TCP | 80 | HTTP |
| TCP | 443 | HTTPS |
| TCP | 3001 | 后端 API（临时调试用） |

### 1.3 SSH 登录

```bash
# macOS 终端
ssh root@你的服务器IP
# 第一次登录会问 yes/no，打 yes
# 然后输入你设置的 root 密码
```

成功后会看到 `root@VM-xxx:~#` 提示符。

---

## 2. 部署后端到服务器（30 分钟）

> ⚠️ 接下来所有命令都在**服务器**的终端里执行（不是你的 Mac）

### 2.1 一键初始化脚本

服务器上跑这一条（复制整段，粘贴到 SSH 终端）：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt update && apt upgrade -y
apt install -y nodejs nginx mysql-server git ufw curl
node -v   # 应该是 v20.x
npm -v
```

### 2.2 创建项目目录

```bash
mkdir -p /opt/momo && cd /opt/momo
```

### 2.3 上传代码（2 选 1）

**方案 A：用 Git（最推荐 ✅）**

服务器上跑：

```bash
cd /opt/momo
git clone https://github.com/elenatang100192-gif/Learningmomo.git app
cd app
```

**方案 B：用 SCP（如果不想用 Git）**

你 Mac 上跑：

```bash
cd /Users/tiaotiaotang/Desktop
scp -r Hongen root@你的服务器IP:/opt/momo/app
```

### 2.4 安装后端依赖 + 编译

```bash
cd /opt/momo/app/server
npm ci --include=dev --legacy-peer-deps
npx prisma generate
npm run build
```

**验证编译成功**：

```bash
ls -la dist/main.js
# 应该看到 -rw-r--r-- ... dist/main.js
```

### 2.5 配置环境变量

```bash
# 创建生产环境 .env
cat > /opt/momo/app/server/.env << 'EOF'
NODE_ENV=production
PORT=3001

# MySQL（用本地的，下一步建库）
DB_HOSTNAME=127.0.0.1
DB_PORT=3306
DB_USERNAME=momo_user
DB_PASSWORD=Momo@2026Strong!
DB_DATABASE=momo

# 鉴权
JWT_SECRET=f0cc110793e801463b00d42fa6047242d9aebe6c88d56e99d7d1aac52d12463b
JWT_EXPIRES_IN=7d

# 七牛云
QINIU_URL=https://trainspace.ashgso.com
QINIU_BUCKET=trainspace
QINIU_ACCESS_KEY=LovYLFiZZuPFtvGLTjlCXe3l7YcJq3yEmsCOBpSU
QINIU_SECRET_KEY=ISfANLfFxsgWn0cFlZD2jLlmEbBV4QSnjW5Y_55u

# CORS（部署后改成真实域名）
WEB_ORIGIN=https://momo.example.com
ADMIN_ORIGIN=https://admin.example.com

# 阿里云百炼
DASHSCOPE_API_KEY=sk-a4fd3b22ac9d4c50bb4fadf9d39022ae

# 默认管理员
ADMIN_DEFAULT_EMAIL=admin@example.com
ADMIN_DEFAULT_PASSWORD=ChangeMe123!
EOF
```

> ⚠️ **安全提示**：JWT_SECRET 用了之前生成的，生产环境建议重新生成：`openssl rand -hex 32`

### 2.6 初始化 MySQL

```bash
# 启动 MySQL
systemctl start mysql
systemctl enable mysql

# 安全初始化
mysql_secure_installation
# 全程按 Y，最后设一个 root 密码（**记下来**）
```

进入 mysql 建库建用户：

```bash
mysql -u root -p
```

进入 mysql 后执行：

```sql
CREATE DATABASE momo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'momo_user'@'localhost' IDENTIFIED BY 'Momo@2026Strong!';
GRANT ALL PRIVILEGES ON momo.* TO 'momo_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2.7 跑 Prisma 迁移

```bash
cd /opt/momo/app/server
npx prisma migrate deploy
# 如果是第一次部署（没迁移历史），用：
# npx prisma db push
```

### 2.8 测试启动

```bash
cd /opt/momo/app/server
node dist/main.js
```

应该看到：
```
Nest application successfully bootstrapped
Hongen API listening on http://0.0.0.0:3001
```

**开另一个 SSH 窗口**测一下：

```bash
curl http://127.0.0.1:3001/api/health
# 应该返回 {"ok":true} 或类似
```

测试通过后 `Ctrl+C` 停掉，继续下一步。

### 2.9 用 PM2 保活

```bash
npm install -g pm2
cd /opt/momo/app/server

# 启动
pm2 start dist/main.js --name momo-api

# 设置开机自启
pm2 startup systemd
# 复制输出的那条命令再跑一次（提示里会有 sudo env PATH=...）

pm2 save

# 常用命令
pm2 status           # 看状态
pm2 logs momo-api    # 看日志
pm2 restart momo-api # 重启
pm2 stop momo-api    # 停止
```

### 2.10 配置 Nginx 反向代理

```bash
cat > /etc/nginx/sites-available/momo << 'EOF'
server {
    listen 80;
    server_name _;  # 没绑域名就用 _ 匹配所有

    client_max_body_size 50M;  # 允许上传大文件

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/momo /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t   # 测试配置
systemctl restart nginx
systemctl enable nginx
```

**测试后端**：

```bash
curl http://你的服务器IP/api/health
# 看到 {"ok":true} 就 OK
```

### 2.11 配置 HTTPS（Let's Encrypt 免费证书）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.example.com
# 填邮箱，同意条款
# 选择自动跳转 HTTPS
```

> 如果你暂时没域名，跳过这一步，用 IP 访问也行

**自动续期**已经配置好，90 天自动续。

---

## 3. 部署前端到 Cloudflare Pages（20 分钟）

### 3.1 在 Cloudflare 创建项目

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 左边栏 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选你的 GitHub 仓库 `Learningmomo`
4. 配置：

| 项目 | 值 |
|---|---|
| **Project name** | `momo-web` |
| **Production branch** | `main` |
| **Framework preset** | `Next.js` |
| **Build command** | `cd web && npm install && npm run build` |
| **Build output directory** | `web/.next` |
| **Root directory** | **留空** |

5. 点 **Save and Deploy**

### 3.2 配置环境变量

部署后（或在 **Settings** → **Environment variables**）：

| 变量 | 值 |
|---|---|
| `NEXT_PUBLIC_API_ORIGIN` | `https://api.example.com`（你的后端域名，没域名就填 `http://服务器IP`） |

### 3.3 next.config.js 已经改好

✅ 上面已经改成读环境变量 `NEXT_PUBLIC_API_ORIGIN`，**不需要再改**。

### 3.4 验证前端

部署成功后会得到一个 `https://momo-web.pages.dev` 域名，**国内访问通常 50-150ms**。

打开浏览器访问：
- 主页：`https://momo-web.pages.dev`
- 注册一个用户
- 看是否能调用后端 API（注册/登录）

---

## 4. 域名绑定（可选，20 分钟）

### 4.1 在 Cloudflare 注册域名

1. Cloudflare Dashboard → **Domain Registration** → **Register Domains**
2. 搜你想要的域名（`.com` ~¥70/年，`.cn` ~¥30/年）
3. 付款，自动加到你的 Cloudflare 账号

### 4.2 绑定前端域名

1. Cloudflare Pages → 你的项目 → **Custom domains** → **Set up a custom domain**
2. 输入 `momo.example.com`，点继续
3. Cloudflare 自动加 DNS 记录

### 4.3 绑定后端域名

1. Cloudflare DNS → 添加记录：
   - 类型：`A`
   - 名称：`api`
   - 内容：`你的服务器IP`
   - 代理：**打开**（橙色云朵 = 走 Cloudflare 代理，国内访问更稳）
2. 服务器上跑 `certbot --nginx -d api.example.com`

### 4.4 改后端 .env 的 CORS

```bash
# 服务器上
nano /opt/momo/app/server/.env
# 把 WEB_ORIGIN 和 ADMIN_ORIGIN 改成你的真实域名
# 然后 pm2 restart momo-api
```

### 4.5 改 Cloudflare Pages 环境变量

NEXT_PUBLIC_API_ORIGIN 改成 `https://api.example.com`，触发重新部署。

---

## 5. 验证和监控

### 5.1 后端健康检查

```bash
curl https://api.example.com/api/health
```

### 5.2 看后端日志

```bash
pm2 logs momo-api --lines 100
```

### 5.3 看服务器状态

```bash
# 内存
free -h
# 磁盘
df -h
# CPU
top
```

### 5.4 数据库备份（强烈建议每天一次）

```bash
cat > /opt/momo/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/opt/momo/backups
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u momo_user -p'Momo@2026Strong!' momo | gzip > $BACKUP_DIR/momo_$DATE.sql.gz
# 保留最近 7 天
find $BACKUP_DIR -name "momo_*.sql.gz" -mtime +7 -delete
EOF
chmod +x /opt/momo/backup.sh

# 每天凌晨 3 点跑
crontab -e
# 加这一行：
0 3 * * * /opt/momo/backup.sh
```

---

## 6. 常见问题 FAQ

### Q1: 国内访问 Cloudflare Pages 慢/打不开？

**A**: 检查 DNS 是否被污染。在 Mac 上：
```bash
nslookup momo-web.pages.dev
```
如果返回 `1.0.0.1` 或 `104.16.x.x`（Cloudflare）就是被污染了。解决办法：用 Cloudflare 自定义域名，访问 `momo.example.com` 通常是好的。

### Q2: 腾讯云香港服务器国内访问慢？

**A**: 正常 150-250ms。要更快就选 **腾讯云广州轻量 + 备案**（备案后 50ms 以内）。

### Q3: PM2 自动启动没生效？

**A**: `pm2 startup` 输出的命令必须再跑一次（用 sudo），然后 `pm2 save`。

### Q4: 502 Bad Gateway？

**A**: 后端挂了。`pm2 restart momo-api` 然后看 `pm2 logs momo-api`。

### Q5: 数据库连接失败？

**A**: 检查 `.env` 里 DB_HOSTNAME/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE，然后 `mysql -u momo_user -p` 测一下能不能登。

### Q6: 想要邮件发送功能？

**A**: 在 .env 加 SMTP 变量，然后用 nodemailer 发。我可以帮你加。

### Q7: 想要 Redis 缓存？

**A**: `apt install redis-server`，PM2 加 worker 进程。

### Q8: 想要 CI/CD（push 代码自动部署）？

**A**: Cloudflare Pages **已经自带**。后端用 GitHub Actions：
- `.github/workflows/deploy-server.yml` 我可以帮你写

### Q9: 怎么扩容？

**A**: 升级服务器配置（垂直扩容），或用负载均衡 + 多台服务器（水平扩容）。小项目半年内不用想。

### Q10: 安全建议？

1. **改 SSH 端口**：`nano /etc/ssh/sshd_config` → `Port 2222`
2. **禁用密码登录**：用 SSH 密钥
3. **开 fail2ban**：`apt install fail2ban`
4. **每月更新系统**：`apt update && apt upgrade -y`
5. **定期备份数据库**（见 5.4）

---

## 🎯 总成本估算

| 项目 | 月成本 |
|---|---|
| 腾讯云香港轻量 2核2G | ¥60-80 |
| 域名（.com，按月摊） | ¥6-8 |
| Cloudflare Pages | 免费 |
| Cloudflare DNS | 免费 |
| **合计** | **约 ¥70-90/月** |

支撑 **1-2 万月活用户**没问题。

---

## 🆘 还需要我帮你

1. ✅ 写 GitHub Actions 自动部署后端
2. ✅ 加 fail2ban + SSH 密钥登录
3. ✅ 写监控告警（用 UptimeRobot，免费）
4. ✅ 加 Redis 缓存
5. ✅ 写得更细（某个步骤展开）
