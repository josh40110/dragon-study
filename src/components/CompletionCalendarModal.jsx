import { Check, ChevronLeft, ChevronRight, Timer, X } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

/** 日曆格子用的極簡寫法：45m / 1.5h */
function formatShort(seconds) {
  if (!seconds || seconds < 60) return '';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/** 詳細區用的完整寫法 */
function formatDuration(seconds) {
  if (!seconds) return '沒有紀錄';
  if (seconds < 60) return `${seconds} 秒`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours} 小時 ${minutes} 分` : `${hours} 小時`;
  return `${minutes} 分`;
}

function toSeconds(map, dateKey) {
  const value = map?.[dateKey];
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function buildMonthCells(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const start = new Date(year, month, 1 - firstWeekday);
  return Array.from({ length: 42 }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d;
  });
}

function toDateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const CalendarDayCell = memo(function CalendarDayCell({
  dateKey,
  dateNumber,
  doneCount,
  studySeconds,
  isCurrentMonth,
  isSelected,
  onSelectDate,
}) {
  return (
    <button
      onClick={() => onSelectDate(dateKey)}
      className={`relative h-16 rounded-xl border-2 p-2 text-left transition-colors duration-150 ${
        isSelected ? 'border-[#daa520] bg-[#fff7e3]' : 'border-[#e6dac1] bg-[#f7f0e2] hover:border-[#caa53f]'
      } ${isCurrentMonth ? 'text-[#4a3526]' : 'text-[#c9b48c]'}`}
    >
      <div className="text-sm font-bold">{dateNumber}</div>
      {studySeconds > 0 && (
        <div className="absolute left-2 bottom-1.5 text-[11px] font-black text-[#b07d0a] tabular-nums">
          {formatShort(studySeconds)}
        </div>
      )}
      {doneCount > 0 && (
        <div className="absolute right-1.5 bottom-1.5 w-5 h-5 rounded-full bg-[#16a34a] text-white flex items-center justify-center">
          <Check size={12} strokeWidth={3} />
        </div>
      )}
    </button>
  );
});

export default memo(function CompletionCalendarModal({
  open,
  onClose,
  completedByDate,
  roleLabel,
  leftStudyByDate,
  rightStudyByDate,
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));

  const cells = useMemo(
    () =>
      buildMonthCells(viewDate).map((d) => ({
        date: d,
        dateKey: toDateKey(d),
      })),
    [viewDate],
  );

  const doneCountMap = useMemo(() => {
    const map = new Map();
    const source = completedByDate && typeof completedByDate === 'object' ? completedByDate : {};
    Object.entries(source).forEach(([dateKey, list]) => {
      map.set(dateKey, Array.isArray(list) ? list.length : 0);
    });
    return map;
  }, [completedByDate]);

  const selectedList = useMemo(() => completedByDate?.[selectedDateKey] || [], [completedByDate, selectedDateKey]);

  /** 格子上顯示的是兩個人加起來的專注時間 */
  const totalSecondsMap = useMemo(() => {
    const map = new Map();
    [leftStudyByDate, rightStudyByDate].forEach((source) => {
      if (!source || typeof source !== 'object') return;
      Object.entries(source).forEach(([dateKey, seconds]) => {
        if (!Number.isFinite(seconds) || seconds <= 0) return;
        map.set(dateKey, (map.get(dateKey) || 0) + Math.floor(seconds));
      });
    });
    return map;
  }, [leftStudyByDate, rightStudyByDate]);

  const selectedGuagua = toSeconds(leftStudyByDate, selectedDateKey);
  const selectedHuahua = toSeconds(rightStudyByDate, selectedDateKey);

  const handlePrevMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }, []);

  const handleSelectDate = useCallback((dateKey) => {
    setSelectedDateKey(dateKey);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] bg-[#2c1d1a]/50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] shadow-[0_30px_80px_rgba(120,90,55,0.3)] overflow-hidden transition-opacity duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#e6dac1]">
          <div className="no-wrap-scroll pr-2">
            <h3 className="text-[#b07d0a] font-black text-2xl">日曆</h3>
            <p className="text-[#9a8568] text-sm font-bold">{roleLabel} 完成紀錄 · 雙方專注時間</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#f3e9d6] text-[#4a3526] hover:bg-[#ece0c9] transition-colors"
            title="關閉"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg bg-[#f3e9d6] text-[#4a3526] hover:bg-[#ece0c9] transform-gpu transition-transform duration-150 hover:scale-105"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-[#b07d0a] font-black text-xl no-wrap-scroll px-2">
              {viewDate.getFullYear()} 年 {viewDate.getMonth() + 1} 月
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg bg-[#f3e9d6] text-[#4a3526] hover:bg-[#ece0c9] transform-gpu transition-transform duration-150 hover:scale-105"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-bold text-[#9a8568]">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 select-none">
            {cells.map((cell) => {
              const doneCount = doneCountMap.get(cell.dateKey) || 0;
              const isCurrentMonth = cell.date.getMonth() === viewDate.getMonth();
              const isSelected = selectedDateKey === cell.dateKey;
              return (
                <CalendarDayCell
                  key={cell.dateKey}
                  dateKey={cell.dateKey}
                  dateNumber={cell.date.getDate()}
                  doneCount={doneCount}
                  studySeconds={totalSecondsMap.get(cell.dateKey) || 0}
                  isCurrentMonth={isCurrentMonth}
                  isSelected={isSelected}
                  onSelectDate={handleSelectDate}
                />
              );
            })}
          </div>

          <div className="mt-6 border-t-2 border-[#e6dac1] pt-4">
            <h4 className="font-black text-[#b07d0a] mb-3 no-wrap-scroll flex items-center gap-2">
              <Timer size={18} />
              {selectedDateKey} 專注時間
            </h4>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { name: '呱呱', seconds: selectedGuagua },
                { name: '花花', seconds: selectedHuahua },
              ].map((person) => (
                <div key={person.name} className="rounded-2xl border-2 border-[#e6dac1] bg-[#f7f0e2] px-4 py-3">
                  <div className="text-[11px] font-black text-[#9a8568]">{person.name}</div>
                  <div className={`font-black text-lg tabular-nums ${person.seconds > 0 ? 'text-[#b07d0a]' : 'text-[#c0ad8c]'}`}>
                    {formatDuration(person.seconds)}
                  </div>
                </div>
              ))}
            </div>

            <h4 className="font-black text-[#b07d0a] mb-2 no-wrap-scroll">{selectedDateKey} 完成事項</h4>
            {selectedList.length === 0 ? (
              <div className="text-[#9a8568] text-sm font-bold">這一天尚無完成任務</div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto overscroll-contain pr-2 custom-scrollbar [scrollbar-gutter:stable]">
                {selectedList.map((item) => (
                  <div key={`${selectedDateKey}-${item.id}`} className="flex items-start gap-2 bg-[#f7f0e2] border border-[#e6dac1] rounded-lg p-2">
                    <Check size={16} className="text-[#16a34a] mt-0.5 shrink-0" />
                    <span className="text-[#4a3526] text-sm font-bold no-wrap-scroll">{item.text || '(未命名任務)'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
