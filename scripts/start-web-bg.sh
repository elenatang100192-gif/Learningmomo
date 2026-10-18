#!/bin/bash
# 在 Terminal.app tab 里以后台方式启动 next dev
# 关键：用 nohup + & + 完全重定向 + disown，完全脱离 Terminal 的 tty 会话
cd /Users/tiaotiaotang/Desktop/Hongen/web
nohup env NEXT_PUBLIC_API_ORIGIN=http://localhost:3200 \
  npx next dev -p 3010 -H 0.0.0.0 \
  > /tmp/hongen-web.log 2>&1 < /dev/null &
disown
echo "Next dev started in background. Tail log: tail -f /tmp/hongen-web.log"
exit 0
