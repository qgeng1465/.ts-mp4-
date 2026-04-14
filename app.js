const { FFmpeg } = window.FFmpegWASM;
const ffmpeg = new FFmpeg();

const uploader = document.getElementById('uploader');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status-text');
const downloadLink = document.getElementById('download-link');

// 监听文件选择
uploader.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.name.toLowerCase().endsWith('.ts')) {
        startBtn.disabled = false;
        statusText.innerText = `待转换: ${file.name}`;
    }
});

// 初始化本地引擎
async function initEngine() {
    if (ffmpeg.loaded) return;
    statusText.innerText = '正在初始化本地转码引擎...';
    
    // 核心机制修正：利用主线程的 window.location.href 作为锚点，动态构建不受环境影响的绝对路径
    const getAbsoluteURL = (relativePath) => new URL(relativePath, window.location.href).href;

    // 将严格的 Absolute URI 注入引擎，消除 Web Worker 内部所有的相对路径歧义
    await ffmpeg.load({
        coreURL: getAbsoluteURL('./lib/ffmpeg-core.js'),
        wasmURL: getAbsoluteURL('./lib/ffmpeg-core.wasm'),
        classWorkerURL: getAbsoluteURL('./lib/814.ffmpeg.js'),
    });
}

startBtn.addEventListener('click', async () => {
    const file = uploader.files[0];
    if (!file) return;

    try {
        startBtn.disabled = true;
        downloadLink.style.display = 'none';
        
        await initEngine();

        const inputName = 'input.ts';
        const outputName = 'output.mp4';
        const finalName = file.name.replace(/\.ts$/i, '.mp4');

        statusText.innerText = '正在读取文件...';
        const arrayBuffer = await file.arrayBuffer();
        await ffmpeg.writeFile(inputName, new Uint8Array(arrayBuffer));

        statusText.innerText = '正在执行无损封装 (Stream Copy)...';
        // 核心指令：-c copy (关键：不重新编码，直接复制流)
        await ffmpeg.exec(['-i', inputName, '-c', 'copy', outputName]);

        statusText.innerText = '转换成功！';
        const data = await ffmpeg.readFile(outputName);
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

        downloadLink.href = url;
        downloadLink.download = finalName;
        downloadLink.style.display = 'inline-block';

        // 内存清理
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
    } catch (e) {
        statusText.innerText = `错误: ${e.message}`;
        console.error(e);
    } finally {
        startBtn.disabled = false;
    }
});