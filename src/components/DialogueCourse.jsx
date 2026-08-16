import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, MessagesSquare, Play, Star, Volume2 } from 'lucide-react';
import {
  DIALOGUE_STAGES,
  DIALOGUE_DAYS,
  TOTAL_DIALOGUE_DAYS,
  firstUnfinishedDialogue,
  getDialogueDay,
} from '../constants/dialogues';
import { updateRoom } from '../lib/roomStore';
import { pronounce } from '../utils/voice';
import LanguageQuiz from './LanguageQuiz';

const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

/** 一句對話：捷克文 → 拼讀 → 英文 → 中文，兩種語言各自可發音 */
function DialogueLine({ line, index }) {
  const mine = index % 2 === 1; // 交錯排版，一眼看出是誰在講
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[92%] rounded-2xl border-2 p-3.5 ${mine ? 'bg-[#fff7e3] border-[#daa520]/50' : 'bg-[#f7f0e2] border-[#e6dac1]'}`}>
        <div className="text-[10px] font-black text-[#b3a084] mb-1">{line.who}</div>

        <div className="flex items-start justify-between gap-3">
          <p className="text-[#4a3526] font-black text-[15px] leading-snug" style={WRAP}>{line.cs}</p>
          <button
            onClick={() => pronounce({ id: line.csId, text: line.cs, lang: 'cs' })}
            className="p-2 rounded-xl bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors shrink-0"
            title="唸捷克文"
          >
            <Volume2 size={15} />
          </button>
        </div>
        {line.pron && (
          <p className="text-[#b3a084] font-mono text-[11px] mt-0.5" style={WRAP}>{line.pron}</p>
        )}

        <div className="flex items-start justify-between gap-3 mt-2 pt-2 border-t border-[#e6dac1]">
          <p className="text-[#5f7a3a] font-bold text-[13px] leading-snug" style={WRAP}>{line.en}</p>
          <button
            onClick={() => pronounce({ id: line.enId, text: line.en, lang: 'en' })}
            className="p-1.5 rounded-lg bg-[#f3e9d6] text-[#7a8f4a] hover:bg-[#ece0c9] transition-colors shrink-0"
            title="唸英文"
          >
            <Volume2 size={13} />
          </button>
        </div>
        <p className="text-[#8a755b] font-bold text-[13px] mt-1.5" style={WRAP}>{line.zh}</p>
      </div>
    </div>
  );
}

/** 對話單字：捷克 + 英文對照，兩邊都能發音 */
export function DialogueWordRow({ word, starred, onToggleStar }) {
  return (
    <div className="bg-[#f7f0e2] border-2 border-[#e6dac1] rounded-2xl px-3 py-2.5 flex items-center gap-2.5">
      <button
        onClick={() => pronounce({ id: word.id, text: word.term, lang: 'cs' })}
        className="p-2 rounded-xl bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors shrink-0"
        title="唸捷克文"
      >
        <Volume2 size={15} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[#4a3526] font-black text-[15px]" style={WRAP}>{word.term}</span>
          <span className="text-[#b3a084] font-mono text-[11px]" style={WRAP}>{word.pron}</span>
        </div>
        <div className="text-[#8a755b] font-bold text-[13px]" style={WRAP}>{word.zh}</div>
        {word.en && (
          <button
            onClick={() => pronounce({ id: word.enId, text: word.en, lang: 'en' })}
            className="text-[#5f7a3a] font-bold text-[12px] mt-0.5 hover:underline flex items-center gap-1"
            title="唸英文"
          >
            🇬🇧 {word.en} <Volume2 size={11} />
          </button>
        )}
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

/** 一整天的課：先對話、再單字、最後測驗 */
export function DialogueLesson({ lesson, starredSet, onToggleStar, showQuiz = true }) {
  return (
    <div className="space-y-5">
      <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
        <div className="flex items-center gap-2 mb-1">
          <MessagesSquare size={18} className="text-[#daa520]" />
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-[#f3e9d6] text-[#8a755b]">
            今日情境
          </span>
        </div>
        <h4 className="text-[#b07d0a] font-black text-xl mt-2" style={WRAP}>
          {lesson.icon} {lesson.scene}
        </h4>
        <p className="text-[#8a6d3b] font-black text-sm mb-4" style={WRAP}>目標：{lesson.goal}</p>

        <div className="space-y-2.5">
          {lesson.lines.map((line, index) => (
            <DialogueLine key={line.csId} line={line} index={index} />
          ))}
        </div>

        {lesson.tip && (
          <p className="mt-4 text-[13px] text-[#8a6d3b] font-bold bg-[#fdf3d8] border-l-4 border-[#daa520] rounded-r-xl px-4 py-3" style={WRAP}>
            💡 {lesson.tip}
          </p>
        )}
      </section>

      <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-[#b07d0a] font-black text-lg">這段對話的單字</h4>
          <span className="text-[#9a8568] font-black text-sm">{lesson.words.length} 個</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {lesson.words.map((word) => (
            <DialogueWordRow
              key={word.id}
              word={word}
              starred={starredSet.has(word.id)}
              onToggleStar={onToggleStar}
            />
          ))}
        </div>
      </section>

      {showQuiz && (
        <section>
          <h4 className="text-[#b07d0a] font-black text-lg mb-3">這一課的小測驗</h4>
          <LanguageQuiz key={`quiz-${lesson.id}`} pool={lesson.words} />
        </section>
      )}
    </div>
  );
}

export default function DialogueCourse({ role, roomData, starredSet, onToggleStar }) {
  const doneDays = useMemo(() => {
    const raw = role === 'left' ? roomData?.leftCourseDays : roomData?.rightCourseDays;
    return Array.isArray(raw) ? raw.filter((d) => Number.isInteger(d) && d >= 1 && d <= TOTAL_DIALOGUE_DAYS) : [];
  }, [role, roomData?.leftCourseDays, roomData?.rightCourseDays]);
  const doneSet = useMemo(() => new Set(doneDays), [doneDays]);

  const [selectedDay, setSelectedDay] = useState(null);
  const nextDay = firstUnfinishedDialogue(doneDays);

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

  if (selectedDay === null) {
    return (
      <div className="space-y-5">
        <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[#b07d0a] font-black text-lg">30 天情境對話</h3>
              <p className="text-[#9a8568] font-bold text-xs mt-1" style={WRAP}>
                一天一個真的會遇到的場景，先把對話練起來，單字都是這段對話裡出現過的。想上哪天就點哪天。
              </p>
            </div>
            <button
              onClick={() => setSelectedDay(nextDay)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] font-black shadow-[0_6px_0_#a9760a] active:translate-y-1 active:shadow-[0_2px_0_#a9760a] transition-all flex items-center gap-2 shrink-0"
            >
              <Play size={18} fill="#5a3c0e" />
              {doneDays.length === 0 ? '從第 1 天開始' : `繼續第 ${nextDay} 天`}
            </button>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-black text-[#9a8568] mb-1.5">
              <span>已完成 {doneDays.length} / {TOTAL_DIALOGUE_DAYS} 天</span>
              <span>{Math.round((doneDays.length / TOTAL_DIALOGUE_DAYS) * 100)}%</span>
            </div>
            <div className="h-3 bg-[#efe4cd] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#f3c44e] to-[#daa520] transition-all duration-500"
                style={{ width: `${(doneDays.length / TOTAL_DIALOGUE_DAYS) * 100}%` }}
              />
            </div>
          </div>
        </section>

        {DIALOGUE_STAGES.map((stage) => {
          const days = DIALOGUE_DAYS.filter((d) => d.stage === stage.id);
          const stageDone = days.filter((d) => doneSet.has(d.day)).length;
          return (
            <section key={stage.id} className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-5 shadow-[0_8px_0_#e0d3b6]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h4 className="text-[#b07d0a] font-black text-[15px]" style={WRAP}>{stage.name}</h4>
                <span className="text-[11px] font-black text-[#9a8568]">{stage.range} · 完成 {stageDone}/{days.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                {days.map((d) => {
                  const done = doneSet.has(d.day);
                  const isNext = d.day === nextDay;
                  return (
                    <button
                      key={d.day}
                      onClick={() => setSelectedDay(d.day)}
                      className={`rounded-2xl border-2 px-3 py-2.5 text-left transition-all flex items-center gap-2.5 ${
                        done
                          ? 'bg-[#fff2c8] border-[#daa520]'
                          : isNext
                            ? 'bg-[#e8f7e9] border-[#16a34a]'
                            : 'bg-[#f7f0e2] border-[#e6dac1] hover:border-[#caa53f]'
                      }`}
                    >
                      <span className="text-xl shrink-0">{d.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-black text-[#9a8568]">Day {d.day}</span>
                        <span className="block text-[13px] font-black text-[#4a3526]" style={WRAP}>{d.scene}</span>
                      </span>
                      {done && <Check size={16} strokeWidth={3} className="text-[#b07d0a] shrink-0" />}
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

  const lesson = getDialogueDay(selectedDay);
  const done = doneSet.has(lesson.day);

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
              title="前一天"
            >
              <ArrowLeft size={16} />
            </button>
            <span className="text-[#9a8568] font-black text-sm">第 {lesson.day} / {TOTAL_DIALOGUE_DAYS} 天</span>
            <button
              onClick={() => setSelectedDay(Math.min(TOTAL_DIALOGUE_DAYS, lesson.day + 1))}
              disabled={lesson.day === TOTAL_DIALOGUE_DAYS}
              className="p-2 rounded-xl bg-[#f3e9d6] text-[#8a755b] hover:bg-[#ece0c9] transition-colors disabled:opacity-40"
              title="下一天"
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
            <h3 className="text-[#b07d0a] font-black text-xl" style={WRAP}>{lesson.icon} {lesson.scene}</h3>
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
          {done ? '這一天已完成 ✓（點此取消）' : '完成這一天'}
        </button>
      </section>

      <DialogueLesson lesson={lesson} starredSet={starredSet} onToggleStar={onToggleStar} />
    </div>
  );
}
