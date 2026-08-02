import { useEffect, useMemo, useState } from 'react';
import { getLocalDateStrFromTime } from '../utils/date';

/** 專注中每隔多久寫一次心跳 */
export const HEARTBEAT_INTERVAL_MS = 60 * 1000;

/**
 * 超過這個時間沒心跳就視為離線。
 * 取 4 分鐘（容忍 3 次漏拍）是為了吸收兩台裝置之間的時鐘誤差——
 * 心跳寫的是寫入端的 Date.now()，由對方的 Date.now() 來比對。
 */
export const HEARTBEAT_STALE_MS = 4 * 60 * 1000;

function normalizeStartMs(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw?.toMillis === 'function') return raw.toMillis();
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 這個角色最後一次「確定還活著」的時間；沒有心跳欄位就回 null。 */
export function getHeartbeatMs(roomData, roleKey) {
  return normalizeStartMs(roomData?.[`${roleKey}LastHeartbeat`]);
}

/**
 * 這個角色現在真的在專注嗎？
 * `xxxStudying` 為 true 但心跳停了（瀏覽器當機、強制結束、分頁被系統回收），
 * 一律當成離線——這是「關掉頁面自動下線」在非正常關閉時的補網。
 *
 * 沒有心跳欄位的一律當作在線：那是這個機制上線前就開始的 session，
 * 若判成過期會把人家已經累積的時間結算成 0。等那台裝置再打開，
 * 心跳就會補上，之後就受保護了。
 */
export function isRoleStudying(roomData, roleKey, nowMs = Date.now()) {
  if (!roomData?.[`${roleKey}Studying`]) return false;
  const beat = getHeartbeatMs(roomData, roleKey);
  if (beat == null) return true;
  return nowMs - beat <= HEARTBEAT_STALE_MS;
}

/** 累計專注秒數（含本段 session）；`nowMs` 預設為當下，供卸載時與按鈕結束專注一致。 */
export function computeRoleTotalElapsed(roomData, roleKey, nowMs = Date.now()) {
  return computeRoleElapsedParts(roomData, roleKey, nowMs).total;
}

export function computeRoleElapsedParts(roomData, roleKey, nowMs = Date.now()) {
  const todayStr = getLocalDateStrFromTime(nowMs);
  let accumulated = 0;
  if (roomData.lastActiveDate === todayStr) {
    accumulated = roomData[`${roleKey}DailyTotal`] || 0;
  }

  let currentSession = 0;
  if (roomData[`${roleKey}Studying`] && roomData[`${roleKey}StartTime`] != null) {
    const startTime = normalizeStartMs(roomData[`${roleKey}StartTime`]);
    if (startTime == null) {
      return { total: accumulated, session: 0 };
    }

    // 心跳停了就凍結在最後一次心跳：對方當機後計時器不會繼續空跑，
    // 結算時也只會記到他真的還在的那一刻為止。
    const beat = getHeartbeatMs(roomData, roleKey);
    const stale = beat != null && nowMs - beat > HEARTBEAT_STALE_MS;
    const effectiveNow = stale ? beat : nowMs;

    const startStr = getLocalDateStrFromTime(startTime);
    if (startStr === todayStr) {
      currentSession = Math.max(0, Math.floor((effectiveNow - startTime) / 1000));
    } else {
      const d = new Date(nowMs);
      const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      currentSession = Math.max(0, Math.floor((effectiveNow - todayStart) / 1000));
    }
  }
  return { total: accumulated + currentSession, session: currentSession };
}

export default function useStudyTimer(roomData, role) {
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const tick = () => setCurrentTime(Date.now());
    const raf = requestAnimationFrame(tick);
    const interval = setInterval(tick, 500);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);

  const leftTime = useMemo(() => computeRoleElapsedParts(roomData, 'left', currentTime), [roomData, currentTime]);
  const rightTime = useMemo(() => computeRoleElapsedParts(roomData, 'right', currentTime), [roomData, currentTime]);
  const leftElapsed = leftTime.total;
  const rightElapsed = rightTime.total;
  const myElapsed = role === 'left' ? leftElapsed : rightElapsed;
  const mySession = role === 'left' ? leftTime.session : rightTime.session;

  return { leftElapsed, rightElapsed, myElapsed, mySession, setCurrentTime };
}
