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

## 計時行為（不可破壞的三條）

這是這個 app 的核心語意，任何改動都不能違反。已於測試房間實測驗證通過。

1. **每天自動刷新**：計時器顯示的是「今天」的累計，跨過午夜自動歸零，
   不需要任何人按按鈕、也不需要重新整理。
   - 實作在 `hooks/useStudyTimer.js` 的 `computeRoleElapsedParts()`：只有
     `roomData.lastActiveDate === 今天` 時才把 `xxxDailyTotal` 算進去，否則當 0。
   - 這是**讀取時判斷**，不是靠寫入重設，所以隔天打開就是 0，不會殘留昨天的數字。
   - 若專注中跨過午夜，當前 session 從今天 00:00 起算（同一個函式的 else 分支）。
   - 別為了「效能」把這個判斷改成只在啟動時算一次，那會讓開著的頁面跨日不歸零。

2. **關掉頁面自動下線**：離開頁面時該角色的 `xxxStudying` 必須變成 `false`，
   對方看到的狀態要立刻變成離線。
   - 實作在 `App.jsx` 的 `persistEndStudyOnLeave`（`pagehide` + `beforeunload`），
     並用 `fetch(keepalive)` 的 Firestore REST PATCH 補強，因為關頁時
     `setDoc` 常來不及送出。
   - 當機、強制結束、手機系統回收分頁時兩個事件都不會觸發，因此另有**心跳**補網：
     專注中每分鐘寫一次 `xxxLastHeartbeat`，超過 `HEARTBEAT_STALE_MS`（4 分鐘）
     沒跳就一律視為離線。
   - **判斷在不在線一律用 `isRoleStudying(roomData, roleKey)`，不要直接讀
     `roomData.xxxStudying`**——當機時那個欄位還是 `true`。App.jsx 裡的登入畫面、
     龍龍動畫、按鈕狀態全部走這個函式。
   - 4 分鐘的門檻是為了吸收兩台裝置的時鐘誤差（心跳寫的是寫入端的 `Date.now()`，
     由對方的 `Date.now()` 比對）。想調短要先想清楚時鐘不同步會誤判成離線。
   - 沒有心跳欄位的資料一律當作在線，那是心跳上線前就開始的 session；
     判成過期會把人家累積的時間結算成 0。這個 fallback 不要拿掉。

3. **累計時間保留到下次開啟**：下線不等於歸零。離開時把當下的精確秒數寫進
   `xxxDailyTotal`，同一天再打開要接續顯示，不能從 0 重來。
   - 四處寫入必須維持一致：`buildEndStudyFirestoreUpdates()`、「暫時休息」按鈕、
     `persistEndStudyOnLeave`、心跳逾時的自我修復 effect。改一處就要同步改其他三處。
   - 心跳過期時結算的是「開始 → 最後一次心跳」，**不含當機後的空白**。
     實作在 `computeRoleElapsedParts()` 的 `effectiveNow`：過期就凍結在心跳時間點。
     這樣當機三小時後再打開，不會平白多出三小時的專注紀錄。

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

## 龍龍旅行社

年底「捷克 → 奧地利 → 瑞典」旅行規劃頁籤：`TripPlanner.jsx`（抬頭、子頁籤、所有寫入，整頁 `memo`）、
`TripItinerary.jsx`（每日行程、路線建議）、`TripMap.jsx`＋`TripLeafletMap.jsx`（地圖排程、拖拉）、
`TripGuide.jsx`（交通／景點／美食／住宿清單）。

- 參考資料在 `constants/tripGuide.js`，2026-09 查證。票價、時刻、營業日會變的項目標 `verify: true`，
  畫面會顯示「出發前再確認」。**比照語料規則：新增資料沒把握就標 verify，並在回報中列出。**
- 有日期窗口的活動（聖誕市集、夜車直達、冰旅館開幕）寫在 `TRIP_EVENTS`，行程表用出發日自動比對。
  判斷「那天在哪個城市」以地點欄為準（`dayLocationText`）；行程欄常寫到轉機地，別改回全文比對。
- 房間欄位：`tripTitle`、`tripStartDate`、`tripDays`（null＝顯示預設的 Notion 行程；每天的 `stops`
  是排進去的項目 id，**陣列順序就是當天的走法**）、`tripPicks`（`{ id, star, booked, memo }`）、
  `tripCustom`（自己加的地點，含查到的 `lat`/`lng`）。
  **一律整個陣列寫入**：`updateRoom` 的 merge 對 map 是深層合併，刪掉的 key 不會消失。
- 房間規則是任何匿名登入都能讀寫，備註欄不要引導使用者記訂位代號或個資。
- 自己加的連結只接受 http(s)（`isSafeUrl`），不要放寬。

### 亮點與網友心得

- `constants/tripInsights.js`：每個景點／美食／住宿的 `tagline`、`highlights`、`bestTime`、`praise`、`gripes`。
- `praise`／`gripes` 是**整理**公開評論的常見說法、用自己的話寫；畫面一律標「非逐字引用」並附看原始評論的連結
  （Google 地圖、Tripadvisor、中文遊記搜尋）。**不能編造個別評論、評分、評論數**；Google／Tripadvisor／Klook
  的評論也不能爬下來放進來（服務條款禁止，Klook 還有機器人驗證）。

### 地圖排程（一頁式）

- `TripMap` 用 `useFillViewport` 把工作區高度設成視窗剩下的高度，整頁不捲動、各欄自己捲；
  地圖分頁時 `TripPlanner` 的抬頭縮成一條，`App.jsx` 在旅行社頁籤把最外層 `pb-32` 換成 `pb-2`
  （那是給共讀小屋的浮動按鈕留的）。改版面後要確認 `document.documentElement.scrollHeight === innerHeight`。
- 中欄 `TripPlaceDetail` 用 Tailwind 容器查詢（`@container`／`@lg:`）：夠寬時亮點和網友心得並排。
- 「全程」模式不照日期：左欄是所有地點（搜尋、城市、分類、想去／已排／未排篩選），
  拖到上方 Day 晶片、或在介紹裡用「排進哪天」排進去；沒選地點時中欄是城市卡＋影片＋天數順序。
- 地圖右上「放大地圖」開全螢幕；手機一次只顯示一欄，用上方的切換鈕。
- 單日模式的「這天的城市」用 `areaOfDay`：地點欄有城市就用；只寫國家（Day 3「奧地利」）就列那國的城市；
  都沒寫就用 `ROUTE_SUGGESTIONS` 那天會去的城市，左欄同時列出可一鍵套用的路線。預設行程 Day 4 以後是空的，別讓畫面整排空白。

### 照片與座標小資料庫

- 座標：`src/constants/tripPlaces.json` 由 `node tools/trip/build_places.mjs` 產生，不要手改。
  **新增或修改 tripGuide.js 的項目後要重跑**（只補改過的；`--force` 全部重抓），跟程式碼一起 commit。
- 每個項目用 `wiki`（維基條目，取座標和備用照片）或 `geo`（OSM 查詢字串，座標以它為準）；`pin: false` 不上地圖。
- OSM 查詢會模糊比對、可能查到別村同名的店：腳本有離城市中心的距離檢查，但新增後仍要看輸出核對。
- **照片是使用者自己挑的**（使用者最在意照片好不好看；**不要一張張看總覽圖幫挑**，很花 token）：
  1. **選圖頁**：`node tools/trip/photo_picker.mjs`（或 `~/Desktop/LLM/.claude/launch.json` 的 `photo-picker`），
     開 http://127.0.0.1:8766 。左邊選地點、點候選照片就選、拖拉排順序、標「示意」，每次改動自動寫進
     `tools/trip/photo_picks.json`（第一張是主圖；啟動時備份到 `~/.cache/dragon-study/`，留 10 份）。
     候選先列 2026-09 兩輪找過的（`~/.cache/dragon-study/trip-photo-candidates.json`，110 個地點、1,300 張），
     再用 `photo_queries.json`＋`photo_queries_extra.json` 的關鍵字搜 Commons（結果快取在同資料夾的
     `photo-candidates.json`）；頁面上也能自己打關鍵字或貼 Commons 檔名。🔍 放大會顯示說明和分類，
     用來確認真的是那個地方（同名的別處、複製品、封館照都出現過）。只收橫式、寬 1200 以上、自由授權的 JPEG。
     伺服器用 Node 寫是刻意的：從桌面 app 預覽啟動時，uv 的 Python 會卡在 macOS「桌面」資料夾權限詢問，Node 已經有權限。
  2. 舊流程（使用者要 Claude 幫挑時才用）：`photo_candidates.py` 依同一份關鍵字找候選，拼成有編號的縮圖總覽。
  3. 選圖頁的「產生網站照片」按鈕＝`tools/tts/.venv/bin/python tools/trip/build_photos.py`，下載成 `public/trip/photos/*.webp`（大圖寬 1400、品質 75）
     和 `public/trip/photos/t/*.webp`（小圖寬 640），作者／授權寫進 `src/constants/tripPhotos.json`。
     373 張約 78 MB（1600／品質 80 會到 110 MB，別調回去）；原圖快取在 `~/.cache/dragon-study/trip-photos`，
     調尺寸或品質用 `--force` 重跑不必重新下載。
- `placeOf` 先用精選照片：`img` 給介紹和放大、`thumb` 給清單和卡片。沒挑過照片的項目才退回
  `tripPlaces.json` 的 `public/trip/*.jpg`（備用，build_places 產的）。
- 照片不是那個地方本身（別家的菜色、別處的極光），在 photo_picks.json 寫成 `{ "file": …, "note": "示意" }`，
  畫面會在那一張標「示意圖」。是逐張標，不是整個地點一起標。
- 只收自由授權（CC BY／BY-SA／CC0／公有領域）；腳本遇到 NC／ND 會停下來。卡片和介紹都要顯示作者與授權，不要拿掉。

### Wikivoyage 清單（程式抓資料，Claude 只負責整理）

- `node tools/trip/fetch_wikivoyage.mjs [--only=prague]`：從英文 Wikivoyage 抓每個城市的景點／餐廳／住宿清單
  （名稱、座標、簡介、營業時間、價格）。城市用 `TRIP_CITIES` 的 `wikivoyage` 欄位（大城市的分區頁自動找；
  後面可以加一日遊小鎮，例如布拉格加了 Kutná Hora）。約 25 秒跑完 8 個城市、2,200 筆。
- 產出：
  - `tools/trip/wikivoyage/<城市>.md`：一行一筆的精簡版（不進版控，隨時重抓）。**要新增地點時先讀這份挑，
    不要一個一個上網搜**；已收錄的標「✓ 項目 id」。挑中的翻成中文寫進 `tripGuide.js`，營業時間、價格查官網並標 `verify`。
  - `src/constants/tripWikivoyage.json`：已收錄項目對到的 Wikivoyage 條目，介紹頁顯示「Wikivoyage 怎麼說」
    （英文原文＋Google 翻譯連結）。**改了 tripGuide.js 的項目或 wiki 欄位後重跑。**
- 對應規則：Wikidata 相同 > 項目 wiki 就是某個分區／城市頁 > 名稱相同或包含、且座標相近。交通和 `imageNote` 示意的項目不對；
  住宿只對 Wikidata 和分區頁（名字比對會把「住中央車站附近」對到某家旅館）。對錯的加進腳本的 `SKIP_MATCH`，
  對不到或不貼切的用 `PIN_MATCH` 人工指定。**跑完要看輸出裡「名稱比對，請確認」那幾行。**
- 營業時間、價格只有近 2 年內編輯過的清單才進 app（`FRESH_YEARS`）：Wikivoyage 上多半是好幾年前的
  （霍夫堡寫 €11.50），會跟 tripGuide.js 查證過的 `cost` 打架。
- Wikivoyage 是 CC BY-SA 4.0：畫面上的來源、授權、原頁連結不要拿掉。Wikimedia 會擋沒有聯絡方式的 User-Agent（回空白）。
- 介紹頁的「找影片・攻略」列：YouTube 中文／外文搜尋、Wikivoyage 連結（對到清單就連那一頁那一段，否則連城市頁）。
  連結不花 token、內容永遠是最新的。

### 影片與推薦來源

- `constants/tripVideos.js`：`byCity`（全程總覽）、`byItem`（地點介紹，沒有就用城市的）。
  **每支都要用 YouTube oEmbed 確認存在**：`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<id>&format=json`；
  回 401／403 是作者不給嵌入，頁面裡會播不出來，不要放。`title` 是自己寫的中文短標題，原標題放 `original`。
- 播放用 `youtube-nocookie.com` 嵌入（`TripMedia.jsx` 的 `VideoModal`）；`SafeImg` 讓外部圖載入失敗時換成替代內容。
- `tripInsights.js` 的 `TRIP_EXPERT_PICKS`：Rick Steves 星等、Lonely Planet 推薦等，只放查得到出處的，標明來源。

### 地圖與外部服務

- 底圖用 OpenStreetMap 官方圖磚（`tile.openstreetmap.org`）。**CARTO 底圖現在要 API 金鑰**，會出現浮水印，別換回去。
- 步行路線用 FOSSGIS 的 OSRM（`routing.openstreetmap.de/routed-foot`），結果快取在 localStorage；
  自訂地點定位用 Nominatim（只在按「加入」時查一次）。三者都是免費但禁止大量使用的公益服務。
- `TripLeafletMap` 外層的 `z-0` 是為了讓 Leaflet 的 z-index 不蓋過置頂 header。
- 拖拉用 @dnd-kit（原生 HTML5 拖拉在手機上不能用）。瀏覽器 pane 隱藏時會發 `visibilitychange`，
  dnd-kit 會因此取消拖曳；**自動化測試拖拉要先攔掉這個事件**，且要用 MessageChannel 等待（背景分頁的 setTimeout 會被節流）。

## 發音

- 一律走 `src/utils/voice.js` 的 `pronounce({ id, text, lang })`，不要直接呼叫
  `speech.js` 的 `speak()`。有預錄音檔就播 `public/audio/<id>.m4a`，沒有才用系統語音。
- 音檔用 XTTS-v2 以 Kokoro 的 `af_heart` 聲線生成，**捷克文與英文同一個聲音**，
  換瀏覽器、換裝置都不會變聲。環境設定與踩雷紀錄見 `tools/tts/README.md`。

## 驗證這個 app 的注意事項

- 瀏覽器 pane 的截圖經常是舊畫面，**驗證要以 `get_page_text` 或 DOM 查詢為準**，
  不要只看截圖就下結論。
  截圖卡在舊畫面時，用 `resize_window` 換一次尺寸可以強制重繪（Leaflet 取景有動畫，要等它跑完再截）。
- React 狀態更新需要一個 tick：連續點擊要分成多次工具呼叫，或寫在單一 async IIFE
  裡並在中間 `await` 一小段時間。
- dev server 的網址是 `http://localhost:5173/dragon-study/`（有 base path）。
- 桌面 app 視窗縮小時 pane 截不了圖。可以在 scratchpad 裝 `playwright-core`，用本機 Chrome
  （`chromium.launch({ channel: 'chrome' })`）無頭截圖；它的頁面是可見的，拖拉也能用真的滑鼠事件測。

## 已知的 lint 雜訊

`useNudgeEffect.js`、`useRoomSync.js`、`lib/firebase.js` 有 5 個既有錯誤
（Firebase 注入的全域變數、effect 內 setState）。**那些不是新改壞的**，
不要順手「修好」它們，除非使用者明確要求。`npx eslint src` 的基準線就是 5 個錯誤。
