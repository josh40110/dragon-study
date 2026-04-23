import { useEffect, useMemo, useState } from 'react';
import { getLocalDateStr } from '../utils/date';

export default function useStudyTimer(roomData, role) {
  const [currentTime, setCurrentTime] = useState(Date.now());
  const todayStr = getLocalDateStr();

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  const calculateElapsed = (roleKey) => {
    let accumulated = 0;
    if (roomData.lastActiveDate === todayStr) {
      accumulated = roomData[`${roleKey}DailyTotal`] || 0;
    }

    let currentSession = 0;
    if (roomData[`${roleKey}Studying`] && roomData[`${roleKey}StartTime`]) {
      const startTime = roomData[`${roleKey}StartTime`];
      const startD = new Date(startTime);
      const startStr = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;

      if (startStr === todayStr) {
        currentSession = Math.max(0, Math.floor((currentTime - startTime) / 1000));
      } else {
        const d = new Date();
        const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        currentSession = Math.max(0, Math.floor((currentTime - todayStart) / 1000));
      }
    }
    return { total: accumulated + currentSession, session: currentSession };
  };

  const leftTime = useMemo(() => calculateElapsed('left'), [roomData, todayStr, currentTime]);
  const rightTime = useMemo(() => calculateElapsed('right'), [roomData, todayStr, currentTime]);
  const leftElapsed = leftTime.total;
  const rightElapsed = rightTime.total;
  const myElapsed = role === 'left' ? leftElapsed : rightElapsed;
  const mySession = role === 'left' ? leftTime.session : rightTime.session;

  return { todayStr, leftElapsed, rightElapsed, myElapsed, mySession, setCurrentTime };
}
