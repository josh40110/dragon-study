import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, GripVertical, Maximize2, Plus, Search, Sparkles, Undo2, X } from 'lucide-react';
import {
  ROUTE_SUGGESTIONS,
  TRIP_CATEGORIES,
  TRIP_CITIES,
  TRIP_COUNTRIES,
  TRIP_EVENTS,
  TRIP_GUIDE,
  TRIP_HOLIDAYS,
} from '../constants/tripGuide';
import { TRIP_EXPERT_PICKS, TRIP_INSIGHTS } from '../constants/tripInsights';
import { TRIP_VIDEOS } from '../constants/tripVideos';
import {
  dayLocationText,
  eventClosedReason,
  eventOpenText,
  eventStatusOn,
  eventsForDayText,
  findPlacesInText,
  formatTripDate,
  tripDateOf,
} from '../utils/tripDates';
import {
  cachedWalk,
  cityCenter,
  cityLink,
  describeSegment,
  distanceKm,
  fetchWalk,
  formatKm,
  formatMinutes,
  optimizeStops,
  placeOf,
  routeKey,
  visitMinutes,
} from '../utils/tripGeo';
import TripLeafletMap from './TripLeafletMap';
import { SafeImg, VideoCard, VideoModal } from './TripMedia';
import TripPlaceDetail from './TripPlaceDetail';

/** 全站 index.css 的 unlayered `p/span { white-space: nowrap }` 會壓過 utility class */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };
/** 一行放不下就截斷加「…」（全站 nowrap 之下，截斷比換行好控制高度） */
const ELLIPSIS = { overflow: 'hidden', textOverflow: 'ellipsis' };

const CARD = 'bg-[#fdf9f1] border-[3px] border-[#e6dac1] rounded-[1.4rem] p-3 shadow-[0_5px_0_#e0d3b6] min-w-0 min-h-0';
const CAT_EMOJI = Object.fromEntries(TRIP_CATEGORIES.map((c) => [c.key, c.emoji]));
const CAT_ORDER = Object.fromEntries(TRIP_CATEGORIES.map((c, i) => [c.key, i]));
const CAT_COLOR = { move: '#2f6db5', fun: '#d97706', food: '#dc2626', stay: '#7c3aed' };
const CITY_BY_KEY = new Map(TRIP_CITIES.map((city) => [city.key, city]));
const SEG_COLOR = { walk: '#b07d0a', transit: '#2f6db5', intercity: '#8a755b' };
/** 一天排超過這麼久就提醒（冬天天黑得早） */
const LONG_DAY_MINUTES = 600;
const LIST_PAGE = 40;
/** 螢幕太矮時寧可讓整頁捲動，也不要把工作區壓到不能用 */
const MIN_WORKSPACE = 460;
/** 全程總覽每個城市用哪一張照片當封面 */
const CITY_COVER = {
  prague: 'fun-prg-market',
  krumlov: 'stay-ck-old',
  vienna: 'fun-vie-rathaus',
  salzburg: 'fun-szg-fortress',
  hallstatt: 'fun-hal-village',
  stockholm: 'fun-sto-gamlastan',
  lapland: 'fun-lap-skystation',
  narvik: 'mv-ofoten',
};
/** 城市卡上的「必看」：有旅遊書推薦的景點排前面，取 3 個 */
const CITY_HIGHLIGHTS = Object.fromEntries(
  TRIP_CITIES.map((city) => {
    const fun = TRIP_GUIDE.filter((item) => item.city === city.key && item.cat === 'fun');
    const ranked = [...fun.filter((item) => TRIP_EXPERT_PICKS[item.id]), ...fun.filter((item) => !TRIP_EXPERT_PICKS[item.id])];
    return [city.key, ranked.slice(0, 3).map((item) => item.name)];
  }),
);
const DAY_GRID = 'lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_360px] 2xl:grid-cols-[290px_minmax(0,1fr)_440px]';
const ALL_GRID = 'lg:grid-cols-[260px_minmax(0,1fr)_320px] xl:grid-cols-[290px_minmax(0,1fr)_400px] 2xl:grid-cols-[320px_minmax(0,1fr)_520px]';

const located = (place) => Boolean(place && Number.isFinite(place.lat) && Number.isFinite(place.lng));

/** 收藏的排前面，再依交通、景點、美食、住宿 */
const starThenCat = (picksById) => (a, b) =>
  Number(Boolean(picksById.get(b.id)?.star)) - Number(Boolean(picksById.get(a.id)?.star)) || CAT_ORDER[a.cat] - CAT_ORDER[b.cat];

/** 'stop:fun-prg-castle' → ['stop', 'fun-prg-castle']；容器 id（'stoplist'）沒有冒號 → ['stoplist', ''] */
function splitId(id) {
  const text = String(id);
  const i = text.indexOf(':');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}

/**
 * 先看游標底下是什麼（日期標籤、某一站）；游標落在縫隙時才找最近的一站，
 * 否則拖到地圖上放開也會被當成排序。
 */
function collision(args) {
  const hits = pointerWithin(args);
  if (hits.length) {
    const precise = hits.filter((hit) => !['stoplist', 'candlist'].includes(String(hit.id)));
    return precise.length ? precise : hits;
  }
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => /^(stop|dayrow):/.test(String(c.id))),
  });
}

/**
 * 工作區高度 = 視窗剩下的高度，整頁不用捲動；各欄自己捲。
 * 直接改 DOM 的 style（跟視窗尺寸同步），不經過 React state，避免多一次重繪。
 */
function useFillViewport(ref) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const fit = () => {
      el.style.height = '';
      const top = el.getBoundingClientRect().top + window.scrollY;
      let height = Math.max(MIN_WORKSPACE, window.innerHeight - top - 16);
      el.style.height = `${height}px`;
      // main 的下邊距、兄弟元素的間距還是撐出捲軸的話，把多出來的扣掉（量兩次比較穩）
      for (let i = 0; i < 2; i += 1) {
        const overflow = document.documentElement.scrollHeight - window.innerHeight;
        if (overflow <= 0 || height - overflow < MIN_WORKSPACE) break;
        height -= overflow;
        el.style.height = `${height}px`;
      }
    };
    window.scrollTo(0, 0);
    fit();
    // 字型、上方抬頭排版穩定後再量一次
    const frame = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
    };
  }, [ref]);
}

// ── 圖釘（只放數字、emoji 和常數，不放使用者輸入的文字）──
const stopPin = (label, color, selected) => {
  const size = selected ? 36 : 30;
  return (
    `<div style="min-width:${size}px;height:${size}px;padding:0 4px;box-sizing:border-box;border-radius:999px;background:${color};color:#fff;` +
    `border:3px solid ${selected ? '#f3c44e' : '#fff'};box-shadow:0 2px 8px rgba(0,0,0,.4);display:flex;` +
    `align-items:center;justify-content:center;font:900 ${selected ? 14 : 12}px/1 system-ui,sans-serif">${label}</div>`
  );
};
const candidatePin = (emoji, color, selected) =>
  `<div style="width:${selected ? 32 : 26}px;height:${selected ? 32 : 26}px;border-radius:50%;background:${selected ? '#fff3c4' : '#fff'};` +
  `border:${selected ? 3 : 2}px solid ${selected ? '#daa520' : color};opacity:${selected ? 1 : 0.92};` +
  `box-shadow:0 1px 4px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:${selected ? 15 : 13}px">${emoji}</div>`;
const cityPin = (text) =>
  `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);white-space:nowrap;background:#fdf9f1;` +
  `border:2px solid #daa520;border-radius:999px;padding:3px 9px;box-shadow:0 2px 6px rgba(0,0,0,.25);` +
  `font:900 11px/1.2 system-ui,sans-serif;color:#4a3526">${text}</div>`;

function Thumb({ item, size = 'w-9 h-9' }) {
  const place = placeOf(item);
  const fallback = (
    <div className={`${size} rounded-lg bg-[#f0e5d0] flex items-center justify-center text-base shrink-0`}>
      {CAT_EMOJI[item.cat]}
    </div>
  );
  return (
    <SafeImg
      key={place?.img}
      src={place?.thumb || place?.img}
      loading="lazy"
      className={`${size} rounded-lg object-cover shrink-0 bg-[#e6dac1]`}
      fallback={fallback}
    />
  );
}

function DayChip({ id, title, sub, count, active, droppable, onClick }) {
  const { setNodeRef, isOver } = useDroppable({ id: `daychip:${id}`, disabled: !droppable });
  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 transition-all ${
        active
          ? 'bg-[#fff7e3] border-[#daa520] shadow-[0_2px_0_#d8c4a0]'
          : isOver
            ? 'bg-[#e8f7e9] border-[#16a34a] scale-105'
            : 'bg-[#f3e9d6] border-transparent hover:bg-[#ece0c9]'
      }`}
    >
      <span className={`text-[12px] font-black ${active ? 'text-[#b07d0a]' : 'text-[#6b5540]'}`}>{title}</span>
      {sub && <span className="text-[11px] font-bold text-[#9a8568] max-w-[110px]" style={ELLIPSIS}>{sub}</span>}
      {count > 0 && <span className="text-[10px] bg-[#daa520] text-white rounded-full px-1.5 leading-4">{count}</span>}
    </button>
  );
}

function StopRow({ item, index, pick, selected, onSelect, onRemove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: `stop:${item.id}` });
  const visit = visitMinutes(item);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1.5 rounded-xl border-2 p-1.5 transition-colors ${isDragging ? 'opacity-40' : ''} ${
        selected
          ? 'border-[#daa520] bg-[#fff7e3]'
          : isOver
            ? 'border-[#daa520] bg-[#fdf9f1]'
            : 'border-[#e6dac1] bg-[#fdf9f1] hover:border-[#d8c4a0]'
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-0.5 rounded text-[#c4b291] hover:text-[#b07d0a]"
        aria-label={`拖曳「${item.name}」調整順序`}
      >
        <GripVertical size={15} />
      </button>
      <span
        className="w-5 h-5 rounded-full text-white text-[11px] font-black flex items-center justify-center shrink-0"
        style={{ background: CAT_COLOR[item.cat] }}
      >
        {index + 1}
      </span>
      <button onClick={() => onSelect(item)} className="min-w-0 flex-1 flex items-center gap-2 text-left" title="看介紹">
        <Thumb item={item} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-black text-[#4a3526] leading-tight" style={ELLIPSIS}>
            {item.name}
            {pick?.booked ? ' ✅' : ''}
          </span>
          <span className="block text-[10px] font-bold text-[#9a8568]" style={ELLIPSIS}>
            {CAT_EMOJI[item.cat]} {visit ? `停留約 ${formatMinutes(visit)}` : item.local || ''}
            {located(placeOf(item)) ? '' : '・沒有固定地點'}
          </span>
        </span>
      </button>
      <button
        onClick={() => onRemove(item)}
        className="p-1 rounded text-[#c4b291] hover:text-[#c0392b] hover:bg-[#f3e9d6] shrink-0"
        title="移出這天"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function SegmentInfo({ seg }) {
  if (!seg) return null;
  const showKm = seg.km && seg.kind !== 'intercity';
  return (
    <div className="flex items-center gap-1.5 py-0.5 pl-9 text-[10px] font-black text-[#8a755b]">
      <span className="h-3 border-l-2 border-dashed border-[#d8c4a0]" />
      <span style={ELLIPSIS} title={seg.text}>
        {seg.icon} {seg.text}
        {showKm ? `・${formatKm(seg.km)}` : ''}
        {seg.kind === 'walk' && seg.estimate ? '（估）' : ''}
      </span>
    </div>
  );
}

/** 可拖的地點列：單日模式是「加地點」清單，全程模式是「所有地點」清單 */
function PlaceRow({ item, pick, scheduled, selected, onSelect, onAdd }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({ id: `cand:${item.id}` });
  const tagline = TRIP_INSIGHTS[item.id]?.tagline;
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-1.5 rounded-xl border-2 p-1.5 transition-colors ${isDragging ? 'opacity-40' : ''} ${
        selected ? 'border-[#daa520] bg-[#fff7e3]' : 'border-[#e6dac1] bg-[#f7f0e2] hover:border-[#d8c4a0]'
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-0.5 rounded text-[#c4b291] hover:text-[#b07d0a]"
        aria-label={`拖曳「${item.name}」加進某一天`}
      >
        <GripVertical size={15} />
      </button>
      <button onClick={() => onSelect(item)} className="min-w-0 flex-1 flex items-center gap-2 text-left" title="看介紹">
        <Thumb item={item} size="w-11 h-11" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-black text-[#4a3526] leading-tight" style={ELLIPSIS}>
            {pick?.star ? '⭐ ' : ''}
            {item.name}
          </span>
          <span className="block text-[10px] font-bold text-[#9a8568]" style={ELLIPSIS}>
            {tagline || item.local || CAT_EMOJI[item.cat]}
          </span>
          {scheduled?.length > 0 && (
            <span className="mt-0.5 inline-block rounded bg-[#fff3c4] px-1 text-[9px] font-black text-[#b07d0a]">
              已排 D{scheduled.join('、D')}
            </span>
          )}
        </span>
      </button>
      {onAdd && (
        <button
          onClick={() => onAdd(item)}
          className="p-1 rounded-lg text-[#b07d0a] bg-[#fff7e3] border-2 border-[#e6dac1] hover:border-[#daa520] shrink-0"
          title="加進這天"
        >
          <Plus size={13} />
        </button>
      )}
    </div>
  );
}

function DropZone({ id, children, className, activeClass }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? activeClass : ''}`}>
      {children}
    </div>
  );
}

function TripDayRow({ day, index, date, cities, stopCount, onOpen }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: `dayrow:${day.id}`,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1.5 rounded-xl border-2 border-[#e6dac1] bg-[#fdf9f1] p-1.5 ${isDragging ? 'opacity-40' : ''}`}
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="touch-none cursor-grab active:cursor-grabbing p-0.5 rounded text-[#c4b291] hover:text-[#b07d0a]"
        aria-label={`拖曳 Day ${index + 1} 調整順序`}
      >
        <GripVertical size={15} />
      </button>
      <button onClick={() => onOpen(day.id)} className="min-w-0 flex-1 text-left" title="排這天">
        <span className="block text-[12px] font-black text-[#b07d0a]" style={ELLIPSIS}>
          Day {index + 1}
          {date ? <span className="ml-1.5 text-[#9a8568]">{formatTripDate(date)}</span> : null}
        </span>
        <span className="block text-[11px] font-bold text-[#4a3526]" style={ELLIPSIS}>
          {day.place || cities.map((k) => CITY_BY_KEY.get(k)?.name).join(' → ') || '還沒決定地點'}
          {day.plan ? `：${day.plan}` : ''}
        </span>
      </button>
      <span className="text-[10px] font-black text-[#9a8568] shrink-0">{stopCount ? `${stopCount} 站` : ''}</span>
    </div>
  );
}

/** 一天的城市：先看地點欄，沒寫就看排進去的站點 */
function citiesOfDay(day, itemsById) {
  const keys = findPlacesInText(dayLocationText(day), TRIP_CITIES).map((c) => c.key);
  if (keys.length) return keys;
  return [...new Set(day.stops.map((id) => itemsById.get(id)?.city).filter((k) => CITY_BY_KEY.has(k)))];
}

/** 會經過第 n 天（1 起算）的路線建議，以及那一天在建議裡寫的地點 */
function routesForDay(n) {
  return ROUTE_SUGGESTIONS.filter((r) => n >= r.from && n < r.from + r.days.length).map((route) => ({
    route,
    entry: route.days[n - route.from],
  }));
}

/**
 * 「這天的城市」：地點欄寫了城市就用；只寫到國家（例如「🇨🇿 → 🇦🇹 奧地利」）就列那個國家的城市；
 * 什麼都沒寫就先用路線建議裡那天會去的城市，不要整排空白。
 */
function areaOfDay(day, dayNumber, dayCities) {
  if (dayCities.length) return { cities: dayCities, source: 'day', label: '' };
  const countries = findPlacesInText(dayLocationText(day), TRIP_COUNTRIES);
  const byCountry = TRIP_CITIES.filter((city) => countries.some((c) => c.flag === city.flag)).map((city) => city.key);
  if (byCountry.length) return { cities: byCountry, source: 'country', label: countries.map((c) => c.name).join('、') };
  const byRoute = [
    ...new Set(routesForDay(dayNumber).flatMap(({ entry }) => findPlacesInText(entry.place, TRIP_CITIES).map((city) => city.key))),
  ];
  return { cities: byRoute, source: byRoute.length ? 'route' : 'none', label: '' };
}

function legText(from, to) {
  const link = cityLink(from, to);
  if (link) return `${link.icon} ${link.text}`;
  return `🚆 約 ${Math.round(distanceKm(cityCenter(from), cityCenter(to)))} km`;
}

function LegLine({ from, to }) {
  const a = CITY_BY_KEY.get(from);
  const b = CITY_BY_KEY.get(to);
  if (!a || !b) return null;
  return (
    <div className="flex items-center gap-1.5 py-0.5 pl-7 text-[10px] font-black text-[#8a755b]">
      <span className="h-3 border-l-2 border-dashed border-[#d8c4a0]" />
      <span style={ELLIPSIS}>
        {a.name} → {b.name}：{legText(from, to)}
      </span>
    </div>
  );
}

/** 全程總覽的城市卡：封面照、第幾天、排了哪些地方、到下一站怎麼走；還沒排的城市顯示必看景點 */
function CityCard({ node, next, stops, onOpenDay, onExplore }) {
  const city = CITY_BY_KEY.get(node.key);
  const cover = placeOf({ id: CITY_COVER[node.key] });
  const scheduled = node.days.length > 0;
  const range = !scheduled
    ? '還沒排進行程'
    : node.days.length > 1
      ? `Day ${node.days[0]}–${node.days[node.days.length - 1]}`
      : `Day ${node.days[0]}`;
  const highlights = CITY_HIGHLIGHTS[node.key] || [];
  return (
    <div className="group rounded-2xl overflow-hidden border-2 border-[#e6dac1] bg-[#f7f0e2] hover:border-[#daa520] transition-colors flex flex-col">
      <button onClick={() => onExplore(node.key)} className="relative h-32 bg-[#e6dac1] text-left" title={`看${city.name}的所有地點`}>
        <SafeImg
          src={cover?.thumb || cover?.img}
          loading="lazy"
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          fallback={<div className="h-full w-full flex items-center justify-center text-4xl">{city.flag}</div>}
        />
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-black text-white ${
            scheduled ? 'bg-black/55' : 'bg-black/35'
          }`}
        >
          {range}
        </span>
        <span className="absolute bottom-2 left-2 text-[16px] font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {city.flag} {city.name}
        </span>
      </button>
      <div className="p-2.5 space-y-1 min-w-0">
        <div className="text-[11px] font-bold text-[#6b5540]" style={ELLIPSIS}>
          {stops.length
            ? stops.map((item) => item.name).join('・')
            : highlights.length
              ? `必看：${highlights.join('・')}`
              : '還沒排地點'}
        </div>
        {next && (
          <div className="text-[11px] font-black text-[#8a755b]" style={ELLIPSIS}>
            ↓ {legText(node.key, next.key)}
          </div>
        )}
        <div className="flex gap-1.5 pt-0.5">
          <button onClick={() => onExplore(node.key)} className="flex-1 rounded-lg bg-[#fff7e3] border-2 border-[#e6dac1] py-1 text-[11px] font-black text-[#b07d0a] hover:border-[#daa520]">
            看這城市的地點
          </button>
          {scheduled && (
            <button onClick={() => onOpenDay(node.days[0])} className="flex-1 rounded-lg bg-[#f3e9d6] py-1 text-[11px] font-black text-[#8a755b] hover:bg-[#ece0c9]">
              排 Day {node.days[0]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children, dark = false }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-2 py-0.5 rounded-lg border-2 text-[11px] font-black transition-colors ${
        active
          ? dark
            ? 'bg-[#4a3526] border-[#4a3526] text-[#fdf9f1]'
            : 'bg-[#fff7e3] border-[#daa520] text-[#b07d0a]'
          : 'bg-[#f3e9d6] border-transparent text-[#9a8568] hover:bg-[#ece0c9]'
      }`}
    >
      {children}
    </button>
  );
}

export default function TripMap({
  days,
  startDate,
  selectedDayId,
  onSelectDay,
  allItems,
  itemsById,
  picksById,
  onAssign,
  onUnassign,
  onReorderStops,
  onMoveStop,
  onReorderDays,
  onOpenItem,
  onUpdatePick,
  onApplyRoute,
}) {
  const workspaceRef = useRef(null);
  useFillViewport(workspaceRef);

  const [activeId, setActiveId] = useState(null);
  const [scope, setScope] = useState('auto');
  const [catFilter, setCatFilter] = useState('all');
  const [listLimit, setListLimit] = useState(LIST_PAGE);
  const [optimizeNote, setOptimizeNote] = useState(null);
  const [walkResults, setWalkResults] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  /** 手機一次只放得下一欄 */
  const [mobilePanel, setMobilePanel] = useState('plan');
  const [bigMap, setBigMap] = useState(false);
  // 放大地圖按 Esc 關閉
  useEffect(() => {
    if (!bigMap) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setBigMap(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [bigMap]);
  const [playing, setPlaying] = useState(null);
  // 全程模式的「所有地點」篩選
  const [exploreCity, setExploreCity] = useState('all');
  const [exploreMode, setExploreMode] = useState('all');
  const [exploreQuery, setExploreQuery] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // 手機長按一下才開始拖，否則滑動頁面會被當成拖曳
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dayIndex = days.findIndex((d) => d.id === selectedDayId);
  const day = dayIndex >= 0 ? days[dayIndex] : null;
  const date = day ? tripDateOf(startDate, dayIndex) : null;

  const stopItems = useMemo(() => (day ? day.stops.map((id) => itemsById.get(id)).filter(Boolean) : []), [day, itemsById]);

  const dayCities = useMemo(() => {
    if (!day) return [];
    const keys = citiesOfDay(day, itemsById);
    stopItems.forEach((item) => {
      [item.city, item.cat === 'move' ? item.to : null].forEach((k) => {
        if (k && CITY_BY_KEY.has(k) && !keys.includes(k)) keys.push(k);
      });
    });
    return keys;
  }, [day, itemsById, stopItems]);

  const dayArea = useMemo(() => (day ? areaOfDay(day, dayIndex + 1, dayCities) : { cities: [], source: 'none', label: '' }), [day, dayIndex, dayCities]);
  const dayRoutes = day && !dayCities.length ? routesForDay(dayIndex + 1) : [];

  /** 每個項目排在哪幾天 */
  const scheduledDays = useMemo(() => {
    const map = new Map();
    days.forEach((d, i) =>
      d.stops.forEach((id) => {
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(i + 1);
      }),
    );
    return map;
  }, [days]);

  // 單日模式：可以加進這天的地點
  const effectiveScope = scope === 'auto' ? (dayArea.cities.length ? 'city' : 'all') : scope;
  const candidates = useMemo(() => {
    if (!day) return [];
    const inDay = new Set(day.stops);
    return allItems
      .filter((item) => !inDay.has(item.id))
      .filter((item) => catFilter === 'all' || item.cat === catFilter)
      .filter((item) => {
        if (effectiveScope === 'all') return true;
        if (effectiveScope === 'star') return Boolean(picksById.get(item.id)?.star);
        return dayArea.cities.includes(item.city);
      })
      .sort(starThenCat(picksById));
  }, [allItems, catFilter, day, dayArea, effectiveScope, picksById]);

  // 全程模式：所有地點（不管日期）
  const explored = useMemo(() => {
    if (day) return [];
    const q = exploreQuery.trim().toLowerCase();
    return allItems
      .filter((item) => exploreCity === 'all' || item.city === exploreCity)
      .filter((item) => catFilter === 'all' || item.cat === catFilter)
      .filter((item) => {
        if (exploreMode === 'star') return Boolean(picksById.get(item.id)?.star);
        if (exploreMode === 'scheduled') return scheduledDays.has(item.id);
        if (exploreMode === 'unscheduled') return !scheduledDays.has(item.id);
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        const text = `${item.name} ${item.local || ''} ${TRIP_INSIGHTS[item.id]?.tagline || ''}`.toLowerCase();
        return text.includes(q);
      })
      .sort(starThenCat(picksById));
  }, [allItems, catFilter, day, exploreCity, exploreMode, exploreQuery, picksById, scheduledDays]);

  const cityCounts = useMemo(() => {
    const counts = new Map();
    allItems.forEach((item) => counts.set(item.city || '', (counts.get(item.city || '') || 0) + 1));
    return counts;
  }, [allItems]);

  // 選到的地點：單日模式沒選就看當天第一個景點／餐廳；全程模式沒選就顯示總覽
  const explicit = selectedId ? itemsById.get(selectedId) : null;
  const selectedItem = day
    ? explicit ||
      stopItems.find((item) => item.cat === 'fun' || item.cat === 'food') ||
      stopItems[0] ||
      candidates.find((item) => item.cat === 'fun') ||
      candidates[0] ||
      null
    : explicit || null;

  const selectItem = (item) => {
    setSelectedId(item.id);
    setMobilePanel('detail');
  };
  const selectDay = (id) => {
    setSelectedId(null);
    setMobilePanel('plan');
    setListLimit(LIST_PAGE);
    onSelectDay(id);
  };
  const exploreCityAll = (cityKey) => {
    onSelectDay('all');
    setSelectedId(null);
    setExploreCity(cityKey);
    setListLimit(LIST_PAGE);
    setMobilePanel('plan');
  };

  // ── 相鄰兩站怎麼走 ──
  const baseSegments = useMemo(
    () =>
      stopItems.slice(1).map((item, i) => {
        const prev = stopItems[i];
        const seg = describeSegment(prev, item);
        const a = placeOf(prev);
        const b = placeOf(item);
        return { ...seg, id: `${prev.id}>${item.id}`, a, b, key: seg.kind === 'walk' ? routeKey(a, b) : null };
      }),
    [stopItems],
  );

  // 步行段去要真正的路線（有快取；失敗就維持直線估算）
  useEffect(() => {
    const missing = baseSegments.filter((seg) => seg.key && cachedWalk(seg.key) === undefined);
    if (!missing.length) return undefined;
    let cancelled = false;
    (async () => {
      for (const seg of missing) {
        const result = await fetchWalk(seg.a, seg.b);
        if (cancelled) return;
        setWalkResults((prev) => ({ ...prev, [seg.key]: result }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseSegments]);

  const segments = useMemo(
    () =>
      baseSegments.map((seg) => {
        if (!seg.key) return seg;
        const walk = walkResults[seg.key] ?? cachedWalk(seg.key);
        if (!walk || walk === 'error') return seg;
        return { ...seg, text: `步行 ${formatMinutes(walk.minutes)}`, minutes: walk.minutes, km: walk.km, path: walk.path, estimate: false };
      }),
    [baseSegments, walkResults],
  );

  const totals = useMemo(() => {
    const t = { walkMin: 0, walkKm: 0, transitMin: 0, visitMin: 0, long: [], estimated: false };
    segments.forEach((seg) => {
      if (seg.kind === 'walk') {
        t.walkMin += seg.minutes;
        t.walkKm += seg.km;
        t.estimated ||= Boolean(seg.estimate);
      } else if (seg.kind === 'transit') {
        t.transitMin += seg.minutes;
      } else if (seg.kind === 'intercity') {
        t.long.push(seg);
      }
    });
    t.visitMin = stopItems.reduce((sum, item) => sum + visitMinutes(item), 0);
    t.load = t.visitMin + t.walkMin + t.transitMin;
    return t;
  }, [segments, stopItems]);

  // 這天的日期提醒（假日、市集有沒有開、夜車）
  const dayBadges = useMemo(() => {
    if (!day || !date) return [];
    const cityKeys = findPlacesInText(dayLocationText(day), TRIP_CITIES).map((c) => c.key);
    const badges = [];
    const holiday = TRIP_HOLIDAYS[date.slice(5)];
    if (holiday) badges.push({ key: 'holiday', warn: true, text: `🔒 ${holiday.split('：')[0]}`, title: holiday });
    eventsForDayText(`${day.place} ${day.plan}`, cityKeys, TRIP_EVENTS).forEach((event) => {
      const open = eventStatusOn(event, date) === 'open';
      badges.push({
        key: event.id,
        warn: !open,
        text: `${open ? event.icon : '⚠️'} ${event.name}`,
        title: open ? eventOpenText(event) : eventClosedReason(event),
      });
    });
    return badges;
  }, [day, date]);

  const freeLocated = stopItems.filter((item) => item.cat !== 'move' && item.cat !== 'stay' && located(placeOf(item))).length;
  const note = optimizeNote && optimizeNote.dayId === day?.id ? optimizeNote : null;

  const handleOptimize = () => {
    if (!day) return;
    const { stops, beforeKm, afterKm } = optimizeStops(stopItems);
    const saved = beforeKm - afterKm;
    if (saved < 0.05) {
      setOptimizeNote({ dayId: day.id, text: '已經是最順的順序了 👍' });
      return;
    }
    // 沒有對應項目的舊 id（例如刪掉的自訂地點）接在最後，不要弄丟
    const unknown = day.stops.filter((id) => !itemsById.has(id));
    onReorderStops(day.id, [...stops, ...unknown]);
    setOptimizeNote({ dayId: day.id, prev: day.stops, text: `少走 ${formatKm(saved)}` });
  };

  const handleUndo = () => {
    if (!note?.prev) return;
    onReorderStops(note.dayId, note.prev);
    setOptimizeNote(null);
  };

  // ── 全程 ──
  const tripNodes = useMemo(() => {
    const nodes = [];
    days.forEach((d, i) => {
      citiesOfDay(d, itemsById).forEach((key) => {
        const last = nodes[nodes.length - 1];
        if (last && last.key === key) {
          if (!last.days.includes(i + 1)) last.days.push(i + 1);
        } else {
          nodes.push({ key, days: [i + 1] });
        }
      });
    });
    return nodes;
  }, [days, itemsById]);

  const tripLegMinutes = tripNodes.slice(1).reduce((sum, node, i) => sum + (cityLink(tripNodes[i].key, node.key)?.minutes || 0), 0);
  // 還沒排進行程的目的地也列出來（不知道去哪好玩時先逛逛）
  const scheduledCityKeys = new Set(tripNodes.map((node) => node.key));
  const otherCities = TRIP_CITIES.filter((city) => !scheduledCityKeys.has(city.key)).map((city) => ({ key: city.key, days: [] }));
  const videoCityKeys = [...scheduledCityKeys, ...otherCities.map((node) => node.key)];

  // ── 地圖內容（TripPlanner 整頁有 memo，只在行程或選取變動時才重算）──
  const mapData = (() => {
    const markers = [];
    const lines = [];
    if (day) {
      stopItems.forEach((item, i) => {
        const place = placeOf(item);
        if (!located(place)) return;
        const selected = selectedItem?.id === item.id;
        markers.push({
          id: `stop-${item.id}`,
          lat: place.lat,
          lng: place.lng,
          html: stopPin(i + 1, CAT_COLOR[item.cat], selected),
          size: selected ? 36 : 30,
          zIndex: selected ? 2000 : 1000,
          tooltip: `${i + 1}. ${item.name}`,
          onClick: () => selectItem(item),
        });
      });
      candidates.forEach((item) => {
        const place = placeOf(item);
        if (!located(place)) return;
        const selected = selectedItem?.id === item.id;
        markers.push({
          id: `cand-${item.id}`,
          lat: place.lat,
          lng: place.lng,
          html: candidatePin(CAT_EMOJI[item.cat], CAT_COLOR[item.cat], selected),
          size: selected ? 32 : 26,
          zIndex: selected ? 1500 : 0,
          tooltip: item.name,
          onClick: () => selectItem(item),
        });
      });
      segments.forEach((seg) => {
        if (!located(seg.a) || !located(seg.b)) return;
        lines.push({
          id: seg.id,
          positions: seg.path || [
            [seg.a.lat, seg.a.lng],
            [seg.b.lat, seg.b.lng],
          ],
          color: SEG_COLOR[seg.kind] || '#8a755b',
          dashed: !seg.path,
          weight: seg.path ? 5 : 3,
        });
      });
    } else {
      // 城市之間的路線
      tripNodes.forEach((node, i) => {
        const city = CITY_BY_KEY.get(node.key);
        if (exploreCity === 'all') {
          const range = node.days.length > 1 ? `D${node.days[0]}–${node.days[node.days.length - 1]}` : `D${node.days[0]}`;
          markers.push({
            id: `node-${i}`,
            lat: city.center[0],
            lng: city.center[1],
            html: cityPin(`${city.flag} ${city.name}・${range}`),
            size: 30,
            zIndex: 500,
            onClick: () => exploreCityAll(node.key),
          });
        }
        if (i > 0) {
          const prev = CITY_BY_KEY.get(tripNodes[i - 1].key);
          const link = cityLink(prev.key, city.key);
          lines.push({
            id: `leg-${i}`,
            positions: [prev.center, city.center],
            color: '#b07d0a',
            dashed: true,
            weight: 3,
            label: exploreCity === 'all' && link ? `${link.icon} ${formatMinutes(link.minutes)}` : null,
          });
        }
      });
      // 所有地點：排過的顯示第幾天，沒排的顯示類別
      explored.forEach((item) => {
        const place = placeOf(item);
        if (!located(place)) return;
        const selected = selectedItem?.id === item.id;
        const dayNums = scheduledDays.get(item.id);
        markers.push({
          id: `all-${item.id}`,
          lat: place.lat,
          lng: place.lng,
          html: dayNums
            ? stopPin(`D${dayNums[0]}`, CAT_COLOR[item.cat], selected)
            : candidatePin(CAT_EMOJI[item.cat], CAT_COLOR[item.cat], selected),
          size: selected ? 34 : dayNums ? 30 : 26,
          zIndex: selected ? 2000 : dayNums ? 1000 : 0,
          tooltip: dayNums ? `Day ${dayNums.join('、')}・${item.name}` : item.name,
          onClick: () => selectItem(item),
        });
      });
    }
    return { markers, lines };
  })();

  // 取景：只在換天、增減站點、換篩選時重新取景
  const { fitPoints, fitKey } = (() => {
    if (!day) {
      const pts = explored.map(placeOf).filter(located).map((p) => [p.lat, p.lng]);
      if (exploreCity !== 'all' && pts.length) {
        return { fitPoints: pts, fitKey: `all|${exploreCity}|${catFilter}|${exploreMode}|${exploreQuery}` };
      }
      const nodes = tripNodes.map((node) => CITY_BY_KEY.get(node.key).center);
      return {
        fitPoints: nodes.length ? nodes : TRIP_CITIES.map((c) => c.center),
        fitKey: `all|${exploreCity}|${tripNodes.map((n) => n.key).join(',')}`,
      };
    }
    const stopPts = stopItems.map(placeOf).filter(located).map((p) => [p.lat, p.lng]);
    if (stopPts.length) return { fitPoints: stopPts, fitKey: `${day.id}|${[...day.stops].sort().join(',')}` };
    const candPts = candidates.map(placeOf).filter(located).map((p) => [p.lat, p.lng]);
    const cityPts = dayArea.cities.map((k) => CITY_BY_KEY.get(k).center);
    return { fitPoints: candPts.length ? candPts : cityPts, fitKey: `${day.id}|empty|${effectiveScope}|${catFilter}` };
  })();

  const selectedPlace = selectedItem ? placeOf(selectedItem) : null;
  const focusPoint = located(selectedPlace) ? [selectedPlace.lat, selectedPlace.lng] : null;

  // ── 拖拉 ──
  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over) return;
    const [aType, aId] = splitId(active.id);
    const [oType, oId] = splitId(over.id);
    if (aType === 'dayrow') {
      if (oType === 'dayrow' && aId !== oId) {
        const ids = days.map((d) => d.id);
        onReorderDays(arrayMove(ids, ids.indexOf(aId), ids.indexOf(oId)));
      }
      return;
    }
    // 從「所有地點」或「加地點」拖到上方某一天
    if (aType === 'cand' && oType === 'daychip' && oId !== 'all') {
      onAssign(aId, oId);
      return;
    }
    if (!day) return;
    if (aType === 'stop') {
      if (oType === 'stop' && aId !== oId) {
        onReorderStops(day.id, arrayMove(day.stops, day.stops.indexOf(aId), day.stops.indexOf(oId)));
      } else if (oType === 'daychip' && oId !== day.id && oId !== 'all') {
        onMoveStop(aId, day.id, oId);
      } else if (oType === 'candlist') {
        onUnassign(aId, day.id);
      }
    } else if (aType === 'cand') {
      if (oType === 'stop') onAssign(aId, day.id, day.stops.indexOf(oId));
      else if (oType === 'stoplist') onAssign(aId, day.id);
    }
  };

  const activeItem = (() => {
    if (!activeId) return null;
    const [type, id] = splitId(activeId);
    if (type === 'dayrow') {
      const i = days.findIndex((d) => d.id === id);
      return i >= 0 ? { label: `Day ${i + 1} ${days[i].place || ''}` } : null;
    }
    const item = itemsById.get(id);
    return item ? { item, label: `${CAT_EMOJI[item.cat]} ${item.name}` } : null;
  })();

  const panelClass = (panel) => `${mobilePanel === panel ? 'flex' : 'hidden'} lg:flex`;
  const mobileTabs = day
    ? [
        ['plan', '📋 行程'],
        ['detail', '📸 介紹'],
        ['map', '🗺 地圖・加地點'],
      ]
    : [
        ['plan', '📋 所有地點'],
        ['detail', selectedItem ? '📸 介紹' : '🏙 總覽'],
        ['map', '🗺 地圖'],
      ];

  const selectedScheduled = selectedItem ? scheduledDays.get(selectedItem.id) || [] : [];
  const detailStatus =
    day && selectedItem
      ? {
          dayLabel: `Day ${dayIndex + 1}`,
          inDay: day.stops.includes(selectedItem.id),
          stopNumber: stopItems.findIndex((item) => item.id === selectedItem.id) + 1,
          scheduledDays: selectedScheduled,
        }
      : { scheduledDays: selectedScheduled };
  const dayOptions = days.map((d, i) => {
    const dDate = tripDateOf(startDate, i);
    const cities = citiesOfDay(d, itemsById).map((k) => CITY_BY_KEY.get(k).name).join('→');
    return {
      id: d.id,
      label: `Day ${i + 1}${dDate ? ` ${formatTripDate(dDate)}` : ''}${cities ? ` ${cities}` : ''}`,
      has: selectedItem ? d.stops.includes(selectedItem.id) : false,
    };
  });
  const videosFor = (item) => (item ? TRIP_VIDEOS.byItem[item.id] || TRIP_VIDEOS.byCity[item.city] || [] : []);

  const mapBox = (className) => (
    <div className={`relative ${className}`}>
      <TripLeafletMap
        markers={mapData.markers}
        lines={mapData.lines}
        fitPoints={fitPoints}
        fitKey={fitKey}
        focus={focusPoint}
        className="h-full"
      />
      <button
        onClick={() => setBigMap(true)}
        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-[#fdf9f1]/95 border-2 border-[#e6dac1] px-2 py-1 text-[11px] font-black text-[#6b5540] shadow hover:border-[#daa520]"
        title="放大地圖"
      >
        <Maximize2 size={12} />
        放大地圖
      </button>
    </div>
  );

  const detailPanel = (
    <TripPlaceDetail
      item={selectedItem}
      pick={selectedItem ? picksById.get(selectedItem.id) : null}
      status={detailStatus}
      onAdd={(it) => day && onAssign(it.id, day.id)}
      onRemove={(it) => day && onUnassign(it.id, day.id)}
      onUpdatePick={onUpdatePick}
      onOpenCard={onOpenItem}
      onBack={!day && selectedItem ? () => setSelectedId(null) : undefined}
      dayOptions={!day ? dayOptions : undefined}
      onAddToDay={(it, dayId) => onAssign(it.id, dayId)}
      videos={videosFor(selectedItem)}
      onPlayVideo={setPlaying}
    />
  );

  const catChips = (
    <div className="flex gap-1 overflow-x-auto">
      {[['all', '全部'], ...TRIP_CATEGORIES.map((c) => [c.key, `${c.emoji} ${c.label}`])].map(([key, label]) => (
        <FilterChip
          key={key}
          dark
          active={catFilter === key}
          onClick={() => {
            setCatFilter(key);
            setListLimit(LIST_PAGE);
          }}
        >
          {label}
        </FilterChip>
      ))}
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div ref={workspaceRef} className="flex flex-col gap-2.5 min-h-0">
        {/* 日期列：點了切換；把地點拖到某天的標籤上就排進那天 */}
        <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 parchment-scrollbar">
          <DayChip id="all" title="🌍 全程・所有地點" sub="" active={!day} droppable={false} onClick={() => selectDay('all')} />
          {days.map((d, i) => {
            const dDate = tripDateOf(startDate, i);
            const cities = citiesOfDay(d, itemsById);
            return (
              <DayChip
                key={d.id}
                id={d.id}
                title={`D${i + 1}`}
                sub={[
                  dDate ? formatTripDate(dDate).split('（')[0] : null,
                  cities.length
                    ? cities.map((k) => CITY_BY_KEY.get(k).name).join('→')
                    : findPlacesInText(dayLocationText(d), TRIP_COUNTRIES).map((c) => c.name).join('→'),
                ]
                  .filter(Boolean)
                  .join(' ')}
                count={d.stops.length}
                active={d.id === day?.id}
                droppable={d.id !== day?.id}
                onClick={() => selectDay(d.id)}
              />
            );
          })}
        </div>

        <div className="lg:hidden shrink-0 grid grid-cols-3 gap-1 bg-[#f3e9d6] border-2 border-[#e6dac1] rounded-xl p-1">
          {mobileTabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMobilePanel(key)}
              className={`py-1.5 rounded-lg text-[12px] font-black ${
                mobilePanel === key ? 'bg-[#fff7e3] text-[#b07d0a] shadow-[0_2px_0_#d8c4a0]' : 'text-[#9a8568]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {day ? (
          <div className={`flex-1 min-h-0 grid gap-2.5 ${DAY_GRID}`}>
            {/* ── 左：當天行程 ── */}
            <section className={`${panelClass('plan')} ${CARD} flex-col`}>
              <div className="shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-[#b07d0a] text-[15px]" style={ELLIPSIS}>
                      Day {dayIndex + 1}
                      {date ? <span className="ml-1.5 text-[12px] text-[#9a8568]">{formatTripDate(date)}</span> : null}
                    </div>
                    <div className="text-[11px] font-bold text-[#6b5540]" style={ELLIPSIS} title={`${day.place} ${day.plan}`}>
                      {day.place || '（還沒填地點）'}
                      {day.plan ? `：${day.plan}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => dayIndex > 0 && selectDay(days[dayIndex - 1].id)}
                      disabled={dayIndex === 0}
                      className="p-1 rounded-lg border-2 border-[#e6dac1] text-[#9a8568] hover:border-[#daa520] disabled:opacity-40"
                      title="前一天"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      onClick={() => dayIndex < days.length - 1 && selectDay(days[dayIndex + 1].id)}
                      disabled={dayIndex === days.length - 1}
                      className="p-1 rounded-lg border-2 border-[#e6dac1] text-[#9a8568] hover:border-[#daa520] disabled:opacity-40"
                      title="後一天"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
                {dayBadges.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dayBadges.map((badge) => (
                      <span
                        key={badge.key}
                        title={badge.title}
                        className={`rounded-lg px-1.5 py-0.5 text-[10px] font-black ${
                          badge.warn ? 'bg-[#fdebc8] text-[#9a5b0a]' : 'bg-[#e8f7e9] text-[#166534]'
                        }`}
                      >
                        {badge.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <DropZone
                id="stoplist"
                className="mt-2 flex-1 min-h-0 overflow-y-auto parchment-scrollbar rounded-xl border-2 border-dashed border-transparent p-0.5 pr-1 transition-colors"
                activeClass="border-[#daa520] bg-[#fff7e3]"
              >
                {stopItems.length === 0 ? (
                  <div className="space-y-2">
                    <div className="rounded-xl border-2 border-dashed border-[#e0d3b6] px-3 py-5 text-center text-[12px] font-bold text-[#9a8568]" style={WRAP}>
                      這天還沒排地點。從右邊把想去的拖進來、按 ＋，或點地圖上的圓圈先看介紹。
                    </div>
                    {dayRoutes.length > 0 && onApplyRoute && (
                      <div className="space-y-1.5">
                        <div className="text-[12px] font-black text-[#b07d0a]" style={WRAP}>
                          還沒決定這幾天去哪？套用一條路線，地點會自動填好：
                        </div>
                        {dayRoutes.map(({ route, entry }) => (
                          <div key={route.id} className="rounded-xl border-2 border-[#e6dac1] bg-[#f7f0e2] p-2">
                            <div className="text-[12px] font-black text-[#4a3526]" style={WRAP}>
                              {route.title}
                            </div>
                            <div className="text-[11px] font-bold text-[#8a755b]" style={WRAP}>
                              這天：{entry.place}
                            </div>
                            <div className="text-[11px] font-bold text-[#9a8568]" style={WRAP}>
                              {route.summary}
                            </div>
                            <button
                              onClick={() => onApplyRoute(route)}
                              className="mt-1 rounded-lg bg-gradient-to-b from-[#f3c44e] to-[#dca01d] px-2.5 py-1 text-[11px] font-black text-[#5a3c0e]"
                            >
                              套用 Day {route.from}–{route.from + route.days.length - 1}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <SortableContext items={stopItems.map((item) => `stop:${item.id}`)} strategy={verticalListSortingStrategy}>
                    {stopItems.map((item, i) => (
                      <Fragment key={item.id}>
                        {i > 0 && <SegmentInfo seg={segments[i - 1]} />}
                        <StopRow
                          item={item}
                          index={i}
                          pick={picksById.get(item.id)}
                          selected={selectedItem?.id === item.id}
                          onSelect={selectItem}
                          onRemove={(it) => onUnassign(it.id, day.id)}
                        />
                      </Fragment>
                    ))}
                  </SortableContext>
                )}
              </DropZone>

              <div className="shrink-0 mt-2 space-y-1.5">
                {stopItems.length > 0 && (
                  <div className="rounded-xl bg-[#f7f0e2] border-2 border-[#e6dac1] px-2.5 py-1.5 text-[11px] font-bold text-[#6b5540] space-y-0.5">
                    <div className="font-black text-[#4a3526]" style={WRAP}>
                      ⏳ 這天約 {formatMinutes(totals.load)}
                      <span className="font-bold text-[#8a755b]" style={WRAP}>
                        （停留 {formatMinutes(totals.visitMin)}＋移動 {formatMinutes(totals.walkMin + totals.transitMin)}）
                      </span>
                    </div>
                    {(totals.walkKm > 0 || totals.transitMin > 0) && (
                      <div style={ELLIPSIS}>
                        {totals.walkKm > 0 ? `🚶 ${formatKm(totals.walkKm)}・${formatMinutes(totals.walkMin)}` : ''}
                        {totals.estimated ? '（估）' : ''}
                        {totals.transitMin > 0 ? ` · 🚇 約 ${formatMinutes(totals.transitMin)}` : ''}
                      </div>
                    )}
                    {totals.long.map((seg) => (
                      <div key={seg.id} style={ELLIPSIS} title={seg.text}>
                        {seg.icon} {seg.text}
                      </div>
                    ))}
                    {totals.load > LONG_DAY_MINUTES && (
                      <div className="text-[#9a5b0a]" style={WRAP}>
                        ⚠️ 超過 10 小時，冬天 4 點多天黑，考慮拖一兩個到別天
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleOptimize}
                    disabled={freeLocated < 2}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] text-[12px] font-black shadow-[0_3px_0_#a9760a] active:translate-y-0.5 active:shadow-[0_1px_0_#a9760a] transition-all disabled:opacity-50 disabled:shadow-none flex items-center gap-1"
                    title="交通和住宿不動，只重排中間的景點和餐廳"
                  >
                    <Sparkles size={13} />
                    順路優化
                  </button>
                  {note && (
                    <span className="min-w-0 text-[11px] font-bold text-[#166534]" style={ELLIPSIS}>
                      {note.text}
                    </span>
                  )}
                  {note?.prev && (
                    <button
                      onClick={handleUndo}
                      className="ml-auto shrink-0 px-2 py-1 rounded-lg border-2 border-[#e6dac1] text-[11px] font-black text-[#8a755b] hover:border-[#daa520] flex items-center gap-1"
                    >
                      <Undo2 size={11} />
                      復原
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* ── 中：地點介紹 ── */}
            <section className={`${panelClass('detail')} ${CARD} flex-col`}>{detailPanel}</section>

            {/* ── 右：地圖＋可以加的地點 ── */}
            <div className={`${panelClass('map')} flex-col gap-2.5 min-h-0 min-w-0`}>
              {mapBox('shrink-0 h-[50%] min-h-[220px] lg:h-[55%]')}
              <DropZone id="candlist" className={`${CARD} flex-1 flex flex-col transition-colors`} activeClass="border-[#c0392b]! bg-[#fdf1ee]!">
                <div className="shrink-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-black text-[#b07d0a] text-[13px]">加地點</h4>
                    <div className="flex gap-1">
                      {[
                        ['city', '這天的城市'],
                        ['star', '⭐'],
                        ['all', '全部'],
                      ].map(([key, label]) => (
                        <FilterChip
                          key={key}
                          active={effectiveScope === key}
                          onClick={() => {
                            setScope(key);
                            setListLimit(LIST_PAGE);
                          }}
                        >
                          {label}
                        </FilterChip>
                      ))}
                    </div>
                  </div>
                  {catChips}
                  {effectiveScope === 'city' && dayArea.source !== 'day' && dayArea.cities.length > 0 && (
                    <div className="rounded-lg bg-[#fff7e3] px-2 py-1 text-[11px] font-bold text-[#8a5a0a]" style={WRAP}>
                      {dayArea.source === 'country'
                        ? `這天只寫到「${dayArea.label}」，先列出${dayArea.label}的城市：`
                        : '這天還沒寫城市，先列出路線建議會去的：'}
                      {dayArea.cities.map((k) => CITY_BY_KEY.get(k).name).join('・')}
                    </div>
                  )}
                </div>
                <div className="mt-2 flex-1 min-h-0 overflow-y-auto parchment-scrollbar pr-1 space-y-1.5">
                  {candidates.length === 0 ? (
                    <div className="py-4 text-center text-[12px] font-bold text-[#9a8568]" style={WRAP}>
                      {effectiveScope === 'star' ? (
                        '還沒有收藏，看介紹時按 ⭐ 就會出現在這裡。'
                      ) : effectiveScope === 'city' && dayArea.cities.length === 0 ? (
                        <>
                          這天還沒寫要去哪個城市。到「行程表」填地點，或先看
                          <button onClick={() => setScope('all')} className="mx-1 underline text-[#b07d0a]">
                            全部地點
                          </button>
                          。
                        </>
                      ) : (
                        '這裡沒有更多地點了。'
                      )}
                    </div>
                  ) : (
                    candidates.slice(0, listLimit).map((item) => (
                      <PlaceRow
                        key={item.id}
                        item={item}
                        pick={picksById.get(item.id)}
                        scheduled={scheduledDays.get(item.id)}
                        selected={selectedItem?.id === item.id}
                        onSelect={selectItem}
                        onAdd={(it) => onAssign(it.id, day.id)}
                      />
                    ))
                  )}
                  {candidates.length > listLimit && (
                    <button
                      onClick={() => setListLimit((n) => n + LIST_PAGE)}
                      className="w-full py-1.5 rounded-xl border-2 border-dashed border-[#daa520] text-[12px] font-black text-[#b07d0a] hover:bg-[#fff7e3]"
                    >
                      再顯示 {Math.min(LIST_PAGE, candidates.length - listLimit)} 個
                    </button>
                  )}
                </div>
              </DropZone>
            </div>
          </div>
        ) : (
          <div className={`flex-1 min-h-0 grid gap-2.5 ${ALL_GRID}`}>
            {/* ── 左：所有地點（不管日期） ── */}
            <section className={`${panelClass('plan')} ${CARD} flex-col`}>
              <div className="shrink-0 space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-black text-[#b07d0a] text-[15px]">所有地點</div>
                  <div className="text-[11px] font-black text-[#9a8568]">{explored.length} 個</div>
                </div>
                <label className="flex items-center gap-1.5 rounded-xl border-2 border-[#e6dac1] bg-[#f7f0e2] px-2 py-1 focus-within:border-[#daa520]">
                  <Search size={13} className="text-[#b3a084] shrink-0" />
                  <input
                    value={exploreQuery}
                    onChange={(e) => {
                      setExploreQuery(e.target.value);
                      setListLimit(LIST_PAGE);
                    }}
                    placeholder="搜尋：城堡、市集、咖啡…"
                    className="min-w-0 flex-1 bg-transparent text-[12px] font-bold text-[#4a3526] placeholder:text-[#c0ad8c] focus:outline-none"
                  />
                </label>
                <div className="flex gap-1 overflow-x-auto pb-0.5">
                  <FilterChip active={exploreCity === 'all'} onClick={() => exploreCityAll('all')}>
                    全部城市
                  </FilterChip>
                  {TRIP_CITIES.filter((c) => cityCounts.get(c.key)).map((c) => (
                    <FilterChip key={c.key} active={exploreCity === c.key} onClick={() => exploreCityAll(c.key)}>
                      {c.flag} {c.name}
                    </FilterChip>
                  ))}
                </div>
                {catChips}
                <div className="flex gap-1">
                  {[
                    ['all', '全部'],
                    ['star', '⭐ 收藏'],
                    ['scheduled', '已排'],
                    ['unscheduled', '還沒排'],
                  ].map(([key, label]) => (
                    <FilterChip
                      key={key}
                      active={exploreMode === key}
                      onClick={() => {
                        setExploreMode(key);
                        setListLimit(LIST_PAGE);
                      }}
                    >
                      {label}
                    </FilterChip>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex-1 min-h-0 overflow-y-auto parchment-scrollbar pr-1 space-y-1.5">
                {explored.length === 0 ? (
                  <div className="py-6 text-center text-[12px] font-bold text-[#9a8568]" style={WRAP}>
                    沒有符合的地點，換個篩選看看。
                  </div>
                ) : (
                  explored.slice(0, listLimit).map((item) => (
                    <PlaceRow
                      key={item.id}
                      item={item}
                      pick={picksById.get(item.id)}
                      scheduled={scheduledDays.get(item.id)}
                      selected={selectedItem?.id === item.id}
                      onSelect={selectItem}
                    />
                  ))
                )}
                {explored.length > listLimit && (
                  <button
                    onClick={() => setListLimit((n) => n + LIST_PAGE)}
                    className="w-full py-1.5 rounded-xl border-2 border-dashed border-[#daa520] text-[12px] font-black text-[#b07d0a] hover:bg-[#fff7e3]"
                  >
                    再顯示 {Math.min(LIST_PAGE, explored.length - listLimit)} 個
                  </button>
                )}
              </div>
              <div className="shrink-0 mt-2 text-[10px] font-bold text-[#b3a084]" style={WRAP}>
                點一下看介紹；按住 ⠿ 拖到上方某一天就排進去。
              </div>
            </section>

            {/* ── 中：選到的地點介紹；沒選就是旅程總覽 ── */}
            <section className={`${panelClass('detail')} ${CARD} flex-col`}>
              {selectedItem ? (
                detailPanel
              ) : (
                <>
                  <div className="shrink-0 flex flex-wrap items-baseline justify-between gap-2">
                    <div className="font-black text-[#b07d0a] text-[15px]">旅程總覽</div>
                    <div className="text-[11px] font-black text-[#8a755b]">
                      已排 {scheduledCityKeys.size} ／ {TRIP_CITIES.length} 個城市
                      {tripLegMinutes > 0 ? `・城市間移動約 ${formatMinutes(tripLegMinutes)}` : ''}
                    </div>
                  </div>
                  <div className="mt-2 flex-1 min-h-0 overflow-y-auto parchment-scrollbar pr-1 space-y-4">
                    {tripNodes.length === 0 ? (
                      <div className="text-[12px] font-bold text-[#9a8568]" style={WRAP}>
                        行程表的地點還沒寫到城市。到「行程表」填地點或套用路線建議，排好的城市會照順序排在最前面。
                      </div>
                    ) : (
                      <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                        {tripNodes.map((node, i) => (
                          <CityCard
                            key={`${node.key}-${i}`}
                            node={node}
                            next={tripNodes[i + 1]}
                            stops={node.days
                              .flatMap((n) => days[n - 1].stops.map((id) => itemsById.get(id)).filter(Boolean))
                              .filter((item) => item.cat !== 'move')}
                            onOpenDay={(n) => selectDay(days[n - 1].id)}
                            onExplore={exploreCityAll}
                          />
                        ))}
                      </div>
                    )}

                    {otherCities.length > 0 && (
                      <div>
                        <div className="text-[13px] font-black text-[#b07d0a] mb-1.5">
                          {tripNodes.length ? '其他目的地（還沒排進行程）' : '所有目的地'}
                        </div>
                        <div className="grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-3">
                          {otherCities.map((node) => (
                            <CityCard key={node.key} node={node} stops={[]} onOpenDay={() => {}} onExplore={exploreCityAll} />
                          ))}
                        </div>
                      </div>
                    )}

                    {videoCityKeys.some((key) => TRIP_VIDEOS.byCity[key]?.length) && (
                      <div>
                        <div className="text-[13px] font-black text-[#b07d0a] mb-1.5">🎬 先看影片感受一下</div>
                        <div className="flex gap-2 overflow-x-auto pb-1 parchment-scrollbar">
                          {videoCityKeys.flatMap((key) =>
                            (TRIP_VIDEOS.byCity[key] || []).map((video) => (
                              <VideoCard key={video.id} video={video} onPlay={setPlaying} compact />
                            )),
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-[13px] font-black text-[#b07d0a]">調整天數順序</div>
                      <div className="text-[11px] font-bold text-[#9a8568] mb-1.5" style={WRAP}>
                        按住 ⠿ 拖曳（日期跟著位置變），點某天開始排。
                      </div>
                      <SortableContext items={days.map((d) => `dayrow:${d.id}`)} strategy={verticalListSortingStrategy}>
                        {days.map((d, i) => {
                          const cities = citiesOfDay(d, itemsById);
                          const prevCities = i > 0 ? citiesOfDay(days[i - 1], itemsById) : [];
                          const prevLast = prevCities[prevCities.length - 1];
                          return (
                            <Fragment key={d.id}>
                              {prevLast && cities[0] && prevLast !== cities[0] && <LegLine from={prevLast} to={cities[0]} />}
                              <TripDayRow
                                day={d}
                                index={i}
                                date={tripDateOf(startDate, i)}
                                cities={cities}
                                stopCount={d.stops.length}
                                onOpen={selectDay}
                              />
                              {cities.slice(1).map((key, j) => (
                                <LegLine key={key} from={cities[j]} to={key} />
                              ))}
                            </Fragment>
                          );
                        })}
                      </SortableContext>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* ── 右：大地圖 ── */}
            <div className={`${panelClass('map')} flex-col min-h-0 min-w-0`}>{mapBox('h-full min-h-[260px]')}</div>
          </div>
        )}
      </div>

      {/* 放大地圖：蓋在整個畫面上，點圖釘會在下方出現小卡 */}
      {bigMap && (
        <div className="fixed inset-0 z-[300] bg-black/60 p-3 md:p-6 flex flex-col" onClick={() => setBigMap(false)}>
          <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-[#fdf9f1]" onClick={(e) => e.stopPropagation()}>
            <TripLeafletMap
              markers={mapData.markers}
              lines={mapData.lines}
              fitPoints={fitPoints}
              fitKey={`big|${fitKey}`}
              focus={focusPoint}
              className="h-full"
            />
            <button
              onClick={() => setBigMap(false)}
              title="關閉（Esc）"
              className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl bg-[#fdf9f1] border-2 border-[#e6dac1] px-3 py-1.5 text-[12px] font-black text-[#6b5540] shadow hover:border-[#daa520]"
            >
              <X size={14} />
              關閉
            </button>
            {selectedItem && (
              <div className="absolute left-3 bottom-3 z-10 w-[min(340px,calc(100%-24px))] rounded-2xl bg-[#fdf9f1] border-2 border-[#e6dac1] shadow-xl overflow-hidden flex">
                <SafeImg
                  key={selectedPlace?.img}
                  src={selectedPlace?.thumb || selectedPlace?.img}
                  className="w-28 h-28 object-cover shrink-0"
                  fallback={<div className="w-28 h-28 bg-[#f0e5d0] flex items-center justify-center text-3xl shrink-0">{CAT_EMOJI[selectedItem.cat]}</div>}
                />
                <div className="min-w-0 p-2.5 flex flex-col">
                  <div className="text-[14px] font-black text-[#4a3526] leading-tight" style={WRAP}>
                    {selectedItem.name}
                  </div>
                  <div className="mt-0.5 text-[11px] font-bold text-[#8a5a0a] line-clamp-2" style={WRAP}>
                    {TRIP_INSIGHTS[selectedItem.id]?.tagline || selectedItem.local}
                  </div>
                  <button
                    onClick={() => {
                      setBigMap(false);
                      setMobilePanel('detail');
                    }}
                    className="mt-auto self-start rounded-lg bg-gradient-to-b from-[#f3c44e] to-[#dca01d] px-2.5 py-1 text-[11px] font-black text-[#5a3c0e]"
                  >
                    看完整介紹 →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <VideoModal video={playing} onClose={() => setPlaying(null)} />

      <DragOverlay dropAnimation={null}>
        {activeItem ? (
          <div className="flex items-center gap-2 rounded-xl border-2 border-[#daa520] bg-[#fff7e3] px-2.5 py-1.5 shadow-[0_8px_20px_rgba(120,90,55,0.3)] text-[12px] font-black text-[#4a3526]">
            {activeItem.item && <Thumb item={activeItem.item} size="w-7 h-7" />}
            {activeItem.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
