const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'config.json');
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const pending = new Map();
let config;
let watcher;
let stopping = false;

function log(message) {
  process.stdout.write(`[${new Date().toISOString()}] ${message}\n`);
}

function loadConfig() {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!raw || typeof raw !== 'object') throw new Error('config.json không hợp lệ.');
  for (const key of ['url', 'token', 'scanDir', 'sentDir', 'errorDir']) {
    if (typeof raw[key] !== 'string' || !raw[key].trim()) throw new Error(`Thiếu ${key} trong config.json.`);
  }
  config = {
    ...raw,
    extensions: Array.isArray(raw.extensions) && raw.extensions.length
      ? raw.extensions.map(value => String(value).toLowerCase())
      : ['.pdf', '.xml'],
    stableSeconds: Math.max(1, Number(raw.stableSeconds) || 5),
    pollSeconds: Math.max(1, Number(raw.pollSeconds) || 2),
    pingSeconds: Math.max(15, Number(raw.pingSeconds) || 60),
    maxFileBytes: Math.min(MAX_FILE_BYTES, Math.max(1, Number(raw.maxFileBytes) || MAX_FILE_BYTES)),
  };
}

function isCandidate(filePath) {
  const absolute = path.resolve(filePath);
  const root = path.resolve(config.scanDir) + path.sep;
  if (!absolute.startsWith(root)) return false;
  const sent = path.resolve(config.sentDir) + path.sep;
  const errors = path.resolve(config.errorDir) + path.sep;
  if (absolute.startsWith(sent) || absolute.startsWith(errors)) return false;
  return config.extensions.includes(path.extname(absolute).toLowerCase());
}

async function stableFile(filePath) {
  let previous;
  const deadline = Date.now() + 30 * 60 * 1000;
  while (!stopping && Date.now() < deadline) {
    let info;
    try {
      info = await fsp.stat(filePath);
    } catch {
      return null;
    }
    if (!info.isFile() || info.size <= 0) return null;
    if (info.size > config.maxFileBytes) throw new Error('Tệp vượt quá giới hạn 10 MB.');
    const current = `${info.size}:${info.mtimeMs}`;
    if (current === previous) return info;
    previous = current;
    await new Promise(resolve => setTimeout(resolve, config.stableSeconds * 1000));
  }
  return null;
}

function idempotencyKey(filePath, info) {
  return crypto.createHash('sha256')
    .update(`${path.resolve(filePath)}:${info.size}:${info.mtimeMs}`)
    .digest('hex');
}

async function moveTo(folder, filePath) {
  const date = new Date().toISOString().slice(0, 10);
  const destinationDir = path.join(folder, date);
  await fsp.mkdir(destinationDir, { recursive: true });
  const base = path.basename(filePath);
  let destination = path.join(destinationDir, base);
  if (path.resolve(destination) === path.resolve(filePath)) return;
  try {
    await fsp.rename(filePath, destination);
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      destination = path.join(destinationDir, `${Date.now()}-${base}`);
      await fsp.rename(filePath, destination);
    } else throw error;
  }
}

async function sendFile(filePath, info) {
  const bytes = await fsp.readFile(filePath);
  const body = new FormData();
  body.append('file', new Blob([bytes]), path.basename(filePath));
  body.append('idempotency_key', idempotencyKey(filePath, info));
  const response = await fetch(config.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}` },
    body,
    signal: AbortSignal.timeout(120000),
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const message = payload && typeof payload.loi === 'string' ? payload.loi : `HTTP ${response.status}`;
    throw new Error(message.slice(0, 240));
  }
  return payload;
}

async function processFile(filePath) {
  if (!isCandidate(filePath) || pending.has(filePath) || stopping) return;
  pending.set(filePath, true);
  try {
    const info = await stableFile(filePath);
    if (!info) return;
    const result = await sendFile(filePath, info);
    await moveTo(config.sentDir, filePath);
    log(`Đã gửi ${path.basename(filePath)} (${result && result.moi === false ? 'đã nhận trước đó' : 'mới'})`);
  } catch (error) {
    log(`Lỗi gửi ${path.basename(filePath)}: ${error instanceof Error ? error.message : 'không xác định'}`);
    try { await moveTo(config.errorDir, filePath); } catch (moveError) {
      log(`Không chuyển được file lỗi ${path.basename(filePath)}: ${moveError instanceof Error ? moveError.message : 'không xác định'}`);
    }
  } finally {
    pending.delete(filePath);
  }
}

async function ping() {
  try {
    const response = await fetch(config.url, {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) log(`Ping VPS thất bại: HTTP ${response.status}`);
  } catch (error) {
    log(`Ping VPS thất bại: ${error instanceof Error ? error.message : 'không xác định'}`);
  }
}

async function start() {
  loadConfig();
  await fsp.mkdir(config.scanDir, { recursive: true });
  await fsp.mkdir(config.sentDir, { recursive: true });
  await fsp.mkdir(config.errorDir, { recursive: true });
  watcher = fs.watch(config.scanDir, { recursive: true }, (_event, name) => {
    if (!name) return;
    const filePath = path.join(config.scanDir, String(name));
    setTimeout(() => void processFile(filePath), config.pollSeconds * 1000);
  });
  watcher.on('error', error => log(`Watcher lỗi: ${error.message}`));
  const pingTimer = setInterval(() => void ping(), config.pingSeconds * 1000);
  await ping();
  log(`Windows Service đang theo dõi ${config.scanDir}`);
  const stop = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(pingTimer);
    watcher?.close();
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

start().catch(error => {
  log(error instanceof Error ? error.message : 'Không khởi động được agent.');
  process.exitCode = 1;
});
