# 呱花秘密基地（dragon-study）

雙人共讀 web app：React 19 + Vite + Tailwind v4 + Firebase Firestore。
兩個使用者是「呱呱」(`left`) 與「花花」(`right`)，共用一個 Firestore 房間文件。

## 協作邊界

這四條是跟使用者談定的，優先於任何「我覺得這樣比較方便」的判斷。

### 部署

**只有使用者明確說「部署」「上線」時才 `npm run deploy`。**
其他時候一律只改本機：跑 lint、build、瀏覽器實測，然後回報結果，等指令。
「這個改動很小」「順便一起推」都不是自行部署的理由。

### 房間資料

**本機驗證一律跑在測試房間，永遠不要對 `shared-room` 做寫入測試。**

- `src/lib/firebase.js` 的房間 id 讀 `VITE_ROOM_ID`，本機的
  `.env.development.local` 設成 `dragon-dev`。
- 這個檔只在 dev 模式載入，`npm run build`（production）拿不到，
  所以正式版永遠是 `shared-room`。部署前可以 grep dist 確認。
- 若發現 `.env.development.local` 不存在或沒設 `VITE_ROOM_ID`，**先提醒使用者補上**，
  不要改用正式房間繼續測。
- 特別注意 `App.jsx` 的 `pagehide` handler：分頁關閉時會結束該角色的專注並寫入
  每日總計。在正式房間選到對方正在專注的角色，等於中斷對方的計時。

### 語料

**可以自由新增與修正語料，但沒把握的地方必須在回報中列出來。**

單字、文法解釋、例句翻譯都是給零基礎的人學的，錯了會被直接背起來。回報時要有一段
**「需要找母語者確認」**清單，列出不確定的名詞性別、格變化、慣用法、語氣強度。
寧可標記過多，也不要靜默放過——使用者沒有能力自行檢查捷克語。

### 音檔

**語料變更後自動增量補生成音檔**，跟程式碼改動一起 commit：

```bash
node tools/tts/export_terms.mjs
tools/tts/.venv/bin/python tools/tts/generate_audio.py --reference tools/tts/reference/af_heart.wav
```

約 2 秒/筆，只會補新的。改完別忘了 `manifest.json`（腳本會自動重建，
若只手動刪改音檔則要跑 `--manifest-only`）。

## 硬規則

- **絕對不要 commit `.env`**（Firebase 金鑰）。`.gitignore` 已涵蓋 `.env` 與 `.env.*`，
  動 `.gitignore` 前先確認這條還在。
- 部署後 GitHub Pages 的 CDN 有快取，要用 `?cb=亂數` 確認線上載入的是新的 bundle 檔名，
  不要看到 HTTP 200 就當作上線成功。

## Tailwind v4 陷阱

`src/index.css` 有一條 **unlayered** 的 `p, span, button… { white-space: nowrap }`，
在 Tailwind v4 會壓過所有 utility class。任何需要換行的文字必須用 inline style：

```jsx
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };
<p style={WRAP}>會換行的長文字</p>
```

## 龍龍語言教室

捷克文＋英文學習頁籤，為 2026 年 8 月底出發的捷克留學做準備。

- 語料檔：`src/constants/vocabCzech.js`、`vocabEnglish.js`（單字大全）、
  `grammarCzech.js`、`grammarEnglish.js`（各 100 課）、`languageData.js`（每日精選、
  情境會話、冷知識）、`curriculum.js`（把上面切成 100 天）。
- **單字大全的排列順序＝100 天課程的發字順序**，是刻意由淺入深排的。不要重新排序，
  也不要插在中間；要加字請加在該分類的尾端。
- `languageData.js` 的 import **刻意帶 `.js` 副檔名**，這樣 `tools/tts/export_terms.mjs`
  才能用 Node 直接載入。不要「順手清乾淨」。
- 房間欄位：`langStarred`、`left/rightLangDates`、`left/rightCourseDays`、
  `czDepartureDate`。加欄位時 `constants/roomDefaults.js` 也要補。

## 發音

- 一律走 `src/utils/voice.js` 的 `pronounce({ id, text, lang })`，不要直接呼叫
  `speech.js` 的 `speak()`。有預錄音檔就播 `public/audio/<id>.m4a`，沒有才用系統語音。
- 音檔用 XTTS-v2 以 Kokoro 的 `af_heart` 聲線生成，**捷克文與英文同一個聲音**，
  換瀏覽器、換裝置都不會變聲。環境設定與踩雷紀錄見 `tools/tts/README.md`。

## 驗證這個 app 的注意事項

- 瀏覽器 pane 的截圖經常是舊畫面，**驗證要以 `get_page_text` 或 DOM 查詢為準**，
  不要只看截圖就下結論。
- React 狀態更新需要一個 tick：連續點擊要分成多次工具呼叫，或寫在單一 async IIFE
  裡並在中間 `await` 一小段時間。
- dev server 的網址是 `http://localhost:5173/dragon-study/`（有 base path）。

## 已知的 lint 雜訊

`useNudgeEffect.js`、`useRoomSync.js`、`lib/firebase.js` 有 5 個既有錯誤
（Firebase 注入的全域變數、effect 內 setState）。**那些不是新改壞的**，
不要順手「修好」它們，除非使用者明確要求。`npx eslint src` 的基準線就是 5 個錯誤。
