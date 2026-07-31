/** 依日期決定性挑選內容：兩個人在同一天打開，看到的課程一定一樣。 */

/** 'YYYY-MM-DD' → 自 1970-01-01 起的天數 */
export function dayNumberFromDateStr(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * 從清單取 count 筆：每天往後推 count 個位置，
 * 讓整份語料輪完一輪才會重複。
 */
export function pickDaily(list, dayNumber, count, salt = 0) {
  if (!Array.isArray(list) || list.length === 0) return [];
  const size = Math.min(count, list.length);
  const start = (((dayNumber * count + salt) % list.length) + list.length) % list.length;
  return Array.from({ length: size }, (_, i) => list[(start + i) % list.length]);
}

/** Fisher-Yates，測驗選項用（每次作答都重新洗牌才好玩） */
export function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 從今天往回數連續打卡天數（今天沒打卡就從昨天起算，當天不算斷） */
export function computeStreak(dateList, todayStr) {
  if (!Array.isArray(dateList) || dateList.length === 0) return 0;
  const set = new Set(dateList);
  const today = dayNumberFromDateStr(todayStr);
  let cursor = set.has(todayStr) ? today : today - 1;
  let streak = 0;
  while (streak < 3650) {
    const dateStr = dateStrFromDayNumber(cursor);
    if (!set.has(dateStr)) break;
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/** 天數 → 'YYYY-MM-DD'（與 dayNumberFromDateStr 互為反函式） */
export function dateStrFromDayNumber(dayNumber) {
  const d = new Date(dayNumber * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** 距離出發還有幾天（負數代表已經出發） */
export function daysUntil(targetDateStr, todayStr) {
  if (!targetDateStr) return null;
  return dayNumberFromDateStr(targetDateStr) - dayNumberFromDateStr(todayStr);
}
