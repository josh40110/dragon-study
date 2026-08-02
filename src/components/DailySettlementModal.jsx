import { CheckCircle2, Sparkles, Timer, Trophy, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { memo } from 'react';

function formatDuration(seconds) {
  if (!seconds) return '0 分';
  if (seconds < 60) return `${seconds} 秒`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) return minutes > 0 ? `${hours} 小時 ${minutes} 分` : `${hours} 小時`;
  return `${minutes} 分`;
}

const ResultCard = memo(function ResultCard({ title, items, rate, seconds, visible }) {
  return (
    <div
      className={`rounded-2xl border-2 border-[#e6dac1] bg-[#f7f0e2] p-4 transform-gpu will-change-[transform,opacity] transition-[opacity,transform] duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h4 className="text-[#b07d0a] font-black text-xl">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-2 py-1 rounded-full bg-[#fff7e3] border border-[#daa520]/50 text-[#b07d0a] flex items-center gap-1">
            <Timer size={12} /> 專注 {formatDuration(seconds)}
          </span>
          <span className="text-xs font-black px-2 py-1 rounded-full bg-[#f0e5d0] text-[#5b4636]">完成率 {rate}%</span>
        </div>
      </div>
      <div className="text-sm text-[#4a3526] font-bold mb-2">完成數量：{items.length}</div>
      {items.length === 0 ? (
        <div className="text-sm text-[#9a8568] font-bold">今日尚無完成事項</div>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
          {items.map((item) => (
            <div key={`${title}-${item.id}`} className="flex items-start gap-2 rounded-lg border border-[#e6dac1] bg-[#fdf9f1] p-2">
              <CheckCircle2 size={16} className="text-[#22c55e] shrink-0 mt-0.5" />
              <span className="text-sm font-bold text-[#4a3526] no-wrap-scroll">{item.text || '(未命名任務)'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

function DailySettlementModal({
  open,
  step,
  onStepChange,
  onClose,
  huahuaItems,
  guaguaItems,
  huahuaRate,
  guaguaRate,
  huahuaSeconds = 0,
  guaguaSeconds = 0,
}) {
  useEffect(() => {
    if (!open) return;
    const t1 = setTimeout(() => onStepChange('guagua'), 1200);
    const t2 = setTimeout(() => onStepChange('summary'), 2400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [open, onStepChange]);

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;
  const showHuahua = step === 'huahua' || step === 'guagua' || step === 'summary';
  const showGuagua = step === 'guagua' || step === 'summary';
  const showSummary = step === 'summary';

  return createPortal(
    <div className="fixed inset-0 z-[999] bg-[#2c1d1a]/50 backdrop-blur-sm grid place-items-center p-4">
      <button type="button" aria-label="關閉結算視窗" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 w-[min(920px,92vw)] max-h-[86vh] rounded-[2rem] border-4 border-[#e6dac1] bg-[#fdf9f1] shadow-[0_30px_80px_rgba(120,90,55,0.3)] overflow-hidden transform-gpu will-change-[transform,opacity] transition-[opacity,transform] duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#e6dac1]">
          <div className="flex items-center gap-2 text-[#b07d0a] no-wrap-scroll">
            <Sparkles size={20} />
            <h3 className="font-black text-2xl">今日結算</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-[#f3e9d6] hover:bg-[#ece0c9] text-[#4a3526]">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[64vh]">
          <ResultCard title="花花" items={huahuaItems} rate={huahuaRate} seconds={huahuaSeconds} visible={showHuahua} />
          <ResultCard title="呱呱" items={guaguaItems} rate={guaguaRate} seconds={guaguaSeconds} visible={showGuagua} />

          {showSummary && (
            <div className="rounded-2xl border-2 border-[#daa520]/60 bg-[#fff7e3] p-4 transition-[opacity,transform] duration-300 transform-gpu will-change-[transform,opacity]">
              <div className="flex items-center gap-2 text-[#b07d0a] font-black text-xl mb-2">
                <Trophy size={20} /> 今日總結
              </div>
              <div className="text-[#4a3526] font-bold no-wrap-scroll">
                花花完成率 <span className="text-[#22c55e]">{huahuaRate}%</span>，呱呱完成率 <span className="text-[#22c55e]">{guaguaRate}%</span>
              </div>
              <div className="text-[#4a3526] font-bold mt-1 no-wrap-scroll">
                今天兩人一起專注了 <span className="text-[#b07d0a]">{formatDuration(huahuaSeconds + guaguaSeconds)}</span>
                <span className="text-[#9a8568] text-sm">（花花 {formatDuration(huahuaSeconds)}、呱呱 {formatDuration(guaguaSeconds)}）</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          {step !== 'summary' && (
            <button
              onClick={() => onStepChange(step === 'huahua' ? 'guagua' : 'summary')}
              className="px-4 py-2 rounded-xl border-2 border-[#caa53f] bg-[#f7f0e2] text-[#4a3526] font-bold hover:bg-[#f0e5d0]"
            >
              下一步
            </button>
          )}
          {step !== 'summary' && (
            <button
              onClick={() => onStepChange('summary')}
              className="px-4 py-2 rounded-xl border-2 border-[#daa520]/60 bg-[#fff7e3] text-[#b07d0a] font-black hover:bg-[#fdeecb]"
            >
              跳過動畫
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border-2 border-[#daa520]/60 bg-[#fff7e3] text-[#b07d0a] font-black hover:bg-[#fdeecb]"
          >
            完成
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default memo(DailySettlementModal);
