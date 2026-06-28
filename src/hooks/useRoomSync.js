import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ensureRoom, isFirebaseReady, subscribeRoom } from '../lib/roomStore';
import { createInitialRoomData, normalizeCompletedByDate, normalizeGoalList } from '../constants/roomDefaults';

export default function useRoomSync() {
  const [user, setUser] = useState(null);
  const [roomData, setRoomData] = useState(createInitialRoomData);
  const [leftGoals, setLeftGoals] = useState([]);
  const [rightGoals, setRightGoals] = useState([]);
  /** 至少收到一次 snapshot，避免用初始 roomData 誤判 */
  const [roomReady, setRoomReady] = useState(false);

  useEffect(() => {
    if (!auth) return undefined;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth Error:', err);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    // 線上模式需先登入才能讀取；離線（localStorage）模式可直接訂閱
    if (isFirebaseReady() && !user) return undefined;
    const unsub = subscribeRoom(
      (data) => {
        setRoomReady(true);
        if (data) {
          const normalizedLeftGoals = normalizeGoalList(data.leftGoals);
          const normalizedRightGoals = normalizeGoalList(data.rightGoals);
          const normalizedLeftCompletedByDate = normalizeCompletedByDate(data.leftCompletedByDate);
          const normalizedRightCompletedByDate = normalizeCompletedByDate(data.rightCompletedByDate);
          setRoomData({
            ...data,
            leftGoals: normalizedLeftGoals,
            rightGoals: normalizedRightGoals,
            leftCompletedByDate: normalizedLeftCompletedByDate,
            rightCompletedByDate: normalizedRightCompletedByDate,
          });
          setLeftGoals(normalizedLeftGoals);
          setRightGoals(normalizedRightGoals);
        } else {
          ensureRoom(createInitialRoomData());
        }
      },
      (err) => console.error('監聽失敗', err),
    );
    return unsub;
  }, [user]);

  return { roomData, setRoomData, leftGoals, setLeftGoals, rightGoals, setRightGoals, roomReady };
}
