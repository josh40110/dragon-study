import { useEffect, useState } from 'react';
import { QUOTES } from '../constants/quotes';

export default function MotivationalBoard() {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const updateQuote = () => {
      const index = Math.floor(Date.now() / 300000) % QUOTES.length;
      setQuoteIndex(index);
    };
    updateQuote();
    const interval = setInterval(updateQuote, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-56 md:w-72 bg-[#0a0a0a] border-[6px] border-[#2c1d1a] rounded-lg p-3 shadow-[inset_0_0_15px_rgba(0,0,0,1),0_20px_25px_rgba(0,0,0,0.8)] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between mb-2 border-b border-[#333] pb-1">
        <span className="text-[10px] text-red-500 font-mono font-black animate-pulse flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full" /> REC
        </span>
        <span className="text-[10px] text-[#666] font-mono tracking-widest">QUOTE OF THE MOMENT</span>
      </div>
      <div className="min-h-[60px] flex items-center justify-center px-1">
        <p className="font-mono text-[#4ade80] text-sm md:text-base font-bold text-center leading-relaxed drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]">
          "{QUOTES[quoteIndex]}"
        </p>
      </div>
    </div>
  );
}
