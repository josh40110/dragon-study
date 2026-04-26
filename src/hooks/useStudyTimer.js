import { useEffect, useMemo, useState } from 'react';
import { getLocalDateStrFromTime } from '../utils/date';

function normalizeStartMs(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw?.toMillis === 'function') return raw.toMillis();
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
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
    const startStr = getLocalDateStrFromTime(startTime);

    if (startStr === todayStr) {
      currentSession = Math.max(0, Math.floor((nowMs - startTime) / 1000));
    } else {
      const d = new Date(nowMs);
      const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      currentSession = Math.max(0, Math.floor((nowMs - todayStart) / 1000));
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
