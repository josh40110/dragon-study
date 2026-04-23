import { getLocalDateStr } from '../utils/date';

export const createItemId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
export const normalizeItemId = (id, fallback = createItemId()) => String(id ?? fallback);

export const createTaskItem = (text) => ({
  id: createItemId(),
  type: 'task',
  text,
  completed: false,
});

export const createGroupItem = (text) => ({
  id: createItemId(),
  type: 'group',
  text,
  completed: false,
  expanded: true,
  children: [],
});

export const normalizeGoalItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  const id = normalizeItemId(item.id);
  const text = typeof item.text === 'string' ? item.text : '';
  if (item.type === 'group') {
    return {
      id,
      type: 'group',
      text,
      completed: Boolean(item.completed),
      expanded: item.expanded !== false,
      children: Array.isArray(item.children) ? item.children.map(normalizeGoalItem).filter(Boolean) : [],
    };
  }
  return {
    id,
    type: 'task',
    text,
    completed: Boolean(item.completed),
  };
};

export const normalizeGoalList = (list) => {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeGoalItem).filter(Boolean);
};

export const createInitialRoomData = () => ({
  leftStudying: false,
  rightStudying: false,
  leftStartTime: null,
  rightStartTime: null,
  leftDailyTotal: 0,
  rightDailyTotal: 0,
  lastActiveDate: getLocalDateStr(),
  leftGoals: [],
  rightGoals: [],
  leftNudge: 0,
  rightNudge: 0,
});
