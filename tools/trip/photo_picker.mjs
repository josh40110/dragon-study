#!/usr/bin/env node
/**
 * 龍龍旅行社：本機選圖頁。每個地點的 Commons 候選照片排成一格一格，自己看、自己點，自動存進 photo_picks.json。
 *
 *   node tools/trip/photo_picker.mjs              # 開 http://127.0.0.1:8766（自動打開瀏覽器）
 *   node tools/trip/photo_picker.mjs --no-open    # 不自動開瀏覽器
 *   node tools/trip/photo_picker.mjs --port=8800
 *
 * - 左邊選地點；上面是已選的照片（第一張是主圖，可以拖拉或用按鈕調順序、標「示意」、拿掉）
 * - 下面是候選：先列之前找過的（~/.cache/dragon-study/trip-photo-candidates.json），再用 photo_queries.json
 *   （＋photo_queries_extra.json）的關鍵字搜；也可以自己打關鍵字，或直接貼 Commons 的檔名／網址
 * - 篩選規則跟 photo_candidates.py 一樣：只留 JPEG、橫式、寬 1200 以上、自由授權（NC／ND 不收），優質圖片排前面
 * - 每次改動自動存檔；啟動時先把原本的 photo_picks.json 備份到 ~/.cache/dragon-study/（留最近 10 份）
 * - 挑完按「產生網站照片」＝用 tools/tts/.venv 的 Python 跑 build_photos.py（只處理新的照片）
 * - 搜尋結果快取在 ~/.cache/dragon-study/photo-candidates.json，同一組關鍵字不會重搜（頁面上可以強制重搜）
 * - 只綁 127.0.0.1；寫入的請求要帶 X-Picker 標頭，別的網站的頁面沒辦法偷改
 *
 * 用 Node 而不是 Python：從桌面 app 的預覽啟動時，macOS 只給 Node 讀「桌面」資料夾的權限，
 * Python 會卡在權限詢問。Node 開的子行程（build_photos.py）沿用 Node 的權限。
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PUBLIC = path.join(ROOT, 'public');
const PICKS_PATH = path.join(HERE, 'photo_picks.json');
const QUERY_PATHS = [path.join(HERE, 'photo_queries.json'), path.join(HERE, 'photo_queries_extra.json')];
const PHOTOS_JSON = path.join(ROOT, 'src/constants/tripPhotos.json');
const PLACES_JSON = path.join(ROOT, 'src/constants/tripPlaces.json');
const GUIDE_JS = path.join(ROOT, 'src/constants/tripGuide.js');
const PAGE = path.join(HERE, 'photo_picker.html');
const CACHE_DIR = path.join(os.homedir(), '.cache/dragon-study');
const CACHE_PATH = path.join(CACHE_DIR, 'photo-candidates.json');
// 2026-09 用 photo_candidates.py 找過兩輪的候選（{ 項目 id: [候選] }），頁面上列成「之前找過的候選」
const PREVIOUS_PATH = path.join(CACHE_DIR, 'trip-photo-candidates.json');
// 產生照片要 Pillow，在 TTS 工具的虛擬環境裡
const VENV_PYTHON = path.join(ROOT, 'tools/tts/.venv/bin/python');
const BASE_URL = '/dragon-study/';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'DragonStudyTrip/1.0 (https://github.com/josh40110/dragon-study)';
const THUMB_WIDTH = 500; // Commons 的標準縮圖寬度（非標準寬度容易被限流）
const RESULTS_PER_QUERY = 24;
// 授權、上傳工具、相機型號這類分類跟「拍的是哪裡」無關
const NOISE_CATEGORY =
  /^PD-|CC-BY|CC-Zero|GFDL|License|Self-published|Pages with|Files with|Uploaded|Taken with|Media with|Quality images|Photographs by|Images by|Panoramio|Flickr|Supported by|Wiki Loves|Unidentified/i;
const BAD_LICENSE = /fair use|non-?free|\bNC\b|\bND\b/i;

const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=8766').split('=')[1]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(file, data, indent = 1) {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, indent)}\n`);
  await fs.rename(tmp, file);
}

// ── Commons ──

async function commons(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      const text = res.ok ? await res.text() : '';
      if (text) return JSON.parse(text);
      if (attempt >= 3) throw new Error(`Commons 回應 HTTP ${res.status}`);
    } catch (err) {
      if (attempt >= 3) throw err;
    }
    await sleep(1500 * (attempt + 1));
  }
}

function stripHtml(text, limit = 80) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

async function searchTitles(query, limit) {
  const data = await commons({ action: 'query', list: 'search', srnamespace: '6', srlimit: String(limit), srsearch: query });
  return (data.query?.search || []).map((hit) => hit.title);
}

async function imageInfo(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 40) {
    const data = await commons({
      action: 'query',
      titles: titles.slice(i, i + 40).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
    });
    // API 會把檔名正規化（底線、大小寫），對回原本寫的名字
    const alias = new Map((data.query?.normalized || []).map((n) => [n.to, n.from]));
    for (const page of Object.values(data.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (info) out[alias.get(page.title) || page.title] = info;
    }
  }
  return out;
}

const isFree = (meta) => {
  const license = stripHtml(meta.LicenseShortName?.value);
  return Boolean(license) && !meta.NonFree?.value && !BAD_LICENSE.test(license);
};

/** 候選照片的資料；說明和分類是用來確認「真的是那個地方」 */
function describe(title, info) {
  const meta = info.extmetadata || {};
  const cats = (meta.Categories?.value || '').split('|').filter((c) => c && !NOISE_CATEGORY.test(c));
  return {
    title,
    thumb: info.thumburl,
    w: info.width,
    h: info.height,
    mime: info.mime,
    license: stripHtml(meta.LicenseShortName?.value),
    author: stripHtml(meta.Artist?.value) || '不詳',
    url: info.descriptionurl,
    desc: stripHtml(meta.ImageDescription?.value, 300),
    date: stripHtml(meta.DateTimeOriginal?.value, 60).split(' (')[0].slice(0, 30),
    cats: cats.slice(0, 10).map((c) => c.replace(/_/g, ' ')),
    free: isFree(meta),
  };
}

/** 一組關鍵字的候選：先找 Commons 認證的優質圖片，再補一般照片 */
async function candidatesFor(query) {
  const quality = await searchTitles(`${query} hastemplate:QualityImage`, 16);
  const plain = await searchTitles(query, RESULTS_PER_QUERY);
  const qualitySet = new Set(quality);
  const ordered = [...new Set([...quality, ...plain])];
  const infos = await imageInfo(ordered);
  const picked = [];
  for (const title of ordered) {
    const info = infos[title];
    if (!info || info.mime !== 'image/jpeg') continue;
    if (info.width < 1200 || info.width < info.height * 1.1) continue;
    const cand = describe(title, info);
    if (!cand.free) continue;
    picked.push({ ...cand, quality: qualitySet.has(title) });
    if (picked.length >= RESULTS_PER_QUERY) break;
  }
  return picked;
}

// ── 快取 ──

const cache = await readJson(CACHE_PATH, { queries: {}, info: {} });
let cacheWrite = Promise.resolve();
function saveCache() {
  cacheWrite = cacheWrite.then(async () => {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await writeJson(CACHE_PATH, cache, 0);
  });
  return cacheWrite;
}

async function search(query, force) {
  if (cache.queries[query] && !force) return { results: cache.queries[query], cached: true };
  const results = await candidatesFor(query);
  cache.queries[query] = results;
  for (const cand of results) cache.info[cand.title] = cand;
  await saveCache();
  return { results, cached: false };
}

/** 指定檔名的資料（貼上的檔名、還沒產生的已選照片）；一併回報授權能不能用 */
async function info(titles) {
  const wanted = titles.filter((t) => typeof t === 'string' && t.startsWith('File:')).slice(0, 60);
  const out = {};
  const todo = [];
  for (const t of wanted) (cache.info[t] ? (out[t] = cache.info[t]) : todo.push(t));
  if (todo.length) {
    for (const [title, raw] of Object.entries(await imageInfo(todo))) {
      out[title] = describe(title, raw);
      cache.info[title] = out[title];
    }
    await saveCache();
  }
  return out;
}

// ── 資料 ──

async function tripData() {
  // 每次重新載入，開著選圖頁時改了 tripGuide.js 也看得到
  const { TRIP_GUIDE, TRIP_CITIES, TRIP_CATEGORIES } = await import(`${pathToFileURL(GUIDE_JS)}?t=${Date.now()}`);
  return {
    cities: TRIP_CITIES.map(({ key, name, local, flag }) => ({ key, name, local, flag })),
    cats: TRIP_CATEGORIES,
    places: TRIP_GUIDE.map(({ id, name, local, city, cat, wiki }) => ({ id, name, local, city, cat, wiki })),
  };
}

async function mergedQueries() {
  const out = {};
  for (const file of QUERY_PATHS) {
    for (const [key, words] of Object.entries(await readJson(file, {}))) {
      if (key.startsWith('_')) continue;
      out[key] = [...new Set([...(out[key] || []), ...words])];
    }
  }
  return out;
}

async function state() {
  const built = {};
  for (const [id, photos] of Object.entries(await readJson(PHOTOS_JSON, {}))) {
    built[id] = photos.map((p) => ({ title: p.title, note: p.note || null, thumb: BASE_URL + p.thumb }));
  }
  const fallback = {};
  for (const [id, place] of Object.entries(await readJson(PLACES_JSON, {}))) {
    if (place.img) fallback[id] = BASE_URL + place.img;
  }
  // 之前的縮圖是 330px，換成同一張的 500px（也是 Commons 的標準寬度）
  const previous = {};
  for (const [id, cands] of Object.entries(await readJson(PREVIOUS_PATH, {}))) {
    if (Array.isArray(cands)) previous[id] = cands.map((c) => ({ ...c, thumb: c.thumb.replace(/\/330px-/, `/${THUMB_WIDTH}px-`) }));
  }
  return { ...(await tripData()), picks: await readJson(PICKS_PATH, {}), queries: await mergedQueries(), built, fallback, previous };
}

/** 只接受 { id: [檔名 或 { file, note }] }；空的地點直接拿掉（網站退回條目預設照片） */
async function cleanPicks(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('格式不對');
  const current = await readJson(PICKS_PATH, {});
  const out = Object.fromEntries(Object.entries(current).filter(([k]) => k.startsWith('_')));
  for (const [id, photos] of Object.entries(raw)) {
    if (id.startsWith('_')) continue;
    if (!Array.isArray(photos)) throw new Error(`${id} 不是陣列`);
    const seen = new Set();
    const cleaned = [];
    for (const photo of photos) {
      const file = typeof photo === 'string' ? photo : photo?.file;
      if (typeof file !== 'string' || !file.startsWith('File:')) throw new Error(`${id} 有不是 Commons 檔名的項目`);
      if (seen.has(file)) continue;
      seen.add(file);
      const note = typeof photo === 'object' ? String(photo.note || '').trim() : '';
      cleaned.push(note ? { file, note } : file);
    }
    if (cleaned.length) out[id] = cleaned;
  }
  return out;
}

// ── 伺服器 ──

const TYPES = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
let saving = Promise.resolve();
let building = false;

function sendJson(res, data, status = 200) {
  const body = Buffer.from(JSON.stringify(data));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': body.length, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

/** 跑 build_photos.py，輸出一行一行串給頁面 */
function runBuild(res) {
  if (building) return sendJson(res, { error: '已經在產生中' }, 409);
  const python = existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3';
  building = true;
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.write(`用 ${path.relative(ROOT, python) || python} 跑 build_photos.py…\n`);
  const child = spawn(python, ['-u', path.join(HERE, 'build_photos.py')], { cwd: ROOT });
  child.stdout.on('data', (d) => res.write(d));
  child.stderr.on('data', (d) => res.write(d));
  child.on('error', (err) => res.write(`\n沒辦法執行 ${python}：${err.message}\n`));
  child.on('close', (code) => {
    building = false;
    res.end(`\n__EXIT__ ${code ?? 1}\n`);
  });
}

async function handle(req, res) {
  const host = (req.headers.host || '').split(':')[0];
  if (host !== '127.0.0.1' && host !== 'localhost') return sendJson(res, { error: 'forbidden' }, 403);
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET') {
    if (pathname === '/' || pathname === '/index.html') {
      const body = await fs.readFile(PAGE);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(body);
    }
    if (pathname === '/api/state') return sendJson(res, await state());
    // 已產生的照片、條目預設照片：跟 app 一樣放在 /dragon-study/ 底下
    if (pathname.startsWith(BASE_URL)) {
      const target = path.normalize(path.join(PUBLIC, decodeURIComponent(pathname.slice(BASE_URL.length))));
      const type = TYPES[path.extname(target).toLowerCase()];
      if (target.startsWith(PUBLIC + path.sep) && type && existsSync(target)) {
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'max-age=60' });
        return res.end(await fs.readFile(target));
      }
    }
    return sendJson(res, { error: 'not found' }, 404);
  }

  // 自訂標頭會觸發 CORS 預檢，別的網站的頁面送不進來
  if (req.method !== 'POST' || req.headers['x-picker'] !== '1') return sendJson(res, { error: 'forbidden' }, 403);
  let body;
  try {
    body = await readBody(req);
  } catch {
    return sendJson(res, { error: '看不懂的請求' }, 400);
  }
  if (pathname === '/api/search') {
    const query = String(body.query || '').trim();
    if (!query) return sendJson(res, { error: '沒有關鍵字' }, 400);
    return sendJson(res, { query, ...(await search(query, Boolean(body.force))) });
  }
  if (pathname === '/api/info') return sendJson(res, await info(Array.isArray(body.titles) ? body.titles : []));
  if (pathname === '/api/picks') {
    // 一次只寫一個，連點時不會互相蓋掉
    const job = saving.then(async () => writeJson(PICKS_PATH, await cleanPicks(body.picks)));
    saving = job.catch(() => {});
    await job;
    return sendJson(res, { ok: true, savedAt: new Date().toTimeString().slice(0, 8) });
  }
  if (pathname === '/api/build') return runBuild(res);
  return sendJson(res, { error: 'not found' }, 404);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (res.headersSent) return res.end(`\n錯誤：${err.message}\n`);
    return sendJson(res, { error: err.message }, err instanceof SyntaxError ? 400 : 502);
  });
});

async function listen(port, tries = 10) {
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && tries > 1) resolve(listen(port + 1, tries - 1));
      else reject(err);
    });
    server.listen(port, '127.0.0.1', () => resolve(port));
  });
}

const port = await listen(PORT);
await fs.mkdir(CACHE_DIR, { recursive: true });
if (existsSync(PICKS_PATH)) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const backup = path.join(CACHE_DIR, `photo_picks.backup-${stamp}.json`);
  await fs.copyFile(PICKS_PATH, backup);
  console.log(`原本的 photo_picks.json 備份在 ${backup}`);
  // 每次啟動備份一份，只留最近 10 份
  const backups = (await fs.readdir(CACHE_DIR)).filter((f) => f.startsWith('photo_picks.backup-')).sort();
  for (const old of backups.slice(0, -10)) await fs.unlink(path.join(CACHE_DIR, old));
}
if (!existsSync(VENV_PYTHON)) console.log('⚠️ 找不到 tools/tts/.venv：可以選圖，但「產生網站照片」需要有 Pillow 的 Python。');
const url = `http://127.0.0.1:${port}/`;
console.log(`龍龍旅行社選圖頁：${url}（Ctrl+C 結束）`);
if (!args.includes('--no-open')) spawn('open', [url], { stdio: 'ignore', detached: true }).on('error', () => {});
