import { useMemo, useState } from 'react';
import { ChevronDown, Search, Volume2, X } from 'lucide-react';
import { CZ_GRAMMAR, CZ_STAGES } from '../constants/grammarCzech';
import { EN_GRAMMAR, EN_STAGES } from '../constants/grammarEnglish';
import { pronounce } from '../utils/voice';

const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const SOURCES = {
  cs: { label: '🇨🇿 捷克文文法', lessons: CZ_GRAMMAR, stages: CZ_STAGES },
  en: { label: '🇬🇧 英文文法', lessons: EN_GRAMMAR, stages: EN_STAGES },
};

function normalize(text) {
  return String(text).toLowerCase();
}

/** 一課文法，預設收合，點開才看細節 */
function GrammarEntry({ lesson, lang, expanded, onToggle }) {
  return (
    <div className="border-2 border-[#e6dac1] rounded-2xl overflow-hidden bg-[#f7f0e2]">
      <button
        onClick={() => onToggle(lesson.id)}
        className="w-full px-4 py-3 text-left flex items-start justify-between gap-3 hover:bg-[#f3e9d6] transition-colors"
      >
        <span className="min-w-0">
          <span className="block text-[#4a3526] font-black text-[15px]" style={WRAP}>{lesson.title}</span>
          <span className="block text-[#8a755b] font-bold text-[12px] mt-0.5" style={WRAP}>{lesson.summary}</span>
        </span>
        <ChevronDown
          size={18}
          className={`text-[#b07d0a] shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 bg-[#fdf9f1] border-t-2 border-[#e6dac1] pt-3">
          <p className="text-[#5f5140] font-bold text-[14px] leading-relaxed mb-3" style={WRAP}>{lesson.body}</p>

          {lesson.table && (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full text-left border-collapse text-[13px]">
                <thead>
                  <tr>
                    {lesson.table.head.map((cell) => (
                      <th key={cell} className="bg-[#f3e9d6] text-[#8a755b] font-black px-3 py-2 border-2 border-[#e6dac1]">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lesson.table.rows.map((row) => (
                    <tr key={row.join('-')}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`${row.join('-')}-${cellIndex}`}
                          className={`px-3 py-2 border-2 border-[#e6dac1] font-bold ${cellIndex === 0 ? 'text-[#9a8568]' : 'text-[#4a3526]'}`}
                          style={WRAP}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="space-y-2">
            {lesson.examples.map(([sentence, zh], index) => (
              <div key={sentence} className="bg-[#f7f0e2] border-2 border-[#e6dac1] rounded-xl p-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[#4a3526] font-black text-[14px] leading-snug" style={WRAP}>{sentence}</p>
                  <p className="text-[#8a755b] font-bold text-[12px] mt-0.5" style={WRAP}>{zh}</p>
                </div>
                <button
                  onClick={() => pronounce({ id: `${lesson.id}-e${index}`, text: sentence, lang })}
                  className="p-2 rounded-xl bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors shrink-0"
                  title="唸這一句"
                >
                  <Volume2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {lesson.tip && (
            <p className="mt-3 text-[12px] text-[#8a6d3b] font-bold bg-[#fdf3d8] border-l-4 border-[#daa520] rounded-r-lg px-3 py-2" style={WRAP}>
              💡 {lesson.tip}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function GrammarBook() {
  const [lang, setLang] = useState('cs');
  const [stageId, setStageId] = useState('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const source = SOURCES[lang];

  const rows = useMemo(() => {
    const q = normalize(query.trim());
    return source.lessons.filter((lesson) => {
      if (stageId !== 'all' && lesson.stage !== stageId) return false;
      if (!q) return true;
      const haystack = normalize(
        `${lesson.title} ${lesson.summary} ${lesson.body} ${lesson.examples.map((e) => e.join(' ')).join(' ')}`,
      );
      return haystack.includes(q);
    });
  }, [query, source.lessons, stageId]);

  const switchLang = (nextLang) => {
    setLang(nextLang);
    setStageId('all');
    setExpandedId(null);
  };

  return (
    <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-[#b07d0a] font-black text-lg">文法大全</h3>
          <p className="text-[#9a8568] font-bold text-xs" style={WRAP}>
            捷克文 {CZ_GRAMMAR.length} 課、英文 {EN_GRAMMAR.length} 課，由淺入深。當參考書查，不用照順序讀。
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
          placeholder="搜尋文法點、說明或例句…"
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
          onClick={() => setStageId('all')}
          className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 border-2 transition-colors ${
            stageId === 'all' ? 'bg-[#fff7e3] border-[#daa520] text-[#b07d0a]' : 'bg-[#f3e9d6] border-transparent text-[#9a8568] hover:bg-[#ece0c9]'
          }`}
        >
          全部 {source.lessons.length}
        </button>
        {source.stages.map((stage) => (
          <button
            key={stage.id}
            onClick={() => setStageId(stage.id)}
            className={`px-3.5 py-2 rounded-xl font-black text-xs shrink-0 border-2 transition-colors ${
              stageId === stage.id ? 'bg-[#fff7e3] border-[#daa520] text-[#b07d0a]' : 'bg-[#f3e9d6] border-transparent text-[#9a8568] hover:bg-[#ece0c9]'
            }`}
          >
            {stage.name}
          </button>
        ))}
      </div>

      <div className="text-[#9a8568] font-black text-xs mb-3">{rows.length} 課</div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-[#9a8568] font-bold" style={WRAP}>
          找不到符合的文法點，換個關鍵字試試。
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((lesson) => (
            <GrammarEntry
              key={lesson.id}
              lesson={lesson}
              lang={lang}
              expanded={expandedId === lesson.id}
              onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
