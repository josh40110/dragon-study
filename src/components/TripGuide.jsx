import { useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, MapPin, Plus, Star, Trash2, X } from 'lucide-react';
import { TRIP_CATEGORIES, TRIP_CITIES, TRIP_EVENTS, TRIP_LEGS } from '../constants/tripGuide';
import { TRIP_INSIGHTS } from '../constants/tripInsights';
import { eventClosedReason, eventStatusOn, formatTripDate, tripDateOf } from '../utils/tripDates';
import { placeOf } from '../utils/tripGeo';
import TripEditableText from './TripEditableText';

/** 全站 index.css 的 unlayered `p/span { white-space: nowrap }` 會壓過 utility class */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const CITY_BY_KEY = new Map(TRIP_CITIES.map((city) => [city.key, city]));
const EVENTS_BY_ID = new Map(TRIP_EVENTS.map((event) => [event.id, event]));
const ROLE_LABEL = { left: '呱呱', right: '花花' };
const STAR_LABEL = { move: '候選', fun: '想去', food: '想吃', stay: '候選' };

const LINK_CLASS =
  'inline-flex items-center gap-1 text-[12px] font-black text-[#2f6db5] bg-[#eaf2fc] hover:bg-[#dbe8f8] rounded-lg px-2 py-1 transition-colors';

function mapUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** 自己加的連結只接受 http(s)，避免 javascript: 之類的網址被點開 */
function isSafeUrl(url) {
  return /^https?:\/\/\S+$/i.test(url || '');
}

function isPicked(pick, scheduled) {
  return scheduled || Boolean(pick && (pick.star || pick.booked || pick.memo));
}

/** 卡片上方的照片；授權照片要標作者，不是那個地方本身的照片標「示意圖」 */
function ItemPhoto({ item }) {
  const place = placeOf(item);
  const [failed, setFailed] = useState(false);
  // 圖片載入失敗（沒網路、外部圖被移除）就整塊不顯示，不要留破圖
  if (!place?.img || failed) return null;
  const credit = place.credit;
  return (
    <div className="relative -mx-4 -mt-4 mb-1 h-36 overflow-hidden rounded-t-[14px] bg-[#e6dac1]">
      <img
        src={place.thumb || place.img}
        alt={item.name}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
      {place.note && (
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white">
          {place.note}圖
        </span>
      )}
      {credit && (
        <a
          href={credit.url}
          target="_blank"
          rel="noreferrer"
          title={`照片：${credit.author}／${credit.license}（Wikimedia Commons）`}
          className="absolute bottom-1.5 right-1.5 max-w-[75%] truncate rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white/90 hover:bg-black/70"
        >
          © {credit.author}・{credit.license}
        </a>
      )}
    </div>
  );
}

function ItemCard({ item, pick, dayOptions, focused, showCity, onUpdatePick, onAssign, onUnassign, onRemoveCustom }) {
  const city = CITY_BY_KEY.get(item.city);
  const event = item.event ? EVENTS_BY_ID.get(item.event) : null;
  const star = Boolean(pick?.star);
  const booked = Boolean(pick?.booked);
  const assigned = dayOptions.filter((d) => d.stops.includes(item.id));
  const closedDays = event ? assigned.filter((d) => eventStatusOn(event, d.date) === 'closed') : [];
  const hasLinks = Boolean(item.map || item.links?.length || isSafeUrl(item.url));
  const insight = TRIP_INSIGHTS[item.id];

  return (
    <article
      id={`trip-item-${item.id}`}
      className={`rounded-2xl border-2 bg-[#f7f0e2] p-4 flex flex-col gap-2.5 transition-shadow scroll-mt-40 ${
        focused
          ? 'border-[#daa520] shadow-[0_0_0_4px_rgba(243,196,78,0.55)]'
          : star || booked || assigned.length > 0
            ? 'border-[#e0c178]'
            : 'border-[#e6dac1]'
      }`}
    >
      <ItemPhoto item={item} />
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            {showCity && city && (
              <span className="text-[11px] font-black text-[#8a755b] bg-[#f0e5d0] rounded-full px-2 py-0.5">
                {city.flag} {city.name}
              </span>
            )}
            {item.custom && (
              <span className="text-[11px] font-black text-[#3b5bab] bg-[#e8eefc] rounded-full px-2 py-0.5">
                {ROLE_LABEL[item.by] || '我們'}加的
              </span>
            )}
            {item.verify && (
              <span
                className="text-[11px] font-black text-[#9a5b0a] bg-[#fdebc8] rounded-full px-2 py-0.5"
                title="票價、時刻或營業日每年會變，出發前以官網為準"
              >
                出發前再確認
              </span>
            )}
          </div>
          <h4 className="font-black text-[16px] text-[#4a3526] leading-snug" style={WRAP}>
            {item.name}
          </h4>
          {item.local && (
            <div className="text-[12px] font-bold text-[#9a8568] mt-0.5" style={WRAP}>
              {item.local}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {item.custom && (
            <button
              onClick={() => onRemoveCustom(item)}
              className="p-1.5 rounded-lg text-[#c4b291] hover:text-[#c0392b] hover:bg-[#f3e9d6] transition-colors"
              title="刪除這筆"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => onUpdatePick(item.id, { star: !star })}
            className={`px-2.5 py-1.5 rounded-xl border-2 text-[12px] font-black flex items-center gap-1 transition-colors ${
              star
                ? 'bg-[#fff3c4] border-[#daa520] text-[#b07d0a]'
                : 'bg-[#fdf9f1] border-[#e6dac1] text-[#9a8568] hover:border-[#daa520]'
            }`}
            title={star ? '取消標記' : `標成${STAR_LABEL[item.cat]}`}
          >
            <Star size={14} fill={star ? '#daa520' : 'none'} />
            {STAR_LABEL[item.cat]}
          </button>
        </div>
      </div>

      {insight?.tagline && (
        <p className="text-[13px] font-black text-[#8a5a0a]" style={WRAP}>
          「{insight.tagline}」
        </p>
      )}

      {insight?.highlights?.length > 0 && (
        <ul className="space-y-0.5">
          {insight.highlights.map((text) => (
            <li key={text} className="text-[12px] font-bold text-[#4a3526] leading-snug" style={WRAP}>
              ✦ {text}
            </li>
          ))}
        </ul>
      )}

      {item.desc && (
        <p className="text-[13px] font-bold text-[#6b5540] leading-relaxed" style={WRAP}>
          {item.desc}
        </p>
      )}

      {(insight?.praise?.length > 0 || insight?.gripes?.length > 0) && (
        <details className="rounded-xl bg-[#fdf9f1] border border-[#e6dac1] px-2.5 py-1.5">
          <summary className="cursor-pointer text-[12px] font-black text-[#b07d0a]">💬 網友怎麼說</summary>
          <div className="mt-1.5 space-y-1">
            {(insight.praise || []).map((text) => (
              <p key={text} className="text-[12px] font-bold text-[#2d5a3a]" style={WRAP}>
                👍 {text}
              </p>
            ))}
            {(insight.gripes || []).map((text) => (
              <p key={text} className="text-[12px] font-bold text-[#7a4a10]" style={WRAP}>
                👎 {text}
              </p>
            ))}
            <p className="text-[10px] font-bold text-[#b3a084]" style={WRAP}>
              整理自公開評論與遊記的常見說法，非逐字引用；地圖頁的介紹有看原始評論的連結。
            </p>
          </div>
        </details>
      )}

      {(item.time || item.cost || item.when) && (
        <div className="flex flex-col gap-1">
          {item.when && (
            <div className="text-[12px] font-black text-[#4a3526]" style={WRAP}>
              🗓 {item.when}
            </div>
          )}
          {item.time && (
            <div className="text-[12px] font-black text-[#4a3526]" style={WRAP}>
              ⏱ {item.time}
            </div>
          )}
          {item.cost && (
            <div className="text-[12px] font-black text-[#4a3526]" style={WRAP}>
              💰 {item.cost}
            </div>
          )}
        </div>
      )}

      {item.tips?.length > 0 && (
        <ul className="space-y-1">
          {item.tips.map((tip) => (
            <li key={tip} className="text-[12px] font-bold text-[#8a6d3b] leading-relaxed" style={WRAP}>
              💡 {tip}
            </li>
          ))}
        </ul>
      )}

      {hasLinks && (
        <div className="flex flex-wrap gap-1.5">
          {item.map && (
            <a href={mapUrl(item.map)} target="_blank" rel="noreferrer" className={LINK_CLASS}>
              <MapPin size={12} />
              地圖
            </a>
          )}
          {item.links?.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className={LINK_CLASS}>
              <ExternalLink size={12} />
              {link.label}
            </a>
          ))}
          {isSafeUrl(item.url) && (
            <a href={item.url} target="_blank" rel="noreferrer" className={LINK_CLASS}>
              <ExternalLink size={12} />
              連結
            </a>
          )}
        </div>
      )}

      <div className="mt-auto pt-2.5 border-t-2 border-dashed border-[#e6dac1] space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {assigned.map((d) => {
            const closed = closedDays.includes(d);
            return (
              <span
                key={d.id}
                className={`inline-flex items-center gap-1 rounded-xl border-2 pl-2.5 pr-1 py-0.5 text-[12px] font-black ${
                  closed ? 'border-[#e0a33a] bg-[#fdebc8] text-[#9a5b0a]' : 'border-[#daa520] bg-[#fff7e3] text-[#b07d0a]'
                }`}
              >
                {closed ? '⚠️' : '📅'} Day {d.index + 1}
                {d.date ? ` · ${formatTripDate(d.date)}` : ''}
                <button
                  onClick={() => onUnassign(item.id, d.id)}
                  className="p-0.5 rounded hover:text-[#c0392b]"
                  title="從這天移除"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}

          <select
            value=""
            onChange={(e) => {
              if (e.target.value) onAssign(item.id, e.target.value);
            }}
            className="w-36 px-2 py-1 rounded-xl border-2 border-[#e6dac1] bg-[#fdf9f1] text-[12px] font-black text-[#8a755b] hover:border-[#daa520] focus:outline-none focus:border-[#daa520] cursor-pointer"
            aria-label="排進哪天"
          >
            <option value="">＋ 排進哪天</option>
            {dayOptions.map((d) => (
              <option key={d.id} value={d.id} disabled={d.stops.includes(item.id)}>
                Day {d.index + 1}
                {d.date ? ` · ${formatTripDate(d.date)}` : ''}
                {d.place ? ` · ${d.place}` : ''}
              </option>
            ))}
          </select>

          <button
            onClick={() => onUpdatePick(item.id, { booked: !booked })}
            className={`px-2.5 py-1 rounded-xl border-2 text-[12px] font-black flex items-center gap-1 transition-colors ${
              booked
                ? 'bg-[#e8f7e9] border-[#16a34a] text-[#166534]'
                : 'bg-[#fdf9f1] border-[#e6dac1] text-[#9a8568] hover:border-[#16a34a]'
            }`}
            title={booked ? '改回還沒訂' : '訂好了就點一下'}
          >
            <span
              className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center ${
                booked ? 'bg-[#16a34a] border-[#16a34a] text-white' : 'border-[#c4b291]'
              }`}
            >
              {booked && <Check size={10} strokeWidth={4} />}
            </span>
            {item.cat === 'food' ? '已訂位' : '已訂'}
          </button>
        </div>

        {closedDays.length > 0 && (
          <div className="text-[12px] font-bold text-[#9a5b0a]" style={WRAP}>
            ⚠️ Day {closedDays.map((d) => d.index + 1).join('、')}：{eventClosedReason(event)}
          </div>
        )}

        <TripEditableText
          tone="boxed"
          value={pick?.memo || ''}
          placeholder="備註（例如：選哪一班、幾點集合）"
          label={`${item.name} 備註`}
          onSave={(memo) => onUpdatePick(item.id, { memo })}
        />
      </div>
    </article>
  );
}

function AddCustomForm({ cat, catLabel, defaultCity, onAdd }) {
  const [name, setName] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [desc, setDesc] = useState('');
  const [url, setUrl] = useState('');
  const cleanUrl = url.trim();
  const urlInvalid = cleanUrl !== '' && !isSafeUrl(cleanUrl);

  const [status, setStatus] = useState(null);

  const submit = async () => {
    const cleanName = name.trim();
    if (!cleanName || urlInvalid || status === 'saving') return;
    setStatus('saving');
    const located = await onAdd({ cat, city, name: cleanName, desc: desc.trim(), url: cleanUrl });
    setName('');
    setDesc('');
    setUrl('');
    setStatus(located ? 'located' : 'unlocated');
  };

  const inputClass =
    'w-full min-w-0 px-3 py-2.5 rounded-2xl border-2 border-[#e6dac1] bg-[#f7f0e2] text-[#4a3526] font-bold focus:outline-none focus:border-[#daa520] placeholder:text-[#c0ad8c]';

  return (
    <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-5 md:p-6 shadow-[0_8px_0_#e0d3b6]">
      <h3 className="text-[#b07d0a] font-black text-lg flex items-center gap-2">
        <Plus size={18} />
        自己加一個{catLabel}
      </h3>
      <p className="text-[12px] text-[#9a8568] font-bold mt-1" style={WRAP}>
        在 Threads、IG 看到想去的，丟進來兩個人都看得到，一樣可以排進行程。會用名稱去 OpenStreetMap 找位置；貼 Google 地圖網址會更準。
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_200px]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit();
          }}
          placeholder="名稱（必填）"
          className={inputClass}
        />
        <select value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} aria-label="城市">
          <option value="">其他地方</option>
          {TRIP_CITIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="說明（選填）"
          rows={2}
          className={`${inputClass} resize-none md:col-span-2`}
          style={WRAP}
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="連結（選填，例如 Google 地圖或文章網址）"
          className={`${inputClass} md:col-span-2`}
        />
      </div>
      {urlInvalid && (
        <p className="text-[12px] font-bold text-[#c0392b] mt-1.5" style={WRAP}>
          連結要是 http:// 或 https:// 開頭的網址
        </p>
      )}
      {status === 'located' && (
        <p className="text-[12px] font-bold text-[#166534] mt-1.5" style={WRAP}>
          ✓ 加好了，也找到位置，地圖上看得到。
        </p>
      )}
      {status === 'unlocated' && (
        <p className="text-[12px] font-bold text-[#9a5b0a] mt-1.5" style={WRAP}>
          加好了，但沒找到位置，所以不會出現在地圖上。想上地圖的話，刪掉後重加，連結貼 Google 地圖網址（有 @緯度,經度 的那種）。
        </p>
      )}
      <button
        onClick={submit}
        disabled={!name.trim() || urlInvalid || status === 'saving'}
        className="mt-3 px-5 py-2.5 rounded-2xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] font-black shadow-[0_6px_0_#a9760a] active:translate-y-1 active:shadow-[0_2px_0_#a9760a] transition-all disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0"
      >
        {status === 'saving' ? '找位置中…' : '加入清單'}
      </button>
    </section>
  );
}

export default function TripGuide({
  cat,
  items,
  picksById,
  days,
  startDate,
  cityFilter,
  onCityFilterChange,
  focusId,
  onFocusDone,
  onUpdatePick,
  onAssign,
  onUnassign,
  onAddCustom,
  onRemoveCustom,
}) {
  const [onlyPicked, setOnlyPicked] = useState(false);
  const category = TRIP_CATEGORIES.find((c) => c.key === cat);
  const groupByLeg = cat === 'move';

  const catItems = useMemo(() => items.filter((item) => item.cat === cat), [items, cat]);
  const scheduledIds = useMemo(() => new Set(days.flatMap((d) => d.stops)), [days]);
  const visible = useMemo(
    () =>
      onlyPicked ? catItems.filter((item) => isPicked(picksById.get(item.id), scheduledIds.has(item.id))) : catItems,
    [catItems, onlyPicked, picksById, scheduledIds],
  );
  const dayOptions = useMemo(
    () =>
      days.map((day, index) => ({ id: day.id, index, date: tripDateOf(startDate, index), place: day.place, stops: day.stops })),
    [days, startDate],
  );

  const cityCounts = useMemo(() => {
    const counts = new Map();
    catItems.forEach((item) => counts.set(item.city || '', (counts.get(item.city || '') || 0) + 1));
    return counts;
  }, [catItems]);

  const sections = useMemo(() => {
    if (groupByLeg) {
      const legs = TRIP_LEGS.map((leg) => ({ ...leg, items: visible.filter((item) => item.leg === leg.key) }));
      legs.push({ key: 'custom', title: '自己加的交通', items: visible.filter((item) => item.custom) });
      return legs.filter((section) => section.items.length > 0);
    }
    const keys = cityFilter === 'all' ? [...TRIP_CITIES.map((c) => c.key), ''] : [cityFilter];
    return keys
      .map((key) => {
        const city = CITY_BY_KEY.get(key);
        return {
          key: key || 'other',
          title: city ? `${city.flag} ${city.name}` : '其他地方',
          hint: city?.local,
          items: visible.filter((item) => (item.city || '') === key),
        };
      })
      .filter((section) => section.items.length > 0);
  }, [groupByLeg, visible, cityFilter]);

  // 從行程表點項目過來：捲到那張卡片並閃一下
  useEffect(() => {
    if (!focusId) return undefined;
    document.getElementById(`trip-item-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = setTimeout(onFocusDone, 1800);
    return () => clearTimeout(timer);
  }, [focusId, onFocusDone]);

  const filterButton = (key, label, count) => {
    const active = cityFilter === key;
    return (
      <button
        key={key || 'other'}
        onClick={() => onCityFilterChange(key)}
        className={`px-3 py-1.5 rounded-xl border-2 text-[13px] font-black transition-all ${
          active
            ? 'bg-[#fff7e3] border-[#daa520] text-[#b07d0a] shadow-[0_3px_0_#d8c4a0]'
            : 'bg-[#f3e9d6] border-transparent text-[#9a8568] hover:bg-[#ece0c9]'
        }`}
      >
        {label}
        {count != null && <span className="ml-1 text-[11px] opacity-70">{count}</span>}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {!groupByLeg && (
          <>
            {filterButton('all', '全部', catItems.length)}
            {TRIP_CITIES.filter((c) => cityCounts.get(c.key)).map((c) =>
              filterButton(c.key, `${c.flag} ${c.name}`, cityCounts.get(c.key)),
            )}
            {cityCounts.get('') ? filterButton('', '其他地方', cityCounts.get('')) : null}
          </>
        )}
        <button
          onClick={() => setOnlyPicked((v) => !v)}
          className={`ml-auto px-3 py-1.5 rounded-xl border-2 text-[13px] font-black flex items-center gap-1.5 transition-colors ${
            onlyPicked
              ? 'bg-[#fff3c4] border-[#daa520] text-[#b07d0a]'
              : 'bg-[#fdf9f1] border-[#e6dac1] text-[#9a8568] hover:border-[#daa520]'
          }`}
        >
          <Star size={14} fill={onlyPicked ? '#daa520' : 'none'} />
          只看有標記的
        </button>
      </div>

      {sections.length === 0 ? (
        <div
          className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-8 text-center text-[#9a8568] font-bold"
          style={WRAP}
        >
          {onlyPicked ? '這裡還沒有標記任何東西，先把想去的按一下「⭐」吧。' : '這裡還沒有資料，可以在下面自己加一個。'}
        </div>
      ) : (
        sections.map((section) => (
          <section
            key={section.key}
            className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-5 md:p-6 shadow-[0_8px_0_#e0d3b6]"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
              <h3 className="text-[#b07d0a] font-black text-lg" style={WRAP}>
                {section.title}
              </h3>
              {section.hint && (
                <span className="text-[12px] text-[#9a8568] font-bold" style={WRAP}>
                  {section.hint}
                </span>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {section.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  pick={picksById.get(item.id)}
                  dayOptions={dayOptions}
                  focused={focusId === item.id}
                  showCity={groupByLeg}
                  onUpdatePick={onUpdatePick}
                  onAssign={onAssign}
                  onUnassign={onUnassign}
                  onRemoveCustom={onRemoveCustom}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <AddCustomForm
        cat={cat}
        catLabel={category?.label || ''}
        defaultCity={cityFilter === 'all' ? '' : cityFilter}
        onAdd={onAddCustom}
      />
    </div>
  );
}
