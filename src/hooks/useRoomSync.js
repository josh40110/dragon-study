import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, getRoomRef } from '../lib/firebase';
import { createInitialRoomData, normalizeCompletedByDate, normalizeGoalList } from '../constants/roomDefaults';

export default function useRoomSync() {
  const [user, setUser] = useState(null);
  const [roomData, setRoomData] = useState(createInitialRoomData);
  const [leftGoals, setLeftGoals] = useState([]);
  const [rightGoals, setRightGoals] = useState([]);
  /** 至少收到一次 Firestore snapshot，避免用初始 roomData 誤判 */
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
    if (!user || !db || !getRoomRef) return undefined;
    const roomRef = getRoomRef();
    const unsub = onSnapshot(
      roomRef,
      (snapshot) => {
        setRoomReady(true);
        if (snapshot.exists()) {
          const data = snapshot.data();
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
          setDoc(roomRef, createInitialRoomData());
        }
      },
      (err) => console.error('監聽失敗', err),
    );
    return () => unsub();
  }, [user]);

  return { roomData, setRoomData, leftGoals, setLeftGoals, rightGoals, setRightGoals, roomReady };
}
