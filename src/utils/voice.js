/**
 * 發音的統一入口：優先播放預先生成的真人音檔（public/audio/<id>.m4a），
 * 找不到音檔或播放失敗時，才退回系統語音（Web Speech API）。
 *
 * 音檔清單來自 public/audio/manifest.json，載入一次後常駐記憶體，
 * 這樣就不會每按一次發音都先送出一個 404。
 */

import { getRate, speak } from './speech';

const BASE = import.meta.env.BASE_URL || '/';
const CLIP_URL = (id) => `${BASE}audio/${id}.m4a`;

let clipIds = null;
let loadPromise = null;
let currentAudio = null;
let forceSystemVoice = false;

/** 讀取音檔清單；沒有 manifest（還沒生成音檔）就當成空集合 */
export function loadClipManifest() {
  if (clipIds) return Promise.resolve(clipIds);
  if (!loadPromise) {
    loadPromise = fetch(`${BASE}audio/manifest.json`, { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        clipIds = new Set(Array.isArray(data?.ids) ? data.ids : []);
        return clipIds;
      })
      .catch(() => {
        clipIds = new Set();
        return clipIds;
      });
  }
  return loadPromise;
}

export function clipCount() {
  return clipIds ? clipIds.size : 0;
}

export function hasClip(id) {
  return Boolean(id && clipIds?.has(id));
}

export function isForcingSystemVoice() {
  return forceSystemVoice;
}

export function setForceSystemVoice(value) {
  forceSystemVoice = Boolean(value);
}

function stopCurrent() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

/**
 * 唸出一段文字。
 * @param {{ id?: string, text: string, lang: 'cs'|'en' }} item
 * @returns {'clip'|'tts'|'none'} 實際使用的方式
 */
export function pronounce({ id, text, lang }) {
  if (!text) return 'none';

  if (!forceSystemVoice && hasClip(id)) {
    stopCurrent();
    window.speechSynthesis?.cancel();
    const audio = new Audio(CLIP_URL(id));
    audio.playbackRate = getRate();
    currentAudio = audio;
    audio.play().catch(() => {
      // 檔案壞了或瀏覽器擋自動播放：改用系統語音
      if (currentAudio === audio) currentAudio = null;
      speak(text, lang);
    });
    return 'clip';
  }

  stopCurrent();
  return speak(text, lang) ? 'tts' : 'none';
}
