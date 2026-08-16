import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookMarked, BookOpen, Check, Flame, GraduationCap, Lightbulb, MessagesSquare, Plane, Search, Star, Volume2 } from 'lucide-react';
import { updateRoom } from '../lib/roomStore';
import { getLocalDateStr } from '../utils/date';
import { computeStreak, daysUntil, dayNumberFromDateStr, pickDaily } from '../utils/dailyPick';
import { pronounce, loadClipManifest } from '../utils/voice';
import { CZECH_WORDS, DAILY_TIPS, ENGLISH_WORDS, STREAK_CHEERS, TERMS_BY_ID } from '../constants/languageData';
import { DIALOGUE_WORDS, TOTAL_DIALOGUE_DAYS, getDialogueDay } from '../constants/dialogues';
import LanguageWordCard from './LanguageWordCard';
import LanguageQuiz from './LanguageQuiz';
import DialogueCourse, { DialogueLesson } from './DialogueCourse';
import GrammarBook from './GrammarBook';
import VocabBook from './VocabBook';
import VoiceSettings from './VoiceSettings';

/** 全站 index.css 的 unlayered `p/span { white-space: nowrap }` 會壓過 utility class，靠 inline style 放行換行 */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

/** 收藏可能來自單字大全、每日精選，或對話單字，查表要三邊都涵蓋 */
const WORDS_BY_ID = new Map([...TERMS_BY_ID, ...DIALOGUE_WORDS.map((w) => [w.id, w])]);
const SUB_TABS = [
  { key: 'today', label: '今日一課', icon: MessagesSquare },
  { key: 'course', label: `${TOTAL_DIALOGUE_DAYS} 天對話`, icon: GraduationCap },
  { key: 'grammar', label: '文法大全', icon: BookOpen },
  { key: 'vocab', label: '單字大全', icon: Search },
  { key: 'quiz', label: '小測驗', icon: Flame },
  { key: 'book', label: '單字本', icon: BookMarked },
];

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function LanguageLab({ role, roomData }) {
  const [subTab, setSubTab] = useState('today');
  const [flippedIds, setFlippedIds] = useState(() => new Set());
  const [quizDone, setQuizDone] = useState(false);
  const [editingDeparture, setEditingDeparture] = useState(false);

  // 一進語言教室就把真人音檔清單抓下來，按發音鈕才不會先送一個 404
  useEffect(() => {
    loadClipManifest();
  }, []);

  const today = getLocalDateStr();
  const dayNumber = useMemo(() => dayNumberFromDateStr(today), [today]);

  // 今天輪到第幾天的對話（30 天一輪，兩個人看到的是同一天）
  const todayLesson = useMemo(
    () => getDialogueDay((((dayNumber % TOTAL_DIALOGUE_DAYS) + TOTAL_DIALOGUE_DAYS) % TOTAL_DIALOGUE_DAYS) + 1),
    [dayNumber],
  );

  const czWords = useMemo(() => pickDaily(CZECH_WORDS, dayNumber, 3), [dayNumber]);
  const enWords = useMemo(() => pickDaily(ENGLISH_WORDS, dayNumber, 3, 11), [dayNumber]);
  const todayWords = useMemo(() => [...czWords, ...enWords], [czWords, enWords]);
  const dailyTip = useMemo(() => pickDaily(DAILY_TIPS, dayNumber, 1, 5)[0], [dayNumber]);
  const cheer = useMemo(() => pickDaily(STREAK_CHEERS, dayNumber, 1, 3)[0], [dayNumber]);

  const starredIds = useMemo(() => toArray(roomData?.langStarred).filter((id) => WORDS_BY_ID.has(id)), [roomData?.langStarred]);
  const starredSet = useMemo(() => new Set(starredIds), [starredIds]);
  const starredWords = useMemo(() => starredIds.map((id) => WORDS_BY_ID.get(id)), [starredIds]);

  const myDates = useMemo(
    () => toArray(role === 'left' ? roomData?.leftLangDates : roomData?.rightLangDates),
    [role, roomData?.leftLangDates, roomData?.rightLangDates],
  );
  const partnerDates = useMemo(
    () => toArray(role === 'left' ? roomData?.rightLangDates : roomData?.leftLangDates),
    [role, roomData?.leftLangDates, roomData?.rightLangDates],
  );
  const myCourseDays = useMemo(
    () => toArray(role === 'left' ? roomData?.leftCourseDays : roomData?.rightCourseDays),
    [role, roomData?.leftCourseDays, roomData?.rightCourseDays],
  );
  const myStreak = useMemo(() => computeStreak(myDates, today), [myDates, today]);
  const checkedInToday = myDates.includes(today);
  const partnerCheckedIn = partnerDates.includes(today);
  const partnerLabel = role === 'left' ? '花花' : '呱呱';

  const departureDate = typeof roomData?.czDepartureDate === 'string' ? roomData.czDepartureDate : '';
  const daysLeft = daysUntil(departureDate, today);

  const handleFlip = useCallback((id) => {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleStar = useCallback(
    async (word) => {
      const current = toArray(roomData?.langStarred);
      const next = current.includes(word.id) ? current.filter((id) => id !== word.id) : [...current, word.id];
      try {
        await updateRoom({ langStarred: next }, { merge: true });
      } catch (err) {
        console.error('收藏單字失敗:', err);
      }
    },
    [roomData?.langStarred],
  );

  /** 可以取消：誤點的話再按一次就把今天的打卡收回（跟 100 天課程的完成鈕一致） */
  const handleCheckIn = useCallback(async () => {
    if (!role) return;
    const field = role === 'left' ? 'leftLangDates' : 'rightLangDates';
    const next = checkedInToday
      ? myDates.filter((d) => d !== today)
      : [...new Set([...myDates, today])].sort().slice(-400);
    try {
      await updateRoom({ [field]: next }, { merge: true });
    } catch (err) {
      console.error(checkedInToday ? '取消語言打卡失敗:' : '語言打卡失敗:', err);
    }
  }, [checkedInToday, myDates, role, today]);

  const handleDepartureChange = useCallback(async (value) => {
    try {
      await updateRoom({ czDepartureDate: value || null }, { merge: true });
    } catch (err) {
      console.error('設定出發日失敗:', err);
    }
    setEditingDeparture(false);
  }, []);

  const flippedTodayCount = todayWords.filter((w) => flippedIds.has(w.id)).length;
  const allFlipped = flippedTodayCount === todayWords.length;
  const quizPool = useMemo(() => {
    const seen = new Set();
    return [...todayLesson.words, ...todayWords, ...starredWords].filter((w) => {
      if (!w || seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
  }, [starredWords, todayLesson, todayWords]);

  return (
    <div className="space-y-6">
      {/* ── 頂部狀態列：倒數 + 連續天數 ── */}
      <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_10px_0_#e0d3b6]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[#b07d0a] font-black text-2xl flex items-center gap-2">
              🐉 龍龍語言教室
            </h2>
            <p className="text-[#9a8568] font-bold text-sm mt-1" style={WRAP}>
              每天一段真的會用到的對話，先聽會話、再學裡面的單字。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-3 rounded-2xl bg-[#fff7e3] border-2 border-[#daa520]/50 text-center">
              <div className="flex items-center justify-center gap-1.5 text-[#b07d0a] font-black text-xl">
                <Flame size={18} fill={myStreak > 0 ? '#daa520' : 'none'} />
                {myStreak}
              </div>
              <div className="text-[10px] text-[#9a8568] font-black mt-0.5">連續天數</div>
            </div>

            <button
              onClick={() => setSubTab('course')}
              className="px-4 py-3 rounded-2xl bg-[#f3e9d6] border-2 border-[#e6dac1] hover:border-[#caa53f] transition-colors text-center"
              title="打開 30 天對話課程"
            >
              <div className="flex items-center justify-center gap-1.5 text-[#4a3526] font-black text-xl">
                <BookOpen size={18} className="text-[#b07d0a]" />
                {myCourseDays.length}
                <span className="text-sm text-[#9a8568]">/{TOTAL_DIALOGUE_DAYS}</span>
              </div>
              <div className="text-[10px] text-[#9a8568] font-black mt-0.5">課程進度</div>
            </button>

            <button
              onClick={() => setEditingDeparture((v) => !v)}
              className="px-4 py-3 rounded-2xl bg-[#f3e9d6] border-2 border-[#e6dac1] hover:border-[#caa53f] transition-colors text-center"
              title="點一下設定出發日"
            >
              <div className="flex items-center justify-center gap-1.5 text-[#4a3526] font-black text-xl">
                <Plane size={18} className="text-[#b07d0a]" />
                {daysLeft === null ? '—' : daysLeft >= 0 ? `D-${daysLeft}` : '已出發'}
              </div>
              <div className="text-[10px] text-[#9a8568] font-black mt-0.5">
                {daysLeft === null ? '設定出發日' : daysLeft >= 0 ? '距離飛捷克' : `第 ${-daysLeft} 天`}
              </div>
            </button>
          </div>
        </div>

        {editingDeparture && (
          <div className="mt-4 flex flex-wrap items-center gap-3 bg-[#f7f0e2] border-2 border-[#e6dac1] rounded-2xl p-3">
            <span className="text-[#8a755b] font-black text-sm">出發去捷克的日子：</span>
            <input
              type="date"
              defaultValue={departureDate}
              onChange={(e) => handleDepartureChange(e.target.value)}
              className="px-3 py-2 rounded-xl border-2 border-[#e6dac1] bg-[#fdf9f1] text-[#4a3526] font-bold focus:outline-none focus:border-[#daa520]"
            />
            <span className="text-[11px] text-[#b3a084] font-bold">兩個人都會看到同一個倒數</span>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={handleCheckIn}
            title={checkedInToday ? '按一下取消今天的打卡' : '記錄今天有學'}
            className={`px-5 py-3 rounded-2xl font-black transition-all flex items-center gap-2 ${
              checkedInToday
                ? 'bg-[#e8f7e9] border-2 border-[#16a34a] text-[#166534] hover:bg-[#dcf0de] active:translate-y-0.5'
                : 'bg-gradient-to-b from-[#57c25c] to-[#369a3f] text-white shadow-[0_6px_0_#2b7a33] active:translate-y-1 active:shadow-[0_2px_0_#2b7a33]'
            }`}
          >
            <Check size={18} strokeWidth={3} />
            {checkedInToday ? '今天已完成 ✓（點此取消）' : '完成今日學習 · 打卡'}
          </button>

          <div className="flex items-center gap-2 text-sm font-bold text-[#9a8568]" style={WRAP}>
            {partnerCheckedIn ? (
              <span className="text-[#b07d0a]">🔥 {partnerLabel} 今天也學了！</span>
            ) : (
              <span>{partnerLabel} 今天還沒學，快去戳一下 👀</span>
            )}
          </div>
        </div>

        {checkedInToday && (
          <p className="mt-3 text-[13px] text-[#8a6d3b] font-bold" style={WRAP}>
            {cheer}
          </p>
        )}
      </section>

      {/* ── 子頁籤 ── */}
      <div className="flex gap-2 flex-wrap">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={`px-5 py-2.5 rounded-2xl border-2 font-black text-sm transition-all flex items-center gap-2 ${
                active
                  ? 'bg-[#fff7e3] border-[#daa520] text-[#b07d0a] shadow-[0_4px_0_#d8c4a0]'
                  : 'bg-[#f3e9d6] border-transparent text-[#9a8568] hover:bg-[#ece0c9]'
              }`}
            >
              <Icon size={16} />
              {tab.label}
              {tab.key === 'book' && starredIds.length > 0 && (
                <span className="text-[10px] bg-[#daa520] text-white rounded-full px-2 py-0.5">{starredIds.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <VoiceSettings />

      {subTab === 'today' && (
        <div className="space-y-6">
          {/* 今天的情境對話 + 該對話的單字（含小測驗） */}
          <DialogueLesson
            lesson={todayLesson}
            starredSet={starredSet}
            onToggleStar={handleToggleStar}
            showQuiz={false}
          />

          {/* 補充：每日精選字卡 */}
          <section>
            <div className="flex items-center justify-between mb-3 gap-3">
              <h3 className="text-[#b07d0a] font-black text-lg">加碼單字</h3>
              <span className="text-[#9a8568] font-black text-sm">
                翻開 {flippedTodayCount} / {todayWords.length} {allFlipped && '🎉'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {todayWords.map((word) => (
                <LanguageWordCard
                  key={word.id}
                  word={word}
                  flipped={flippedIds.has(word.id)}
                  onFlip={handleFlip}
                  starred={starredSet.has(word.id)}
                  onToggleStar={handleToggleStar}
                />
              ))}
            </div>
          </section>

          {/* 龍龍小知識 */}
          {dailyTip && (
            <section className="bg-gradient-to-b from-[#fff7e3] to-[#fdf3d8] border-4 border-[#daa520]/40 rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={20} className="text-[#daa520]" />
                <h3 className="text-[#b07d0a] font-black text-lg">龍龍小知識</h3>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-3xl shrink-0">{dailyTip.icon}</span>
                <div className="min-w-0">
                  <p className="text-[#4a3526] font-black text-[15px] mb-1" style={WRAP}>{dailyTip.title}</p>
                  <p className="text-[#6b5a45] font-bold text-[13px] leading-relaxed" style={WRAP}>{dailyTip.body}</p>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {subTab === 'course' && (
        <DialogueCourse role={role} roomData={roomData} starredSet={starredSet} onToggleStar={handleToggleStar} />
      )}

      {subTab === 'grammar' && <GrammarBook />}

      {subTab === 'vocab' && <VocabBook starredSet={starredSet} onToggleStar={handleToggleStar} />}

      {subTab === 'quiz' && (
        <div className="space-y-4">
          <p className="text-[#9a8568] font-bold text-sm" style={WRAP}>
            題目來自今天的單字＋你們收藏的單字。{quizDone && ' 今天的測驗已經完成囉，想再練隨時可以重來。'}
          </p>
          <LanguageQuiz pool={quizPool} onComplete={() => setQuizDone(true)} />
        </div>
      )}

      {subTab === 'book' && (
        <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-[#b07d0a] font-black text-lg">我們的單字本</h3>
            <span className="text-[#9a8568] font-black text-sm">{starredWords.length} 個字</span>
          </div>

          {starredWords.length === 0 ? (
            <div className="text-center py-10">
              <Star size={40} className="text-[#e0d3b6] mx-auto mb-3" />
              <p className="text-[#9a8568] font-bold" style={WRAP}>
                還沒有收藏的單字。在字卡上點 ⭐ 就會存進來，兩個人共用同一本。
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {starredWords.map((word) => (
                <div key={word.id} className="bg-[#f7f0e2] border-2 border-[#e6dac1] rounded-2xl p-3.5 flex items-start gap-3">
                  <button
                    onClick={() => pronounce({ id: word.id, text: word.term, lang: word.lang })}
                    className="p-2 rounded-xl bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors shrink-0"
                    title="唸給我聽"
                  >
                    <Volume2 size={16} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[#4a3526] font-black text-[15px]" style={WRAP}>
                      {word.lang === 'cs' ? '🇨🇿' : '🇬🇧'} {word.term}
                      <span className="text-[#b3a084] font-mono text-[11px] ml-2">{word.pron}</span>
                    </p>
                    <p className="text-[#8a755b] font-bold text-[13px]" style={WRAP}>{word.zh}</p>
                    <p className="text-[#b3a084] font-bold text-[12px] mt-1" style={WRAP}>{word.ex}</p>
                  </div>
                  <button
                    onClick={() => handleToggleStar(word)}
                    className="p-2 rounded-xl text-[#daa520] hover:bg-[#f3e9d6] transition-colors shrink-0"
                    title="從單字本移除"
                  >
                    <Star size={16} fill="#daa520" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
