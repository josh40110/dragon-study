import { Check, CheckCircle2, ChevronDown, ChevronUp, Circle, GripVertical, Heart, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

/** 拖曳結束後短暫抑制誤觸 click（模組層級，避免 react-hooks/purity 將 Date.now 視為 render 期呼叫） */
function isClickSuppressed(suppressUntilRef) {
  return Date.now() < suppressUntilRef.current;
}

const getProgress = (targetGoals) => {
  if (!targetGoals || targetGoals.length === 0) return 0;
  const completedCount = targetGoals.filter((g) => g.completed).length;
  return Math.round((completedCount / targetGoals.length) * 100);
};

export default function TaskPanel({
  panelRole,
  role,
  goals,
  newGoalText,
  onNewGoalTextChange,
  onCreateItem,
  onToggleGoal,
  onDeleteGoal,
  onEditGoal,
  onReorderGoals,
  onReorderTopLevelItem,
  onToggleGroupExpanded,
  onMoveTaskToGroup,
  onMoveTaskAroundTopLevelItem,
  onSendNudge,
}) {
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [draggingGoalId, setDraggingGoalId] = useState(null);
  const [draggingItemType, setDraggingItemType] = useState(null);
  const [dragOverGoalId, setDragOverGoalId] = useState(null);
  const [dropPosition, setDropPosition] = useState('before');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [createMode, setCreateMode] = useState('task');
  const suppressClickUntilRef = useRef(0);
  const draggingGoalIdRef = useRef(null);
  const draggingItemTypeRef = useRef(null);
  const dragHoverKeyRef = useRef(null);
  const dropPositionRef = useRef('before');
  const dragOverRafRef = useRef(null);
  const pendingDragHoverRef = useRef(null);
  const DND_MIME = 'application/x-task-dnd';
  const isLeft = panelRole === 'left';
  const progress = getProgress(goals);
  const isMyPanel = role === panelRole;
  const headerTitle = isLeft ? '呱呱的任務' : '花花的任務';
  const accent = isLeft
    ? {
        borderActive: '#0a6b24',
        borderProgress: '#14532d',
        borderIdle: '#2a1a15',
        stripeClass: 'progress-stripes-left',
        stripeShadow: '4px 0 20px rgba(10,107,36,0.6)',
        itemDone: 'bg-[#061c0f] border-[#14532d] opacity-60',
        itemTodo: 'bg-[#0d0706] border-[#14532d]/40',
        iconDone: 'text-[#22c55e]',
        iconTodo: 'text-[#14532d]',
        textDone: 'line-through text-[#166534]',
        textTodo: 'text-[#e0d5c1]',
        emptyText: 'text-[#14532d]',
        inputClass:
          'flex-1 bg-[#0d0706] border-4 border-[#14532d]/40 px-6 py-4 rounded-[1.5rem] font-bold text-xl outline-none focus:border-[#22c55e] transition-colors shadow-inner text-[#e0d5c1]',
        btnClass:
          'bg-[#14532d] p-4 rounded-2xl text-[#22c55e] hover:bg-[#22c55e] hover:text-[#0d0706] transition-all border-b-4 border-black active:translate-y-1 active:border-b-0',
      }
    : {
        borderActive: '#b8860b',
        borderProgress: '#8b6508',
        borderIdle: '#2a1a15',
        stripeClass: 'progress-stripes-right',
        stripeShadow: '4px 0 20px rgba(184,134,11,0.6)',
        itemDone: 'bg-[#2c1d1a] border-[#3e2723] opacity-60',
        itemTodo: 'bg-[#0d0706] border-[#5d4037]',
        iconDone: 'text-[#daa520]',
        iconTodo: 'text-[#5d4037]',
        textDone: 'line-through text-[#8d6e63]',
        textTodo: '',
        emptyText: 'text-[#3e2723]',
        inputClass:
          'flex-1 bg-[#0d0706] border-4 border-[#3e2723] px-6 py-4 rounded-[1.5rem] font-bold text-xl outline-none focus:border-[#daa520] transition-colors shadow-inner',
        btnClass:
          'bg-[#3e2723] p-4 rounded-2xl text-[#daa520] hover:bg-[#daa520] hover:text-[#0d0706] transition-all border-b-4 border-black active:translate-y-1 active:border-b-0',
      };

  const startEdit = (goal) => {
    setEditingGoalId(goal.id);
    setEditingText(goal.text);
  };

  const cancelEdit = () => {
    setEditingGoalId(null);
    setEditingText('');
  };

  const saveEdit = async () => {
    if (!isMyPanel || !editingGoalId) return;
    const trimmed = editingText.trim();
    if (!trimmed) {
      cancelEdit();
      return;
    }
    await onEditGoal(editingGoalId, panelRole, trimmed);
    cancelEdit();
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    await onCreateItem(createMode);
    setShowCreateMenu(false);
  };

  const openCreateMenu = () => setShowCreateMenu((prev) => !prev);

  const selectCreateMode = (mode) => {
    setCreateMode(mode);
    setShowCreateMenu(false);
  };

  const writeDragPayload = (e, payload) => {
    const serialized = JSON.stringify(payload);
    e.dataTransfer.setData(DND_MIME, serialized);
    e.dataTransfer.setData('text/task-id', String(payload.taskId));
    e.dataTransfer.setData('text/item-type', String(payload.itemType || 'task'));
    e.dataTransfer.setData('text/source-group-id', payload.sourceGroupId ? String(payload.sourceGroupId) : '');
    e.dataTransfer.effectAllowed = 'move';
  };
  const readDragPayload = (e) => {
    const raw = e.dataTransfer.getData(DND_MIME);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    const refId = draggingGoalIdRef.current;
    const fallbackTaskId =
      e.dataTransfer.getData('text/task-id') ||
      (refId != null && refId !== '' ? String(refId) : draggingGoalId != null && draggingGoalId !== '' ? String(draggingGoalId) : null);
    if (!fallbackTaskId) return null;
    const fallbackItemType = e.dataTransfer.getData('text/item-type') || draggingItemTypeRef.current || 'task';
    const fallbackSourceGroupId = e.dataTransfer.getData('text/source-group-id') || null;
    return {
      taskId: fallbackTaskId,
      itemId: fallbackTaskId,
      itemType: fallbackItemType,
      sourceGroupId: fallbackSourceGroupId,
    };
  };
  const canAcceptDrop = (e) => {
    if (!isMyPanel) return false;
    if (draggingGoalIdRef.current != null || draggingGoalId) return true;
    const types = e.dataTransfer?.types ? Array.from(e.dataTransfer.types) : [];
    return types.includes(DND_MIME) || types.includes('text/task-id');
  };

  const resetDragHoverRefs = useCallback(() => {
    dragHoverKeyRef.current = null;
    dropPositionRef.current = 'before';
    pendingDragHoverRef.current = null;
    if (dragOverRafRef.current !== null) {
      cancelAnimationFrame(dragOverRafRef.current);
      dragOverRafRef.current = null;
    }
  }, []);

  /** 釋放拖曳 session（ref + state + hover）；onDrop 不論早退或成功都應 finally 呼叫，避免 ref 卡死 */
  const clearDragSession = useCallback(() => {
    draggingGoalIdRef.current = null;
    draggingItemTypeRef.current = null;
    setDraggingGoalId(null);
    setDraggingItemType(null);
    setDragOverGoalId(null);
    resetDragHoverRefs();
  }, [resetDragHoverRefs]);

  const flushPendingDragHover = useCallback(() => {
    dragOverRafRef.current = null;
    const pending = pendingDragHoverRef.current;
    if (!pending) return;
    pendingDragHoverRef.current = null;
    const { key, position } = pending;
    if (dragHoverKeyRef.current === key && dropPositionRef.current === position) return;
    dragHoverKeyRef.current = key;
    dropPositionRef.current = position;
    setDragOverGoalId(key);
    setDropPosition(position);
  }, []);

  /** 在 onDrop 前呼叫，避免 rAF 尚未 flush 導致 dropPosition 過期 */
  const syncDragHoverBeforeDrop = useCallback(() => {
    if (dragOverRafRef.current !== null) {
      cancelAnimationFrame(dragOverRafRef.current);
      dragOverRafRef.current = null;
    }
    const pending = pendingDragHoverRef.current;
    if (pending) {
      pendingDragHoverRef.current = null;
      dragHoverKeyRef.current = pending.key;
      dropPositionRef.current = pending.position;
      setDragOverGoalId(pending.key);
      setDropPosition(pending.position);
    }
    return dropPositionRef.current;
  }, []);

  const queueDragHoverUpdate = useCallback(
    (key, position) => {
      pendingDragHoverRef.current = { key, position };
      if (dragOverRafRef.current === null) {
        dragOverRafRef.current = requestAnimationFrame(flushPendingDragHover);
      }
    },
    [flushPendingDragHover],
  );

  useEffect(
    () => () => {
      if (dragOverRafRef.current !== null) cancelAnimationFrame(dragOverRafRef.current);
    },
    [],
  );

  const renderTopLevelInsertZone = (targetItemId, position = 'before') => (
    <div
      key={`insert-${targetItemId}-${position}`}
      onDragEnter={(e) => {
        if (!canAcceptDrop(e)) return;
        if (!draggingItemTypeRef.current) return;
        e.preventDefault();
      }}
      onDragOver={(e) => {
        if (!canAcceptDrop(e)) return;
        const kind = draggingItemTypeRef.current;
        if (kind !== 'task' && kind !== 'group') return;
        e.preventDefault();
        e.stopPropagation();
        try {
          e.dataTransfer.dropEffect = 'move';
        } catch {
          /* ignore */
        }
        const key = `insert-${targetItemId}-${position}`;
        queueDragHoverUpdate(key, position);
      }}
      onDrop={(e) => {
        e.stopPropagation();
        try {
          syncDragHoverBeforeDrop();
          const payload = readDragPayload(e);
          const activeDraggedId = payload?.itemId ?? payload?.taskId ?? draggingGoalIdRef.current;
          const itemType = payload?.itemType || draggingItemTypeRef.current;
          if (!isMyPanel || activeDraggedId == null || activeDraggedId === '') return;
          e.preventDefault();
          if (itemType === 'group') {
            onReorderTopLevelItem(panelRole, String(activeDraggedId), targetItemId, position);
          } else {
            onMoveTaskAroundTopLevelItem(String(activeDraggedId), targetItemId, panelRole, position);
          }
        } finally {
          clearDragSession();
        }
      }}
      className={`relative z-20 -my-1.5 min-h-[28px] h-7 rounded-md transition-all ${dragOverGoalId === `insert-${targetItemId}-${position}` ? 'bg-[#daa520]/40 border border-[#daa520]' : 'bg-transparent border border-transparent'}`}
    />
  );

  const renderTaskRow = (task, level = 0, inGroupId = null) => (
    <div
      key={`${inGroupId ?? 'top'}-${task.id}`}
      data-drop-kind="task-row"
      data-task-id={task.id}
      onDragOver={(e) => {
        if (!canAcceptDrop(e)) return;
        e.stopPropagation();
        e.preventDefault();
        try {
          e.dataTransfer.dropEffect = 'move';
        } catch {
          /* ignore */
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const isBefore = e.clientY < rect.top + rect.height / 2;
        const nextPos = isBefore ? 'before' : 'after';
        queueDragHoverUpdate(task.id, nextPos);
      }}
      onDrop={(e) => {
        e.stopPropagation();
        try {
          const position = syncDragHoverBeforeDrop();
          const payload = readDragPayload(e);
          const activeDraggedId = payload?.itemId ?? payload?.taskId ?? draggingGoalIdRef.current;
          const itemType = payload?.itemType || draggingItemTypeRef.current;
          if (!isMyPanel || activeDraggedId == null || activeDraggedId === '') return;
          e.preventDefault();
          if (itemType === 'group' && level === 0) {
            onReorderTopLevelItem(panelRole, String(activeDraggedId), task.id, position);
          } else if (itemType !== 'group') {
            onReorderGoals(panelRole, String(activeDraggedId), task.id, position);
          }
        } finally {
          clearDragSession();
        }
      }}
      onClick={() => {
        if (draggingGoalId || isClickSuppressed(suppressClickUntilRef)) return;
        onToggleGoal(task.id, panelRole);
      }}
      className={`p-3 rounded-2xl border-[3px] transition-all flex items-start gap-3 group relative ${isMyPanel ? 'cursor-default' : 'cursor-not-allowed'} ${task.completed ? accent.itemDone : accent.itemTodo} ${draggingGoalId === task.id ? 'opacity-40 scale-[0.98]' : ''} ${dragOverGoalId === task.id ? 'ring-2 ring-[#daa520]/70' : ''} ${level > 0 ? 'ml-6' : ''}`}
    >
      {dragOverGoalId === task.id && draggingGoalId !== task.id && (
        <div className={`absolute left-3 right-3 h-[3px] bg-[#daa520] rounded-full shadow-[0_0_12px_rgba(218,165,32,0.9)] ${dropPosition === 'before' ? 'top-[-2px]' : 'bottom-[-2px]'}`} />
      )}
      <div
        draggable={isMyPanel}
        onDragStart={(e) => {
          e.stopPropagation();
          writeDragPayload(e, {
            taskId: String(task.id),
            itemId: String(task.id),
            itemType: 'task',
            sourceGroupId: inGroupId ? String(inGroupId) : null,
            sourceLevel: level,
          });
          draggingGoalIdRef.current = task.id;
          draggingItemTypeRef.current = 'task';
          setDraggingGoalId(task.id);
          setDraggingItemType('task');
          setDragOverGoalId(null);
          resetDragHoverRefs();
          suppressClickUntilRef.current = Date.now() + 300;
        }}
        onDragEnd={(e) => {
          e.stopPropagation();
          clearDragSession();
          suppressClickUntilRef.current = Date.now() + 300;
        }}
        className={`${isMyPanel ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'} shrink-0 mt-1 touch-none`}
        title="拖曳排序"
      >
        <GripVertical size={16} className="text-[#8d6e63] opacity-60" />
      </div>
      {task.completed ? <CheckCircle2 size={24} className={`${accent.iconDone} shrink-0 mt-0.5`} /> : <Circle size={24} className={`${accent.iconTodo} shrink-0 mt-0.5`} />}
      {editingGoalId === task.id ? (
        <input
          value={editingText}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setEditingText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              saveEdit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
          className="text-base font-bold flex-1 bg-black/20 border border-[#daa520]/40 rounded-lg px-2 py-1 outline-none focus:border-[#daa520]"
          autoFocus
        />
      ) : (
        <span
          title={task.text}
          className={`text-base font-bold flex-1 min-w-0 line-clamp-2 break-words ${task.completed ? accent.textDone : accent.textTodo}`}
        >
          {task.text}
        </span>
      )}
      {isMyPanel && (
        <div className="flex items-center gap-1">
          {editingGoalId === task.id ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  saveEdit();
                }}
                className="opacity-100 text-[#22c55e] hover:text-[#86efac] transition-opacity p-1 shrink-0"
              >
                <Check size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  cancelEdit();
                }}
                className="opacity-100 text-[#f59e0b] hover:text-[#fcd34d] transition-opacity p-1 shrink-0"
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEdit(task);
                }}
                className="opacity-0 group-hover:opacity-100 text-[#9ca3af] hover:text-[#e5e7eb] transition-opacity p-1 shrink-0"
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteGoal(task.id, panelRole);
                }}
                className="opacity-0 group-hover:opacity-100 text-[#8b1a1a] hover:text-[#ff4d4d] transition-opacity p-1 shrink-0"
              >
                <Trash2 size={18} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className={`bg-[#1a0f0d] rounded-[3rem] p-8 border-4 overflow-hidden transition-all ${isMyPanel ? 'border-[#3e2723] shadow-2xl' : 'border-black/50 opacity-80'}`}>
      <div
        className="relative overflow-hidden bg-[#0c0807] border-b-[3px] border-[#2a1a15] h-24 flex items-end pb-5 px-14 mb-8 -mt-8 -mx-8 transition-colors duration-300"
        style={{ borderColor: progress === 100 ? accent.borderActive : progress > 0 ? accent.borderProgress : accent.borderIdle }}
      >
        <div
          className={`absolute left-0 top-0 h-full transition-all duration-[800ms] ease-[cubic-bezier(0.19,1,0.22,1)] z-0 ${accent.stripeClass}`}
          style={{ width: `${progress}%`, boxShadow: progress > 0 && progress < 100 ? accent.stripeShadow : 'none' }}
        />
        <div className="relative z-10 w-full flex justify-between items-center pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <h3 className="text-[#daa520] font-black text-2xl flex items-center gap-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              <Trophy size={28} /> {headerTitle}
            </h3>
            {role && role !== panelRole && (
              <button onClick={onSendNudge} className="flex items-center gap-1 text-[#f472b6] hover:text-pink-400 bg-[#331515] px-3 py-1 rounded-full border-2 border-[#f472b6]/30 hover:scale-105 active:scale-95 transition-all text-sm font-bold shadow-sm ml-2">
                <Heart size={16} fill="currentColor" /> 戳一下
              </button>
            )}
          </div>
          <div className="text-right text-sm font-bold text-[#daa520] flex items-center gap-4 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-xl border border-[#daa520]/20 pointer-events-auto shadow-sm">
            進度 {progress}%
          </div>
        </div>
      </div>

      <div
        className="space-y-2 mb-8 h-[500px] overflow-y-auto pr-2 custom-scrollbar"
        onDragEnter={(e) => {
          if (!canAcceptDrop(e)) return;
          e.preventDefault();
        }}
      >
        {goals.map((goal, index) => (
          <div key={`top-wrap-${goal.id}`}>
            {renderTopLevelInsertZone(goal.id, 'before')}
            {goal.type === 'task' ? (
              renderTaskRow(goal, 0, null)
            ) : (
              <div
              data-drop-kind="group-container"
              data-group-id={goal.id}
              onDragOverCapture={(e) => {
                if (!canAcceptDrop(e)) return;
                if (draggingItemTypeRef.current !== 'group') return;
                e.preventDefault();
                e.stopPropagation();
                try {
                  e.dataTransfer.dropEffect = 'move';
                } catch {
                  /* ignore */
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const relativeY = (e.clientY - rect.top) / Math.max(rect.height, 1);
                const nextPos = relativeY < 0.5 ? 'before' : 'after';
                queueDragHoverUpdate(`group-${goal.id}`, nextPos);
              }}
              onDragOver={(e) => {
                if (!canAcceptDrop(e)) return;
                if (draggingItemTypeRef.current === 'group') return;
                e.stopPropagation();
                e.preventDefault();
                try {
                  e.dataTransfer.dropEffect = 'move';
                } catch {
                  /* ignore */
                }
                const rect = e.currentTarget.getBoundingClientRect();
                const relativeY = (e.clientY - rect.top) / Math.max(rect.height, 1);
                const dragKind = draggingItemTypeRef.current;
                let nextPos;
                if (dragKind === 'task') {
                  if (relativeY < 0.22) nextPos = 'before';
                  else if (relativeY > 0.78) nextPos = 'after';
                  else nextPos = 'inside';
                } else {
                  return;
                }
                queueDragHoverUpdate(`group-${goal.id}`, nextPos);
              }}
              onDrop={(e) => {
                e.stopPropagation();
                try {
                  const position = syncDragHoverBeforeDrop();
                  const payload = readDragPayload(e);
                  const activeDraggedId = payload?.itemId ?? payload?.taskId ?? draggingGoalIdRef.current;
                  const itemType = payload?.itemType || draggingItemTypeRef.current;
                  if (!isMyPanel || activeDraggedId == null || activeDraggedId === '') return;
                  e.preventDefault();
                  if (itemType === 'group') {
                    const groupDropPosition = position === 'after' ? 'after' : 'before';
                    onReorderTopLevelItem(panelRole, String(activeDraggedId), goal.id, groupDropPosition);
                  } else if (position === 'inside') {
                    onMoveTaskToGroup(String(activeDraggedId), goal.id, panelRole);
                  } else {
                    onMoveTaskAroundTopLevelItem(String(activeDraggedId), goal.id, panelRole, position);
                  }
                } finally {
                  clearDragSession();
                }
              }}
              className={`p-3 rounded-2xl border-[3px] transition-all relative ${isMyPanel ? 'cursor-default' : 'cursor-not-allowed'} ${goal.completed ? accent.itemDone : 'bg-[#1c1412] border-[#5d4037] hover:border-[#8d6e63]'} ${dragOverGoalId === `group-${goal.id}` ? 'ring-2 ring-[#d4a373]/80 bg-[#2a1d18]' : ''}`}
            >
              {dragOverGoalId === `group-${goal.id}` && draggingGoalId !== goal.id && dropPosition !== 'inside' && (
                <div className={`absolute left-3 right-3 h-[3px] bg-[#daa520] rounded-full shadow-[0_0_12px_rgba(218,165,32,0.9)] ${dropPosition === 'before' ? 'top-[-2px]' : 'bottom-[-2px]'}`} />
              )}
              <div
                onClick={() => onToggleGroupExpanded(goal.id, panelRole)}
                className="flex items-start gap-3"
              >
                <div
                  draggable={isMyPanel}
                  onDragStart={(e) => {
                    e.stopPropagation();
                    writeDragPayload(e, {
                      itemId: String(goal.id),
                      taskId: String(goal.id),
                      itemType: 'group',
                      sourceGroupId: null,
                      sourceLevel: 0,
                    });
                    draggingGoalIdRef.current = goal.id;
                    draggingItemTypeRef.current = 'group';
                    setDraggingGoalId(goal.id);
                    setDraggingItemType('group');
                    setDragOverGoalId(null);
                    resetDragHoverRefs();
                    suppressClickUntilRef.current = Date.now() + 300;
                  }}
                  onDragEnd={(e) => {
                    e.stopPropagation();
                    clearDragSession();
                    suppressClickUntilRef.current = Date.now() + 300;
                  }}
                  className={`${isMyPanel ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'} shrink-0 mt-1 touch-none`}
                  title="拖曳移動群組"
                >
                  <GripVertical size={16} className="text-[#8d6e63] opacity-60" />
                </div>
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (draggingGoalId) return;
                    onToggleGoal(goal.id, panelRole);
                  }}
                  className="shrink-0 mt-0.5"
                >
                  {goal.completed ? <CheckCircle2 size={24} className={`${accent.iconDone} shrink-0`} /> : <Circle size={24} className="text-[#d4a373] shrink-0" />}
                </button>
                <div className="flex-1 min-w-0">
                  {editingGoalId === goal.id ? (
                    <input
                      value={editingText}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      className="text-base font-bold w-full bg-black/20 border border-[#daa520]/40 rounded-lg px-2 py-1 outline-none focus:border-[#daa520] text-[#e7c59f]"
                      autoFocus
                    />
                  ) : (
                    <span
                      title={goal.text}
                      className={`text-base font-bold block min-w-0 line-clamp-2 break-words ${goal.completed ? accent.textDone : 'text-[#e7c59f]'}`}
                    >
                      {goal.text}
                    </span>
                  )}
                  <div className="text-xs text-[#8d6e63] mt-1">{goal.expanded ? '已展開，可拖曳任務進入' : '已收合'}</div>
                </div>
                {isMyPanel && (
                  <div className="flex items-center gap-1">
                    {editingGoalId === goal.id ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            saveEdit();
                          }}
                          className="opacity-100 text-[#22c55e] hover:text-[#86efac] transition-opacity p-1 shrink-0"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelEdit();
                          }}
                          className="opacity-100 text-[#f59e0b] hover:text-[#fcd34d] transition-opacity p-1 shrink-0"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(goal);
                          }}
                          className="opacity-80 text-[#9ca3af] hover:text-[#e5e7eb] transition-opacity p-1 shrink-0"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteGoal(goal.id, panelRole);
                          }}
                          className="opacity-80 text-[#8b1a1a] hover:text-[#ff4d4d] transition-opacity p-1 shrink-0"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleGroupExpanded(goal.id, panelRole);
                  }}
                  className="opacity-80 text-[#d4a373] p-1 shrink-0"
                >
                  {goal.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              </div>
              {goal.expanded && (
                <div className={`mt-2 space-y-2 ${draggingItemType === 'group' ? 'pointer-events-none' : ''}`}>
                  {(goal.children || []).length === 0 && (
                    <div className="ml-6 text-xs text-[#8d6e63] italic">把任務拖曳到這個群組裡</div>
                  )}
                  {(goal.children || []).filter((child) => child.type === 'task').map((child) => renderTaskRow(child, 1, goal.id))}
                </div>
              )}
              </div>
            )}
            {index === goals.length - 1 && renderTopLevelInsertZone(goal.id, 'after')}
          </div>
        ))}
        {goals.length === 0 && <div className={`text-center py-6 ${accent.emptyText} font-bold italic text-sm`}>尚未新增任何任務...</div>}
      </div>

      {isMyPanel && (
        <form onSubmit={handleCreateSubmit} className="flex gap-4">
          <input
            type="text"
            value={newGoalText}
            onChange={(e) => onNewGoalTextChange(e.target.value)}
            placeholder={createMode === 'group' ? '新增任務群組...' : '新增任務...'}
            className={accent.inputClass}
          />
          <div className="relative">
            {showCreateMenu && (
              <div className="absolute bottom-[calc(100%+8px)] right-0 bg-[#0d0706] border-2 border-[#3e2723] rounded-xl overflow-hidden shadow-2xl z-20 min-w-[170px]">
                <button
                  type="button"
                  onClick={() => selectCreateMode('task')}
                  className="w-full text-left px-4 py-2 text-sm font-bold text-[#e0d5c1] hover:bg-[#1f1614] transition-colors"
                >
                  新增任務
                </button>
                <button
                  type="button"
                  onClick={() => selectCreateMode('group')}
                  className="w-full text-left px-4 py-2 text-sm font-bold text-[#e0d5c1] hover:bg-[#1f1614] transition-colors border-t border-[#3e2723]"
                >
                  新增任務群組
                </button>
              </div>
            )}
            <button type="button" onClick={openCreateMenu} className={accent.btnClass}>
              <Plus size={32} strokeWidth={4} />
            </button>
          </div>
          <button type="submit" className="hidden" />
        </form>
      )}
    </div>
  );
}
