# 角色 Lottie 资源

把从 LottieFiles 下载的角色 JSON 放在本目录下，文件名必须严格为以下三份：

- idle.json      — 待机（页面打开 / 音频停止时显示，2~3 秒循环）
- speaking.json  — 说话（音频播放中显示，1~2 秒循环，嘴要有开合）
- happy.json     — 答对/通关（一次性播放，1~1.5 秒）

选角色时注意：JSON 需为 Lottie 5.x 格式（Bodymovin 导出），
文件大小 < 500KB 最佳。License 选 CC0 或 Free for Commercial。
找不到资源时 Mascot 组件会优雅退化（显示浅色圆 + 警告日志），不会导致页面崩溃。
