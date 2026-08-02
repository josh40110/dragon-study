import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CalendarDays, Coffee, Heart, Home, Languages, Sparkles } from 'lucide-react';
import { updateRoom } from './lib/roomStore';
import AnimatedWindow from './components/AnimatedWindow';
import LanguageLab from './components/LanguageLab';
import WishBoard from './components/WishBoard';
import MotivationalBoard from './components/MotivationalBoard';
import PixelArt from './components/PixelArt';
import RealTimeClock from './components/RealTimeClock';
import RunningDragonIcon from './components/RunningDragonIcon';
import Steam from './components/Steam';
import TaskPanel from './components/TaskPanel';
import CompletionCalendarModal from './components/CompletionCalendarModal';
import DailySettlementModal from './components/DailySettlementModal';
import { createGroupItem, createTaskItem, normalizeItemId } from './constants/roomDefaults';
import { PALETTES, SPRITES } from './constants/pixelArtData';
import { auth, getFirestoreRestPatchUrl } from './lib/firebase';
import { getLocalDateStr, getLocalDateStrFromTime } from './utils/date';
import useNudgeEffect from './hooks/useNudgeEffect';
import useRoomSync from './hooks/useRoomSync';
import useStudyTimer, {
  HEARTBEAT_INTERVAL_MS,
  computeRoleTotalElapsed,
  isRoleStudying,
} from './hooks/useStudyTimer';
import { firestorePatchKeepalive } from './utils/firestoreRestPatch';

const END_STUDY_PENDING_KEY = 'dragon-study-pending-end-study';

const MAIN_TABS = [
  { key: 'room', label: '共讀小屋', icon: Home },
  { key: 'language', label: '龍龍語言教室', icon: Languages },
  { key: 'wish', label: '許願池', icon: Sparkles },
];

/**
 * 把某一天的專注秒數寫進歷史表。整張表一起寫（而不是只寫單一 key），
 * 因為 localStorage 離線模式只做淺層合併，只寫一個 key 會把其他日子洗掉。
 */
function mergeStudyByDate(current, dateKey, seconds) {
  const base = current && typeof current === 'object' ? current : {};
  if (base[dateKey] === seconds) return base;
  return { ...base, [dateKey]: seconds };
}

/** 與「暫時休息」按鈕相同的 Firestore 欄位（結束專注） */
function buildEndStudyFirestoreUpdates({ roleKey, exactElapsed, roomLastActiveDate, studyByDate, nowMs = Date.now() }) {
  const currentDateStr = getLocalDateStrFromTime(nowMs);
  const updates = {};
  if (roomLastActiveDate !== currentDateStr) {
    updates.leftDailyTotal = 0;
    updates.rightDailyTotal = 0;
    updates.lastActiveDate = currentDateStr;
  }
  updates[`${roleKey}Studying`] = false;
  updates[`${roleKey}StartTime`] = null;
  updates[`${roleKey}LastHeartbeat`] = null;
  updates[`${roleKey}DailyTotal`] = exactElapsed;
  // 每天的累計會被隔天歸零，所以要另外留一份歷史給日曆與結算看
  updates[`${roleKey}StudyByDate`] = mergeStudyByDate(studyByDate, currentDateStr, exactElapsed);
  updates.lastActiveDate = currentDateStr;
  return updates;
}

export default function App() {
  const [role, setRole] = useState(null);
  const { roomData, leftGoals, setLeftGoals, rightGoals, setRightGoals, roomReady } = useRoomSync();
  const [newGoalText, setNewGoalText] = useState('');
  const [isPomodoro, setIsPomodoro] = useState(false);
  const [activeTab, setActiveTab] = useState('room');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showDailySettlement, setShowDailySettlement] = useState(false);
  const [settlementStep, setSettlementStep] = useState('huahua');
  const receiveNudge = useNudgeEffect(roomData, role);

  const { leftElapsed, rightElapsed, myElapsed, mySession, setCurrentTime } = useStudyTimer(roomData, role);

  // 一律用心跳感知的判斷，不要直接讀 roomData.xxxStudying：
  // 對方當機時欄位還是 true，但人已經不在了。useStudyTimer 每 500ms 觸發重繪，
  // 所以這裡每次 render 重算就等於持續偵測。
  const leftDragonIsStudying = isRoleStudying(roomData, 'left');
  const rightDragonIsStudying = isRoleStudying(roomData, 'right');
  const isStudying = role === 'left' ? leftDragonIsStudying : rightDragonIsStudying;

  const unloadStudyRef = useRef({ role: null, isStudying: false, roomData: null });
  const idTokenRef = useRef(null);
  const roomDataRef = useRef(roomData);

  useEffect(() => {
    roomDataRef.current = roomData;
  }, [roomData]);

  /** 專注中定期寫心跳，讓對方知道我還在。正常關頁由 pagehide 收尾，這是當機時的補網。 */
  useEffect(() => {
    if (!role || !isStudying) return undefined;
    const beat = () => {
      const rd = roomDataRef.current;
      const nowMs = Date.now();
      // 順便把當下累計寫進歷史：不增加寫入次數，就算之後當機，日曆最多只差一分鐘
      void updateRoom(
        {
          [`${role}LastHeartbeat`]: nowMs,
          [`${role}StudyByDate`]: mergeStudyByDate(
            rd?.[`${role}StudyByDate`],
            getLocalDateStrFromTime(nowMs),
            computeRoleTotalElapsed(rd, role, nowMs),
          ),
        },
        { merge: true },
      ).catch(() => {
        /* 單次心跳漏掉沒關係，下一拍會補上 */
      });
    };
    beat();
    const id = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [role, isStudying]);

  /** 上次是當機離開的：心跳已經過期，把停在最後一次心跳的時間結算掉，別讓狀態卡在專注中。 */
  useEffect(() => {
    if (!roomReady || !role) return;
    const rd = roomDataRef.current;
    if (!rd?.[`${role}Studying`]) return;
    if (isRoleStudying(rd, role)) return;
    const nowMs = Date.now();
    void updateRoom(
      buildEndStudyFirestoreUpdates({
        roleKey: role,
        // computeRoleTotalElapsed 會自動截到最後一次心跳，不會把當機的空白算進去
        exactElapsed: computeRoleTotalElapsed(rd, role, nowMs),
        roomLastActiveDate: rd.lastActiveDate,
        studyByDate: rd[`${role}StudyByDate`],
        nowMs,
      }),
      { merge: true },
    ).catch((err) => console.error('清除逾時的專注狀態失敗:', err));
  }, [roomReady, role]);

  useEffect(() => {
    unloadStudyRef.current = { role, isStudying, roomData };
  }, [role, isStudying, roomData]);

  useEffect(() => {
    if (!auth) return undefined;
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) {
        idTokenRef.current = null;
        return;
      }
      void u.getIdToken().then((t) => {
        idTokenRef.current = t;
      });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!auth) return undefined;
    const id = setInterval(() => {
      const u = auth.currentUser;
      if (!u) return;
      void u.getIdToken(true).then((t) => {
        idTokenRef.current = t;
      });
    }, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /** 關閉分頁時 setDoc 常被中斷：sessionStorage + fetch keepalive PATCH 補強；下次開啟再重試一次 */
  useEffect(() => {
    const persistEndStudyOnLeave = () => {
      const s = unloadStudyRef.current;
      if (!s.role || !s.isStudying) return;
      const roleKey = s.role === 'left' ? 'left' : 'right';
      const nowMs = Date.now();
      const exactElapsed = computeRoleTotalElapsed(s.roomData, roleKey, nowMs);
      const roomLastActiveDate = s.roomData?.lastActiveDate;
      const updates = buildEndStudyFirestoreUpdates({
        roleKey,
        exactElapsed,
        roomLastActiveDate,
        studyByDate: s.roomData?.[`${roleKey}StudyByDate`],
        nowMs,
      });
      try {
        sessionStorage.setItem(
          END_STUDY_PENDING_KEY,
          JSON.stringify({ roleKey, ts: nowMs, exactElapsed, roomLastActiveDate: roomLastActiveDate ?? null }),
        );
      } catch {
        /* private mode */
      }
      const url = getFirestoreRestPatchUrl?.();
      const token = idTokenRef.current;
      if (url && token) {
        firestorePatchKeepalive(url, token, updates);
      }
      void updateRoom(updates, { merge: true }).catch(() => {
        /* 仍可能中斷；依賴 keepalive 與下次開啟重試 */
      });
    };
    window.addEventListener('pagehide', persistEndStudyOnLeave);
    window.addEventListener('beforeunload', persistEndStudyOnLeave);
    return () => {
      window.removeEventListener('pagehide', persistEndStudyOnLeave);
      window.removeEventListener('beforeunload', persistEndStudyOnLeave);
    };
  }, []);

  useEffect(() => {
    if (!roomReady) return;
    let raw;
    try {
      raw = sessionStorage.getItem(END_STUDY_PENDING_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    let pending;
    try {
      pending = JSON.parse(raw);
    } catch {
      try {
        sessionStorage.removeItem(END_STUDY_PENDING_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    if (!pending.roleKey || (pending.roleKey !== 'left' && pending.roleKey !== 'right')) return;
    if (Date.now() - pending.ts > 120000) {
      try {
        sessionStorage.removeItem(END_STUDY_PENDING_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    const rd = roomDataRef.current;
    if (!rd[`${pending.roleKey}Studying`]) {
      try {
        sessionStorage.removeItem(END_STUDY_PENDING_KEY);
      } catch {
        /* ignore */
      }
      return;
    }
    const key = pending.roleKey;
    const nowMs = Date.now();
    const exactElapsed = computeRoleTotalElapsed(rd, key, nowMs);
    void updateRoom(
      buildEndStudyFirestoreUpdates({
        roleKey: key,
        exactElapsed,
        roomLastActiveDate: rd.lastActiveDate ?? pending.roomLastActiveDate,
        studyByDate: rd[`${key}StudyByDate`],
        nowMs,
      }),
      { merge: true },
    )
      .then(() => {
        try {
          sessionStorage.removeItem(END_STUDY_PENDING_KEY);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {});
  }, [roomReady]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatPomodoroTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const getProgress = useCallback((targetGoals) => {
    if (!targetGoals || targetGoals.length === 0) return 0;
    const completedCount = targetGoals.filter((g) => g.completed).length;
    return Math.round((completedCount / targetGoals.length) * 100);
  }, []);

  const todayKey = getLocalDateStr();
  const huahuaItems = useMemo(() => roomData.rightCompletedByDate?.[todayKey] || [], [roomData.rightCompletedByDate, todayKey]);
  const guaguaItems = useMemo(() => roomData.leftCompletedByDate?.[todayKey] || [], [roomData.leftCompletedByDate, todayKey]);
  const huahuaRate = useMemo(() => getProgress(rightGoals), [getProgress, rightGoals]);
  const guaguaRate = useMemo(() => getProgress(leftGoals), [getProgress, leftGoals]);

  const openDailySettlement = useCallback(() => {
    setSettlementStep('huahua');
    setShowDailySettlement(true);
  }, []);

  const closeDailySettlement = useCallback(() => {
    setShowDailySettlement(false);
  }, []);

  const openCalendarModal = useCallback(() => {
    setShowCalendarModal(true);
  }, []);

  const closeCalendarModal = useCallback(() => {
    setShowCalendarModal(false);
  }, []);

  const calendarCompletedByDate = useMemo(
    () => (role === 'left' ? roomData.leftCompletedByDate : roomData.rightCompletedByDate),
    [role, roomData.leftCompletedByDate, roomData.rightCompletedByDate],
  );

  const updateGoalsByRole = async (targetRole, updater, errorLabel, extraRoomFields = null) => {
    if (role !== targetRole) return;
    const fieldToUpdate = targetRole === 'left' ? 'leftGoals' : 'rightGoals';
    const currentGoals = targetRole === 'left' ? leftGoals : rightGoals;
    const nextGoals = updater(currentGoals);
    const syncGroupCompletion = (items) =>
      items.map((item) => {
        if (item.type !== 'group') return item;
        const nextChildren = syncGroupCompletion(item.children || []);
        const hasChildren = nextChildren.length > 0;
        const allChildrenCompleted = hasChildren && nextChildren.every((child) => Boolean(child.completed));
        return { ...item, children: nextChildren, completed: allChildrenCompleted };
      });
    const updatedGoals = nextGoals ? syncGroupCompletion(nextGoals) : nextGoals;
    if (!updatedGoals) return;

    if (targetRole === 'left') setLeftGoals(updatedGoals);
    else setRightGoals(updatedGoals);

    try {
      const payload = extraRoomFields ? { [fieldToUpdate]: updatedGoals, ...extraRoomFields } : { [fieldToUpdate]: updatedGoals };
      await updateRoom(payload, { merge: true });
    } catch (err) {
      console.error(errorLabel, err);
    }
  };

  const mapItemInTree = (items, itemId, updater) => {
    const normalizedItemId = normalizeItemId(itemId);
    return items.map((item) => {
      if (normalizeItemId(item.id) === normalizedItemId) return updater(item);
      if (item.type === 'group') {
        return { ...item, children: mapItemInTree(item.children || [], normalizedItemId, updater) };
      }
      return item;
    });
  };

  const findItemInTree = (items, itemId) => {
    const normalizedItemId = normalizeItemId(itemId);
    for (const item of items) {
      if (normalizeItemId(item.id) === normalizedItemId) return item;
      if (item.type === 'group') {
        const found = findItemInTree(item.children || [], normalizedItemId);
        if (found) return found;
      }
    }
    return null;
  };

  const updateCompletedHistoryByDate = (currentByDate, dateKey, nextRecord, isCompleting) => {
    const prev = currentByDate && typeof currentByDate === 'object' ? currentByDate : {};
    const dayList = Array.isArray(prev[dateKey]) ? prev[dateKey] : [];
    const nextDayList = isCompleting
      ? [...dayList.filter((r) => r?.id !== nextRecord.id), nextRecord]
      : dayList.filter((r) => r?.id !== nextRecord.id);
    if (nextDayList.length === dayList.length && nextDayList.every((r, i) => r.id === dayList[i]?.id && r.text === dayList[i]?.text)) {
      return prev;
    }
    return { ...prev, [dateKey]: nextDayList };
  };

  const removeTaskFromTree = (items, taskId) => {
    const normalizedTaskId = normalizeItemId(taskId);
    let removedTask = null;
    const nextItems = [];
    items.forEach((item) => {
      if (item.type === 'task' && normalizeItemId(item.id) === normalizedTaskId) {
        removedTask = item;
        return;
      }
      if (item.type === 'group') {
        const { nextItems: nextChildren, removedTask: removedFromChild } = removeTaskFromTree(item.children || [], normalizedTaskId);
        if (removedFromChild && !removedTask) removedTask = removedFromChild;
        nextItems.push({ ...item, children: nextChildren });
        return;
      }
      nextItems.push(item);
    });
    return { nextItems, removedTask };
  };

  const removeItemFromTree = (items, itemId) => {
    const normalizedItemId = normalizeItemId(itemId);
    let removedItem = null;
    const nextItems = [];
    items.forEach((item) => {
      if (normalizeItemId(item.id) === normalizedItemId) {
        removedItem = item;
        return;
      }
      if (item.type === 'group') {
        const result = removeItemFromTree(item.children || [], normalizedItemId);
        if (result.removedItem && !removedItem) removedItem = result.removedItem;
        nextItems.push({ ...item, children: result.nextItems });
        return;
      }
      nextItems.push(item);
    });
    return { nextItems, removedItem };
  };

  const addTaskToGroupInTree = (items, groupId, taskToAdd) =>
    {
      const normalizedGroupId = normalizeItemId(groupId);
      return items.map((item) => {
        if (item.type === 'group' && normalizeItemId(item.id) === normalizedGroupId) {
          return { ...item, expanded: true, children: [...(item.children || []), taskToAdd] };
        }
        if (item.type === 'group') {
          return { ...item, children: addTaskToGroupInTree(item.children || [], normalizedGroupId, taskToAdd) };
        }
        return item;
      });
    };

  const insertTaskAroundTarget = (items, targetTaskId, taskToInsert, position = 'before') => {
    const normalizedTargetTaskId = normalizeItemId(targetTaskId);
    let inserted = false;
    const nextItems = [];
    items.forEach((item) => {
      if (item.type === 'task' && normalizeItemId(item.id) === normalizedTargetTaskId) {
        inserted = true;
        if (position === 'before') nextItems.push(taskToInsert);
        nextItems.push(item);
        if (position === 'after') nextItems.push(taskToInsert);
        return;
      }
      if (item.type === 'group') {
        const result = insertTaskAroundTarget(item.children || [], normalizedTargetTaskId, taskToInsert, position);
        if (result.inserted) {
          inserted = true;
          nextItems.push({ ...item, children: result.nextItems });
        } else {
          nextItems.push(item);
        }
        return;
      }
      nextItems.push(item);
    });
    return { nextItems, inserted };
  };

  const hasTaskInTree = (items, taskId) => {
    const normalizedTaskId = normalizeItemId(taskId);
    return items.some((item) => {
      if (item.type === 'task' && normalizeItemId(item.id) === normalizedTaskId) return true;
      if (item.type === 'group') return hasTaskInTree(item.children || [], normalizedTaskId);
      return false;
    });
  };

  const handleToggleStudy = async () => {
    if (!role) return;
    const roleKey = role === 'left' ? 'left' : 'right';
    const fieldStudying = `${roleKey}Studying`;
    const fieldStartTime = `${roleKey}StartTime`;
    const currentDateStr = getLocalDateStr();

    if (isStudying) {
      const nowMs = Date.now();
      const exactElapsed = computeRoleTotalElapsed(roomData, roleKey, nowMs);
      await updateRoom(
        buildEndStudyFirestoreUpdates({
          roleKey,
          exactElapsed,
          roomLastActiveDate: roomData.lastActiveDate,
          studyByDate: roomData[`${roleKey}StudyByDate`],
          nowMs,
        }),
        { merge: true },
      );
      try {
        sessionStorage.removeItem(END_STUDY_PENDING_KEY);
      } catch {
        /* ignore */
      }
      return;
    }

    try {
      sessionStorage.removeItem(END_STUDY_PENDING_KEY);
    } catch {
      /* ignore */
    }

    const updates = {};
    if (roomData.lastActiveDate !== currentDateStr) {
      updates.leftDailyTotal = 0;
      updates.rightDailyTotal = 0;
      updates.lastActiveDate = currentDateStr;
    }
    updates[fieldStudying] = true;
    updates[fieldStartTime] = Date.now();
    updates[`${roleKey}LastHeartbeat`] = Date.now();
    updates.lastActiveDate = currentDateStr;
    setCurrentTime(Date.now());
    await updateRoom(updates, { merge: true });
  };

  const sendNudge = async () => {
    if (!role) return;
    const partnerRole = role === 'left' ? 'right' : 'left';
    await updateRoom({ [`${partnerRole}Nudge`]: Date.now() }, { merge: true });
  };

  const handleCreateItem = async (itemType = 'task') => {
    if (!newGoalText.trim() || !role) return;

    const newItem = itemType === 'group' ? createGroupItem(newGoalText.trim()) : createTaskItem(newGoalText.trim());
    await updateGoalsByRole(role, (currentGoals) => [...currentGoals, newItem], 'Update Error:');
    setNewGoalText('');
  };

  const toggleGoal = async (id, targetRole) => {
    const currentGoals = targetRole === 'left' ? leftGoals : rightGoals;
    const targetItem = findItemInTree(currentGoals, id);
    let extraRoomFields = null;
    if (targetItem && targetItem.type === 'task') {
      const dateKey = getLocalDateStr();
      const record = { id: normalizeItemId(targetItem.id), text: targetItem.text || '' };
      const sourceMap = targetRole === 'left' ? roomData.leftCompletedByDate : roomData.rightCompletedByDate;
      const nextMap = updateCompletedHistoryByDate(sourceMap, dateKey, record, !targetItem.completed);
      extraRoomFields = targetRole === 'left' ? { leftCompletedByDate: nextMap } : { rightCompletedByDate: nextMap };
    }
    await updateGoalsByRole(
      targetRole,
      (currentGoals) => mapItemInTree(currentGoals, id, (item) => ({ ...item, completed: !item.completed })),
      'Toggle Error:',
      extraRoomFields,
    );
  };

  const deleteGoal = async (id, targetRole) => {
    await updateGoalsByRole(targetRole, (currentGoals) => removeItemFromTree(currentGoals, id).nextItems, 'Delete Error:');
  };

  const editGoal = async (id, targetRole, newText) => {
    if (role !== targetRole) return;
    const normalizedText = newText.trim();
    if (!normalizedText) return;
    await updateGoalsByRole(
      targetRole,
      (currentGoals) => mapItemInTree(currentGoals, id, (item) => ({ ...item, text: normalizedText })),
      'Edit Error:',
    );
  };

  const reorderGoals = async (targetRole, draggedId, targetId, position = 'before') => {
    if (role !== targetRole || normalizeItemId(draggedId) === normalizeItemId(targetId)) return;
    await updateGoalsByRole(
      targetRole,
      (currentGoals) => {
        if (!hasTaskInTree(currentGoals, draggedId) || !hasTaskInTree(currentGoals, targetId)) {
          console.warn('Reorder skipped: task path invalid', { draggedId, targetId, targetRole });
          return currentGoals;
        }
        const { nextItems, removedTask } = removeTaskFromTree(currentGoals, draggedId);
        if (!removedTask) {
          console.warn('Reorder skipped: dragged task not found', { draggedId, targetRole });
          return currentGoals;
        }
        const inserted = insertTaskAroundTarget(nextItems, targetId, removedTask, position);
        if (!inserted.inserted) {
          console.warn('Reorder skipped: target task not found', { targetId, targetRole });
          return currentGoals;
        }
        return inserted.nextItems;
      },
      'Reorder Error:',
    );
  };

  const reorderTopLevelItem = async (targetRole, draggedId, targetId, position = 'before') => {
    if (role !== targetRole || normalizeItemId(draggedId) === normalizeItemId(targetId)) return;
    if (!draggedId || !targetId) return;
    await updateGoalsByRole(
      targetRole,
      (currentGoals) => {
        const fromIndex = currentGoals.findIndex((item) => normalizeItemId(item.id) === normalizeItemId(draggedId));
        const toIndex = currentGoals.findIndex((item) => normalizeItemId(item.id) === normalizeItemId(targetId));
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
          console.warn('Top-level reorder skipped: item not found', { draggedId, targetId, targetRole });
          return currentGoals;
        }
        const updated = [...currentGoals];
        const [moved] = updated.splice(fromIndex, 1);
        let insertIndex = toIndex;
        if (position === 'after') {
          insertIndex = fromIndex < toIndex ? toIndex : toIndex + 1;
        } else if (fromIndex < toIndex) {
          insertIndex = toIndex - 1;
        }
        updated.splice(insertIndex, 0, moved);
        return updated;
      },
      'Top-level Reorder Error:',
    );
  };

  const toggleGroupExpanded = async (id, targetRole) => {
    await updateGoalsByRole(
      targetRole,
      (currentGoals) =>
        currentGoals.map((g) => (g.id === id && g.type === 'group' ? { ...g, expanded: !g.expanded } : g)),
      'Toggle Group Error:',
    );
  };

  const moveTaskToGroup = async (taskId, groupId, targetRole) => {
    await updateGoalsByRole(
      targetRole,
      (currentGoals) => {
        const { nextItems, removedTask } = removeTaskFromTree(currentGoals, taskId);
        if (!removedTask) {
          console.warn('Move to group skipped: dragged task not found', { taskId, groupId, targetRole });
          return currentGoals;
        }
        return addTaskToGroupInTree(nextItems, groupId, removedTask);
      },
      'Move To Group Error:',
    );
  };

  const moveTaskAroundTopLevelItem = async (taskId, targetItemId, targetRole, position = 'before') => {
    if (normalizeItemId(taskId) === normalizeItemId(targetItemId)) return;
    await updateGoalsByRole(
      targetRole,
      (currentGoals) => {
        const { nextItems, removedTask } = removeTaskFromTree(currentGoals, taskId);
        if (!removedTask) {
          console.warn('Move around top-level skipped: dragged task not found', { taskId, targetItemId, targetRole });
          return currentGoals;
        }
        const targetIndex = nextItems.findIndex((item) => normalizeItemId(item.id) === normalizeItemId(targetItemId));
        if (targetIndex === -1) {
          console.warn('Move around top-level skipped: target item not found', { taskId, targetItemId, targetRole });
          return currentGoals;
        }
        const updated = [...nextItems];
        const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
        updated.splice(insertIndex, 0, removedTask);
        return updated;
      },
      'Move Around Top Level Error:',
    );
  };

  // --- 登入畫面 ---

  if (!role) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f3e9d3_0%,#ecdcbf_45%,#e0caa3_100%)] flex items-center justify-center p-6 font-sans">
        <div className="bg-[#fdf9f1] p-10 rounded-[3rem] border-[6px] border-[#e6dac1] text-center max-w-lg w-full shadow-[0_24px_60px_rgba(120,90,55,0.18)]">
          <div className="flex justify-center mb-6"><RunningDragonIcon /></div>
          <h1 className="text-4xl font-black text-[#b07d0a] mb-4 tracking-wider">呱花秘密基地</h1>
          <p className="text-[#5b4636] mb-8 font-bold leading-relaxed text-lg">
            嘿！夥伴現在的狀態是？<br/>
            {leftDragonIsStudying || rightDragonIsStudying ? (
              <span className="text-[#b07d0a] animate-pulse">🔥 有人在努力中，快加入吧！</span>
            ) : (
              <span className="text-[#9a8568]">目前基地很安靜，可以盡情補眠...</span>
            )}
          </p>
          <div className="flex gap-4">
            <button onClick={() => setRole('left')} className={`flex-1 py-6 rounded-3xl border-4 transition-all relative overflow-hidden group ${leftDragonIsStudying ? 'bg-[#fff7e3] border-[#daa520] shadow-[0_0_20px_rgba(218,165,32,0.25)]' : 'bg-[#f3e9d6] border-transparent hover:border-[#caa53f] hover:bg-[#ece0c9]'}`}>
              <div className="relative z-10 flex flex-col items-center">
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={4} className={`mb-4 transition-transform group-hover:scale-110 ${!leftDragonIsStudying && 'grayscale opacity-50'}`} />
                <span className={`font-black text-xl block ${leftDragonIsStudying ? 'text-[#b07d0a]' : 'text-[#9a8568]'}`}>
                  {leftDragonIsStudying ? '呱呱專注中' : '我是呱呱'}
                </span>
                {leftDragonIsStudying && (
                   <span className="text-[10px] text-[#7a6450] opacity-70 font-mono mt-2 block tracking-tighter">掛機專注中...</span>
                )}
              </div>
              {leftDragonIsStudying && <div className="absolute inset-0 bg-gradient-to-t from-[#daa520]/10 to-transparent pointer-events-none" />}
            </button>

            <button onClick={() => setRole('right')} className={`flex-1 py-6 rounded-3xl border-4 transition-all relative overflow-hidden group ${rightDragonIsStudying ? 'bg-[#fff7e3] border-[#daa520] shadow-[0_0_20px_rgba(218,165,32,0.25)]' : 'bg-[#f3e9d6] border-transparent hover:border-[#caa53f] hover:bg-[#ece0c9]'}`}>
              <div className="relative z-10 flex flex-col items-center">
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={4} className={`mb-4 transition-transform group-hover:scale-110 ${!rightDragonIsStudying && 'grayscale opacity-50'}`} />
                <span className={`font-black text-xl block ${rightDragonIsStudying ? 'text-[#b07d0a]' : 'text-[#9a8568]'}`}>
                  {rightDragonIsStudying ? '花花專注中' : '我是花花'}
                </span>
                {rightDragonIsStudying && (
                   <span className="text-[10px] text-[#7a6450] opacity-70 font-mono mt-2 block tracking-tighter">掛機專注中...</span>
                )}
              </div>
              {rightDragonIsStudying && <div className="absolute inset-0 bg-gradient-to-t from-[#daa520]/10 to-transparent pointer-events-none" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f3e9d3_0%,#ecdcbf_45%,#e0caa3_100%)] text-[#4a3526] font-sans pb-32 overflow-x-hidden">
      <CompletionCalendarModal
        open={showCalendarModal}
        onClose={closeCalendarModal}
        completedByDate={calendarCompletedByDate}
        roleLabel={role === 'left' ? '呱呱' : '花花'}
        leftStudyByDate={roomData.leftStudyByDate}
        rightStudyByDate={roomData.rightStudyByDate}
      />
      <DailySettlementModal
        open={showDailySettlement}
        step={settlementStep}
        onStepChange={setSettlementStep}
        onClose={closeDailySettlement}
        huahuaItems={huahuaItems}
        guaguaItems={guaguaItems}
        huahuaRate={huahuaRate}
        guaguaRate={guaguaRate}
        huahuaSeconds={rightElapsed}
        guaguaSeconds={leftElapsed}
      />
      <aside className={`${showDailySettlement ? 'hidden' : 'hidden md:flex'} fixed left-0 top-0 h-full w-20 bg-[#fdf9f1] border-r-2 border-[#e6dac1] z-[180] flex-col items-center py-6`}>
        <button
          onClick={openCalendarModal}
          className="w-14 h-14 rounded-2xl bg-[#f3e9d6] border-2 border-[#daa520]/50 text-[#b07d0a] hover:bg-[#ece0c9] transition-colors flex flex-col items-center justify-center gap-0.5"
          title="日曆"
        >
          <CalendarDays size={18} />
          <span className="text-[10px] font-black">日曆</span>
        </button>
      </aside>
      {!showDailySettlement && activeTab === 'room' && (
        <button
          onClick={openDailySettlement}
          className="fixed right-6 bottom-6 z-[180] px-5 py-3 rounded-2xl border-2 border-[#daa520] bg-[#fff7e3] text-[#b07d0a] font-black shadow-[0_8px_0_#d8c4a0] hover:bg-[#fdeecb] active:translate-y-1 active:shadow-[0_4px_0_#d8c4a0] transition-all flex items-center gap-2"
        >
          <Sparkles size={18} />
          今日結算
        </button>
      )}
      
      <style>{`
        @keyframes stripe-move {
          0% { background-position: 0 0; }
          100% { background-position: 56.57px 0; }
        }
        .progress-stripes-left {
          background-color: #064e1b;
          background-image: repeating-linear-gradient(
            -45deg,
            #0a6b24 0px,
            #0a6b24 20px,
            transparent 20px,
            transparent 40px
          );
          background-size: 56.57px 56.57px;
          animation: stripe-move 3s linear infinite;
        }
        .progress-stripes-right {
          background-color: #6b4412;
          background-image: repeating-linear-gradient(
            -45deg,
            #8b5a2b 0px,
            #8b5a2b 20px,
            transparent 20px,
            transparent 40px
          );
          background-size: 56.57px 56.57px;
          animation: stripe-move 3s linear infinite;
        }
      `}</style>
      <style>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #d4a373 #1a0f0d;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 12px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a0f0d;
          border: 2px solid #2a1a15;
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #f5c27a 0%, #d4a373 40%, #8d6e63 100%);
          border: 2px solid #1a0f0d;
          border-radius: 999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #ffd59b 0%, #e0b27e 40%, #a57f72 100%);
        }
      `}</style>

      {/* 全螢幕沉浸番茄鐘 */}
      {isStudying && isPomodoro && (
        <div className="fixed inset-0 z-[200] bg-[#0d0706]/95 backdrop-blur-lg flex flex-col items-center justify-center">
          <div className="text-[100px] md:text-[140px] mb-4 animate-pulse drop-shadow-[0_0_40px_rgba(239,68,68,0.4)]">
            🍅
          </div>
          <div className={`font-mono text-7xl md:text-9xl font-black tracking-widest mb-16 drop-shadow-[0_0_30px_rgba(218,165,32,0.4)] ${1500 - mySession <= 0 ? 'text-red-500 animate-bounce' : 'text-[#daa520]'}`}>
            {formatPomodoroTime(Math.max(0, 1500 - mySession))}
          </div>
          <button 
            onClick={handleToggleStudy}
            className="px-10 py-5 bg-[#2c1d1a] text-[#daa520] font-black text-2xl rounded-[2rem] border-4 border-[#daa520] hover:bg-[#daa520] hover:text-[#0d0706] transition-all shadow-[0_0_20px_rgba(218,165,32,0.2)] active:scale-95"
          >
            結束專注
          </button>
        </div>
      )}

      {/* 戳一下全螢幕特效 */}
      {receiveNudge && !isPomodoro && (
        <div className="fixed inset-0 pointer-events-none z-[150] flex items-center justify-center bg-pink-500/10">
          <div className="animate-bounce flex flex-col items-center">
            <Heart size={120} fill="#f472b6" className="text-pink-400 drop-shadow-[0_0_30px_rgba(244,114,182,0.8)]" />
            <span className="text-white font-black text-2xl md:text-4xl mt-6 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] px-6 py-2 bg-pink-500/80 rounded-full border-4 border-white">
              對方給了你一個愛的鼓勵！
            </span>
          </div>
        </div>
      )}

      <header className="bg-[#fdf9f1] border-b-2 border-[#e6dac1] p-4 2xl:p-5 sticky top-0 z-[100] flex flex-wrap gap-y-3 justify-between items-center px-6 md:pl-28 2xl:px-10 2xl:pl-32 shadow-[0_6px_20px_rgba(120,90,55,0.12)]">
        <div className="flex items-center gap-4 min-w-0">
          <RunningDragonIcon />
          <h1 className="text-2xl 2xl:text-3xl font-black tracking-widest text-[#b07d0a] no-wrap-scroll">呱花秘密基地</h1>
        </div>

        {/* 頁籤：共讀小屋 ⇄ 龍龍語言教室 */}
        <nav className="order-3 w-full lg:order-none lg:w-auto flex items-center gap-1.5 bg-[#f3e9d6] border-2 border-[#e6dac1] rounded-2xl p-1">
          {MAIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 lg:flex-none px-4 py-2 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 ${
                  active
                    ? 'bg-[#fff7e3] text-[#b07d0a] border-2 border-[#daa520] shadow-[0_3px_0_#d8c4a0]'
                    : 'text-[#9a8568] border-2 border-transparent hover:bg-[#ece0c9]'
                }`}
              >
                <Icon size={16} />
                <span className="no-wrap-scroll">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-[#8a755b] bg-[#f0e5d0] px-3 py-1 rounded-full hidden md:block no-wrap-scroll">
            你是 {role === 'left' ? '呱呱' : '花花'}
          </span>
          <div className="relative overflow-hidden bg-gradient-to-b from-[#3a2817] to-[#1b120b] px-6 2xl:px-7 py-2 2xl:py-2.5 rounded-2xl border border-[#daa520]/50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.55),0_4px_12px_rgba(120,90,55,0.22)]">
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
            <span className="relative text-2xl 2xl:text-3xl font-mono font-bold tracking-[0.12em] tabular-nums text-[#f4cd57] drop-shadow-[0_0_8px_rgba(244,205,87,0.45)]">{formatTime(myElapsed)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl 2xl:max-w-[1520px] mx-auto p-4 2xl:px-6 md:pl-24 2xl:pl-28 space-y-8 2xl:space-y-7 mt-4 2xl:mt-3">
        {activeTab === 'language' && <LanguageLab role={role} roomData={roomData} />}

        {activeTab === 'wish' && <WishBoard role={role} roomData={roomData} />}

        {activeTab === 'room' && (
        <div className="space-y-8 2xl:space-y-7">
        {/* 背景與動畫區域 */}
        <section className="relative w-full aspect-[21/9] md:aspect-[16/9] bg-[#3a2723] rounded-[4rem] 2xl:rounded-[4.6rem] overflow-hidden border-[12px] 2xl:border-[14px] border-[#2c1d1a] shadow-[0_30px_70px_rgba(74,52,33,0.35)] flex flex-col items-center">
          <div className="absolute inset-0 bg-[#4e342e]" />
          <div className="absolute top-[6%] left-[4%] z-10 opacity-100 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"><AnimatedWindow /></div>
          
          {/* 勵志電子牆 */}
          <div className="absolute top-[8%] right-[6%] z-10 opacity-95">
             <MotivationalBoard />
          </div>
          
          <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-10"><RealTimeClock /></div>
          
          {/* 左側：呱呱 */}
          <div className="absolute bottom-[28%] left-[25%] -translate-x-1/2 z-20 flex justify-center items-end">
             {role === 'right' && (
               <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded-xl border border-[#daa520]/50 text-[#daa520] font-mono text-sm font-bold z-50 tracking-wider shadow-[0_0_10px_rgba(0,0,0,0.6)]">
                 {formatTime(leftElapsed)}
               </div>
             )}
             <div className={`transition-all duration-700 ${leftDragonIsStudying ? 'opacity-100 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={11} className="drop-shadow-[0_15px_15px_rgba(0,0,0,0.7)]" />
             </div>
             {!leftDragonIsStudying && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 scale-100">
                  <PixelArt art={SPRITES.dragonSleep} palette={PALETTES.dragon} pixelSize={11} />
                  <div className="absolute -top-10 -right-8"><PixelArt art={SPRITES.zzz} palette={PALETTES.dragon} pixelSize={3.5} /></div>
                </div>
             )}
          </div>
          
          {/* 右側：花花 */}
          <div className="absolute bottom-[28%] left-[75%] -translate-x-1/2 z-20 flex justify-center items-end">
             {role === 'left' && (
               <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded-xl border border-[#daa520]/50 text-[#daa520] font-mono text-sm font-bold z-50 tracking-wider shadow-[0_0_10px_rgba(0,0,0,0.6)]">
                 {formatTime(rightElapsed)}
               </div>
             )}
             <div className={`transition-all duration-700 ${rightDragonIsStudying ? 'opacity-100 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={11} className="drop-shadow-[0_15px_15px_rgba(0,0,0,0.7)]" />
             </div>
             {!rightDragonIsStudying && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 scale-100">
                  <PixelArt art={SPRITES.dragonSleep} palette={PALETTES.dragon} pixelSize={11} />
                  <div className="absolute -top-10 -right-8"><PixelArt art={SPRITES.zzz} palette={PALETTES.dragon} pixelSize={3.5} /></div>
                </div>
             )}
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-[32%] z-30 bg-[#4e342e] border-t-[20px] border-[#795548] shadow-[0_-20px_40px_rgba(0,0,0,0.6)]">
             <div className="absolute top-0 left-0 w-full h-2 bg-white/10" />
             <div className="absolute top-[-20px] left-0 w-full h-2 bg-black/20" />
          </div>

          <div className="absolute bottom-0 w-full h-full z-40 pointer-events-none">
             <div className={`absolute inset-0 transition-all duration-700 ${leftDragonIsStudying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                 <div className="absolute bottom-[10%] left-[12%] z-[41] flex flex-col items-center">
                    {leftDragonIsStudying && <div className="absolute -top-14 left-1/2 -translate-x-1/2"><Steam /></div>}
                    <div className="drop-shadow-[0_15px_10px_rgba(0,0,0,0.8)]"><PixelArt art={SPRITES.coffeeCupDetailed} palette={PALETTES.env} pixelSize={8} /></div>
                 </div>
                 <div className="absolute bottom-[12%] left-[28%] z-[40]">
                    <div className="drop-shadow-[0_20px_15px_rgba(0,0,0,0.8)]"><PixelArt art={SPRITES.redBook} palette={PALETTES.env} pixelSize={7.5} /></div>
                 </div>
             </div>

             <div className={`absolute inset-0 transition-all duration-700 ${rightDragonIsStudying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                 <div className="absolute bottom-[10%] left-[62%] z-[41] flex flex-col items-center">
                    {rightDragonIsStudying && <div className="absolute -top-14 left-1/2 -translate-x-1/2"><Steam /></div>}
                    <div className="drop-shadow-[0_15px_10px_rgba(0,0,0,0.8)]"><PixelArt art={SPRITES.coffeeCupDetailed} palette={PALETTES.env} pixelSize={8} /></div>
                 </div>
                 <div className="absolute bottom-[12%] left-[78%] z-[40]">
                    <div className="drop-shadow-[0_20px_15px_rgba(0,0,0,0.8)]"><PixelArt art={SPRITES.redBook} palette={PALETTES.env} pixelSize={7.5} /></div>
                 </div>
             </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 z-[50] pointer-events-none" />
        </section>

        <div className="px-6 md:px-12 2xl:px-14 space-y-6 2xl:space-y-5">
          
          <button
            onClick={handleToggleStudy}
            className={`group w-full py-7 2xl:py-8 rounded-[2.5rem] 2xl:rounded-[2.8rem] font-black text-2xl 2xl:text-[2rem] transition-all duration-150 flex items-center justify-center relative overflow-hidden active:translate-y-[6px] ${
              isStudying
                ? 'bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] shadow-[0_9px_0_#a9760a,0_16px_28px_rgba(176,125,10,0.35)] active:shadow-[0_3px_0_#a9760a]'
                : 'bg-gradient-to-b from-[#57c25c] to-[#369a3f] text-white shadow-[0_9px_0_#2b7a33,0_16px_28px_rgba(46,125,50,0.35)] active:shadow-[0_3px_0_#2b7a33]'
            }`}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/30 to-transparent" />
            {isStudying ? (
              <div className="relative flex items-center gap-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]"><Coffee size={34} /> 暫時休息</div>
            ) : (
              <div className="relative flex items-center justify-center gap-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.18)]">
                <BookOpen size={34} />
                <span>開始專注</span>
                <label
                  onClick={(e) => e.stopPropagation()}
                  className={`flex items-center gap-2 cursor-pointer font-bold text-base px-4 py-2 rounded-full ml-3 border transition-all duration-200 active:scale-95 ${isPomodoro ? 'bg-white text-[#d23f31] border-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]' : 'bg-black/15 text-white border-white/40 hover:bg-black/25'}`}
                >
                  <input type="checkbox" checked={isPomodoro} onChange={e => setIsPomodoro(e.target.checked)} className="w-4 h-4 accent-[#e74c3c] cursor-pointer" />
                  🍅 番茄鐘
                </label>
              </div>
            )}
          </button>

          {/* 任務方塊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 2xl:gap-7">
            <TaskPanel
              panelRole="left"
              role={role}
              goals={leftGoals}
              newGoalText={newGoalText}
              onNewGoalTextChange={setNewGoalText}
              onCreateItem={handleCreateItem}
              onToggleGoal={toggleGoal}
              onDeleteGoal={deleteGoal}
              onEditGoal={editGoal}
              onReorderGoals={reorderGoals}
              onReorderTopLevelItem={reorderTopLevelItem}
              onToggleGroupExpanded={toggleGroupExpanded}
              onMoveTaskToGroup={moveTaskToGroup}
              onMoveTaskAroundTopLevelItem={moveTaskAroundTopLevelItem}
              onSendNudge={sendNudge}
            />
            <TaskPanel
              panelRole="right"
              role={role}
              goals={rightGoals}
              newGoalText={newGoalText}
              onNewGoalTextChange={setNewGoalText}
              onCreateItem={handleCreateItem}
              onToggleGoal={toggleGoal}
              onDeleteGoal={deleteGoal}
              onEditGoal={editGoal}
              onReorderGoals={reorderGoals}
              onReorderTopLevelItem={reorderTopLevelItem}
              onToggleGroupExpanded={toggleGroupExpanded}
              onMoveTaskToGroup={moveTaskToGroup}
              onMoveTaskAroundTopLevelItem={moveTaskAroundTopLevelItem}
              onSendNudge={sendNudge}
            />
          </div>
        </div>
        </div>
        )}
      </main>
    </div>
  );
}