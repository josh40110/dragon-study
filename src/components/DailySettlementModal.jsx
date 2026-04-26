import { CheckCircle2, Sparkles, Trophy, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { memo } from 'react';

const ResultCard = memo(function ResultCard({ title, items, rate, visible }) {
  return (
    <div
      className={`rounded-2xl border-2 border-[#3e2723] bg-[#130b0a] p-4 transform-gpu will-change-[transform,opacity] transition-[opacity,transform] duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[#daa520] font-black text-xl">{title}</h4>
        <span className="text-xs font-black px-2 py-1 rounded-full bg-[#2c1d1a] text-[#e0d5c1]">完成率 {rate}%</span>
      </div>
      <div className="text-sm text-[#e0d5c1] font-bold mb-2">完成數量：{items.length}</div>
      {items.length === 0 ? (
        <div className="text-sm text-[#8d6e63] font-bold">今日尚無完成事項</div>
      ) : (
        <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
          {items.map((item) => (
            <div key={`${title}-${item.id}`} className="flex items-start gap-2 rounded-lg border border-[#3e2723] bg-[#1a0f0d] p-2">
              <CheckCircle2 size={16} className="text-[#22c55e] shrink-0 mt-0.5" />
              <span className="text-sm font-bold text-[#e0d5c1] no-wrap-scroll">{item.text || '(未命名任務)'}</span>
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
    <div className="fixed inset-0 z-[999] bg-black/85 backdrop-blur-sm grid place-items-center p-4">
      <button type="button" aria-label="關閉結算視窗" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 w-[min(920px,92vw)] max-h-[86vh] rounded-[2rem] border-4 border-[#5d4037] bg-[#1a0f0d] shadow-[0_0_80px_rgba(0,0,0,0.9)] overflow-hidden transform-gpu will-change-[transform,opacity] transition-[opacity,transform] duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-[#3e2723]">
          <div className="flex items-center gap-2 text-[#daa520] no-wrap-scroll">
            <Sparkles size={20} />
            <h3 className="font-black text-2xl">今日結算</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-[#2c1d1a] hover:bg-[#3e2723] text-[#e0d5c1]">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[64vh]">
          <ResultCard title="花花" items={huahuaItems} rate={huahuaRate} visible={showHuahua} />
          <ResultCard title="呱呱" items={guaguaItems} rate={guaguaRate} visible={showGuagua} />

          {showSummary && (
            <div className="rounded-2xl border-2 border-[#daa520]/60 bg-[#2c1d1a] p-4 transition-[opacity,transform] duration-300 transform-gpu will-change-[transform,opacity]">
              <div className="flex items-center gap-2 text-[#daa520] font-black text-xl mb-2">
                <Trophy size={20} /> 今日總結
              </div>
              <div className="text-[#e0d5c1] font-bold no-wrap-scroll">
                花花完成率 <span className="text-[#22c55e]">{huahuaRate}%</span>，呱呱完成率 <span className="text-[#22c55e]">{guaguaRate}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex justify-end gap-3">
          {step !== 'summary' && (
            <button
              onClick={() => onStepChange(step === 'huahua' ? 'guagua' : 'summary')}
              className="px-4 py-2 rounded-xl border-2 border-[#8d6e63] bg-[#130b0a] text-[#e0d5c1] font-bold hover:bg-[#2c1d1a]"
            >
              下一步
            </button>
          )}
          {step !== 'summary' && (
            <button
              onClick={() => onStepChange('summary')}
              className="px-4 py-2 rounded-xl border-2 border-[#daa520]/60 bg-[#2c1d1a] text-[#daa520] font-black hover:bg-[#3e2723]"
            >
              跳過動畫
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border-2 border-[#daa520]/60 bg-[#2c1d1a] text-[#daa520] font-black hover:bg-[#3e2723]"
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
