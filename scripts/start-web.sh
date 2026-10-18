#!/bin/bash
# 启动 Hongen 前端 dev server（独立于 Cursor shell，端口 3010）
set -e
cd /Users/tiaotiaotang/Desktop/Hongen/web
exec NEXT_PUBLIC_API_ORIGIN=http://localhost:3200 npx next dev -p 3010 -H 0.0.0.0
