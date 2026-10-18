#!/bin/bash
# 启动 Hongen 后端 NestJS dev server（独立于 Cursor shell，端口 3001）
set -e
cd /Users/tiaotiaotang/Desktop/Hongen/server
[ -f .env ] || cp ../.env .env
exec npx nest start
