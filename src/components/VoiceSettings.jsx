import { useCallback, useEffect, useMemo, useState } from 'react';
import { Play, RotateCcw, Settings2, Volume2 } from 'lucide-react';
import { getRate, getVoicePref, listVoices, onVoicesReady, resolveVoice, setRate, setVoicePref, speak } from '../utils/speech';

const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const LANGS = [
  { key: 'cs', label: '🇨🇿 捷克文', sample: 'Dobrý den, dám si jedno pivo, prosím.', sampleZh: '您好，我要一杯啤酒。' },
  { key: 'en', label: '🇬🇧 英文', sample: 'Hi, I am an exchange student from Taiwan.', sampleZh: '嗨，我是來自台灣的交換學生。' },
];

export default function VoiceSettings() {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const [prefs, setPrefs] = useState({ cs: getVoicePref('cs'), en: getVoicePref('en') });
  const [rate, setRateState] = useState(getRate);

  // 語音清單是非同步載入的
  useEffect(() => onVoicesReady(() => setTick((t) => t + 1)), []);

  const voices = useMemo(
    () => ({ cs: listVoices('cs'), en: listVoices('en') }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  const handlePick = useCallback((lang, voiceURI) => {
    setVoicePref(lang, voiceURI);
    setPrefs((prev) => ({ ...prev, [lang]: voiceURI }));
    const entry = listVoices(lang).find((r) => r.voice.voiceURI === voiceURI);
    const sample = LANGS.find((l) => l.key === lang)?.sample;
    if (sample) speak(sample, lang, { voice: entry?.voice });
  }, []);

  const handleRate = useCallback((value) => {
    setRateState(value);
    setRate(value);
  }, []);

  const handleReset = useCallback(() => {
    LANGS.forEach((l) => setVoicePref(l.key, ''));
    setRate(0.85);
    setPrefs({ cs: '', en: '' });
    setRateState(0.85);
  }, []);

  return (
    <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] shadow-[0_8px_0_#e0d3b6] overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-6 py-4 flex items-center justify-between gap-3 hover:bg-[#f7f0e2] transition-colors"
      >
        <span className="flex items-center gap-2 text-[#b07d0a] font-black">
          <Settings2 size={18} />
          發音設定
        </span>
        <span className="text-[#9a8568] font-bold text-xs no-wrap-scroll">
          {resolveVoice('cs')?.name || '無捷克語音'} · {resolveVoice('en')?.name || '無英文語音'} · {rate.toFixed(2)}x
        </span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-5 border-t-2 border-[#e6dac1] pt-5">
          {LANGS.map((lang) => {
            const ranked = voices[lang.key];
            const current = prefs[lang.key] || resolveVoice(lang.key)?.voiceURI || '';
            return (
              <div key={lang.key}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[#4a3526] font-black text-sm">{lang.label}</span>
                  <span className="text-[11px] text-[#b3a084] font-bold">{ranked.length} 個可用語音</span>
                </div>

                {ranked.length === 0 ? (
                  <p className="text-[13px] text-[#8a6d3b] font-bold bg-[#fdf3d8] border-l-4 border-[#daa520] rounded-r-xl px-4 py-3" style={WRAP}>
                    這台裝置沒有安裝{lang.label}語音，發音鈕會用預設語音硬唸。安裝方式見下方說明。
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={current}
                      onChange={(e) => handlePick(lang.key, e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-2 border-[#e6dac1] bg-[#f7f0e2] text-[#4a3526] font-bold focus:outline-none focus:border-[#daa520]"
                    >
                      {ranked.map(({ voice, novelty }) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} · {voice.lang}
                          {novelty ? '（特效音，不建議）' : ''}
                          {voice.localService ? '' : '（需網路）'}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => speak(lang.sample, lang.key)}
                      className="px-4 py-2.5 rounded-xl bg-[#f3e9d6] text-[#b07d0a] font-black text-sm hover:bg-[#ece0c9] transition-colors flex items-center gap-1.5 shrink-0"
                      title="試聽"
                    >
                      <Play size={14} fill="#b07d0a" />
                      試聽
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-[#b3a084] font-bold mt-1.5" style={WRAP}>
                  試聽句：{lang.sample}（{lang.sampleZh}）
                </p>
              </div>
            );
          })}

          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[#4a3526] font-black text-sm flex items-center gap-2">
                <Volume2 size={16} className="text-[#b07d0a]" />
                語速
              </span>
              <span className="text-[#9a8568] font-black text-sm">{rate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="1.2"
              step="0.05"
              value={rate}
              onChange={(e) => handleRate(Number(e.target.value))}
              className="w-full accent-[#daa520]"
            />
            <div className="flex justify-between text-[11px] text-[#b3a084] font-bold">
              <span>0.5x 慢速跟讀</span>
              <span>1.2x 接近母語速度</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-[#f3e9d6] text-[#8a755b] font-black text-sm hover:bg-[#ece0c9] transition-colors flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              回到自動挑選
            </button>
            <span className="text-[11px] text-[#b3a084] font-bold" style={WRAP}>
              設定存在這台裝置上，手機和電腦可以各自選。
            </span>
          </div>

          <div className="text-[12px] text-[#8a6d3b] font-bold bg-[#fdf3d8] border-l-4 border-[#daa520] rounded-r-xl px-4 py-3 space-y-1.5" style={WRAP}>
            <p style={WRAP}>🎧 <strong>想要更自然的音調？</strong>系統內建的是壓縮版語音，可以免費下載高音質版：</p>
            <p style={WRAP}>• <strong>macOS</strong>：系統設定 → 輔助使用 → 朗讀內容 → 系統語音 → 管理語音 → 找「Čeština / Zuzana」與「English / Samantha（進階）」下載，回來重整頁面就會出現。</p>
            <p style={WRAP}>• <strong>iPhone</strong>：設定 → 輔助使用 → 朗讀內容 → 聲音 → 選語言下載進階版。</p>
            <p style={WRAP}>• 用 <strong>Chrome</strong> 開這個網站會多出 Google 的網路語音（Google čeština），語調通常比系統內建更接近真人。</p>
          </div>
        </div>
      )}
    </section>
  );
}
