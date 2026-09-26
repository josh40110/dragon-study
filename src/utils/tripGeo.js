import PLACES from '../constants/tripPlaces.json';
import PHOTOS from '../constants/tripPhotos.json';
import { TRIP_CITIES, TRIP_CITY_LINKS } from '../constants/tripGuide';

const BASE = import.meta.env.BASE_URL || '/';
const CITY_BY_KEY = new Map(TRIP_CITIES.map((city) => [city.key, city]));

/** 超過這個直線距離就不建議走路，改估搭車時間 */
const WALK_MAX_KM = 2.5;
/** 超過這個距離（或跨城市）算長途移動 */
const INTERCITY_KM = 40;

/** 項目的座標與照片：參考資料查 tripPlaces.json，自己加的地點用存在房間裡的座標 */
export function placeOf(item) {
  if (!item) return null;
  if (item.custom) {
    return Number.isFinite(item.lat) && Number.isFinite(item.lng) ? { lat: item.lat, lng: item.lng } : null;
  }
  const entry = PLACES[item.id];
  // 精選照片（tools/trip/photo_picks.json → build_photos.py）優先；沒挑過的才用條目的預設照片
  // 精選照片每張各自標 note（示意），也有小圖 thumb 給清單和卡片用
  const curated = PHOTOS[item.id];
  if (Array.isArray(curated) && curated.length > 0) {
    const [hero, ...rest] = curated;
    return {
      lat: entry?.lat ?? null,
      lng: entry?.lng ?? null,
      img: `${BASE}${hero.src}`,
      thumb: `${BASE}${hero.thumb}`,
      credit: hero.credit,
      note: hero.note || null,
      gallery: rest.map((photo) => ({
        url: `${BASE}${photo.src}`,
        thumb: `${BASE}${photo.thumb}`,
        credit: photo.credit,
        note: photo.note || null,
      })),
    };
  }
  if (!entry) return null;
  return {
    lat: entry.lat,
    lng: entry.lng,
    img: entry.img ? `${BASE}${entry.img}` : null,
    credit: entry.credit,
    note: entry.note,
    // 相簿直接用 Wikimedia 的縮圖網址（沒網路時只剩主照片）
    gallery: Array.isArray(entry.gallery) ? entry.gallery : [],
  };
}

export function hasCoords(item) {
  const place = placeOf(item);
  return Boolean(place && Number.isFinite(place.lat) && Number.isFinite(place.lng));
}

/** 兩點直線距離（公里） */
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function cityLink(a, b) {
  if (!a || !b || a === b) return null;
  return TRIP_CITY_LINKS.find((link) => (link.a === a && link.b === b) || (link.a === b && link.b === a)) || null;
}

export function formatMinutes(minutes) {
  const m = Math.max(1, Math.round(minutes));
  if (m < 60) return `${m} 分`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小時 ${rest} 分` : `${h} 小時`;
}

export function formatKm(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export const routeKey = (a, b) => `${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}`;

/**
 * 相鄰兩站怎麼移動：
 * - walk：直線 2.5 km 內，之後會去要真正的步行路線
 * - transit：同城市但比較遠，粗估搭車時間
 * - intercity：跨城市，用 TRIP_CITY_LINKS 查好的時間
 * 交通項目的座標是出發地，所以「交通項目 → 下一站」這段算作那趟車本身。
 */
export function describeSegment(fromItem, toItem) {
  const from = placeOf(fromItem);
  const to = placeOf(toItem);
  const fromCity = fromItem.cat === 'move' && fromItem.to ? fromItem.to : fromItem.city;
  const rideCity = fromItem.cat === 'move' ? fromItem.city : null;

  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(to.lat)) {
    return { kind: 'unknown', icon: '·', text: '有一站沒有固定地點，無法估算' };
  }
  const km = distanceKm(from, to);

  // 搭上交通項目、下一站已經在目的地城市：這段就是那趟車
  if (rideCity && fromItem.to && fromItem.to !== rideCity && toItem.city === fromItem.to) {
    const link = cityLink(rideCity, fromItem.to);
    return {
      kind: 'intercity',
      icon: link?.icon || '🚆',
      text: link ? link.text : `長途移動約 ${Math.round(km)} km`,
      minutes: link?.minutes ?? null,
      km,
    };
  }

  const link = cityLink(fromCity, toItem.city);
  if (link || km > INTERCITY_KM) {
    return {
      kind: 'intercity',
      icon: link?.icon || '🚆',
      text: link ? link.text : `長途移動約 ${Math.round(km)} km`,
      minutes: link?.minutes ?? null,
      km,
    };
  }
  if (km <= WALK_MAX_KM) {
    // 市區路線大約比直線多繞 30%，步行 4.8 km/h
    const minutes = ((km * 1.3) / 4.8) * 60;
    return { kind: 'walk', icon: '🚶', text: `步行約 ${formatMinutes(minutes)}`, minutes, km: km * 1.3, estimate: true };
  }
  const minutes = 10 + km * 2;
  return { kind: 'transit', icon: '🚇', text: `搭車約 ${formatMinutes(minutes)}（估）`, minutes, km };
}

// ── 真正的步行路線（OpenStreetMap / FOSSGIS 的 OSRM 步行路由）──

const CACHE_KEY = 'dragon-trip-walk-v1';
const MAX_CACHE = 400;
const walkCache = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
  if (Array.isArray(saved)) saved.forEach(([k, v]) => walkCache.set(k, v));
} catch {
  /* 無痕模式或資料壞掉：不影響功能，只是要重新查 */
}

function persistCache() {
  try {
    const entries = [...walkCache.entries()].filter(([, v]) => v && v !== 'error').slice(-MAX_CACHE);
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    /* 容量不足就算了 */
  }
}

/** 已查過的步行路線：{ path: [[lat,lng]...], minutes, km }；'error' 代表查不到 */
export function cachedWalk(key) {
  return walkCache.get(key);
}

const inflight = new Map();

/** 同一段正在查就共用同一個請求，重繪時不會重複打 API */
export function fetchWalk(a, b) {
  const key = routeKey(a, b);
  if (walkCache.has(key)) return Promise.resolve(walkCache.get(key));
  if (!inflight.has(key)) {
    inflight.set(
      key,
      requestWalk(a, b, key).finally(() => inflight.delete(key)),
    );
  }
  return inflight.get(key);
}

async function requestWalk(a, b, key) {
  const url =
    'https://routing.openstreetmap.de/routed-foot/route/v1/driving/' +
    `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error('no route');
    const result = {
      path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      minutes: route.duration / 60,
      km: route.distance / 1000,
    };
    walkCache.set(key, result);
    persistCache();
    return result;
  } catch {
    // 失敗不寫進 localStorage，下次打開再試
    walkCache.set(key, 'error');
    return 'error';
  }
}

// ── 順路優化 ──

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) total += distanceKm(points[i - 1], points[i]);
  return total;
}

function permutations(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((item, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest]));
}

/** 固定頭尾，排出最短的中間順序（7 個以內全部試，超過用最近鄰＋2-opt） */
function bestOrder(start, free, end) {
  const score = (order) => pathLength([start, ...order, end].filter(Boolean));
  if (free.length <= 7) {
    let best = free;
    let bestScore = score(free);
    permutations(free).forEach((order) => {
      const s = score(order);
      if (s < bestScore - 1e-9) {
        best = order;
        bestScore = s;
      }
    });
    return best;
  }
  const left = [...free];
  const order = [];
  let cursor = start || left.shift();
  if (!start) order.push(cursor);
  while (left.length) {
    let bestIdx = 0;
    left.forEach((p, i) => {
      if (distanceKm(cursor, p) < distanceKm(cursor, left[bestIdx])) bestIdx = i;
    });
    cursor = left.splice(bestIdx, 1)[0];
    order.push(cursor);
  }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < order.length - 1; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        const next = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (score(next) < score(order) - 1e-9) {
          order.splice(0, order.length, ...next);
          improved = true;
        }
      }
    }
  }
  return order;
}

/**
 * 一天的站點重排成最順的走法。
 * 交通和住宿當作固定的錨點（出發、回飯店的位置不能亂動），
 * 只重排錨點之間的景點和餐廳；沒有座標的站留在原本那一段的最後。
 * 回傳 { stops, beforeKm, afterKm }。
 */
export function optimizeStops(items) {
  const withPlace = items.map((item) => ({ item, place: placeOf(item) }));
  const isAnchor = ({ item }) => item.cat === 'move' || item.cat === 'stay';
  const located = (entry) => entry.place && Number.isFinite(entry.place.lat);
  const pointsOf = (list) => list.filter(located).map((entry) => entry.place);

  const result = [];
  let block = [];
  let prevAnchor = null;
  const flush = (nextAnchor) => {
    const free = block.filter(located);
    const floating = block.filter((entry) => !located(entry));
    const start = prevAnchor && located(prevAnchor) ? prevAnchor.place : null;
    const end = nextAnchor && located(nextAnchor) ? nextAnchor.place : null;
    const byPlace = new Map(free.map((entry) => [entry.place, entry]));
    bestOrder(start, free.map((e) => e.place), end).forEach((place) => result.push(byPlace.get(place)));
    result.push(...floating);
    block = [];
  };
  withPlace.forEach((entry) => {
    if (isAnchor(entry)) {
      flush(entry);
      result.push(entry);
      prevAnchor = entry;
    } else {
      block.push(entry);
    }
  });
  flush(null);

  return {
    stops: result.map((entry) => entry.item.id),
    beforeKm: pathLength(pointsOf(withPlace)),
    afterKm: pathLength(pointsOf(result)),
  };
}

// ── 一天排了多少時間 ──

/** '1 小時'、'1.5–2 小時'、'半天～一天'、'30 分鐘' → 分鐘（範圍取中間值） */
export function visitMinutes(item) {
  if (item.cat === 'move' || item.cat === 'stay') return 0;
  const text = item.time || '';
  if (!text) return item.cat === 'food' ? 75 : 60;
  if (text.includes('半天～一天')) return 360;
  if (text.includes('一天')) return 480;
  if (text.includes('半天')) return 240;
  const nums = (text.match(/\d+(\.\d+)?/g) || []).map(Number);
  if (nums.length === 0) return 60;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return text.includes('分') && !text.includes('小時') ? avg : avg * 60;
}

export function cityCenter(key) {
  const center = CITY_BY_KEY.get(key)?.center;
  return center ? { lat: center[0], lng: center[1] } : null;
}

/** 從 Google 地圖網址抓座標（@lat,lng、?q=lat,lng、!3d…!4d…） */
export function coordsFromMapUrl(url) {
  const text = String(url || '');
  const patterns = [/@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

/** 自己加的地點：用名稱＋城市去 OpenStreetMap 查座標，查不到回傳 null */
export async function geocodePlace(name, cityKey) {
  const city = CITY_BY_KEY.get(cityKey);
  const query = city ? `${name}, ${city.local.split(' / ')[0]}` : name;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=zh-TW,en&q=${encodeURIComponent(query)}`,
    );
    if (!res.ok) return null;
    const [hit] = await res.json();
    if (!hit) return null;
    const found = { lat: Number(hit.lat), lng: Number(hit.lon) };
    // 同名地點很多，離城市中心太遠就當作沒找到，免得釘到別國去
    const center = cityCenter(cityKey);
    if (center && distanceKm(center, found) > (cityKey === 'lapland' ? 150 : 60)) return null;
    return found;
  } catch {
    return null;
  }
}
