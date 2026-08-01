/**
 * 瀏覽器內建語音（Web Speech API）：免安裝、離線也能唸。
 *
 * 重點：不能「抓到第一個符合語言的就用」——macOS 的英文清單第一個是 Albert
 * 這種 1990 年代的搞笑語音。這裡用評分挑最自然的一個，並讓使用者自己覆寫。
 * 偏好存在 localStorage（每台裝置能用的語音都不一樣，不適合跨裝置同步）。
 */

const LANG_TAG = { cs: 'cs-CZ', en: 'en-US' };
const PREF_KEY = 'dragon-study-voice-pref';

/** macOS 的特效／老骨董語音，唸單字完全不能聽（清單第一個 Albert 就是這種） */
const NOVELTY = /^(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|fred|good news|hysterical|jester|junior|kathy|organ|pipe organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox)/i;

/** macOS 新一代的角色語音：音質不差但語氣戲劇化，預設不選，但仍可挑 */
const CHARACTER = /^(eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)/i;

/** 明確標示高品質的語音 */
const HIGH_QUALITY = /(premium|enhanced|neural|natural|siri|超進階|進階|增強)/i;

/** 各語言公認堪用的預設語音 */
const KNOWN_GOOD = {
  cs: /^(zuzana|iveta|google)/i,
  en: /^(samantha|daniel|karen|moira|tessa|serena|google|microsoft)/i,
};

function synth() {
  return typeof window !== 'undefined' ? window.speechSynthesis : null;
}

function readPrefs() {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writePrefs(prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* 無痕模式：這次 session 仍可用記憶體中的值 */
  }
}

/** 分數越高越自然 */
function scoreVoice(voice, lang) {
  const tag = LANG_TAG[lang] || lang;
  let score = 0;
  if (HIGH_QUALITY.test(voice.name)) score += 100;
  if (KNOWN_GOOD[lang]?.test(voice.name)) score += 40;
  if (CHARACTER.test(voice.name)) score -= 20;
  if (NOVELTY.test(voice.name)) score -= 1000;
  if (voice.lang.replace('_', '-') === tag) score += 10;
  if (!voice.localService) score += 25; // Chrome 的 Google 網路語音通常較自然
  if (voice.default) score += 5;
  return score;
}

/** 該語言可用的語音，好的排前面 */
export function listVoices(lang) {
  const s = synth();
  if (!s) return [];
  const prefix = (LANG_TAG[lang] || lang).slice(0, 2).toLowerCase();
  return s
    .getVoices()
    .filter((v) => v.lang?.toLowerCase().replace('_', '-').startsWith(prefix))
    .map((v) => ({ voice: v, score: scoreVoice(v, lang), novelty: NOVELTY.test(v.name) }))
    .sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name));
}

/** 使用者選的語音；沒選就用評分最高的 */
export function resolveVoice(lang) {
  const ranked = listVoices(lang);
  if (ranked.length === 0) return null;
  const wanted = readPrefs()[lang];
  const chosen = wanted && ranked.find((r) => r.voice.voiceURI === wanted);
  return (chosen || ranked[0]).voice;
}

export function getVoicePref(lang) {
  return readPrefs()[lang] || '';
}

export function setVoicePref(lang, voiceURI) {
  const prefs = readPrefs();
  if (voiceURI) prefs[lang] = voiceURI;
  else delete prefs[lang];
  writePrefs(prefs);
}

export function getRate() {
  const rate = Number(readPrefs().rate);
  return Number.isFinite(rate) && rate >= 0.5 && rate <= 1.2 ? rate : 0.85;
}

export function setRate(rate) {
  const prefs = readPrefs();
  prefs.rate = rate;
  writePrefs(prefs);
}

/** 該語言是否有可用語音（沒有時瀏覽器會用預設語音硬唸，聽起來會很怪） */
export function hasVoiceFor(lang) {
  return listVoices(lang).length > 0;
}

/** 語音清單是非同步載入的，載好後通知一次 */
export function onVoicesReady(callback) {
  const s = synth();
  if (!s) return () => {};
  const handler = () => callback();
  s.addEventListener('voiceschanged', handler);
  if (s.getVoices().length > 0) callback();
  return () => s.removeEventListener('voiceschanged', handler);
}

/** 唸出文字；回傳是否真的找到該語言的語音 */
export function speak(text, lang = 'cs', { rate, voice } = {}) {
  const s = synth();
  if (!s || !text) return false;
  s.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG_TAG[lang] || lang;
  utterance.rate = rate ?? getRate();
  const chosen = voice || resolveVoice(lang);
  if (chosen) {
    utterance.voice = chosen;
    utterance.lang = chosen.lang;
  }
  s.speak(utterance);
  return Boolean(chosen);
}
