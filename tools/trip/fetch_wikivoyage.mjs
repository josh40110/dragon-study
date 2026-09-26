#!/usr/bin/env node
/**
 * 龍龍旅行社：從英文 Wikivoyage 抓每個城市的景點、餐廳、住宿清單（名稱、座標、簡介、營業時間、價格）。
 * 程式負責抓和比對，人（或 Claude）只負責從清單裡挑、翻成中文寫進 tripGuide.js。
 *
 *   node tools/trip/fetch_wikivoyage.mjs                   # 全部城市
 *   node tools/trip/fetch_wikivoyage.mjs --only=prague     # 只抓某幾個城市（TRIP_CITIES 的 key，逗號分隔）
 *
 * 產出：
 * - tools/trip/wikivoyage/<城市>.json：完整清單（不進版控，隨時可重抓）
 * - tools/trip/wikivoyage/<城市>.md：一行一筆的精簡版，挑新地點時看這份就好；已經收錄的標「✓ 項目 id」
 * - src/constants/tripWikivoyage.json：tripGuide.js 已有的項目對到的 Wikivoyage 條目，介紹頁顯示「Wikivoyage 怎麼說」
 *
 * 城市用 TRIP_CITIES 的 wikivoyage 欄位；大城市的分區頁（Prague/Old Town and Josefov 這種）自動找。
 *
 * 對應方式（只對景點、美食、住宿；交通和 imageNote 示意的項目不對，它們的 wiki 只是拿來找照片的）：
 * 1. Wikidata：項目的 wiki 條目跟清單的 wikidata 是同一個（最準）
 * 2. 名稱：清單名稱／別名跟項目的 local、維基條目名一樣，或一個包含另一個，而且座標相距不遠
 * 3. 分區頁：項目的 wiki 條目就是某個分區或城市（住宿大多是「住哪一區」），連到那一頁、用它的開頭介紹
 * 住宿項目只用 1、3：名字比對會把「住中央車站附近」對到某家剛好叫這名字的旅館。
 *
 * Wikivoyage 內容是 CC BY-SA 4.0：畫面上要標來源與授權、附原頁連結，不要拿掉。
 * 對應結果要看一下輸出的「名稱比對」清單，名字像但其實不是同一個地方的，加進 SKIP_MATCH。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRIP_CITIES, TRIP_GUIDE } from '../../src/constants/tripGuide.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = path.join(ROOT, 'tools/trip/wikivoyage');
const OUT_JSON = path.join(ROOT, 'src/constants/tripWikivoyage.json');
const PLACES = JSON.parse(await fs.readFile(path.join(ROOT, 'src/constants/tripPlaces.json'), 'utf8'));
const API = 'https://en.wikivoyage.org/w/api.php';
// Wikimedia 會擋掉沒有聯絡方式的 User-Agent（回空白）
const UA = 'DragonStudyTrip/1.0 (https://github.com/josh40110/dragon-study)';

/** 對到了、但不是在講這個項目：'項目 id': ['Wikivoyage 清單名稱', …] */
const SKIP_MATCH = {
  // 項目是教堂前廣場的聖誕市集，wiki 用大教堂只是為了座標和照片
  'fun-szg-market': ['Salzburg Cathedral'],
};

/**
 * 自動對不到、或對到的不是最貼切的，人工指定：'項目 id': 'Wikivoyage 清單名稱' 或 { page: '頁面標題' }
 * 指定的頁面要在那個城市的 wikivoyage 頁面清單裡（含分區頁）。
 */
const PIN_MATCH = {
  // 霍夫堡＋茜茜公主博物館：皇帝寓所那筆才是買票參觀的部分（名字比對會對到新王宮）
  'fun-vie-hofburg': 'Kaiserappartements',
  // 猶太區聯票：猶太博物館那筆涵蓋全部會堂和墓園
  'fun-prg-josefov': 'Jewish Museum',
  'fun-prg-kutna': { page: 'Kutná Hora' },
  'fun-lap-icehotel': 'Ice Hotel',
  // 住宿「住哪一區」連到那一區的分區頁
  'stay-prg-old': { page: 'Prague/Old Town and Josefov' },
  'stay-vie-1': { page: 'Vienna/Innere Stadt' },
  'stay-vie-6-7': { page: 'Vienna/Mariahilf' },
  'stay-sto-central': { page: 'Stockholm/Norrmalm' },
  'stay-szg-old': { page: 'Salzburg' },
  'stay-nar-town': { page: 'Narvik' },
};

/** 項目類別可以對到哪些清單類型（Wikidata 比對不限類型，但住宿只對 sleep） */
const NAME_TYPES = { fun: ['see', 'do', 'buy', 'listing'], food: ['eat', 'drink'] };
const QID_TYPES = { fun: ['see', 'do', 'buy', 'eat', 'drink', 'listing'], food: ['eat', 'drink', 'buy', 'see', 'listing'], stay: ['sleep'] };
const SECTION_TYPE = { see: 'see', do: 'do', buy: 'buy', eat: 'eat', drink: 'drink', sleep: 'sleep', 'get in': 'go', 'get around': 'go' };
/** 清單內容太長就截斷，完整的看原頁 */
const CONTENT_MAX = 700;
/**
 * 營業時間、價格只收這段時間內編輯過的（lastedit）；更舊的常常差很多（霍夫堡寫 €11.50，現在早就不只），
 * 還會跟 tripGuide.js 查證過的 cost 打架。舊的只留在精簡版清單給人參考。
 */
const FRESH_YEARS = 2;
const TODAY = new Date().toISOString().slice(0, 10);
const FRESH_SINCE = `${Number(TODAY.slice(0, 4)) - FRESH_YEARS}${TODAY.slice(4)}`;

const args = process.argv.slice(2);
const ONLY = new Set((args.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const text = res.ok ? await res.text() : '';
    // 被限流時會回 429 或空白內容，等一下再試
    if (text) return JSON.parse(text);
    if (attempt >= 4) throw new Error(`HTTP ${res.status} ${url}`);
    await sleep(2000 * (attempt + 1));
  }
}

const api = (params, base = API) =>
  getJson(`${base}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`);

// ── wikitext 解析 ──

/** 從 start（指向 '{{'）找到對應的 '}}'，回傳結束位置（不含） */
function templateEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length - 1; i++) {
    const two = text.slice(i, i + 2);
    if (two === '{{') {
      depth++;
      i++;
    } else if (two === '}}') {
      depth--;
      i++;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/** 用最外層的 '|' 切參數（{{…}} 和 [[…]] 裡面的 '|' 不算） */
function splitParams(body) {
  const parts = [];
  let cur = '';
  let curly = 0;
  let square = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === '{{' || two === '}}' || two === '[[' || two === ']]') {
      if (two === '{{') curly++;
      if (two === '}}') curly--;
      if (two === '[[') square++;
      if (two === ']]') square--;
      cur += two;
      i++;
    } else if (body[i] === '|' && curly === 0 && square === 0) {
      parts.push(cur);
      cur = '';
    } else {
      cur += body[i];
    }
  }
  parts.push(cur);
  return parts;
}

/** 內文裡的小模板：{{lang|cs|Karlův most}}、{{w|Foo}}、{{CZK|100}} 之類留下文字，其他整個拿掉 */
function templateText(inner) {
  const [rawName, ...params] = splitParams(inner);
  const name = rawName.trim().toLowerCase();
  const positional = params.filter((p) => !/^\s*[\w-]+\s*=/.test(p)).map((p) => p.trim());
  if (name === 'lang' || name === 'w' || name === 'nowrap' || name === 'small' || name === 'smaller') {
    return positional[positional.length - 1] || '';
  }
  // 幣別模板：{{CZK|100}} → 100 CZK
  if (/^[a-z]{3}$/.test(name) && positional.length) return `${positional[0]} ${name.toUpperCase()}`;
  if (name === 'price' || name === 'convert') return positional.join(' ');
  return '';
}

const ENTITIES = { nbsp: ' ', amp: '&', quot: '"', ndash: '–', mdash: '—', lt: '<', gt: '>', apos: "'", times: '×', euro: '€', shy: '' };

function clean(text) {
  let s = String(text || '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<ref[^>]*\/>/gi, '').replace(/<ref[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, ' ');
  // 從最內層的模板往外換
  for (let i = 0; i < 6 && s.includes('{{'); i++) s = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => templateText(inner));
  s = s.replace(/\[\[(?:File|Image):(?:[^[\]]|\[\[[^\]]*\]\])*\]\]/gi, '');
  s = s.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, (_, t) => t.replace(/#.*/, ''));
  s = s.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/[^\]]+\]/g, '');
  s = s.replace(/'{2,}/g, '');
  s = s.replace(/<[^>]+>/g, '');
  s = s.replace(/&(#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCharCode(Number(e.slice(1))) : ENTITIES[e.toLowerCase()] ?? m));
  return s.replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return `${end > max * 0.6 ? cut.slice(0, end + 1) : cut.trimEnd()}…`;
}

const LISTING_START = /\{\{\s*(see|do|eat|drink|sleep|buy|go|listing)\s*(?=\||\}\})/gi;
const HEADING = /^(={2,5})\s*(.*?)\s*\1\s*$/gm;
const LISTING_FIELDS = ['name', 'alt', 'url', 'address', 'directions', 'phone', 'hours', 'price', 'checkin', 'checkout', 'wikipedia', 'wikidata', 'image', 'lastedit'];

/** 一整頁 wikitext → 清單陣列（每筆記下在哪一段、哪一個價位分類） */
function parseListings(wikitext, page) {
  const headings = [...wikitext.matchAll(HEADING)].map((m) => ({ at: m.index, level: m[1].length, text: clean(m[2]) }));
  const listings = [];
  for (const match of wikitext.matchAll(LISTING_START)) {
    const end = templateEnd(wikitext, match.index);
    if (end < 0) continue;
    const params = {};
    for (const part of splitParams(wikitext.slice(match.index + 2, end - 2)).slice(1)) {
      const eq = part.indexOf('=');
      if (eq > 0) params[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim();
    }
    const name = clean(params.name);
    if (!name) continue;

    const before = headings.filter((h) => h.at < match.index);
    const section = [...before].reverse().find((h) => h.level === 2)?.text || '';
    const sectionAt = [...before].reverse().find((h) => h.level === 2)?.at ?? -1;
    const tier = [...before].reverse().find((h) => h.level === 3 && h.at > sectionAt)?.text || '';
    const template = match[1].toLowerCase();
    const type = template === 'listing'
      ? (params.type || '').trim().toLowerCase() || SECTION_TYPE[section.toLowerCase()] || 'listing'
      : template;

    const listing = { type, page, section };
    if (tier) listing.tier = tier;
    for (const field of LISTING_FIELDS) {
      const value = clean(params[field]);
      if (value) listing[field] = value;
    }
    const lat = Number.parseFloat(params.lat);
    const lng = Number.parseFloat(params.long);
    if (Number.isFinite(lat) && Number.isFinite(lng) && (lat || lng)) {
      listing.lat = Math.round(lat * 1e5) / 1e5;
      listing.lng = Math.round(lng * 1e5) / 1e5;
    }
    const content = clean(params.content);
    if (content) listing.content = truncate(content, CONTENT_MAX);
    if (listing.url && !/^https?:\/\//i.test(listing.url)) delete listing.url;
    listings.push(listing);
  }
  return listings;
}

/** 頁首到第一個標題之間的介紹文字 */
function leadOf(wikitext) {
  const first = wikitext.search(/^==[^=]/m);
  const lead = clean(first > 0 ? wikitext.slice(0, first) : '');
  return lead ? truncate(lead, CONTENT_MAX) : '';
}

// ── 抓資料 ──

async function subpagesOf(title) {
  const data = await api({
    action: 'query',
    list: 'allpages',
    apprefix: `${title}/`,
    apnamespace: '0',
    apfilterredir: 'nonredirects',
    aplimit: '100',
  });
  return (data.query?.allpages || []).map((p) => p.title);
}

async function fetchPages(titles) {
  const pages = [];
  // 一次 8 頁；每頁的 wikitext 可能上百 KB
  for (let i = 0; i < titles.length; i += 8) {
    const data = await api({
      action: 'query',
      redirects: '1',
      prop: 'revisions|pageprops',
      rvprop: 'content|timestamp',
      rvslots: 'main',
      ppprop: 'wikibase_item',
      titles: titles.slice(i, i + 8).join('|'),
    });
    for (const page of data.query?.pages || []) {
      const rev = page.revisions?.[0];
      if (page.missing || !rev) {
        console.warn(`⚠️ Wikivoyage 沒有「${page.title}」這頁`);
        continue;
      }
      pages.push({
        title: page.title,
        qid: page.pageprops?.wikibase_item || null,
        edited: rev.timestamp.slice(0, 10),
        text: rev.slots.main.content,
      });
    }
    await sleep(300);
  }
  return pages;
}

/** 項目的 wiki 條目（'en:Charles Bridge'）→ Wikidata id，依語言分批查 */
async function wikidataOfItems(items) {
  const byLang = new Map();
  for (const item of items) {
    const [lang, ...rest] = item.wiki.split(':');
    if (!byLang.has(lang)) byLang.set(lang, []);
    byLang.get(lang).push([item.id, rest.join(':')]);
  }
  const out = new Map();
  for (const [lang, pairs] of byLang) {
    for (let i = 0; i < pairs.length; i += 40) {
      const batch = pairs.slice(i, i + 40);
      const data = await api(
        { action: 'query', redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item', titles: batch.map(([, t]) => t).join('|') },
        `https://${lang}.wikipedia.org/w/api.php`,
      );
      // 條目名會被正規化、或經過重新導向，一路對回原本寫的名字
      const rename = new Map();
      for (const n of [...(data.query?.normalized || []), ...(data.query?.redirects || [])]) rename.set(n.to, n.from);
      const original = (title) => {
        let t = title;
        for (let k = 0; k < 3 && rename.has(t); k++) t = rename.get(t);
        return t;
      };
      for (const page of data.query?.pages || []) {
        const qid = page.pageprops?.wikibase_item;
        if (!qid) continue;
        const title = original(page.title);
        for (const [id, t] of batch) if (t === title || t.replace(/_/g, ' ') === title) out.set(id, qid);
      }
      await sleep(200);
    }
  }
  return out;
}

// ── 比對 ──

const norm = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim();

/** 項目可以拿來比的名字：local（可能用 / 分好幾個）、維基條目名、Google 地圖查詢字串 */
function itemNames(item) {
  const names = [
    ...(item.local || '').split(/\s*[/／・,，]\s*/),
    item.wiki ? item.wiki.split(':').slice(1).join(':') : '',
    item.map || '',
  ];
  return [...new Set(names.map(norm).filter((n) => n.length >= 4))];
}

function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** a 的每個字都出現在 b 裡（'Hofburg' 不算包含在 'Hofburgkapelle'） */
const wordsWithin = (a, b) => {
  const words = new Set(b.split(' '));
  return a.split(' ').every((w) => words.has(w));
};

/** 名字比對分數：完全一樣 2、一個包含另一個 1；距離太遠不算 */
function nameScore(item, listing) {
  const listingNames = [listing.name, ...(listing.alt || '').split(/\s*[/,;]\s*/)].map(norm).filter((n) => n.length >= 4);
  const place = PLACES[item.id];
  const km = place?.lat != null && listing.lat != null ? distanceKm(place, listing) : null;
  let best = 0;
  for (const a of itemNames(item)) {
    for (const b of listingNames) {
      if (a === b && (km == null || km < 0.6)) best = Math.max(best, 2);
      else if (Math.min(a.length, b.length) >= 6 && (wordsWithin(a, b) || wordsWithin(b, a)) && km != null && km < 0.4) best = Math.max(best, 1);
    }
  }
  return best;
}

function matchItem(item, qid, listings, pages) {
  const pin = PIN_MATCH[item.id];
  if (pin) {
    const hit = typeof pin === 'string'
      ? listings.find((l) => l.name === pin) && { via: 'pin', listing: listings.find((l) => l.name === pin) }
      : pages.find((p) => p.title === pin.page) && { via: 'page', page: pages.find((p) => p.title === pin.page) };
    if (hit) return hit;
    console.warn(`⚠️ ${item.id}：PIN_MATCH 指定的「${pin.page || pin}」找不到，改用自動比對`);
  }
  const skip = new Set((SKIP_MATCH[item.id] || []).map(norm));
  let best = null;
  for (const listing of listings) {
    if (skip.has(norm(listing.name))) continue;
    let score = 0;
    let via = '';
    if (qid && listing.wikidata === qid && QID_TYPES[item.cat].includes(listing.type)) {
      score = 3;
      via = 'wikidata';
    } else if (NAME_TYPES[item.cat]?.includes(listing.type)) {
      score = nameScore(item, listing);
      via = 'name';
    }
    if (!score) continue;
    // 同分時選介紹寫比較多的那筆
    const rank = score * 10000 + (listing.content?.length || 0);
    if (!best || rank > best.rank) best = { rank, via, listing };
  }
  // 項目的 wiki 條目就是某個分區或城市：連到那一頁，比名字像的清單可靠
  const page = qid && pages.find((p) => p.qid === qid);
  if (best?.via === 'wikidata' || (best && !page)) return { via: best.via, listing: best.listing };
  return page ? { via: 'page', page } : null;
}

// ── 輸出 ──

function digestLine(listing, matchedIds) {
  const bits = [
    `${listing.name}${listing.alt ? `（${listing.alt}）` : ''}`,
    listing.lat != null ? `${listing.lat},${listing.lng}` : '無座標',
    listing.page.includes('/') ? listing.page.split('/').slice(1).join('/') : '',
    listing.tier || '',
    listing.hours ? `⏱ ${listing.hours}` : '',
    listing.price ? `💰 ${listing.price}` : '',
    listing.lastedit ? `（${listing.lastedit} 更新）` : '',
    listing.content ? truncate(listing.content, 180) : '',
  ].filter(Boolean);
  return `- ${matchedIds.length ? `✓ ${matchedIds.join(' ')} ` : ''}${bits.join(' · ')}`;
}

const TYPE_ORDER = ['see', 'do', 'buy', 'eat', 'drink', 'sleep', 'go', 'listing'];
const TYPE_LABEL = { see: '看', do: '玩', buy: '買', eat: '吃', drink: '喝', sleep: '住', go: '交通', listing: '其他' };

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const cities = TRIP_CITIES.filter((c) => c.wikivoyage && (ONLY.size === 0 || ONLY.has(c.key)));
  const candidates = TRIP_GUIDE.filter((item) => item.cat !== 'move' && !item.imageNote);
  const qids = await wikidataOfItems(candidates.filter((item) => item.wiki));

  let matched = {};
  try {
    matched = JSON.parse(await fs.readFile(OUT_JSON, 'utf8'));
  } catch {
    /* 第一次跑 */
  }
  const report = [];

  for (const city of cities) {
    const titles = [];
    for (const title of city.wikivoyage) {
      titles.push(title, ...(await subpagesOf(title)));
      await sleep(200);
    }
    const pages = await fetchPages(titles);
    const listings = pages.flatMap((p) => parseListings(p.text, p.title));

    const cityItems = candidates.filter((item) => item.city === city.key);
    const matchedBy = new Map();
    for (const item of cityItems) {
      delete matched[item.id];
      const hit = matchItem(item, qids.get(item.id), listings, pages);
      if (!hit) continue;
      if (hit.page) {
        const lead = leadOf(hit.page.text);
        matched[item.id] = { page: hit.page.title, pageOnly: true, ...(lead ? { content: lead } : {}), edited: hit.page.edited, via: 'page' };
        report.push(`  ${item.id} → 分區頁 ${hit.page.title}`);
        continue;
      }
      const { listing } = hit;
      const { type, page, section, name, alt, content, address, url, lastedit } = listing;
      const fresh = Boolean(lastedit && lastedit >= FRESH_SINCE);
      const hours = fresh ? listing.hours : null;
      const price = fresh ? listing.price : null;
      matched[item.id] = Object.fromEntries(
        Object.entries({ type, page, section, name, alt, content, hours, price, address, url, lastedit, via: hit.via }).filter(([, v]) => v),
      );
      if (!matchedBy.has(listing)) matchedBy.set(listing, []);
      matchedBy.get(listing).push(item.id);
      report.push(`  ${item.id} → ${listing.name}（${{ name: '名稱比對，請確認', pin: '人工指定', wikidata: 'Wikidata' }[hit.via]}）`);
    }

    const pageInfo = pages.map(({ title, qid, edited }) => ({ title, qid, edited }));
    await fs.writeFile(
      path.join(OUT_DIR, `${city.key}.json`),
      `${JSON.stringify({ city: city.key, fetched: new Date().toISOString().slice(0, 10), license: 'CC BY-SA 4.0 (Wikivoyage)', pages: pageInfo, listings }, null, 1)}\n`,
    );

    const lines = [
      `# ${city.flag} ${city.name} ${city.local} — Wikivoyage 清單`,
      '',
      `${new Date().toISOString().slice(0, 10)} 抓取；來源 https://en.wikivoyage.org/wiki/${encodeURI(city.wikivoyage[0].replace(/ /g, '_'))}（CC BY-SA 4.0）。`,
      `頁面：${pages.map((p) => `${p.title}（${p.edited}）`).join('、')}`,
      '「✓ 項目 id」是 tripGuide.js 已經收錄的。欄位：名稱（別名）· 座標 · 分區 · 小分類（吃住多半是價位）· 營業時間 · 價格 ·（這筆最後更新日）· 簡介',
      `營業時間、價格沒寫更新日、或早於 ${FRESH_SINCE} 的多半過時，寫進 tripGuide.js 前要查官網，並標 verify。`,
    ];
    for (const type of TYPE_ORDER) {
      const group = listings.filter((l) => l.type === type);
      if (!group.length) continue;
      lines.push('', `## ${TYPE_LABEL[type]} ${type}（${group.length}）`, '');
      for (const listing of group) lines.push(digestLine(listing, matchedBy.get(listing) || []));
    }
    // 其他類型（例如 Wikivoyage 寫錯的 type）歸到最後
    const others = listings.filter((l) => !TYPE_ORDER.includes(l.type));
    if (others.length) {
      lines.push('', `## 其他類型（${others.length}）`, '');
      for (const listing of others) lines.push(digestLine(listing, matchedBy.get(listing) || []));
    }
    await fs.writeFile(path.join(OUT_DIR, `${city.key}.md`), `${lines.join('\n')}\n`);

    const counts = TYPE_ORDER.map((t) => [t, listings.filter((l) => l.type === t).length]).filter(([, n]) => n);
    console.log(
      `✓ ${city.name}：${pages.length} 頁、${listings.length} 筆（${counts.map(([t, n]) => `${TYPE_LABEL[t]} ${n}`).join('、')}），` +
        `對到已收錄項目 ${cityItems.filter((i) => matched[i.id]).length}/${cityItems.length}`,
    );
  }

  // 刪掉 tripGuide.js 已經沒有的項目
  const ids = new Set(candidates.map((item) => item.id));
  Object.keys(matched).forEach((id) => {
    if (!ids.has(id)) delete matched[id];
  });
  const sorted = Object.fromEntries(Object.entries(matched).sort(([a], [b]) => a.localeCompare(b)));
  await fs.writeFile(OUT_JSON, `${JSON.stringify(sorted, null, 1)}\n`);
  console.log(`\n寫入 ${path.relative(ROOT, OUT_JSON)}：${Object.keys(sorted).length} 筆`);
  console.log(`清單在 ${path.relative(ROOT, OUT_DIR)}/<城市>.md`);
  if (report.length) console.log(`\n對應結果：\n${report.join('\n')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
