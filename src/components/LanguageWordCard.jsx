import { memo } from 'react';
import { Star, Volume2 } from 'lucide-react';
import { pronounce } from '../utils/voice';

const LANG_BADGE = {
  cs: { label: '🇨🇿 捷克文', className: 'bg-[#1b3a8f]/10 text-[#1b3a8f] border-[#1b3a8f]/30' },
  en: { label: '🇬🇧 英文', className: 'bg-[#8b2c2c]/10 text-[#8b2c2c] border-[#8b2c2c]/30' },
};

/** 全站 index.css 有 unlayered 的 `p/span { white-space: nowrap }`，會壓過 utility class，故用 inline style 放行換行 */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const FACE = {
  gridArea: '1 / 1',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
};

export default memo(function LanguageWordCard({ word, flipped, onFlip, starred, onToggleStar }) {
  const badge = LANG_BADGE[word.lang] || LANG_BADGE.cs;

  const handleSpeak = (e, text, id) => {
    e.stopPropagation();
    pronounce({ id, text, lang: word.lang });
  };

  const handleStar = (e) => {
    e.stopPropagation();
    onToggleStar(word);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onFlip(word.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFlip(word.id);
        }
      }}
      className="cursor-pointer select-none outline-none h-full"
      style={{ perspective: '1200px' }}
      title="點一下翻面"
    >
      {/* 兩面疊在同一個 grid 格子裡：卡片高度自動取兩面較高者，翻面時不會跳動 */}
      <div
        className="grid h-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* 正面：單字 */}
        <div
          style={FACE}
          className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[1.8rem] p-5 shadow-[0_8px_0_#e0d3b6] flex flex-col"
        >
          <div className="flex items-start justify-between gap-2 mb-3">
            <span className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${badge.className}`}>{badge.label}</span>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => handleSpeak(e, word.term, word.id)}
                className="p-2 rounded-xl bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors"
                title="唸給我聽"
              >
                <Volume2 size={16} />
              </button>
              <button
                onClick={handleStar}
                className={`p-2 rounded-xl border-2 transition-colors ${
                  starred ? 'bg-[#fff2c8] border-[#daa520] text-[#daa520]' : 'bg-[#f3e9d6] border-transparent text-[#c4b291] hover:text-[#daa520]'
                }`}
                title={starred ? '從單字本移除' : '加進單字本'}
              >
                <Star size={16} fill={starred ? '#daa520' : 'none'} />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center py-3 text-center">
            <div className="text-[#4a3526] font-black text-2xl md:text-[1.7rem] leading-tight" style={WRAP}>
              {word.term}
            </div>
            <div className="text-[#9a8568] font-bold text-sm mt-2 font-mono" style={WRAP}>
              {word.pron}
            </div>
            <div className="text-[11px] text-[#b3a084] font-bold mt-3">{word.pos} · {word.cat}</div>
          </div>

          <div className="text-center text-[11px] text-[#c0ad8c] font-black">點一下看意思 👆</div>
        </div>

        {/* 背面：中文與例句 */}
        <div
          style={{ ...FACE, transform: 'rotateY(180deg)' }}
          className="bg-[#fff7e3] border-4 border-[#daa520]/50 rounded-[1.8rem] p-5 shadow-[0_8px_0_#e0d3b6] flex flex-col"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[#b07d0a] font-black text-lg" style={WRAP}>{word.term}</span>
            <button
              onClick={handleStar}
              className={`p-1.5 rounded-lg shrink-0 transition-colors ${starred ? 'text-[#daa520]' : 'text-[#c4b291] hover:text-[#daa520]'}`}
              title={starred ? '從單字本移除' : '加進單字本'}
            >
              <Star size={16} fill={starred ? '#daa520' : 'none'} />
            </button>
          </div>

          <div className="text-[#4a3526] font-black text-lg leading-snug mb-3" style={WRAP}>
            {word.zh}
          </div>

          <div className="bg-[#fdf9f1] border-2 border-[#e6dac1] rounded-2xl p-3 mb-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[#4a3526] font-bold text-[13px] leading-snug" style={WRAP}>{word.ex}</p>
              <button
                onClick={(e) => handleSpeak(e, word.ex, `${word.id}-ex`)}
                className="p-1.5 rounded-lg bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors shrink-0"
                title="唸整句"
              >
                <Volume2 size={14} />
              </button>
            </div>
            <p className="text-[#9a8568] font-bold text-[12px] mt-1.5 leading-snug" style={WRAP}>{word.exZh}</p>
          </div>

          {word.tip && (
            <p className="text-[12px] text-[#8a6d3b] font-bold leading-snug bg-[#fdf3d8] border-l-4 border-[#daa520] rounded-r-lg px-3 py-2" style={WRAP}>
              💡 {word.tip}
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
