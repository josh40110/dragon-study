import { useState } from 'react';
import { BookOpen, Coffee, Heart } from 'lucide-react';
import { setDoc } from 'firebase/firestore';
import AnimatedWindow from './components/AnimatedWindow';
import MotivationalBoard from './components/MotivationalBoard';
import PixelArt from './components/PixelArt';
import RealTimeClock from './components/RealTimeClock';
import RunningDragonIcon from './components/RunningDragonIcon';
import Steam from './components/Steam';
import TaskPanel from './components/TaskPanel';
import { createGroupItem, createTaskItem, normalizeItemId } from './constants/roomDefaults';
import { PALETTES, SPRITES } from './constants/pixelArtData';
import { getRoomRef } from './lib/firebase';
import { getLocalDateStr } from './utils/date';
import useNudgeEffect from './hooks/useNudgeEffect';
import useRoomSync from './hooks/useRoomSync';
import useStudyTimer from './hooks/useStudyTimer';

export default function App() {
  const [role, setRole] = useState(null);
  const { roomData, leftGoals, setLeftGoals, rightGoals, setRightGoals } = useRoomSync();
  const [newGoalText, setNewGoalText] = useState('');
  const [isPomodoro, setIsPomodoro] = useState(false);
  const receiveNudge = useNudgeEffect(roomData, role);

  const isStudying = role === 'left' ? roomData.leftStudying : roomData.rightStudying;
  const leftDragonIsStudying = roomData?.leftStudying || false;
  const rightDragonIsStudying = roomData?.rightStudying || false;
  const { leftElapsed, rightElapsed, myElapsed, mySession, setCurrentTime } = useStudyTimer(roomData, role);

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

  const updateGoalsByRole = async (targetRole, updater, errorLabel) => {
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
      await setDoc(getRoomRef(), { [fieldToUpdate]: updatedGoals }, { merge: true });
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
    if (!role || !getRoomRef) return;
    const roomRef = getRoomRef();
    const roleKey = role === 'left' ? 'left' : 'right';
    const fieldStudying = `${roleKey}Studying`;
    const fieldStartTime = `${roleKey}StartTime`;
    const fieldDailyTotal = `${roleKey}DailyTotal`;
    const currentDateStr = getLocalDateStr();

    const updates = {};
    if (roomData.lastActiveDate !== currentDateStr) {
      updates.leftDailyTotal = 0;
      updates.rightDailyTotal = 0;
      updates.lastActiveDate = currentDateStr;
    }

    if (isStudying) {
      const exactElapsed = role === 'left' ? leftElapsed : rightElapsed;
      updates[fieldStudying] = false;
      updates[fieldStartTime] = null;
      updates[fieldDailyTotal] = exactElapsed;
      updates.lastActiveDate = currentDateStr;
    } else {
      updates[fieldStudying] = true;
      updates[fieldStartTime] = Date.now();
      updates.lastActiveDate = currentDateStr;
      setCurrentTime(Date.now());
    }

    await setDoc(roomRef, updates, { merge: true });
  };

  const sendNudge = async () => {
    if (!role || !getRoomRef) return;
    const partnerRole = role === 'left' ? 'right' : 'left';
    await setDoc(getRoomRef(), { [`${partnerRole}Nudge`]: Date.now() }, { merge: true });
  };

  const handleCreateItem = async (itemType = 'task') => {
    if (!newGoalText.trim() || !role) return;

    const newItem = itemType === 'group' ? createGroupItem(newGoalText.trim()) : createTaskItem(newGoalText.trim());
    await updateGoalsByRole(role, (currentGoals) => [...currentGoals, newItem], 'Update Error:');
    setNewGoalText('');
  };

  const toggleGoal = async (id, targetRole) => {
    await updateGoalsByRole(
      targetRole,
      (currentGoals) => mapItemInTree(currentGoals, id, (item) => ({ ...item, completed: !item.completed })),
      'Toggle Error:',
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
      <div className="min-h-screen bg-[#0d0706] flex items-center justify-center p-6 font-sans">
        <div className="bg-[#1a0f0d] p-10 rounded-[3rem] border-[6px] border-[#3e2723] text-center max-w-lg w-full shadow-[0_0_100px_rgba(0,0,0,0.8)]">
          <div className="flex justify-center mb-6"><RunningDragonIcon /></div>
          <h1 className="text-4xl font-black text-[#daa520] mb-4 tracking-wider">呱花秘密基地</h1>
          <p className="text-[#e0d5c1] mb-8 font-bold leading-relaxed text-lg">
            嘿！夥伴現在的狀態是？<br/>
            {roomData.leftStudying || roomData.rightStudying ? (
              <span className="text-[#daa520] animate-pulse">🔥 有人在努力中，快加入吧！</span>
            ) : (
              <span className="text-[#8d6e63]">目前基地很安靜，可以盡情補眠...</span>
            )}
          </p>
          <div className="flex gap-4">
            <button onClick={() => setRole('left')} className={`flex-1 py-6 rounded-3xl border-4 transition-all relative overflow-hidden group ${roomData.leftStudying ? 'bg-[#2c1d1a] border-[#daa520] shadow-[0_0_20px_rgba(218,165,32,0.3)]' : 'bg-[#3e2723] border-transparent hover:border-[#daa520] hover:bg-[#5d4037]'}`}>
              <div className="relative z-10 flex flex-col items-center">
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={4} className={`mb-4 transition-transform group-hover:scale-110 ${!roomData.leftStudying && 'grayscale opacity-50'}`} />
                <span className={`font-black text-xl block ${roomData.leftStudying ? 'text-[#daa520]' : 'text-[#8d6e63]'}`}>
                  {roomData.leftStudying ? '呱呱專注中' : '我是呱呱'}
                </span>
                {roomData.leftStudying && (
                   <span className="text-[10px] text-[#e0d5c1] opacity-60 font-mono mt-2 block tracking-tighter">掛機專注中...</span>
                )}
              </div>
              {roomData.leftStudying && <div className="absolute inset-0 bg-gradient-to-t from-[#daa520]/10 to-transparent pointer-events-none" />}
            </button>

            <button onClick={() => setRole('right')} className={`flex-1 py-6 rounded-3xl border-4 transition-all relative overflow-hidden group ${roomData.rightStudying ? 'bg-[#2c1d1a] border-[#daa520] shadow-[0_0_20px_rgba(218,165,32,0.3)]' : 'bg-[#3e2723] border-transparent hover:border-[#daa520] hover:bg-[#5d4037]'}`}>
              <div className="relative z-10 flex flex-col items-center">
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={4} className={`mb-4 transition-transform group-hover:scale-110 ${!roomData.rightStudying && 'grayscale opacity-50'}`} />
                <span className={`font-black text-xl block ${roomData.rightStudying ? 'text-[#daa520]' : 'text-[#8d6e63]'}`}>
                  {roomData.rightStudying ? '花花專注中' : '我是花花'}
                </span>
                {roomData.rightStudying && (
                   <span className="text-[10px] text-[#e0d5c1] opacity-60 font-mono mt-2 block tracking-tighter">掛機專注中...</span>
                )}
              </div>
              {roomData.rightStudying && <div className="absolute inset-0 bg-gradient-to-t from-[#daa520]/10 to-transparent pointer-events-none" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0706] text-[#e0d5c1] font-sans pb-32 overflow-x-hidden">
      
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

      <header className="bg-[#1a0f0d] border-b-2 border-[#3e2723] p-4 sticky top-0 z-[100] flex justify-between items-center px-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <RunningDragonIcon />
          <h1 className="text-2xl font-black tracking-widest text-[#daa520]">呱花秘密基地</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-[#8d6e63] bg-[#3e2723] px-3 py-1 rounded-full hidden md:block">
            你是 {role === 'left' ? '呱呱' : '花花'}
          </span>
          <div className="bg-black/80 px-6 py-2 rounded-2xl border-2 border-[#daa520]/40 shadow-[0_0_15px_rgba(218,165,32,0.15)]">
            <span className="text-2xl font-mono font-bold text-[#daa520]">{formatTime(myElapsed)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-8 mt-4">
        {/* 背景與動畫區域 */}
        <section className="relative w-full aspect-[21/9] md:aspect-[16/9] bg-[#3a2723] rounded-[4rem] overflow-hidden border-[12px] border-[#2c1d1a] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col items-center">
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

        <div className="px-6 md:px-12 space-y-6">
          
          <button 
            onClick={handleToggleStudy}
            className={`w-full py-8 rounded-[3rem] font-black text-2xl border-[6px] border-black shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3 transition-all flex items-center justify-center relative ${
              isStudying ? 'bg-[#daa520] text-black' : 'bg-[#388e3c] text-white'
            }`}
          >
            {isStudying ? (
              <div className="flex items-center gap-6"><Coffee size={36} /> 暫時休息</div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <BookOpen size={36} /> 
                <span>開始專注</span>
                <label 
                  onClick={(e) => e.stopPropagation()} 
                  className="flex items-center gap-2 cursor-pointer text-white hover:text-yellow-200 transition-colors font-bold text-base bg-black/30 px-4 py-2 rounded-full ml-4 border-2 border-black/20"
                >
                  <input type="checkbox" checked={isPomodoro} onChange={e => setIsPomodoro(e.target.checked)} className="w-5 h-5 accent-[#daa520]" />
                  🍅 番茄鐘
                </label>
              </div>
            )}
          </button>

          {/* 任務方塊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </main>
    </div>
  );
}