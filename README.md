# TS ⇌ MP4 无损转换器（离线版）

一个**纯浏览器端**的 TS ⇌ MP4 无损封装工具（只改容器、不重新编码），基于 [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)。

## ✨ 特性

- 🔄 **TS ⇌ MP4 无损封装**：只换容器、不重编码，速度快、画质零损失
- 🔒 **完全离线**：所有处理都在浏览器本地完成（WebAssembly），视频文件不会上传到任何服务器
- 🖥️ **无需安装**：打开网页即用，无需下载任何软件
- 📦 **内置 FFmpeg**：打包了 WASM 版 FFmpeg，开箱即用

## 🚀 使用

1. 直接打开 `index.html`（或 clone 后在本地运行）
2. 拖入 `.ts` 或 `.mp4` 文件
3. 点击转换，完成后下载

## 🧰 技术栈

- [FFmpegWASM](https://github.com/ffmpegwasm/ffmpeg.wasm) —— 在浏览器里运行的 FFmpeg
- 原生 HTML / CSS / JavaScript（无框架）

## ⚠️ 说明

- 大文件转换耗时取决于你的电脑性能
- 仅离线本地运行，隐私安全

> 如果对你有帮助，欢迎 Star ⭐
