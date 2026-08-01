import { useMemo, useState } from 'react';
import { Search, Star, Volume2, X } from 'lucide-react';
import { CZ_CATEGORIES, CZ_VOCAB } from '../constants/vocabCzech';
import { EN_CATEGORIES, EN_VOCAB } from '../constants/vocabEnglish';
import { pronounce } from '../utils/voice';

const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };
const MAX_ROWS = 200;

const SOURCES = {
  cs: { label: '🇨🇿 捷克文', categories: CZ_CATEGORIES, words: CZ_VOCAB },
  en: { label: '🇬🇧 英文', categories: EN_CATEGORIES, words: EN_VOCAB },
};

function normalize(text) {
  return String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function VocabBook({ starredSet, onToggleStar }) {
  const [lang, setLang] = useState('cs');
  const [catId, setCatId] = useState('all');
  const [query, setQuery] = useState('');

  const source = SOURCES[lang];

  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return source.words.filter((word) => {
      if (catId !== 'all' && word.catId !== catId) return false;
      if (!q) return true;
      return normalize(word.term).includes(q) || word.zh.includes(query.trim()) || normalize(word.pron).includes(q);
    });
  }, [catId, query, source.words]);

  const shown = rows.slice(0, MAX_ROWS);

  const switchLang = (nextLang) => {
    setLang(nextLang);
    setCatId('all');
  };

  return (
    <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-[#b07d0a] font-black text-lg">基礎單字大全</h3>
          <p className="text-[#9a8568] font-bold text-xs" style={WRAP}>
            捷克文 {CZ_VOCAB.length} 字、英文 {EN_VOCAB.length} 字，點 🔊 聽發音、點 ⭐ 收進單字本。
          </p>
        </div>
        <div className="flex gap-1.5 bg-[#f3e9d6] border-2 border-[#e6dac1] rounded-2xl p-1">
          {Object.entries(SOURCES).map(([key, value]) => (
            <button
              key={key}
              onClick={() => switchLang(key)}
              className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${
                lang === key ? 'bg-[#fff7e3] text-[#b07d0a] border-2 border-[#daa520]' : 'text-[#9a8568] border-2 border-transparent hover:bg-[#ece0c9]'
              }`}
            >
              {value.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#b3a084]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋單字、拼讀或中文…"
          className="w-full pl-11 pr-10 py-3 rounded-2xl border-2 border-[#e6dac1] bg-[#f7f0e2] text-[#4a3526] font-bold focus:outline-none focus:border-[#daa520] placeholder:text-[#c0ad8c]"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#b3a084] hover:bg-[#ece0c9]"
            title="清除"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-wrap-scroll">
        <button
          onClick={() => setCatId('all')}
          className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 border-2 transition-colors ${
            catId === 'all' ? 'bg-[#fff7e3] border-[#daa520] text-[#b07d0a]' : 'bg-[#f3e9d6] border-transparent text-[#9a8568] hover:bg-[#ece0c9]'
          }`}
        >
          全部 {source.words.length}
        </button>
        {source.categories.map((category) => (
          <button
            key={category.id}
            onClick={() => setCatId(category.id)}
            className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 border-2 transition-colors ${
              catId === category.id ? 'bg-[#fff7e3] border-[#daa520] text-[#b07d0a]' : 'bg-[#f3e9d6] border-transparent text-[#9a8568] hover:bg-[#ece0c9]'
            }`}
          >
            {category.icon} {category.name} {category.words.length}
          </button>
        ))}
      </div>

      <div className="text-[#9a8568] font-black text-xs mb-3">
        {rows.length} 個結果{rows.length > MAX_ROWS && `（先顯示前 ${MAX_ROWS} 個，用搜尋縮小範圍）`}
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-10 text-[#9a8568] font-bold" style={WRAP}>
          找不到符合的單字，換個關鍵字試試。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {shown.map((word) => {
            const starred = starredSet.has(word.id);
            return (
              <div key={word.id} className="bg-[#f7f0e2] border-2 border-[#e6dac1] rounded-2xl px-3 py-2.5 flex items-center gap-2.5">
                <button
                  onClick={() => pronounce({ id: word.id, text: word.term, lang: word.lang })}
                  className="p-2 rounded-xl bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors shrink-0"
                  title="唸給我聽"
                >
                  <Volume2 size={15} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[#4a3526] font-black text-[15px]" style={WRAP}>{word.term}</span>
                    <span className="text-[#b3a084] font-mono text-[11px]" style={WRAP}>{word.pron}</span>
                    {word.pos && <span className="text-[10px] text-[#c0ad8c] font-black">{word.pos}</span>}
                  </div>
                  <div className="text-[#8a755b] font-bold text-[13px]" style={WRAP}>{word.zh}</div>
                </div>
                <button
                  onClick={() => onToggleStar(word)}
                  className={`p-2 rounded-xl shrink-0 transition-colors ${starred ? 'text-[#daa520]' : 'text-[#c4b291] hover:text-[#daa520]'}`}
                  title={starred ? '從單字本移除' : '加進單字本'}
                >
                  <Star size={15} fill={starred ? '#daa520' : 'none'} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
