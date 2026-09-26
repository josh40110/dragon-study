import { dateStrFromDayNumber, dayNumberFromDateStr } from './dailyPick';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 第 index 天（0 起算）的日期 'YYYY-MM-DD'；還沒設出發日回傳 null */
export function tripDateOf(startDate, index) {
  if (!startDate) return null;
  return dateStrFromDayNumber(dayNumberFromDateStr(startDate) + index);
}

/** '2026-12-18' → '12/18（五）' */
export function formatTripDate(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}（${WEEKDAYS[weekdayOf(dateStr)]}）`;
}

function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-').map(Number);
  return `${m}/${d}`;
}

/** 活動期間的簡短寫法：'11/28–1/6'、'12/13 起' */
export function formatEventWindow(event) {
  if (!event?.start) return '';
  if (!event.end) return `${shortDate(event.start)} 起`;
  if (event.start === event.end) return `只有 ${shortDate(event.start)}`;
  return `${shortDate(event.start)}–${shortDate(event.end)}`;
}

/** 活動在這天有沒有開：'open' | 'closed'；沒有日期就回傳 null（無從判斷） */
export function eventStatusOn(event, dateStr) {
  if (!event || !dateStr) return null;
  // 'YYYY-MM-DD' 字串直接比大小就是日期先後
  if (event.start && dateStr < event.start) return 'closed';
  if (event.end && dateStr > event.end) return 'closed';
  if (Array.isArray(event.weekdays) && !event.weekdays.includes(weekdayOf(dateStr))) return 'closed';
  return 'open';
}

/** 活動有開時的說明 */
export function eventOpenText(event) {
  return event.openText || '這天有開';
}

/** 活動沒開時給使用者看的原因 */
export function eventClosedReason(event) {
  if (event.closedText) return event.closedText;
  if (event.note && Array.isArray(event.weekdays)) return event.note;
  return `這天沒開（${formatEventWindow(event)}）`;
}

/**
 * 判斷「這天人在哪」用的文字：以地點欄為準，地點空白才看行程欄。
 * 行程欄常寫到轉機、要去的地方（「基律納飛斯德哥爾摩轉機」），全部算進去會誤判。
 */
export function dayLocationText(day) {
  return day.place.trim() ? day.place : day.plan;
}

/** 從一段文字裡依出現順序找出提到的地點（城市或國家），供路線摘要與日期檢查使用 */
export function findPlacesInText(text, places) {
  const lower = String(text || '').toLowerCase();
  const hits = [];
  places.forEach((place) => {
    const positions = place.keywords.map((k) => lower.indexOf(k)).filter((i) => i >= 0);
    if (positions.length > 0) hits.push({ place, index: Math.min(...positions) });
  });
  return hits.sort((a, b) => a.index - b.index).map((hit) => hit.place);
}

/** 這一天（地點＋行程文字）會碰到哪些有營業期間的活動 */
export function eventsForDayText(text, cityKeys, events) {
  const lower = String(text || '').toLowerCase();
  return events.filter(
    (event) =>
      (event.cities || []).some((city) => cityKeys.includes(city)) ||
      (event.keywords || []).some((keyword) => lower.includes(keyword)),
  );
}
