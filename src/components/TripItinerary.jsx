import { useMemo } from 'react';
import { CalendarDays, Map as MapIcon, Plus, Route, Trash2, TriangleAlert, X } from 'lucide-react';
import {
  ROUTE_SUGGESTIONS,
  TRIP_CATEGORIES,
  TRIP_CITIES,
  TRIP_EVENTS,
  TRIP_HOLIDAYS,
  TRIP_NOTICES,
} from '../constants/tripGuide';
import {
  dayLocationText,
  eventClosedReason,
  eventOpenText,
  eventStatusOn,
  eventsForDayText,
  findPlacesInText,
  formatEventWindow,
  formatTripDate,
  tripDateOf,
} from '../utils/tripDates';
import TripEditableText from './TripEditableText';

/** 全站 index.css 的 unlayered `p/span { white-space: nowrap }` 會壓過 utility class */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const CARD = 'bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-5 md:p-6 shadow-[0_8px_0_#e0d3b6] min-w-0';
const CAT_EMOJI = Object.fromEntries(TRIP_CATEGORIES.map((c) => [c.key, c.emoji]));
const EVENTS_BY_ID = new Map(TRIP_EVENTS.map((event) => [event.id, event]));

/** 路線建議依 group 分組，保留原本順序 */
const SUGGESTION_GROUPS = ROUTE_SUGGESTIONS.reduce((groups, route) => {
  const last = groups[groups.length - 1];
  if (last && last.name === route.group) last.routes.push(route);
  else groups.push({ name: route.group, routes: [route] });
  return groups;
}, []);

function DayRow({ day, index, date, entries, onUpdateDay, onRemoveDay, onUnassign, onOpenItem, onOpenMap }) {
  const cityKeys = findPlacesInText(dayLocationText(day), TRIP_CITIES).map((city) => city.key);
  const events = date ? eventsForDayText(`${day.place} ${day.plan}`, cityKeys, TRIP_EVENTS) : [];
  const holiday = date ? TRIP_HOLIDAYS[date.slice(5)] : null;

  const rowButtons = (className) => (
    <div className={`items-center shrink-0 ${className}`}>
      <button
        onClick={() => onOpenMap(day.id)}
        className="p-2 rounded-xl text-[#c4b291] hover:text-[#2f6db5] hover:bg-[#eaf2fc] transition-colors"
        title="在地圖上排這天"
      >
        <MapIcon size={15} />
      </button>
      <button
        onClick={() => onRemoveDay(day, index)}
        className="p-2 rounded-xl text-[#c4b291] hover:text-[#c0392b] hover:bg-[#f3e9d6] transition-colors"
        title="刪除這天"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  return (
    <div className="rounded-2xl border-2 border-[#e6dac1] bg-[#f7f0e2] p-3 md:p-3.5">
      <div className="flex flex-col md:flex-row md:items-start gap-1.5 md:gap-3">
        <div className="flex items-center justify-between md:block md:w-[92px] md:shrink-0 md:pt-1.5">
          <div className="flex items-baseline gap-2 md:block">
            <div className="font-black text-[#b07d0a] text-[15px]">Day {index + 1}</div>
            <div className="text-[12px] font-bold text-[#9a8568]">{date ? formatTripDate(date) : '日期未定'}</div>
          </div>
          {rowButtons('flex md:hidden')}
        </div>
        <div className="min-w-0 flex-1 grid gap-1 md:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
          <TripEditableText
            value={day.place}
            placeholder="地點"
            label={`Day ${index + 1} 地點`}
            onSave={(place) => onUpdateDay(day.id, { place })}
          />
          <TripEditableText
            multiline
            value={day.plan}
            placeholder="行程"
            label={`Day ${index + 1} 行程`}
            onSave={(plan) => onUpdateDay(day.id, { plan })}
          />
        </div>
        {rowButtons('hidden md:flex')}
      </div>

      {(holiday || events.length > 0 || entries.length > 0) && (
        <div className="mt-2 md:pl-[104px] space-y-1.5">
          {holiday && (
            <div className="text-[12px] font-bold text-[#9a5b0a] bg-[#fdebc8] rounded-xl px-3 py-1.5" style={WRAP}>
              🔒 {holiday}
            </div>
          )}

          {events.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {events.map((event) => {
                const open = eventStatusOn(event, date) === 'open';
                return (
                  <span
                    key={event.id}
                    title={event.note || undefined}
                    className={`text-[11px] font-black rounded-xl px-2.5 py-1 ${
                      open ? 'bg-[#e8f7e9] text-[#166534]' : 'bg-[#fdebc8] text-[#9a5b0a]'
                    }`}
                    style={WRAP}
                  >
                    {open ? event.icon : '⚠️'} {event.name}：{open ? eventOpenText(event) : eventClosedReason(event)}
                  </span>
                );
              })}
            </div>
          )}

          {entries.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {entries.map(({ item, pick }, index) => {
                const event = item.event ? EVENTS_BY_ID.get(item.event) : null;
                const closed = Boolean(event && eventStatusOn(event, date) === 'closed');
                return (
                  <span
                    key={item.id}
                    className={`inline-flex items-center max-w-full rounded-xl border-2 bg-[#fdf9f1] ${
                      closed ? 'border-[#e0a33a]' : 'border-[#e6dac1]'
                    }`}
                  >
                    <button
                      onClick={() => onOpenItem(item)}
                      className="min-w-0 pl-2.5 pr-1 py-0.5 text-left text-[12px] font-black text-[#4a3526] hover:text-[#b07d0a]"
                      title={closed ? eventClosedReason(event) : '看詳細資料'}
                      style={WRAP}
                    >
                      {index + 1}. {CAT_EMOJI[item.cat]} {item.name}
                      {pick?.booked ? ' ✅' : ''}
                      {closed ? ' ⚠️' : ''}
                    </button>
                    <button
                      onClick={() => onUnassign(item.id, day.id)}
                      className="pr-2 pl-0.5 py-1 text-[#c4b291] hover:text-[#c0392b] shrink-0"
                      title="從這天移除"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RouteSuggestions({ onApply }) {
  return (
    <section className={CARD}>
      <h3 className="text-[#b07d0a] font-black text-lg flex items-center gap-2">
        <Route size={18} />
        路線建議
      </h3>
      <p className="text-[12px] text-[#9a8568] font-bold mt-1" style={WRAP}>
        還沒想好怎麼走的話，挑一個按「套用」，會寫進行程表對應的那幾天，之後還是可以自己改。
      </p>

      {SUGGESTION_GROUPS.map((group) => (
        <div key={group.name} className="mt-4">
          <div className="text-[13px] font-black text-[#8a755b] mb-2">{group.name}</div>
          <div className="space-y-2.5">
            {group.routes.map((route) => (
              <div key={route.id} className="rounded-2xl border-2 border-[#e6dac1] bg-[#f7f0e2] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-black text-[#4a3526] text-[15px] leading-snug" style={WRAP}>
                      {route.title}
                    </div>
                    <div className="text-[12px] font-bold text-[#9a8568] mt-0.5" style={WRAP}>
                      {route.summary}
                    </div>
                  </div>
                  <button
                    onClick={() => onApply(route)}
                    className="shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] text-[12px] font-black shadow-[0_3px_0_#a9760a] active:translate-y-0.5 active:shadow-[0_1px_0_#a9760a] transition-all"
                  >
                    套用到 Day {route.from}–{route.from + route.days.length - 1}
                  </button>
                </div>
                <ol className="mt-2.5 space-y-1">
                  {route.days.map((d, i) => (
                    <li key={d.place + d.plan} className="text-[12px] font-bold text-[#6b5540] leading-relaxed" style={WRAP}>
                      <b className="text-[#b07d0a]">Day {route.from + i}</b> {d.place}：{d.plan}
                    </li>
                  ))}
                </ol>
                <div className="mt-2 text-[11px] font-bold text-[#166534]" style={WRAP}>
                  👍 {route.pros}
                </div>
                <div className="text-[11px] font-bold text-[#9a5b0a]" style={WRAP}>
                  👎 {route.cons}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function Notices() {
  return (
    <section className={CARD}>
      <h3 className="text-[#b07d0a] font-black text-lg flex items-center gap-2">
        <TriangleAlert size={18} />
        出發前必看
      </h3>
      <div className="space-y-3.5 mt-3">
        {TRIP_NOTICES.map((notice) => (
          <div key={notice.title} className="flex gap-2.5">
            <div className="text-lg leading-none pt-0.5 shrink-0">{notice.icon}</div>
            <div className="min-w-0">
              <div className="font-black text-[#4a3526] text-[14px]" style={WRAP}>
                {notice.title}
              </div>
              <p className="text-[12px] font-bold text-[#8a755b] leading-relaxed mt-0.5" style={WRAP}>
                {notice.text}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t-2 border-dashed border-[#e6dac1]">
        <div className="font-black text-[#8a755b] text-[13px] mb-2">活動日期一覽（設好出發日會自動比對）</div>
        <ul className="space-y-1.5">
          {TRIP_EVENTS.map((event) => (
            <li key={event.id} className="text-[12px] font-bold text-[#6b5540] leading-relaxed" style={WRAP}>
              {event.icon} {event.name}：<b className="text-[#4a3526]">{formatEventWindow(event)}</b>
              {event.note ? `（${event.note}）` : ''}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function TripItinerary({
  days,
  startDate,
  picksById,
  itemsById,
  onUpdateDay,
  onAddDay,
  onRemoveDay,
  onApplyRoute,
  onUnassign,
  onOpenItem,
  onOpenMap,
}) {
  /** dayId → 排進那天的項目，順序就是地圖上排好的走法 */
  const entriesByDay = useMemo(
    () =>
      new Map(
        days.map((day) => [
          day.id,
          day.stops
            .map((id) => itemsById.get(id))
            .filter(Boolean)
            .map((item) => ({ item, pick: picksById.get(item.id) })),
        ]),
      ),
    [days, itemsById, picksById],
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px] items-start">
      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[#b07d0a] font-black text-lg flex items-center gap-2">
            <CalendarDays size={18} />
            每日行程
          </h3>
          <span className="text-[#9a8568] font-black text-sm">共 {days.length} 天</span>
        </div>
        <p className="text-[12px] text-[#9a8568] font-bold mt-1 mb-4" style={WRAP}>
          地點、行程點了就能改，按 Enter 或點別的地方就存好。在各分頁按「排進哪天」，或到「地圖」分頁拖進來，就會照順序出現在那一天底下。
        </p>

        {!startDate && (
          <div
            className="mb-4 rounded-2xl border-2 border-dashed border-[#daa520] bg-[#fff7e3] px-4 py-3 text-[13px] font-bold text-[#8a6d3b]"
            style={WRAP}
          >
            還沒設出發日：在上面填好 Day 1 的日期，每天就會自動標上日期，還會檢查那天聖誕市集、夜車有沒有開。
          </div>
        )}

        <div className="space-y-2.5">
          {days.map((day, index) => (
            <DayRow
              key={day.id}
              day={day}
              index={index}
              date={tripDateOf(startDate, index)}
              entries={entriesByDay.get(day.id) || []}
              onUpdateDay={onUpdateDay}
              onRemoveDay={onRemoveDay}
              onUnassign={onUnassign}
              onOpenItem={onOpenItem}
              onOpenMap={onOpenMap}
            />
          ))}
        </div>

        <button
          onClick={onAddDay}
          className="mt-4 w-full py-3 rounded-2xl border-2 border-dashed border-[#daa520] text-[#b07d0a] font-black hover:bg-[#fff7e3] transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          加一天
        </button>
      </section>

      <div className="space-y-5 min-w-0">
        <RouteSuggestions onApply={onApplyRoute} />
        <Notices />
      </div>
    </div>
  );
}
