import { useCallback, useState } from 'react';
import { Check, RotateCcw, Trophy, Volume2, X, Zap } from 'lucide-react';
import { ALL_TERMS } from '../constants/languageData';
import { shuffle } from '../utils/dailyPick';
import { speak } from '../utils/speech';
import PixelArt from './PixelArt';
import { PALETTES, SPRITES } from '../constants/pixelArtData';

const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };
const QUESTION_COUNT = 6;

/** 一題 = 一個單字 + 方向（看外文選中文，或看中文選外文）+ 三個同語言干擾選項 */
function buildQuestions(pool) {
  const source = Array.isArray(pool) && pool.length >= 4 ? pool : ALL_TERMS;
  return shuffle(source)
    .slice(0, QUESTION_COUNT)
    .map((word) => {
      const askTerm = Math.random() < 0.5; // true：給中文選外文
      const label = (w) => (askTerm ? w.term : w.zh);
      const distractors = shuffle(ALL_TERMS.filter((w) => w.lang === word.lang && w.id !== word.id))
        .filter((w, idx, arr) => arr.findIndex((x) => label(x) === label(w)) === idx)
        .filter((w) => label(w) !== label(word))
        .slice(0, 3);
      return {
        word,
        askTerm,
        prompt: askTerm ? word.zh : word.term,
        answer: label(word),
        options: shuffle([word, ...distractors].map(label)),
      };
    });
}

export default function LanguageQuiz({ pool, onComplete }) {
  // 出題後就固定住：中途收藏單字不該打亂正在作答的這一輪
  const [questions, setQuestions] = useState(() => buildQuestions(pool));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = questions[index];

  const handlePick = useCallback(
    (option) => {
      if (picked !== null || !current) return;
      setPicked(option);
      if (option === current.answer) {
        setScore((s) => s + 1);
        setCombo((c) => {
          const next = c + 1;
          setBestCombo((b) => Math.max(b, next));
          return next;
        });
        if (!current.askTerm) speak(current.word.term, current.word.lang);
      } else {
        setCombo(0);
      }
    },
    [current, picked],
  );

  const handleNext = useCallback(() => {
    if (index + 1 >= questions.length) {
      setFinished(true);
      onComplete?.({ score, total: questions.length });
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }, [index, onComplete, questions.length, score]);

  const handleRestart = useCallback(() => {
    setQuestions(buildQuestions(pool));
    setIndex(0);
    setPicked(null);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setFinished(false);
  }, [pool]);

  if (finished) {
    const perfect = score === questions.length;
    const good = score >= Math.ceil(questions.length * 0.6);
    return (
      <div className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-8 text-center shadow-[0_8px_0_#e0d3b6]">
        <div className="flex justify-center mb-4">
          <PixelArt
            art={good ? SPRITES.dragonSit : SPRITES.dragonSleep}
            palette={PALETTES.dragon}
            pixelSize={6}
            className={good ? 'animate-bounce' : 'opacity-70'}
          />
        </div>
        <div className="text-[#b07d0a] font-black text-3xl mb-2">
          {score} / {questions.length}
        </div>
        <p className="text-[#8a755b] font-bold mb-1" style={WRAP}>
          {perfect ? '全對！龍龍決定今天多噴一口火慶祝 🔥' : good ? '不錯喔，剩下幾個明天再遇到就記起來了。' : '沒關係，錯過的字會排在明天的複習裡。'}
        </p>
        {bestCombo >= 3 && (
          <p className="text-[#b07d0a] font-black text-sm mb-4" style={WRAP}>
            最高連擊 {bestCombo} 連 ⚡
          </p>
        )}
        <button
          onClick={handleRestart}
          className="mt-4 px-6 py-3 rounded-2xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] font-black shadow-[0_6px_0_#a9760a] active:translate-y-1 active:shadow-[0_2px_0_#a9760a] transition-all inline-flex items-center gap-2"
        >
          <RotateCcw size={18} />
          再來一輪
        </button>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-[#9a8568] font-black text-sm">
          <Trophy size={16} className="text-[#daa520]" />
          第 {index + 1} / {questions.length} 題
        </div>
        {combo >= 2 && (
          <div className="flex items-center gap-1 text-[#d97706] font-black text-sm animate-pulse">
            <Zap size={16} fill="#d97706" />
            {combo} 連擊！
          </div>
        )}
      </div>

      <div className="h-2 bg-[#efe4cd] rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#f3c44e] to-[#daa520] transition-all duration-300"
          style={{ width: `${((index + (picked ? 1 : 0)) / questions.length) * 100}%` }}
        />
      </div>

      <div className="text-center mb-6">
        <div className="text-[11px] font-black text-[#b3a084] mb-2">
          {current.askTerm
            ? `用 ${current.word.lang === 'cs' ? '🇨🇿 捷克文' : '🇬🇧 英文'} 怎麼說？`
            : `這個 ${current.word.lang === 'cs' ? '🇨🇿 捷克文' : '🇬🇧 英文'} 是什麼意思？`}
        </div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-[#4a3526] font-black text-2xl" style={WRAP}>
            {current.prompt}
          </span>
          {!current.askTerm && (
            <button
              onClick={() => speak(current.word.term, current.word.lang)}
              className="p-2 rounded-xl bg-[#f3e9d6] text-[#b07d0a] hover:bg-[#ece0c9] transition-colors shrink-0"
              title="唸給我聽"
            >
              <Volume2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {current.options.map((option) => {
          const isAnswer = option === current.answer;
          const isPicked = option === picked;
          let tone = 'bg-[#f7f0e2] border-[#e6dac1] text-[#4a3526] hover:border-[#caa53f] hover:bg-[#f3e9d6]';
          if (picked !== null && isAnswer) tone = 'bg-[#e8f7e9] border-[#16a34a] text-[#166534]';
          else if (isPicked) tone = 'bg-[#fdecec] border-[#dc2626] text-[#991b1b]';
          else if (picked !== null) tone = 'bg-[#f7f0e2] border-[#e6dac1] text-[#b3a084] opacity-60';
          return (
            <button
              key={option}
              onClick={() => handlePick(option)}
              disabled={picked !== null}
              className={`px-4 py-3 rounded-2xl border-2 font-bold text-left transition-all flex items-center gap-2 ${tone}`}
            >
              {picked !== null && isAnswer && <Check size={16} className="shrink-0" strokeWidth={3} />}
              {picked !== null && isPicked && !isAnswer && <X size={16} className="shrink-0" strokeWidth={3} />}
              <span style={WRAP}>{option}</span>
            </button>
          );
        })}
      </div>

      {picked !== null && (
        <div className="mt-5 pt-4 border-t-2 border-[#e6dac1]">
          <p className="text-[13px] text-[#8a755b] font-bold mb-3" style={WRAP}>
            <span className="text-[#b07d0a] font-black">{current.word.term}</span>
            <span className="text-[#b3a084]"> [{current.word.pron}] </span>
            {current.word.zh}
            {current.word.ex ? ` — ${current.word.ex}` : ''}
          </p>
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-2xl bg-gradient-to-b from-[#57c25c] to-[#369a3f] text-white font-black shadow-[0_6px_0_#2b7a33] active:translate-y-1 active:shadow-[0_2px_0_#2b7a33] transition-all"
          >
            {index + 1 >= questions.length ? '看結果 🏁' : '下一題 →'}
          </button>
        </div>
      )}
    </div>
  );
}
