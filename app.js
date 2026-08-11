/* TS ⇌ MP4 无损转换器
 * 支持：多段 .ts 合并 / 批量转换 / 单文件双向封装
 * 全部在浏览器本地完成（FFmpeg.wasm），文件不上传。
 * Author: qgeng1465 | License: MIT
 */
const { FFmpeg } = window.FFmpegWASM;
const ffmpeg = new FFmpeg();

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const drop = $('drop'), fileInput = $('fileInput');
const modeTabs = $('modeTabs'), modeHint = $('modeHint');
const listCard = $('listCard'), fileList = $('fileList'), fileCount = $('fileCount');
const sortBtn = $('sortBtn'), clearBtn = $('clearBtn');
const mergeTip = $('mergeTip'), batchTip = $('batchTip'), memWarn = $('memWarn');
const progressCard = $('progressCard'), statusText = $('statusText'), etaEl = $('eta'), progressBar = $('progressBar');
const resultCard = $('resultCard'), resultList = $('resultList');
const startBtn = $('startBtn');

// ---------- 状态 ----------
const SUPPORTED = /\.(ts|m2ts|mts|mp4|mov|mkv|avi|flv|webm|mpg|mpeg|wmv)$/i;
const TS_FAMILY = /\.(ts|m2ts|mts)$/i;
const MODE_HINT = {
    single: '把一个视频转成 MP4（.ts 类输入无损封装；.mp4 输入可转回 .ts）。',
    merge: '把多个 .ts 片段按顺序无损合并成一个 MP4 —— 直播录制 / M3U8 分片一键还原。',
    batch: '多个视频各自转成目标格式，逐个处理，每个文件独立输出。',
};
let mode = 'merge';
let files = [];            // File[]（只含受支持的文件）
let objectURLs = [];       // 供释放

// ---------- 工具 ----------
function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
}
function outputNameFor(file) {
    const base = file.name.replace(/\.[^./]+$/, '');
    if (TS_FAMILY.test(file.name)) return base + '.mp4';
    if (/\.mp4$/i.test(file.name)) return base + '.ts';
    return base + '.mp4';
}
// 自然排序：把文件名中的数字序列按数值比较（seg_1 < seg_2 < ... < seg_10）
function naturalCmp(a, b) {
    const ta = a.name.match(/\d+|\D+/g) || [], tb = b.name.match(/\d+|\D+/g) || [];
    const n = Math.max(ta.length, tb.length);
    for (let i = 0; i < n; i++) {
        const x = ta[i], y = tb[i];
        if (x === undefined) return -1;
        if (y === undefined) return 1;
        if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
            if (x !== y) return Number(x) < Number(y) ? -1 : 1;
        } else if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return 0;
}
// 支持拖入文件夹（递归展开）
function filesFromDataTransfer(dt) {
    const out = [];
    const items = dt.items;
    if (items && items.length && typeof items[0].webkitGetAsEntry === 'function') {
        const tasks = [];
        for (const item of items) {
            const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
            if (entry) tasks.push(walkEntry(entry, out));
        }
        return Promise.all(tasks).then(() => out);
    }
    return Promise.resolve([...dt.files]);
}
function walkEntry(entry, out) {
    return new Promise(resolve => {
        if (entry.isFile) {
            entry.file(f => { out.push(f); resolve(); }, resolve);
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const all = [];
            const readBatch = () => reader.readEntries(batch => {
                if (!batch.length) {
                    Promise.all(all.map(en => walkEntry(en, out))).then(resolve);
                } else {
                    all.push(...batch);
                    readBatch();
                }
            }, resolve);
            readBatch();
        } else resolve();
    });
}

// ---------- 文件添加 / 列表 ----------
function addFiles(list) {
    const supported = list.filter(f => SUPPORTED.test(f.name));
    const droppedNonTs = list.filter(f => !SUPPORTED.test(f.name)).length;
    if (mode === 'merge') {
        const ts = supported.filter(f => TS_FAMILY.test(f.name));
        if (supported.length - ts.length > 0) {
            setStatus(`合并模式已忽略 ${supported.length - ts.length} 个非 .ts 文件`, 'err');
        }
        supported.length = 0;
        supported.push(...ts);
    }
    if (!supported.length) {
        setStatus('未找到受支持的视频文件', 'err');
        return;
    }
    const existing = new Set(files.map(f => f.name + '|' + f.size));
    const fresh = supported.filter(f => !existing.has(f.name + '|' + f.size));
    files.push(...fresh);
    files.sort(naturalCmp);
    renderList();
    updateDropSub(droppedNonTs);
}
function updateDropSub(dropped) {
    const d = $('dropSub');
    if (mode === 'merge') {
        d.textContent = '多段合并模式：请拖入全部 .ts 片段（可拖整个文件夹），已自动按数字序号排序';
    } else {
        d.textContent = '支持 .ts / .m2ts / .mts / .mp4 / .mov / .mkv / .avi / .flv / .webm';
    }
}
function renderList() {
    listCard.style.display = files.length ? 'block' : 'none';
    mergeTip.style.display = mode === 'merge' && files.length ? 'block' : 'none';
    batchTip.style.display = mode === 'batch' && files.length ? 'block' : 'none';
    fileCount.textContent = files.length ? `（${files.length} 个）` : '';
    fileList.innerHTML = '';
    const total = files.reduce((s, f) => s + f.size, 0);
    if (total > 800 * 1048576) {
        memWarn.style.display = 'block';
        memWarn.innerHTML = `⚠️ 文件总大小约 <b>${fmtSize(total)}</b>，超过浏览器内存安全线（约 800MB）。若处理失败，请分批合并。`;
    } else {
        memWarn.style.display = 'none';
    }
    startBtn.disabled = files.length === 0;
    files.forEach((f, i) => {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.idx = i;
        li.innerHTML = `
            <span class="drag-handle" title="拖动排序">⋮⋮</span>
            <span class="order">${i + 1}</span>
            <span class="fname" title="${f.name}">${f.name}</span>
            <span class="fsize">${fmtSize(f.size)}</span>
            <button class="rm" title="移除">✕</button>`;
        li.querySelector('.rm').onclick = () => { files.splice(i, 1); renderList(); };
        li.addEventListener('dragstart', onDragStart);
        li.addEventListener('dragover', onDragOver);
        li.addEventListener('drop', onDrop);
        li.addEventListener('dragend', onDragEnd);
        fileList.appendChild(li);
    });
}
let dragFrom = null;
function onDragStart(e) {
    dragFrom = +e.target.dataset.idx;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}
function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const li = e.target.closest('li');
    if (li && dragFrom !== null && li.dataset.idx != dragFrom) li.classList.add('drag-over');
}
function onDrop(e) {
    e.preventDefault();
    const li = e.target.closest('li');
    if (!li || dragFrom === null) return;
    const to = +li.dataset.idx;
    if (to !== dragFrom) {
        const [moved] = files.splice(dragFrom, 1);
        files.splice(to, 0, moved);
        renderList();
    }
}
function onDragEnd(e) {
    e.target.classList.remove('dragging');
    fileList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    dragFrom = null;
}

// ---------- 交互 ----------
modeTabs.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b) return;
    modeTabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === b));
    mode = b.dataset.mode;
    modeHint.textContent = MODE_HINT[mode];
    updateDropSub();
    renderList();
});
drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
drop.addEventListener('drop', async e => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const list = await filesFromDataTransfer(e.dataTransfer);
    addFiles(list);
});
fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
sortBtn.addEventListener('click', () => { files.sort(naturalCmp); renderList(); });
clearBtn.addEventListener('click', () => { files = []; renderList(); });

// ---------- 引擎 ----------
async function initEngine() {
    if (ffmpeg.loaded) return;
    setStatus('正在初始化本地转码引擎 (WASM)…');
    const abs = p => new URL(p, window.location.href).href;
    await ffmpeg.load({
        coreURL: abs('./lib/ffmpeg-core.js'),
        wasmURL: abs('./lib/ffmpeg-core.wasm'),
        classWorkerURL: abs('./lib/814.ffmpeg.js'),
    });
}
async function probeStream(inName) {
    // 只用「无输出探测」：ffmpeg 打印流信息后以「至少需要一个输出文件」报错退出，
    // 结束快且稳定（WASM 版 null muxer 会卡死，故不用 -f null）
    let logs = '';
    const logger = ({ message }) => { logs += message + '\n'; };
    ffmpeg.on('log', logger);
    try { await ffmpeg.exec(['-i', inName, '-hide_banner']); } catch (e) { /* 无输出文件，必然以错误码退出 */ }
    ffmpeg.off('log', logger);
    return { h264: /Video:\s*h264/i.test(logs), aac: /Audio:\s*aac/i.test(logs) };
}

// ---------- 进度 ----------
let progT0 = 0;
function makeProgress(label) {
    progT0 = performance.now();
    return ({ progress }) => {
        const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
        progressBar.style.width = pct + '%';
        const elapsed = (performance.now() - progT0) / 1000;
        if (pct > 0) {
            const total = elapsed / (pct / 100);
            const eta = Math.max(0, Math.round(total - elapsed));
            etaEl.textContent = pct < 100 ? `已用 ${Math.round(elapsed)}s · 预计剩余 ${eta}s` : '';
        } else {
            etaEl.textContent = '';
        }
        if (pct < 100) statusText.textContent = `${label} ${pct}%`;
        else if (pct >= 100) statusText.textContent = `${label} … 封装中`;
    };
}
async function runExec(cmd, label) {
    const onProg = makeProgress(label);
    ffmpeg.on('progress', onProg);
    try { await ffmpeg.exec(cmd); }
    finally { ffmpeg.off('progress', onProg); }
}

// ---------- 结果 ----------
function addResult(fileName, data, mime) {
    const url = URL.createObjectURL(new Blob([data], { type: mime }));
    objectURLs.push(url);
    const wrap = document.createElement('div');
    wrap.className = 'rfile';
    wrap.innerHTML = `<span>${fileName} <b style="color:var(--ok)">✓</b></span>
        <a class="dl-btn" href="${url}" download="${fileName}">⬇ 下载</a>`;
    resultList.appendChild(wrap);
}
function clearResults() {
    objectURLs.forEach(u => URL.revokeObjectURL(u));
    objectURLs = [];
    resultList.innerHTML = '';
    resultCard.style.display = 'none';
}
function setStatus(msg, cls) {
    statusText.textContent = msg;
    statusText.style.color = cls === 'err' ? 'var(--err)' : cls === 'ok' ? 'var(--ok)' : '';
}

// ---------- 转换 ----------
async function convertOne(file, label) {
    const inName = 'in.' + extOf(file.name);
    const outName = outputNameFor(file).toLowerCase();
    const outExt = outName.endsWith('.ts') ? 'ts' : 'mp4';
    const virtualOut = 'out.' + outExt;

    await ffmpeg.writeFile(inName, new Uint8Array(await file.arrayBuffer()));

    if (outExt === 'ts') {
        // MP4 → TS 单向封装
        await runExec(['-i', inName, '-c', 'copy', '-f', 'mpegts', virtualOut], label);
    } else {
        const { h264, aac } = await probeStream(inName);
        if (h264 && aac) {
            await runExec(['-i', inName, '-c', 'copy', '-movflags', '+faststart', virtualOut], label + '（无损封装）');
        } else if (h264) {
            await runExec(['-i', inName, '-c:v', 'copy', '-c:a', 'aac', '-movflags', '+faststart', virtualOut], label + '（视频复制 + 音频 AAC）');
        } else {
            setStatus(`${label}：编码不兼容，自动重编码 H.264/AAC…`);
            await runExec(['-i', inName, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', virtualOut], label + '（重编码）');
        }
    }
    const data = await ffmpeg.readFile(virtualOut);
    try { await ffmpeg.deleteFile(inName); } catch (e) {}
    try { await ffmpeg.deleteFile(virtualOut); } catch (e) {}
    return data;
}
function extOf(name) {
    const m = name.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : 'mp4';
}

async function runSingle() {
    const file = files[0];
    if (!file) return;
    clearResults();
    const data = await convertOne(file, '转换');
    addResult(outputNameFor(file), data, 'video/mp4');
}

async function runBatch() {
    clearResults();
    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setStatus(`批量：第 ${i + 1}/${files.length} 个 — ${f.name}`);
        const data = await convertOne(f, `[${i + 1}/${files.length}]`);
        addResult(outputNameFor(f), data, 'video/mp4');
    }
}

async function runMerge() {
    clearResults();
    if (!files.length) return;
    const list = files;
    setStatus(`正在读取 ${list.length} 个片段…`);
    progressCard.style.display = 'block';

    const entries = [];
    for (let i = 0; i < list.length; i++) {
        const segName = 'seg_' + String(i + 1).padStart(4, '0') + '.ts';
        await ffmpeg.writeFile(segName, new Uint8Array(await list[i].arrayBuffer()));
        entries.push(`file '${segName}'`);
    }
    await ffmpeg.writeFile('concat.txt', new TextEncoder().encode(entries.join('\n')));

    const outName = 'merged.mp4';
    // 先探测首个片段：编码兼容 → 无损流复制；否则直接重编码
    const { h264, aac } = await probeStream('seg_0001.ts');
    let cmd;
    if (h264 && aac) {
        setStatus('检测到 H.264/AAC，执行无损合并 (Stream Copy)…');
        cmd = ['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', '-movflags', '+faststart', outName];
    } else {
        setStatus('片段编码不一致，自动重编码 H.264/AAC 保底…');
        cmd = ['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', outName];
    }
    try {
        await runExec(cmd, '合并');
    } catch (e) {
        // 无损合并失败 → 回退重编码
        setStatus('无损合并失败，自动回退重编码 H.264/AAC…');
        try {
            await runExec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-c:a', 'aac', '-movflags', '+faststart', outName], '重编码合并');
        } catch (e2) {
            throw new Error('合并失败：' + (e2.message || e2));
        }
    }
    const data = await ffmpeg.readFile(outName);
    const base = list[0].name.replace(/[._-]*\d*\.(ts|m2ts|mts)$/i, '') || '合并';
    addResult(base + '_merged.mp4', data, 'video/mp4');
    ['concat.txt', outName].forEach(n => { try { ffmpeg.deleteFile(n); } catch (e) {} });
    list.forEach((f, i) => { try { ffmpeg.deleteFile('seg_' + String(i + 1).padStart(4, '0') + '.ts'); } catch (e) {} });
}

startBtn.addEventListener('click', async () => {
    if (!files.length) return;
    startBtn.disabled = true;
    progressCard.style.display = 'block';
    progressBar.style.width = '0%';
    etaEl.textContent = '';
    setStatus('准备中…');
    try {
        await initEngine();
        if (mode === 'merge') await runMerge();
        else if (mode === 'batch') await runBatch();
        else await runSingle();
        resultCard.style.display = 'block';
        progressCard.style.display = 'none';
        setStatus('全部完成 ✓', 'ok');
    } catch (e) {
        progressCard.style.display = 'none';
        setStatus('出错：' + (e && e.message ? e.message : e), 'err');
        console.error(e);
    } finally {
        startBtn.disabled = files.length === 0;
    }
});
