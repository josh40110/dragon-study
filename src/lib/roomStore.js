import { onSnapshot, setDoc } from 'firebase/firestore';
import { db, getRoomRef } from './firebase';

/**
 * 房間資料存取層：有設定 Firebase 時走 Firestore（即時同步），
 * 否則自動退回 localStorage（單機離線模式，仍可存檔 + 同分頁/跨分頁即時更新）。
 */

const LS_KEY = 'dragon-study-room';
const localListeners = new Set();

export function isFirebaseReady() {
  return Boolean(db && getRoomRef);
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(data) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* 無痕模式 / 容量不足：忽略，至少本次 session 仍以記憶體狀態運作 */
  }
}

function notifyLocal() {
  const data = readLocal();
  localListeners.forEach((cb) => {
    try {
      cb(data);
    } catch {
      /* 單一訂閱者出錯不影響其他訂閱者 */
    }
  });
}

/** 訂閱房間資料變化；回傳取消訂閱函式。 */
export function subscribeRoom(onData, onError) {
  if (isFirebaseReady()) {
    return onSnapshot(
      getRoomRef(),
      (snapshot) => onData(snapshot.exists() ? snapshot.data() : null),
      onError,
    );
  }
  localListeners.add(onData);
  // 模擬 onSnapshot 首次回呼，立即送出目前資料
  Promise.resolve().then(() => onData(readLocal()));
  // 跨分頁同步
  const storageHandler = (e) => {
    if (e.key === LS_KEY) onData(readLocal());
  };
  window.addEventListener('storage', storageHandler);
  return () => {
    localListeners.delete(onData);
    window.removeEventListener('storage', storageHandler);
  };
}

/** 合併更新房間資料。 */
export function updateRoom(updates, { merge = true } = {}) {
  if (isFirebaseReady()) {
    return setDoc(getRoomRef(), updates, { merge });
  }
  const current = readLocal() || {};
  const next = merge ? { ...current, ...updates } : { ...updates };
  writeLocal(next);
  notifyLocal();
  return Promise.resolve();
}

/** 房間不存在時建立初始資料。 */
export function ensureRoom(initialData) {
  if (isFirebaseReady()) {
    return setDoc(getRoomRef(), initialData);
  }
  if (readLocal() == null) {
    writeLocal(initialData);
    notifyLocal();
  }
  return Promise.resolve();
}
