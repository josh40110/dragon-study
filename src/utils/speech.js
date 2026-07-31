/**
 * 瀏覽器內建語音（Web Speech API）：免安裝、離線也能唸。
 * macOS 若沒有捷克語語音，可到 系統設定 → 輔助使用 → 朗讀內容 → 系統語音 下載「Čeština」。
 */

const LANG_TAG = { cs: 'cs-CZ', en: 'en-US' };

function synth() {
  return typeof window !== 'undefined' ? window.speechSynthesis : null;
}

/** 該語言是否有可用語音（沒有時瀏覽器會用預設語音硬唸，聽起來會怪） */
export function hasVoiceFor(lang) {
  const s = synth();
  if (!s) return false;
  const prefix = (LANG_TAG[lang] || lang).slice(0, 2).toLowerCase();
  return s.getVoices().some((v) => v.lang?.toLowerCase().startsWith(prefix));
}

/** 語音清單是非同步載入的，載好後通知一次 */
export function onVoicesReady(callback) {
  const s = synth();
  if (!s) return () => {};
  const handler = () => callback();
  s.addEventListener('voiceschanged', handler);
  // 有些瀏覽器一開始就備妥了，先問一次
  if (s.getVoices().length > 0) callback();
  return () => s.removeEventListener('voiceschanged', handler);
}

/** 唸出文字；回傳是否找到該語言的語音 */
export function speak(text, lang = 'cs', { rate = 0.85 } = {}) {
  const s = synth();
  if (!s || !text) return false;
  s.cancel();
  const tag = LANG_TAG[lang] || lang;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = tag;
  utterance.rate = rate;
  const prefix = tag.slice(0, 2).toLowerCase();
  const voice = s.getVoices().find((v) => v.lang?.toLowerCase().startsWith(prefix));
  if (voice) utterance.voice = voice;
  s.speak(utterance);
  return Boolean(voice);
}
