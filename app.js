const { FFmpeg } = window.FFmpegWASM;
const ffmpeg = new FFmpeg();

const uploader = document.getElementById('uploader');
const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status-text');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const downloadLink = document.getElementById('download-link');

const VIDEO_RE = /\.(ts|m2ts|mts|mp4)$/i;
let objectURL = null;

function revokeURL() {
    if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
}

uploader.addEventListener('change', () => {
    const file = uploader.files[0];
    if (!file) return;
    revokeURL();
    downloadLink.style.display = 'none';
    if (VIDEO_RE.test(file.name)) {
        startBtn.disabled = false;
        statusText.innerText = '待转换: ' + file.name;
    } else {
        startBtn.disabled = true;
        statusText.innerText = '请选择 .ts / .m2ts / .mts / .mp4 视频文件';
    }
});

// 初始化本地 FFmpeg 引擎（所有依赖均在本地，完全离线）
async function initEngine() {
    if (ffmpeg.loaded) return;
    statusText.innerText = '正在初始化本地转码引擎...';
    const abs = p => new URL(p, window.location.href).href;
    await ffmpeg.load({
        coreURL: abs('./lib/ffmpeg-core.js'),
        wasmURL: abs('./lib/ffmpeg-core.wasm'),
        classWorkerURL: abs('./lib/814.ffmpeg.js'),
    });
}

startBtn.addEventListener('click', async () => {
    const file = uploader.files[0];
    if (!file) return;
    startBtn.disabled = true;

    const inputName = 'input.ts';
    const outputName = 'output.mp4';

    const onProgress = ({ progress }) => {
        const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
        progressBar.style.width = pct + '%';
        if (pct < 100) statusText.innerText = '封装中... ' + pct + '%';
    };

    try {
        revokeURL();
        downloadLink.style.display = 'none';
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';

        await initEngine();

        const finalName = file.name.replace(/\.(ts|m2ts|mts)$/i, '.mp4');

        statusText.innerText = '正在读取文件...';
        await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));

        // 核心指令：-c copy 流复制，只更换封装容器，不重新编码，画质零损失
        statusText.innerText = '正在执行无损封装 (Stream Copy)...';
        ffmpeg.on('progress', onProgress);
        await ffmpeg.exec(['-i', inputName, '-c', 'copy', '-movflags', '+faststart', outputName]);

        statusText.innerText = '转换成功！';
        const data = await ffmpeg.readFile(outputName);
        objectURL = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));
        downloadLink.href = objectURL;
        downloadLink.download = finalName;
        downloadLink.style.display = 'inline-block';
        progressContainer.style.display = 'none';
    } catch (e) {
        statusText.innerText = '转换失败: ' + (e && e.message ? e.message : e);
        console.error(e);
    } finally {
        ffmpeg.off('progress', onProgress);
        try { await ffmpeg.deleteFile(inputName); await ffmpeg.deleteFile(outputName); } catch (e) {}
        startBtn.disabled = false;
    }
});
