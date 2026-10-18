# ===== 莫莫英语后端 Dockerfile =====
# 多阶段构建：第一阶段编译 TS，第二阶段只拷运行所需

FROM node:20-alpine AS builder
WORKDIR /app

# 安装构建依赖（Prisma + nest 编译需要）
COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json nest-cli.json ./
COPY src ./src

RUN npm ci --include=dev --legacy-peer-deps
RUN npx prisma generate
RUN npm run build

# ===== 运行时镜像（极小）=====
FROM node:20-alpine AS runtime
WORKDIR /app

# 关键：Prisma Client 在 Linux 上需要 openssl 库
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3001

# 只拷运行需要的产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

EXPOSE 3001

CMD ["node", "dist/main.js"]
