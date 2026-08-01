import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, GraduationCap, Lightbulb, Play, Star, Volume2 } from 'lucide-react';
import { COURSE_STAGES, TOTAL_DAYS, firstUnfinishedDay, getCourseDay } from '../constants/curriculum';
import { updateRoom } from '../lib/roomStore';
import { pronounce } from '../utils/voice';
import LanguageQuiz from './LanguageQuiz';

const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

function GrammarCard({ grammar, lang, accent }) {
  return (
    <section className={`bg-[#fdf9f1] border-4 rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6] ${accent}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-[#f3e9d6] text-[#8a755b]">
          {lang === 'cs' ? '🇨🇿 捷克文文法' : '🇬🇧 英文文法'}
        </span>
      </div>
      <h4 className="text-[#b07d0a] font-black text-xl mt-2 mb-1" style={WRAP}>{grammar.title}</h4>
      <p className="text-[#8a6d3b] font-black text-sm mb-3" style={WRAP}>{grammar.summary}</p>
      <p className="text-[#5f5140] font-bold text-[14px] leading-relaxed mb-4" style={WRAP}>{grammar.body}</p>

      {grammar.table && (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr>
                {grammar.table.head.map((cell) => (
                  <th key={cell} className="bg-[#f3e9d6] text-[#8a755b] font-black px-3 py-2 border-2 border-[#e6dac1] first:rounded-tl-xl last:rounded-tr-xl">
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grammar.table.rows.map((row) => (
                <tr key={row.join('-')}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${row.join('-')}-${cellIndex}`}
                      className={`px-3 py-2 border-2 border-[#e6dac1] bg-[#fdf9f1] font-bold ${cellIndex === 0 ? 'text-[#9a8568]' : 'text-[#4a3526]'}`}
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
        {grammar.examples.map(([sentence, zh], index) => (
          <div key={sentence} className="bg-[#f7f0e2] border-2 border-[#e6dac1] rounded-2xl p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[#4a3526] font-black text-[14px] leading-snug" style={WRAP}>{sentence}</p>
              <p className="text-[#8a755b] font-bold text-[13px] mt-0.5" style={WRAP}>{zh}</p>
            </div>
            <button
              onClick={() => pronounce({ id: `${grammar.id}-e${index}`, text: sentence, lang })}
              className="p-2 rounded-xl bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors shrink-0"
              title="唸這一句"
            >
              <Volume2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {grammar.tip && (
        <p className="mt-4 text-[13px] text-[#8a6d3b] font-bold bg-[#fdf3d8] border-l-4 border-[#daa520] rounded-r-xl px-4 py-3" style={WRAP}>
          💡 {grammar.tip}
        </p>
      )}
    </section>
  );
}

function WordRow({ word, starred, onToggleStar }) {
  return (
    <div className="bg-[#f7f0e2] border-2 border-[#e6dac1] rounded-2xl px-3 py-2.5 flex items-center gap-2.5">
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
}

export default function CourseTab({ role, roomData, starredSet, onToggleStar }) {
  const doneDays = useMemo(() => {
    const raw = role === 'left' ? roomData?.leftCourseDays : roomData?.rightCourseDays;
    return Array.isArray(raw) ? raw.filter((d) => Number.isInteger(d) && d >= 1 && d <= TOTAL_DAYS) : [];
  }, [role, roomData?.leftCourseDays, roomData?.rightCourseDays]);
  const doneSet = useMemo(() => new Set(doneDays), [doneDays]);

  const [selectedDay, setSelectedDay] = useState(null);
  const nextDay = firstUnfinishedDay(doneDays);

  const toggleDayDone = useCallback(
    async (day) => {
      if (!role) return;
      const field = role === 'left' ? 'leftCourseDays' : 'rightCourseDays';
      const next = doneSet.has(day) ? doneDays.filter((d) => d !== day) : [...doneDays, day].sort((a, b) => a - b);
      try {
        await updateRoom({ [field]: next }, { merge: true });
      } catch (err) {
        console.error('課程進度儲存失敗:', err);
      }
    },
    [doneDays, doneSet, role],
  );

  // ── 課程列表 ──
  if (selectedDay === null) {
    return (
      <div className="space-y-5">
        <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[#b07d0a] font-black text-lg">100 天文法課程</h3>
              <p className="text-[#9a8568] font-bold text-xs mt-1" style={WRAP}>
                每一課 = 一個捷克文法點 + 一個英文文法點 + 當天單字 + 小測驗。想上哪一天就點哪一天。
              </p>
            </div>
            <button
              onClick={() => setSelectedDay(nextDay)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] font-black shadow-[0_6px_0_#a9760a] active:translate-y-1 active:shadow-[0_2px_0_#a9760a] transition-all flex items-center gap-2 shrink-0"
            >
              <Play size={18} fill="#5a3c0e" />
              {doneDays.length === 0 ? '從第 1 課開始' : `繼續第 ${nextDay} 課`}
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-black text-[#9a8568] mb-1.5">
              <span>已完成 {doneDays.length} / {TOTAL_DAYS} 課</span>
              <span>{Math.round((doneDays.length / TOTAL_DAYS) * 100)}%</span>
            </div>
            <div className="h-3 bg-[#efe4cd] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#f3c44e] to-[#daa520] transition-all duration-500"
                style={{ width: `${(doneDays.length / TOTAL_DAYS) * 100}%` }}
              />
            </div>
          </div>
        </section>

        {COURSE_STAGES.map((stage) => {
          const stageDone = stage.days.filter((d) => doneSet.has(d)).length;
          return (
            <section key={stage.id} className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-5 shadow-[0_8px_0_#e0d3b6]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="text-[#b07d0a] font-black text-[15px]" style={WRAP}>{stage.name}</h4>
                <span className="text-[11px] font-black text-[#9a8568]">{stage.range} · 完成 {stageDone}/{stage.days.length}</span>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {stage.days.map((day) => {
                  const done = doneSet.has(day);
                  const isNext = day === nextDay;
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      title={getCourseDay(day).title}
                      className={`aspect-square rounded-xl border-2 font-black text-sm flex flex-col items-center justify-center transition-all ${
                        done
                          ? 'bg-[#fff2c8] border-[#daa520] text-[#b07d0a]'
                          : isNext
                            ? 'bg-[#e8f7e9] border-[#16a34a] text-[#166534] animate-pulse'
                            : 'bg-[#f7f0e2] border-[#e6dac1] text-[#9a8568] hover:border-[#caa53f] hover:bg-[#f3e9d6]'
                      }`}
                    >
                      {done ? <Check size={16} strokeWidth={3} /> : day}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  // ── 單日課程 ──
  const lesson = getCourseDay(selectedDay);
  const done = doneSet.has(lesson.day);
  const quizPool = [...lesson.csWords, ...lesson.enWords];

  return (
    <div className="space-y-5">
      <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-5 shadow-[0_8px_0_#e0d3b6]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setSelectedDay(null)}
            className="px-4 py-2 rounded-xl bg-[#f3e9d6] text-[#8a755b] font-black text-sm hover:bg-[#ece0c9] transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            課程列表
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDay(Math.max(1, lesson.day - 1))}
              disabled={lesson.day === 1}
              className="p-2 rounded-xl bg-[#f3e9d6] text-[#8a755b] hover:bg-[#ece0c9] transition-colors disabled:opacity-40"
              title="上一課"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-[#9a8568] font-black text-sm">第 {lesson.day} / {TOTAL_DAYS} 課</span>
            <button
              onClick={() => setSelectedDay(Math.min(TOTAL_DAYS, lesson.day + 1))}
              disabled={lesson.day === TOTAL_DAYS}
              className="p-2 rounded-xl bg-[#f3e9d6] text-[#8a755b] hover:bg-[#ece0c9] transition-colors disabled:opacity-40"
              title="下一課"
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] font-black text-xl flex items-center justify-center shrink-0 shadow-[0_4px_0_#a9760a]">
            {lesson.day}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-black text-[#b3a084]" style={WRAP}>{lesson.stageName}</div>
            <h3 className="text-[#b07d0a] font-black text-xl" style={WRAP}>{lesson.title}</h3>
          </div>
        </div>

        <button
          onClick={() => toggleDayDone(lesson.day)}
          className={`mt-4 w-full py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 ${
            done
              ? 'bg-[#e8f7e9] border-2 border-[#16a34a] text-[#166534]'
              : 'bg-gradient-to-b from-[#57c25c] to-[#369a3f] text-white shadow-[0_6px_0_#2b7a33] active:translate-y-1 active:shadow-[0_2px_0_#2b7a33]'
          }`}
        >
          <Check size={18} strokeWidth={3} />
          {done ? '這一課已完成 ✓（點此取消）' : '完成這一課'}
        </button>
      </section>

      <GrammarCard grammar={lesson.csGrammar} lang="cs" accent="border-[#1b3a8f]/25" />
      <GrammarCard grammar={lesson.enGrammar} lang="en" accent="border-[#8b2c2c]/25" />

      <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap size={18} className="text-[#daa520]" />
          <h4 className="text-[#b07d0a] font-black text-lg">今日單字</h4>
          <span className="text-[#9a8568] font-black text-xs">{lesson.csWords.length + lesson.enWords.length} 個</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[12px] font-black text-[#8a755b] mb-1">🇨🇿 捷克文</div>
            {lesson.csWords.map((word) => (
              <WordRow key={word.id} word={word} starred={starredSet.has(word.id)} onToggleStar={onToggleStar} />
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-[12px] font-black text-[#8a755b] mb-1">🇬🇧 英文</div>
            {lesson.enWords.map((word) => (
              <WordRow key={word.id} word={word} starred={starredSet.has(word.id)} onToggleStar={onToggleStar} />
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={18} className="text-[#daa520]" />
          <h4 className="text-[#b07d0a] font-black text-lg">這一課的小測驗</h4>
        </div>
        <LanguageQuiz key={`quiz-day-${lesson.day}`} pool={quizPool} />
      </section>
    </div>
  );
}
