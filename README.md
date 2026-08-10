# TS ⇌ MP4 无损转换器

纯浏览器端的 TS → MP4 无损封装工具。只更换封装容器，不重新编码，画质零损失，文件不上传任何服务器。

![界面](screenshot.png)

选中文件后：

![选中文件](screenshot-file.png)

## 功能

- TS / M2TS / MTS / MP4 → MP4，`-c copy` 流复制，无损快速
- 输出带 `+faststart`，可边加载边播放
- 完全离线：基于 FFmpeg.wasm，全部在本地浏览器运行
- 打开即用，无需安装，无账号

## 使用

1. 打开 `index.html`（建议用本地 HTTP 服务访问，避免跨域限制）
2. 选择 `.ts` 视频文件
3. 点击「立即转换（无损）」，完成后保存 MP4

## 原理

```bash
ffmpeg -i input.ts -c copy -movflags +faststart output.mp4
```

`-c copy` 表示流复制：不重新编码，直接把音视频流重新封装进 MP4 容器，速度最快、画质无损。

## 本地运行

```bash
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

---

如果对你有帮助，欢迎 Star ⭐

---

## ☕ 打赏

如果这个工具对你有帮助，欢迎打赏支持继续开发：

![Support](likes.jpg)

## 📚 更多工具 More Tools

> 我做的所有免费工具与智能体都在这：[qgeng1465](https://github.com/qgeng1465) · 全部开源、本地优先、即装即用。

| 类别 | 项目 |
|---|---|
| ✈️ 可视化 | [飞行足迹 3D](https://github.com/qgeng1465/flight-trajectory-visualizer) · [TS→MP4](https://github.com/qgeng1465/ts-to-mp4-converter) · [MP4转换](https://github.com/qgeng1465/mp4-converter) · [音频工具箱](https://github.com/qgeng1465/audio-toolbox) |
| 🎬 下载 | [抖音](https://github.com/qgeng1465/douyin-watermark-free-downloader) · [B站](https://github.com/qgeng1465/bilibili-video-downloader) · [YouTube](https://github.com/qgeng1465/youtube-downloader) · [小红书](https://github.com/qgeng1465/xiaohongshu-downloader) · [公众号](https://github.com/qgeng1465/wechat-article-exporter) · [直播录制](https://github.com/qgeng1465/LiveRecorder) |
| 🧬 AI 智能体 | [AI4Bio](https://github.com/qgeng1465/ai4bio-agents) · [AI4Chem](https://github.com/qgeng1465/ai4chem-agents) · [AI4科研](https://github.com/qgeng1465/ai4research-agents) · [日常生活](https://github.com/qgeng1465/daily-agents) |

