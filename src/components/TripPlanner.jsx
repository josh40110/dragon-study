import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import {
  BedDouble,
  CalendarDays,
  FerrisWheel,
  Luggage,
  Map as MapIcon,
  Pencil,
  Plane,
  TrainFront,
  Utensils,
} from 'lucide-react';
import { updateRoom } from '../lib/roomStore';
import { createItemId } from '../constants/roomDefaults';
import {
  DEFAULT_TRIP_DAYS,
  DEFAULT_TRIP_TITLE,
  TRIP_CATEGORIES,
  TRIP_CITIES,
  TRIP_COUNTRIES,
  TRIP_GUIDE,
} from '../constants/tripGuide';
import { getLocalDateStr } from '../utils/date';
import { daysUntil } from '../utils/dailyPick';
import { dayLocationText, findPlacesInText, formatTripDate, tripDateOf } from '../utils/tripDates';
import { coordsFromMapUrl, geocodePlace } from '../utils/tripGeo';
import TripEditableText from './TripEditableText';
import TripGuide from './TripGuide';
import TripItinerary from './TripItinerary';
import TripMap from './TripMap';

/** 全站 index.css 的 unlayered `p/span { white-space: nowrap }` 會壓過 utility class */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const SUB_TABS = [
  { key: 'plan', label: '行程表', icon: CalendarDays },
  { key: 'map', label: '地圖', icon: MapIcon },
  { key: 'move', label: '交通', icon: TrainFront },
  { key: 'fun', label: '景點', icon: FerrisWheel },
  { key: 'food', label: '美食', icon: Utensils },
  { key: 'stay', label: '住宿', icon: BedDouble },
];

const CAT_KEYS = TRIP_CATEGORIES.map((c) => c.key);
const CITY_KEYS = TRIP_CITIES.map((c) => c.key);
const ROUTE_PLACES = [...TRIP_CITIES, ...TRIP_COUNTRIES];

/**
 * 房間還沒存過行程（null）就用 Notion 版預設；存過空陣列代表真的全刪了。
 * stops：排進這天的項目 id，順序就是當天的走法（地圖拖拉排的就是它）。
 */
function normalizeDays(raw) {
  const source = Array.isArray(raw) ? raw : DEFAULT_TRIP_DAYS;
  return source
    .filter((d) => d && typeof d === 'object')
    .map((d, i) => ({
      id: String(d.id ?? `d${i + 1}`),
      place: typeof d.place === 'string' ? d.place : '',
      plan: typeof d.plan === 'string' ? d.plan : '',
      stops: Array.isArray(d.stops) ? [...new Set(d.stops.map(String))] : [],
    }));
}

function normalizePicks(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === 'object' && p.id != null)
    .map((p) => ({
      id: String(p.id),
      star: Boolean(p.star),
      booked: Boolean(p.booked),
      memo: typeof p.memo === 'string' ? p.memo : '',
    }));
}

function normalizeCustom(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === 'object' && c.id != null && typeof c.name === 'string')
    .map((c) => ({
      id: String(c.id),
      cat: CAT_KEYS.includes(c.cat) ? c.cat : 'fun',
      city: CITY_KEYS.includes(c.city) ? c.city : '',
      name: c.name,
      desc: typeof c.desc === 'string' ? c.desc : '',
      url: typeof c.url === 'string' ? c.url : '',
      lat: Number.isFinite(c.lat) ? c.lat : null,
      lng: Number.isFinite(c.lng) ? c.lng : null,
      by: c.by === 'left' || c.by === 'right' ? c.by : null,
      createdAt: Number.isFinite(c.createdAt) ? c.createdAt : 0,
      custom: true,
    }));
}

/** 寫回房間的欄位（custom 旗標只給畫面用） */
const toStoredCustom = (c) => ({
  id: c.id,
  cat: c.cat,
  city: c.city,
  name: c.name,
  desc: c.desc,
  url: c.url,
  lat: c.lat,
  lng: c.lng,
  by: c.by,
  createdAt: c.createdAt,
});

const isEmptyPick = (p) => !p.star && !p.booked && !p.memo;

function countdownText(startDate, endDate, today) {
  const left = daysUntil(startDate || null, today);
  if (left === null) return { big: '—', small: '設定出發日' };
  if (left > 0) return { big: `D-${left}`, small: '距離出發' };
  if (left === 0) return { big: '今天！', small: '出發日' };
  if (endDate && today <= endDate) return { big: `第 ${1 - left} 天`, small: '旅行中' };
  return { big: '🎉', small: '玩回來了' };
}

function TripPlanner({ role, roomData }) {
  const [subTab, setSubTab] = useState('plan');
  const [cityFilter, setCityFilter] = useState('all');
  const [focusId, setFocusId] = useState(null);
  const [editingTitle, setEditingTitle] = useState(false);
  /** 地圖頁選哪一天；'all' 是全程 */
  const [mapDayId, setMapDayId] = useState('all');

  const days = useMemo(() => normalizeDays(roomData?.tripDays), [roomData?.tripDays]);
  const picks = useMemo(() => normalizePicks(roomData?.tripPicks), [roomData?.tripPicks]);
  const custom = useMemo(() => normalizeCustom(roomData?.tripCustom), [roomData?.tripCustom]);
  const title = typeof roomData?.tripTitle === 'string' && roomData.tripTitle.trim() ? roomData.tripTitle : DEFAULT_TRIP_TITLE;
  const startDate = typeof roomData?.tripStartDate === 'string' ? roomData.tripStartDate : '';

  const allItems = useMemo(() => [...TRIP_GUIDE, ...custom], [custom]);
  const itemsById = useMemo(() => new Map(allItems.map((item) => [item.id, item])), [allItems]);
  const picksById = useMemo(() => new Map(picks.map((pick) => [pick.id, pick])), [picks]);

  // 所有寫入都整個欄位覆寫：updateRoom 的 merge 對 map 是深層合併，刪掉的 key 不會消失，陣列才會整個換掉
  const write = useCallback(async (updates, label) => {
    try {
      await updateRoom(updates, { merge: true });
    } catch (err) {
      console.error(`${label}失敗:`, err);
    }
  }, []);

  const writeDays = useCallback((nextDays, label) => write({ tripDays: nextDays }, label), [write]);

  // ── 行程表 ──
  const handleUpdateDay = useCallback(
    (dayId, patch) => writeDays(days.map((d) => (d.id === dayId ? { ...d, ...patch } : d)), '更新行程'),
    [days, writeDays],
  );

  const handleAddDay = useCallback(
    () => writeDays([...days, { id: createItemId(), place: '', plan: '', stops: [] }], '新增一天'),
    [days, writeDays],
  );

  const handleRemoveDay = useCallback(
    (day, index) => {
      if ((day.place || day.plan || day.stops.length) && !window.confirm(`刪除 Day ${index + 1}？排進這天的項目會回到清單裡。`)) {
        return;
      }
      writeDays(
        days.filter((d) => d.id !== day.id),
        '刪除一天',
      );
    },
    [days, writeDays],
  );

  /** 拖拉整天換順序：日期跟著位置走，所以 Day 編號和日期會一起變 */
  const handleReorderDays = useCallback(
    (orderedIds) => {
      const byId = new Map(days.map((d) => [d.id, d]));
      writeDays(orderedIds.map((id) => byId.get(id)).filter(Boolean), '調整天數順序');
    },
    [days, writeDays],
  );

  const handleApplyRoute = useCallback(
    (route) => {
      const start = route.from - 1;
      const next = [...days];
      while (next.length < start + route.days.length) next.push({ id: createItemId(), place: '', plan: '', stops: [] });
      const last = route.from + route.days.length - 1;
      const overwrite = route.days.some((_, i) => next[start + i].place || next[start + i].plan);
      if (overwrite && !window.confirm(`會蓋掉 Day ${route.from}–${last} 目前寫的地點和行程，確定套用「${route.title}」？`)) return;
      route.days.forEach((d, i) => {
        next[start + i] = { ...next[start + i], place: d.place, plan: d.plan };
      });
      writeDays(next, '套用路線');
    },
    [days, writeDays],
  );

  // ── 排進哪天、順序 ──
  const handleAssign = useCallback(
    (itemId, dayId, index = null) => {
      writeDays(
        days.map((d) => {
          if (d.id !== dayId || d.stops.includes(itemId)) return d;
          const stops = [...d.stops];
          stops.splice(index ?? stops.length, 0, itemId);
          return { ...d, stops };
        }),
        '排進行程',
      );
    },
    [days, writeDays],
  );

  const handleUnassign = useCallback(
    (itemId, dayId) =>
      writeDays(
        days.map((d) => (d.id === dayId ? { ...d, stops: d.stops.filter((id) => id !== itemId) } : d)),
        '移出行程',
      ),
    [days, writeDays],
  );

  const handleReorderStops = useCallback(
    (dayId, stops) => writeDays(days.map((d) => (d.id === dayId ? { ...d, stops } : d)), '調整順序'),
    [days, writeDays],
  );

  /** 從一天拖到另一天：兩天一次寫入，不會出現中間狀態 */
  const handleMoveStop = useCallback(
    (itemId, fromDayId, toDayId) => {
      if (fromDayId === toDayId) return;
      writeDays(
        days.map((d) => {
          if (d.id === fromDayId) return { ...d, stops: d.stops.filter((id) => id !== itemId) };
          if (d.id === toDayId && !d.stops.includes(itemId)) return { ...d, stops: [...d.stops, itemId] };
          return d;
        }),
        '換到別天',
      );
    },
    [days, writeDays],
  );

  // ── 收藏／已訂／備註 ──
  const handleUpdatePick = useCallback(
    (itemId, patch) => {
      const current = picksById.get(itemId) || { id: itemId, star: false, booked: false, memo: '' };
      const next = { ...current, ...patch };
      const others = picks.filter((p) => p.id !== itemId);
      write({ tripPicks: isEmptyPick(next) ? others : [...others, next] }, '更新清單');
    },
    [picks, picksById, write],
  );

  /** 自己加的地點：網址有座標就直接用，沒有就拿名稱去 OpenStreetMap 查 */
  const handleAddCustom = useCallback(
    async (draft) => {
      const coords = coordsFromMapUrl(draft.url) || (await geocodePlace(draft.name, draft.city));
      const item = {
        id: `custom-${createItemId()}`,
        cat: draft.cat,
        city: draft.city || '',
        name: draft.name,
        desc: draft.desc,
        url: draft.url,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        by: role || null,
        createdAt: Date.now(),
      };
      await write({ tripCustom: [...custom.map(toStoredCustom), item] }, '新增地點');
      return Boolean(coords);
    },
    [custom, role, write],
  );

  const handleRemoveCustom = useCallback(
    (item) => {
      if (!window.confirm(`刪除「${item.name}」？`)) return;
      write(
        {
          tripCustom: custom.filter((c) => c.id !== item.id).map(toStoredCustom),
          tripPicks: picks.filter((p) => p.id !== item.id),
          tripDays: days.map((d) => ({ ...d, stops: d.stops.filter((id) => id !== item.id) })),
        },
        '刪除地點',
      );
    },
    [custom, days, picks, write],
  );

  /** 行程表點項目 → 跳到那個分類、那個城市，捲到卡片 */
  const handleOpenItem = useCallback((item) => {
    setSubTab(item.cat);
    if (item.cat !== 'move') setCityFilter(item.city || '');
    setFocusId(item.id);
  }, []);
  const handleFocusDone = useCallback(() => setFocusId(null), []);

  const handleOpenDayMap = useCallback((dayId) => {
    setMapDayId(dayId);
    setSubTab('map');
  }, []);

  // ── 抬頭資訊 ──
  const today = getLocalDateStr();
  const endDate = startDate && days.length > 0 ? tripDateOf(startDate, days.length - 1) : null;
  const countdown = countdownText(startDate, endDate, today);

  const route = useMemo(() => {
    const nodes = [];
    days.forEach((d) => {
      findPlacesInText(dayLocationText(d), ROUTE_PLACES).forEach((place) => {
        if (nodes[nodes.length - 1]?.key !== place.key) nodes.push(place);
      });
    });
    return nodes;
  }, [days]);

  const scheduledIds = useMemo(() => new Set(days.flatMap((d) => d.stops)), [days]);

  const stats = useMemo(() => {
    const touched = new Set([...picks.map((p) => p.id), ...scheduledIds].filter((id) => itemsById.has(id)));
    const perCat = {};
    touched.forEach((id) => {
      const cat = itemsById.get(id).cat;
      perCat[cat] = (perCat[cat] || 0) + 1;
    });
    return {
      star: picks.filter((p) => p.star && itemsById.has(p.id)).length,
      scheduled: [...scheduledIds].filter((id) => itemsById.has(id)).length,
      booked: picks.filter((p) => p.booked && itemsById.has(p.id)).length,
      perCat,
    };
  }, [picks, scheduledIds, itemsById]);

  /** 地圖排程要整頁不捲動：抬頭縮成一條，分頁按鈕也跟著變小 */
  const compact = subTab === 'map';
  const tabButtons = SUB_TABS.map((tab) => {
    const Icon = tab.icon;
    const active = subTab === tab.key;
    const count = stats.perCat[tab.key];
    return (
      <button
        key={tab.key}
        onClick={() => setSubTab(tab.key)}
        className={`${compact ? 'shrink-0 px-2.5 py-1.5 rounded-xl text-[12px] gap-1' : 'px-4 sm:px-5 py-2.5 rounded-2xl text-sm gap-2'} border-2 font-black transition-all flex items-center ${
          active
            ? `bg-[#fff7e3] border-[#daa520] text-[#b07d0a] ${compact ? 'shadow-[0_2px_0_#d8c4a0]' : 'shadow-[0_4px_0_#d8c4a0]'}`
            : 'bg-[#f3e9d6] border-transparent text-[#9a8568] hover:bg-[#ece0c9]'
        }`}
      >
        <Icon size={compact ? 14 : 16} />
        {tab.label}
        {count > 0 && <span className="text-[10px] bg-[#daa520] text-white rounded-full px-1.5 leading-4">{count}</span>}
      </button>
    );
  });

  return (
    <div className={compact ? 'flex flex-col gap-2.5' : 'space-y-5'}>
      {compact ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[#fdf9f1] border-[3px] border-[#e6dac1] rounded-2xl px-3 py-2 shadow-[0_4px_0_#e0d3b6]">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <Luggage size={16} className="text-[#b07d0a] shrink-0" />
            <span className="min-w-0 font-black text-[#4a3526] text-[14px]" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </span>
            <span className="hidden md:inline shrink-0 text-[11px] font-black text-[#9a8568]">
              {startDate && endDate ? `${formatTripDate(startDate)} → ${formatTripDate(endDate)}` : '還沒設出發日'}
            </span>
            <span className="shrink-0 flex items-center gap-1 rounded-full bg-[#f3e9d6] px-2 py-0.5 text-[11px] font-black text-[#4a3526]">
              <Plane size={12} className="text-[#b07d0a]" />
              {startDate ? countdown.big : countdown.small}
            </span>
          </div>
          {/* 手機上一排塞不下就左右滑，不要折成好幾行吃掉高度 */}
          <div className="flex gap-1.5 overflow-x-auto max-w-full pb-0.5 -mb-0.5">{tabButtons}</div>
        </div>
      ) : (
        <>
      <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-5 md:p-6 shadow-[0_10px_0_#e0d3b6]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[#b07d0a] font-black text-sm flex items-center gap-2">
                  <Luggage size={16} />
                  龍龍旅行社・年底旅行
                </div>
                {/* 手機寬度放不下右邊的倒數方塊，縮成一顆小標籤 */}
                <span className="md:hidden shrink-0 flex items-center gap-1 rounded-full bg-[#f3e9d6] px-2.5 py-1 text-[12px] font-black text-[#4a3526]">
                  <Plane size={13} className="text-[#b07d0a]" />
                  {startDate ? countdown.big : countdown.small}
                </span>
              </div>
              {editingTitle ? (
                <TripEditableText
                  tone="title"
                  autoFocus
                  value={title}
                  placeholder={DEFAULT_TRIP_TITLE}
                  label="旅行標題"
                  onSave={(next) => write({ tripTitle: next || null }, '更新標題')}
                  onDone={() => setEditingTitle(false)}
                  className="mt-1 -ml-2"
                />
              ) : (
                <div className="mt-1 flex items-start gap-2">
                  <h2
                    onClick={() => setEditingTitle(true)}
                    className="text-2xl md:text-3xl font-black text-[#4a3526] leading-snug cursor-text"
                    style={WRAP}
                  >
                    {title}
                  </h2>
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="mt-1 p-1.5 rounded-lg text-[#c4b291] hover:text-[#b07d0a] hover:bg-[#f3e9d6] transition-colors shrink-0"
                    title="改標題"
                  >
                    <Pencil size={16} />
                  </button>
                </div>
              )}
              {route.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {route.map((place, i) => (
                    <Fragment key={`${place.key}-${i}`}>
                      {i > 0 && <span className="text-[#c4b291] font-black">→</span>}
                      <span className="text-[13px] font-black text-[#6b5540] bg-[#f3e9d6] rounded-full px-3 py-1">
                        {place.flag} {place.name}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
  
            <div className="hidden md:block shrink-0 rounded-2xl border-2 border-[#e6dac1] bg-[#f7f0e2] px-5 py-3 text-center min-w-[112px]">
              <div className="flex items-center justify-center gap-1.5 text-[#4a3526] font-black text-xl">
                <Plane size={18} className="text-[#b07d0a]" />
                {countdown.big}
              </div>
              <div className="text-[10px] text-[#9a8568] font-black mt-0.5">{countdown.small}</div>
            </div>
          </div>
  
          <div className="mt-4 flex flex-wrap items-center gap-3 bg-[#f7f0e2] border-2 border-[#e6dac1] rounded-2xl p-3">
            <label htmlFor="trip-start-date" className="text-[#8a755b] font-black text-sm">
              出發日（Day 1）
            </label>
            <input
              id="trip-start-date"
              type="date"
              value={startDate}
              onChange={(e) => write({ tripStartDate: e.target.value || null }, '設定出發日')}
              className="px-3 py-2 rounded-xl border-2 border-[#e6dac1] bg-[#fdf9f1] text-[#4a3526] font-bold focus:outline-none focus:border-[#daa520]"
            />
            {startDate && endDate ? (
              <span className="text-[13px] font-black text-[#6b5540]" style={WRAP}>
                {formatTripDate(startDate)} → {formatTripDate(endDate)}，共 {days.length} 天
              </span>
            ) : (
              <span className="text-[12px] font-bold text-[#b3a084]" style={WRAP}>
                設好就會自動算每天日期、檢查市集和夜車
              </span>
            )}
          </div>
  
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-black">
            <span className="bg-[#fff3c4] text-[#b07d0a] rounded-full px-3 py-1">⭐ 標記 {stats.star}</span>
            <span className="bg-[#fff7e3] text-[#b07d0a] rounded-full px-3 py-1">📅 排進行程 {stats.scheduled}</span>
            <span className="bg-[#e8f7e9] text-[#166534] rounded-full px-3 py-1">✅ 已訂 {stats.booked}</span>
          </div>
  
          <p className="mt-3 text-[11px] text-[#b3a084] font-bold" style={WRAP}>
            🔓 這頁存在你們的共用房間，兩個人都能看、都能改。房間沒有密碼保護，訂位代號、護照號碼這類資料別記在這裡。
          </p>
        </section>

          <div className="flex gap-2 flex-wrap">{tabButtons}</div>
        </>
      )}

      {subTab === 'plan' && (
        <TripItinerary
          days={days}
          startDate={startDate}
          picksById={picksById}
          itemsById={itemsById}
          onUpdateDay={handleUpdateDay}
          onAddDay={handleAddDay}
          onRemoveDay={handleRemoveDay}
          onApplyRoute={handleApplyRoute}
          onUnassign={handleUnassign}
          onOpenItem={handleOpenItem}
          onOpenMap={handleOpenDayMap}
        />
      )}

      {subTab === 'map' && (
        <TripMap
          days={days}
          startDate={startDate}
          selectedDayId={mapDayId}
          onSelectDay={setMapDayId}
          allItems={allItems}
          itemsById={itemsById}
          picksById={picksById}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onReorderStops={handleReorderStops}
          onMoveStop={handleMoveStop}
          onReorderDays={handleReorderDays}
          onOpenItem={handleOpenItem}
          onUpdatePick={handleUpdatePick}
          onApplyRoute={handleApplyRoute}
        />
      )}

      {CAT_KEYS.includes(subTab) && (
        <TripGuide
          key={subTab}
          cat={subTab}
          items={allItems}
          picksById={picksById}
          days={days}
          startDate={startDate}
          cityFilter={cityFilter}
          onCityFilterChange={setCityFilter}
          focusId={focusId}
          onFocusDone={handleFocusDone}
          onUpdatePick={handleUpdatePick}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onAddCustom={handleAddCustom}
          onRemoveCustom={handleRemoveCustom}
        />
      )}
    </div>
  );
}

/**
 * App 為了計時器每 0.5 秒重繪一次；房間資料沒變就不必重畫整個旅行頁（地圖圖層很多）。
 */
export default memo(TripPlanner);
