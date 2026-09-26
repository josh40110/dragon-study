#!/usr/bin/env node
/**
 * 龍龍旅行社的小資料庫：替 tripGuide.js 每個項目抓座標和一張有授權的照片。
 *
 *   node tools/trip/build_places.mjs            # 只補新的、或 wiki/geo 設定改過的
 *   node tools/trip/build_places.mjs --force    # 全部重抓
 *   node tools/trip/build_places.mjs --only=fun-prg-castle,food-vie-cafe
 *
 * 產出：
 * - src/constants/tripPlaces.json：{ [項目 id]: { lat, lng, img, credit, note, gallery } }
 * - public/trip/*.jpg：主照片（JPEG、最長邊 900，跟著網站一起部署，離線也看得到）
 * - gallery：同一條目裡另外最多 3 張授權照片，直接用 Wikimedia 的縮圖網址（不下載，避免專案越來越大）
 *
 * 來源：維基百科條目的授權照片（pilicense=free）與座標；geo 欄位走 OpenStreetMap Nominatim。
 * Nominatim 規定每秒最多 1 次，腳本會自動等。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TRIP_CITIES, TRIP_GUIDE } from '../../src/constants/tripGuide.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_JSON = path.join(ROOT, 'src/constants/tripPlaces.json');
const IMG_DIR = path.join(ROOT, 'public/trip');
const UA = 'DragonStudyTrip/1.0 (https://github.com/josh40110/dragon-study)';
const THUMB_WIDTH = 960;
const GALLERY_WIDTH = 640;
const GALLERY_MAX = 3;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const ONLY = new Set(
  (args.find((a) => a.startsWith('--only=')) || '')
    .replace('--only=', '')
    .split(',')
    .filter(Boolean),
);

const execFileAsync = promisify(execFile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CITY_BY_KEY = new Map(TRIP_CITIES.map((c) => [c.key, c]));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.json();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** 'en:Charles Bridge' → 條目標題、網址、授權照片、座標 */
async function lookupWiki(spec) {
  const [lang, ...rest] = spec.split(':');
  const title = rest.join(':');
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1` +
    `&prop=pageimages|coordinates|info&inprop=url&piprop=name|thumbnail&pithumbsize=${THUMB_WIDTH}` +
    `&pilicense=free&titles=${encodeURIComponent(title)}`;
  const data = await getJson(url);
  const page = Object.values(data?.query?.pages || {})[0];
  if (!page || page.missing !== undefined) return null;
  return {
    lang,
    pageUrl: page.fullurl,
    image: page.pageimage || null,
    thumb: page.thumbnail?.source || null,
    coords: page.coordinates?.[0] ? [page.coordinates[0].lat, page.coordinates[0].lon] : null,
  };
}

/** 照片作者與授權（CC BY-SA 之類要標示出處） */
async function lookupCredit(fileName, lang) {
  for (const host of ['commons.wikimedia.org', `${lang}.wikipedia.org`]) {
    const url =
      `https://${host}/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url` +
      `&titles=${encodeURIComponent(`File:${fileName}`)}`;
    const data = await getJson(url);
    const page = Object.values(data?.query?.pages || {})[0];
    const info = page?.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata || {};
    return {
      author: stripHtml(meta.Artist?.value) || '不詳',
      license: stripHtml(meta.LicenseShortName?.value) || '見原始頁面',
      url: info.descriptionurl,
    };
  }
  return null;
}

let lastNominatim = 0;
async function geocode(query) {
  const wait = 1100 - (Date.now() - lastNominatim);
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const [hit] = await getJson(url);
  return hit ? [Number(hit.lat), Number(hit.lon)] : null;
}

/**
 * 下載縮圖並統一轉成 JPEG、最長邊 900px（macOS 內建 sips；沒有 sips 就保留原檔）。
 * 檔名用 Commons 檔名的雜湊，同一張照片多個項目共用。
 */
async function downloadImage(thumbUrl, fileName) {
  const hash = crypto.createHash('sha1').update(fileName).digest('hex').slice(0, 12);
  const jpg = path.join(IMG_DIR, `${hash}.jpg`);
  try {
    await fs.access(jpg);
    return `trip/${hash}.jpg`;
  } catch {
    /* 還沒下載過 */
  }
  const res = await fetch(thumbUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`圖片下載失敗 HTTP ${res.status}`);
  const ext = (thumbUrl.split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i)?.[1] || 'jpg').toLowerCase();
  const raw = path.join(IMG_DIR, `${hash}.raw.${ext}`);
  await fs.writeFile(raw, Buffer.from(await res.arrayBuffer()));
  try {
    await execFileAsync('sips', ['-Z', '900', '-s', 'format', 'jpeg', '-s', 'formatOptions', 'low', raw, '--out', jpg]);
    await fs.unlink(raw);
    return `trip/${hash}.jpg`;
  } catch {
    const kept = path.join(IMG_DIR, `${hash}.${ext}`);
    await fs.rename(raw, kept);
    return `trip/${hash}.${ext}`;
  }
}

/** 地圖、徽章、商標、平面圖這類不是「風景照」的檔案 */
const NOT_A_PHOTO = /map|karte|mapa|plan|logo|icon|flag|coat|wappen|znak|seal|diagram|locator|signature|stamp|coin|banknote|scheme|schema|sketch|drawing|engraving|litho/i;

/**
 * 條目裡的其他照片：只收 JPEG、橫式、夠大、自由授權，排除主照片。
 * 直式多半是人像或雕像特寫，放在橫式相簿裡也不好看，一律略過。
 */
async function lookupGallery(spec, heroFile) {
  const [lang, ...rest] = spec.split(':');
  const title = rest.join(':');
  const url =
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&generator=images&gimlimit=60` +
    `&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${GALLERY_WIDTH}&titles=${encodeURIComponent(title)}`;
  const data = await getJson(url);
  const pages = Object.values(data?.query?.pages || {});
  const out = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const name = page.title.replace(/^[^:]+:/, '');
    if (!info || name === heroFile || name.replace(/ /g, '_') === heroFile) continue;
    if (info.mime !== 'image/jpeg' || info.width < 900 || info.width < info.height * 1.15) continue;
    if (NOT_A_PHOTO.test(name)) continue;
    const meta = info.extmetadata || {};
    const license = stripHtml(meta.LicenseShortName?.value);
    if (!license || meta.NonFree?.value || /fair use|non-free/i.test(license)) continue;
    out.push({
      url: info.thumburl,
      credit: { author: stripHtml(meta.Artist?.value) || '不詳', license, url: info.descriptionurl },
    });
    if (out.length >= GALLERY_MAX) break;
  }
  return out;
}

/** 兩點距離（公里） */
function distanceKm([lat1, lng1], [lat2, lng2]) {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

const specOf = (item) => JSON.stringify([item.wiki || null, item.geo || null, item.pin !== false, item.imageNote || null]);

async function main() {
  await fs.mkdir(IMG_DIR, { recursive: true });
  let db = {};
  try {
    db = JSON.parse(await fs.readFile(OUT_JSON, 'utf8'));
  } catch {
    /* 第一次跑 */
  }

  const warnings = [];
  for (const item of TRIP_GUIDE) {
    if (ONLY.size > 0 && !ONLY.has(item.id)) continue;
    const spec = specOf(item);
    if (!FORCE && db[item.id]?.spec === spec) continue;

    const entry = { spec, lat: null, lng: null, img: null, credit: null, note: item.imageNote || null, wiki: null, gallery: [] };
    let wiki = null;
    if (item.wiki) {
      try {
        wiki = await lookupWiki(item.wiki);
      } catch (err) {
        warnings.push(`${item.id}：維基查詢失敗 ${err.message}`);
      }
      if (!wiki) warnings.push(`${item.id}：找不到條目 ${item.wiki}`);
    }

    if (wiki) {
      entry.wiki = wiki.pageUrl;
      if (wiki.image && wiki.thumb) {
        try {
          entry.img = await downloadImage(wiki.thumb, wiki.image);
          entry.credit = await lookupCredit(wiki.image, wiki.lang);
        } catch (err) {
          warnings.push(`${item.id}：照片失敗 ${err.message}`);
        }
      } else {
        warnings.push(`${item.id}：條目沒有可用的授權照片`);
      }
      // 交通項目不需要相簿
      if (item.cat !== 'move') {
        entry.gallery = await lookupGallery(item.wiki, wiki.image).catch((err) => {
          warnings.push(`${item.id}：相簿查詢失敗 ${err.message}`);
          return [];
        });
      }
    }

    if (item.pin !== false) {
      let coords = null;
      if (item.geo) {
        coords = await geocode(item.geo).catch(() => null);
        if (!coords) warnings.push(`${item.id}：OSM 查不到「${item.geo}」，改用條目座標`);
      }
      coords = coords || wiki?.coords || null;
      if (coords) {
        [entry.lat, entry.lng] = coords.map((n) => Math.round(n * 1e5) / 1e5);
        const city = CITY_BY_KEY.get(item.city);
        const km = city ? distanceKm(coords, city.center) : 0;
        const limit = item.city === 'lapland' ? 120 : item.cat === 'move' ? 60 : 30;
        if (km > limit) warnings.push(`${item.id}：座標離${city.name}中心 ${Math.round(km)} 公里，請確認`);
      } else {
        warnings.push(`${item.id}：沒有座標，不會出現在地圖上`);
      }
    }

    db[item.id] = entry;
    console.log(`✓ ${item.id}${entry.img ? ' 📷' : ''}${entry.gallery.length ? `+${entry.gallery.length}` : ''}${entry.lat != null ? ' 📍' : ''}`);
  }

  // 刪掉資料檔已經沒有的項目
  const ids = new Set(TRIP_GUIDE.map((i) => i.id));
  Object.keys(db).forEach((id) => {
    if (!ids.has(id)) delete db[id];
  });

  const sorted = Object.fromEntries(Object.entries(db).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(OUT_JSON, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`\n寫入 ${path.relative(ROOT, OUT_JSON)}：${Object.keys(sorted).length} 筆`);
  if (warnings.length) console.log(`\n⚠️ 需要看一下：\n- ${warnings.join('\n- ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
