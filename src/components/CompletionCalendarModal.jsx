import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { memo, useCallback, useMemo, useState } from 'react';

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
  isCurrentMonth,
  isSelected,
  onSelectDate,
}) {
  return (
    <button
      onClick={() => onSelectDate(dateKey)}
      className={`relative h-16 rounded-xl border-2 p-2 text-left transition-colors duration-150 ${
        isSelected ? 'border-[#daa520] bg-[#2c1d1a]' : 'border-[#3e2723] bg-[#130b0a] hover:border-[#8d6e63]'
      } ${isCurrentMonth ? 'text-[#e0d5c1]' : 'text-[#6b4f49]'}`}
    >
      <div className="text-sm font-bold">{dateNumber}</div>
      {doneCount > 0 && (
        <div className="absolute right-2 bottom-2 w-5 h-5 rounded-full bg-[#16a34a] text-white flex items-center justify-center">
          <Check size={12} strokeWidth={3} />
        </div>
      )}
    </button>
  );
});

export default memo(function CompletionCalendarModal({ open, onClose, completedByDate, roleLabel }) {
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
    <div className="fixed inset-0 z-[220] bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-[#1a0f0d] border-4 border-[#3e2723] rounded-[2rem] shadow-[0_0_40px_rgba(0,0,0,0.65)] overflow-hidden transition-opacity duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#3e2723]">
          <div className="no-wrap-scroll pr-2">
            <h3 className="text-[#daa520] font-black text-2xl">日曆</h3>
            <p className="text-[#8d6e63] text-sm font-bold">{roleLabel} 完成紀錄</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-[#2c1d1a] text-[#e0d5c1] hover:bg-[#3e2723] transition-colors"
            title="關閉"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-lg bg-[#2c1d1a] text-[#e0d5c1] hover:bg-[#3e2723] transform-gpu transition-transform duration-150 hover:scale-105"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="text-[#daa520] font-black text-xl no-wrap-scroll px-2">
              {viewDate.getFullYear()} 年 {viewDate.getMonth() + 1} 月
            </div>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-lg bg-[#2c1d1a] text-[#e0d5c1] hover:bg-[#3e2723] transform-gpu transition-transform duration-150 hover:scale-105"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-bold text-[#8d6e63]">
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
                  isCurrentMonth={isCurrentMonth}
                  isSelected={isSelected}
                  onSelectDate={handleSelectDate}
                />
              );
            })}
          </div>

          <div className="mt-6 border-t-2 border-[#3e2723] pt-4">
            <h4 className="font-black text-[#daa520] mb-2 no-wrap-scroll">{selectedDateKey} 完成事項</h4>
            {selectedList.length === 0 ? (
              <div className="text-[#8d6e63] text-sm font-bold">這一天尚無完成任務</div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto overscroll-contain pr-2 custom-scrollbar [scrollbar-gutter:stable]">
                {selectedList.map((item) => (
                  <div key={`${selectedDateKey}-${item.id}`} className="flex items-start gap-2 bg-[#130b0a] border border-[#3e2723] rounded-lg p-2">
                    <Check size={16} className="text-[#16a34a] mt-0.5 shrink-0" />
                    <span className="text-[#e0d5c1] text-sm font-bold no-wrap-scroll">{item.text || '(未命名任務)'}</span>
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
