import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, BookOpen, Coffee, Calendar, Star, User, Trophy, CheckCircle2, Circle, Plus, Trash2
} from 'lucide-react';

// --- Firebase 模組載入 ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';

// --- Firebase 環境初始化 ---
let app, auth, db, getRoomRef;

try {
  if (typeof __firebase_config !== 'undefined') {
    const firebaseConfig = JSON.parse(__firebase_config);
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    getRoomRef = () => doc(db, 'artifacts', appId, 'public', 'data', 'rooms', 'shared-room');
  } else {
    // 備援：本地開發環境變數 (Vite)
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    getRoomRef = () => doc(db, 'rooms', 'shared-room');
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

// --- 終極調色盤 ---
const PALETTES = {
  dragon: { 
    'K': '#331515', 'k': '#8d6e63', 'W': '#ffffff', 'G': '#f5f5f5', 'R': '#8b0000', 'O': '#ff9a76', 'B': '#000000',
    'Z': '#81d4fa', 'z': '#ffffff'  
  },
  env: {
    'D': '#3e2723', 'L': '#5d4037', 'T': '#795548', 'S': '#1a0f0d', 
    'r': '#a52a2a', 'b': '#2c3e50', 'y': '#f1c40f', 'g': '#27ae60', 'w': '#ecf0f1', 'p': '#8e44ad', 'o': '#e67e22',
    'W': '#ffffff', 'coffee': '#3e2723', 'paper': '#fdf5e6', '-': '#d1d5db', 'R': '#c0392b',
    'C': '#7dd3fc', 'H': '#bae6fd', 'Y': '#fde047', 'U': '#0284c7', 'V': '#38bdf8' 
  }
};

const SPRITES = {
  dragonSit: [
    "......R...R......", "......R...R......", "....kkKKKKKkk....", "...kKWWWWWWWKk...", "..kKWWWWWWWWWKk..", ".kKWWWWWWWWWWWKk.", ".KWWKWWWWWWWKWWK.", ".KWWKWWKKKWWKWWK.", "KKWOOWWWWWOWOWKK.", "KKWOOWWWWWOWOWKK.", ".KWWWWWWWWWWWK...", ".KGGGGGGGGGGGK...", "..KKKKKKKKKKK....", ".....K...K......."
  ].join('\n'),
  dragonRun1: [
    "......R...R......", "....kkKKKKKkk....", "..kKWWWWWWWWWKk..", ".kKWWWWWWWWWWWKk.", ".KWWKWWWWWWWKWWK.", ".KWWKWWKKKWWKWWK.", "KKWOOWWWWWOWOWKK.", ".KWWWWWWWWWWWK...", ".KGGGGGGGGGGGK...", "..KKKKKKKKKKK....", "...K.......K....."
  ].join('\n'),
  dragonRun2: [
    "......R...R......", "....kkKKKKKkk....", "..kKWWWWWWWWWKk..", ".kKWWWWWWWWWWWKk.", ".KWWKWWWWWWWKWWK.", ".KWWKWWKKKWWKWWK.", ".KWOOWWWWWOWOWK..", ".KWWWWWWWWWWWK...", ".KGGGGGGGGGGGK...", "..KKKKKKKKKKK....", ".....K...K......."
  ].join('\n'),
  dragonSleep: [
    "........R.....R.......", "......RRR...RRR.......", "........R.....R.......", ".....KKKKKKKKKKKKK....", "...KKWWWWWWWWWWWWWKK..", "..KWWWWWWWWWWWWWWWWWK.", "..KWWWWKKKWWWWWKKKWWK.", ".KWWWWWWWWWWWWWWWWWZZK", ".KWWWOOOOWWKWWOOOOZWZK", "KKWWWOOOOWWWWWWOOOOZZK", "KWWWWWWWWWWWWWWWWWWKK.", ".KKKKKKKKKKKKKKKKKKK.." 
  ].join('\n'),
  redBook: [
    ".......S.......", ".WWWWWWWWWWWWW.", "WwwwwwwSwwwwwwW", "W--w--wS--w--wW", "WwwwwwwSwwwwwwW", "W--w--wS--w--wW", "RRRRRRRRRRRRRRR", ".SSSSSSSSSSSSS."
  ].join('\n'),
  coffeeCupDetailed: [
    "...........", "..WWWWW....", ".WcccccW...", "WcccccccWW.", "WcccccccW.W", ".WWWWWWW.W.", "..WWWWW.W..", "..........."
  ].join('\n'),
  zzz: [
    ".........zzzzz", "............z.", "...........z..", "..........z...", ".........zzzzz", "..............", ".....zzzz.....", ".......z......", "......z.......", ".....zzzz.....", "..............", "..zzz.........", "....z.........", "...z..........", "..zzz........."
  ].join('\n')
};

// --- 100 句勵志名言資料庫 ---
const QUOTES = [
  "生活就像騎單車，為了保持平衡，你必須不斷前進。 —— 阿爾伯特·愛因斯坦",
  "天才就是百分之一的靈感加上百分之九十九的汗水。 —— 湯瑪斯·愛迪生",
  "不要等待機會，而要創造機會。 —— 喬治·蕭伯納",
  "成功是由不斷的失敗所構成，卻不失熱情。 —— 溫斯頓·邱吉爾",
  "我們最大的弱點在於放棄。成功的必然之路就是不斷的重來一次。 —— 湯瑪斯·愛迪生",
  "你不能把點滴連結起來看向未來，你只能在回顧時將它們連結起來。 —— 史蒂夫·賈伯斯",
  "只有把抱怨環境的心情，化為上進的力量，才是成功的保證。 —— 羅曼·羅蘭",
  "那些瘋狂到以為自己能夠改變世界的人，才能真正改變世界。 —— 羅伯特·西爾弗伯格",
  "成功不是最終的，失敗不是致命的：最重要的是繼續前進的勇氣。 —— 溫斯頓·邱吉爾",
  "不論你在什麼時候開始，重要的是開始之後就不要停止。 —— 柏拉圖",
  "想像力比知識更重要。 —— 阿爾伯特·愛因斯坦",
  "走得慢沒關係，只要你不停下來。 —— 安迪·沃荷",
  "我並沒有失敗。我只是找到了一萬種行不通的方法。 —— 湯瑪斯·愛迪生",
  "如果你相信自己做得到，你就已經成功了一半。 —— 西奧多·羅斯福",
  "如果這件事很重要，那你就會找到方法。 —— 伊隆·馬斯克",
  "教育不是注滿一桶水，而是點燃一把火。 —— 威廉·巴特勒·葉慈",
  "所謂的幸運，不過是機會遇見了努力。 —— 塞內卡",
  "你不需要很厲害才能開始，但你需要開始才會很厲害。 —— 齊格·金克拉",
  "人生沒有白走的路，每一步都算數。 —— 李宗盛",
  "種一棵樹最好的時間是十年前，其次是現在。 —— 丹比薩·莫約",
  "行動是治癒恐懼的良藥。 —— 威廉·詹姆斯",
  "你的負擔將變成禮物，你受的苦將照亮你的路。 —— 羅賓德拉納特·泰戈爾",
  "與其抱怨黑暗，不如提燈前行。 —— 海倫·凱勒",
  "即使現在很痛苦，也要相信未來會很好。 —— 亞伯拉罕·林肯",
  "努力不一定會成功，但不努力一定很舒服...才怪！ —— 蔡康永",
  "每一次的失敗，都是成功的墊腳石。 —— 亨利·福特",
  "最可怕的敵人，就是沒有堅定的信念。 —— 羅曼·羅蘭",
  "真正的發現之旅不在於尋找新大陸，而在於擁有新的眼光。 —— 馬塞爾·普魯斯特",
  "夢想還是要有的，萬一實現了呢？ —— 馬雲",
  "不管前方的路有多苦，只要方向正確，都比站在原地更接近幸福。 —— 宮崎駿",
  "成功，就是跌倒九次，爬起來十次。 —— 瓊·邦·喬飛",
  "不要畏懼失敗，因為它是成功的必經之路。 —— 麥可·喬丹",
  "我一直覺得，只有拼盡全力，才能看起來毫不費力。 —— 李安",
  "把每天當作最後一天來活，你會更加珍惜。 —— 史蒂夫·賈伯斯",
  "凡是殺不死我的，都會使我更強大。 —— 弗里德里希·尼采",
  "做你害怕做的事，恐懼自然會消失。 —— 羅夫·華多·愛默生",
  "我不在乎你跌倒了多少次，我在乎的是你是否站了起來。 —— 亞伯拉罕·林肯",
  "偉大的事業不是靠力氣、速度和身體的敏捷完成的，而是靠性格、意志和知識的力量完成的。 —— 查理斯·達爾文",
  "一切偉大的行動和思想，都有一個微不足道的開始。 —— 阿爾貝·卡繆",
  "不要讓別人的意見淹沒了你內心的聲音。 —— 史蒂夫·賈伯斯",
  "你若想做，會找一個方法；你若不想做，會找一個藉口。 —— 吉姆·羅恩",
  "讀書不是為了雄辯和駁斥，也不是為了輕信和盲從，而是為了思考和權衡。 —— 弗蘭西斯·培根",
  "只有在字典裡，成功才排在工作之前。 —— 維達·沙宣",
  "不要試圖去做一個成功的人，而要努力成為一個有價值的人。 —— 阿爾伯特·愛因斯坦",
  "人生的價值，並不是用時間，而是用深度去衡量的。 —— 列夫·托爾斯泰",
  "沒有激流就稱不上勇進，沒有山峰則談不上攀登。 —— 拜倫",
  "讀書之於心靈，猶如運動之於身體。 —— 理查·斯蒂爾",
  "世上沒有絕望的處境，只有對處境絕望的人。 —— 哈爾夫丹·馬勒",
  "我們知之甚少，而我們能做的又那麼多。 —— 威廉·詹姆斯",
  "如果你不肯付出一時的努力去博取成功，那麼你可能就要用一生的耐心去忍受失敗。 —— 喬治·巴頓",
  "有志者事竟成。 —— 查理斯·狄更斯",
  "當你停下來休息的時候，別忘了別人還在奔跑。 —— 安德魯·卡內基",
  "你必須成為你在這世界上想看到的改變。 —— 聖雄甘地",
  "成功人士與其他人的區別，不是在於力量或知識的缺乏，而是在於意志力的缺乏。 —— 文斯·倫巴第",
  "你改變不了過去，但你可以改變現在。 —— 威廉·大衛·米勒",
  "每天做一件讓自己害怕的事。 —— 埃莉諾·羅斯福",
  "相信你能，你就已經完成了一半。 —— 西奧多·羅斯福",
  "未來屬於那些相信夢想之美的人。 —— 埃莉諾·羅斯福",
  "不要把時間浪費在敲打一堵牆，期望它會變成一扇門。 —— 可可·香奈兒",
  "不要因為事情困難就放棄，是因為放棄才讓事情變得困難。 —— 塞內卡",
  "生活不是要等待風暴過去，而是要學會在雨中跳舞。 —— 薇薇安·格林",
  "我們不能改變風向，但我們可以調整風帆。 —— 托馬斯·蒙蓀",
  "你唯一應該超越的人，是昨天的自己。 —— 喬丹·彼得森",
  "設定目標是將無形化為有形的第一步。 —— 托尼·羅賓斯",
  "唯一能限制我們明天成就的，是我們今天的懷疑。 —— 富蘭克林·羅斯福",
  "最困難的事情是做出行動的決定，剩下的只是純粹的毅力。 —— 阿梅莉亞·埃爾哈特",
  "卓越不是單一的舉動，而是一種習慣。 —— 亞里斯多德",
  "不要看手錶，做它正在做的事：繼續前進。 —— 山姆·萊文森",
  "如果你一直在等待完美的時機，你可能永遠不會開始。 —— 喬治·盧卡斯",
  "成功是從小努力中累積而成的，日復一日。 —— 羅伯特·科利爾",
  "人生最重要的不是你所處的位置，而是你前進的方向。 —— 奧利弗·溫德爾·霍姆斯",
  "每當你發現自己和大多數人站在同一邊，你就該停下來反思一下。 —— 馬克·吐溫",
  "即使跌倒了，你依然在向前邁進。 —— 查爾斯·凱特林",
  "我從不把時間浪費在後悔上，這是不值得的。 —— 比爾·蓋茲",
  "勇敢是即使害怕，也要堅持向前。 —— 約翰·韋恩",
  "你的時間有限，所以不要浪費時間去過別人的生活。 —— 史蒂夫·賈伯斯",
  "一切的秘密在於行動。 —— 查理·卓別林",
  "只有熱愛你所做的，才能成就偉大。 —— 史蒂夫·賈伯斯",
  "無論做什麼事，都要有一顆渴望成功的心。 —— 亨利·福特",
  "如果我們做到了所有我們能做的事，我們真的會讓自己大吃一驚。 —— 托馬斯·愛迪生",
  "悲觀者在每個機會中看到困難，樂觀者在每個困難中看到機會。 —— 溫斯頓·邱吉爾",
  "一個人的價值，應該看他貢獻什麼，而不應看他取得什麼。 —— 阿爾伯特·愛因斯坦",
  "智慧源於經驗，而經驗往往源於缺乏智慧。 —— 泰瑞·普萊契",
  "生命中最痛苦的事情，莫過於你本可以做到的卻沒有去做。 —— 傑西·傑克遜",
  "永遠不要放棄你真正想要的東西。等待很困難，但後悔更困難。 —— 史蒂夫·賈伯斯",
  "行動不一定帶來幸福，但沒有行動就一定沒有幸福。 —— 本傑明·迪斯雷利",
  "最浪費的日子是那些沒有笑聲的日子。 —— E.E.卡明斯",
  "成功並不複雜。就是知道你在做什麼，熱愛你在做什麼，並相信你在做什麼。 —— 威爾·羅傑斯",
  "當你的才華還撐不起你的野心時，那你就應該靜下心來學習。 —— 莫言",
  "最長的路也有盡頭，最黑暗的夜晚也會迎接清晨。 —— 哈里特·比徹·斯托",
  "你無法跨越海洋，除非你有勇氣失去對海岸的視線。 —— 克里斯托弗·哥倫布",
  "我寧願因嘗試做偉大的事情而失敗，也不願因什麼都不做而成功。 —— 羅伯特·H·舒勒",
  "我們無法在不改變的情況下進步，那些無法改變自己心智的人，什麼也改變不了。 —— 喬治·蕭伯納",
  "人生是由百分之十的遭遇，加上百分之九十你對它的反應所構成。 —— 查爾斯·斯溫多爾",
  "成功是得到你想要的，幸福是享受你得到的。 —— 戴爾·卡內基",
  "你永遠無法改變你的生活，除非你改變你每天做的事。 —— 約翰·麥克斯韋",
  "不要讓你在起點的恐懼阻止你到達終點。 —— 貝比·魯斯",
  "當我們不再能夠改變一個情況，我們就面臨改變自己的挑戰。 —— 維克多·弗蘭克爾",
  "一個不曾犯錯的人，就是一個從未嘗試新事物的人。 —— 阿爾伯特·愛因斯坦",
  "生命中最美麗的風景，是我們不懈追求夢想的過程。 —— 歌德"
];

const PixelArt = ({ art, palette, pixelSize = 4, className = "" }) => {
  const rows = useMemo(() => (Array.isArray(art) ? art : art.trim().split('\n')).map(r => r.trim()), [art]);
  return (
    <div className={`relative ${className}`} style={{ width: rows[0].length * pixelSize, height: rows.length * pixelSize }}>
      {rows.flatMap((row, y) => row.split('').map((char, x) => {
        if (char === '.' || char === ' ' || !palette[char]) return null;
        return (
          <div key={`${x}-${y}`} style={{ position: 'absolute', left: x * pixelSize, top: y * pixelSize, width: pixelSize, height: pixelSize, backgroundColor: palette[char] }} />
        );
      }))}
    </div>
  );
};

const AnimatedWindow = () => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame(f => (f + 1) % 3), 600);
    return () => clearInterval(timer);
  }, []);

  const skySection = [
    "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK", "KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK", "KDCCCCCCCCCCCCCCKKCCCCCCCCCCCCCCCCKKCCCCCCCCCCCCCCDK", "KDCCCCCCCCCCCCCCKKCCCCCCCCCCCCCCCCKKCCCCCCCCCCCCCCDK", "KDCCCWWWWWCCCCCCKKCCCCCCYYYYYCCCCCKKCCCCCCCWWWWCCCDK", "KDCCWWWWWWWCCCCCKKCCCCYYYYYYYYYCCCKKCCCCCCWWWWWWCCDK", "KDCCCWWWWWCCCCCCKKCCCYYYYYYYYYYYCCKKCCCCCCCWWWWCCCDK", "KDCCCCCCCCCCCCCCKKCCCYYYYYYYYYYYCCKKCCCCCCCCCCCCCCDK", "KDCCCCHHHHCCCCCCKKCCHHHYYYYYYYYYHHKKCCHHHHCCCCCCCCDK", "KDHHHHHHHHHHHHHHKKHHHHHHYYYYYHHHHHKKHHHHHHHHHHHHHHDK", "KDHHHHHHHHHHHHHHKKHHHHHHHHHHHHHHHHKKHHHHHHHHHHHHHHDK", "KDHHHHHHHHHHHHHHKKHHHHHHHHHHHHHHHHKKHHHHHHHHHHHHHHDK", "KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK", "KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK"
  ];
  const baseSection = [
    "KDUUUUUUUUUUUUUUKKUUUUUUUUUUUUUUUUKKUUUUUUUUUUUUUUDK", "KDUUUUUUUUUUUUUUKKUUUUUUUUUUUUUUUUKKUUUUUUUUUUUUUUDK", "KDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDK", "KLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLK", "KLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLK", "KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK"
  ];
  const windowFrames = [
    [ ...skySection, "KDUUUUVVVUUUUUUUKKUUUUUUVVVUUUUUUUKKUUUUUVVVUUUUUUDK", "KDUUUUUUVVVUUUUUKKUUUUUUUUVVVUUUUUKKUUUUUUUVVVUUUUDK", "KDUUVVUUUUUUUUUUKKUUUVVUUUUUUUUUUUKKUUUVVUUUUUUUVVDK", "KDUUUVVUUUUUUUUUKKUUUUVVUUUUUUUUUUKKUUUUVVUUUUUUUUDK", "KDUUUUUUUVVVUUUUKKUUUUUUUUUVVVUUUUKKUUUUUUUUVVVUUUDK", "KDUUUUUUUUUVVVUUKKUUUUUUUUUUUVVVUUKKUUUUUUUUUUVVVUDK", ...baseSection ].join('\n'),
    [ ...skySection, "KDUUUUUVVVUUUUUUKKUUUUUUUVVVUUUUUUKKUUUUUUVVVUUUUUDK", "KDUUUUUUUVVVUUUUKKUUUUUUUUUVVVUUUUKKUUUUUUUVVVUUUDK", "KDUUUVVUUUUUUUUUKKUUUUVVUUUUUUUUUUKKUUUUVVUUUUUUUVDK", "KDUUUUVVUUUUUUUUKKUUUUUVVUUUUUUUUUKKUUUUUVVUUUUUUUDK", "KDUUUUUUUUVVVUUUKKUUUUUUUUUUVVVUUUKKUUUUUUUUUVVVUUDK", "KDUUUUUUUUUVVVUUKKUUUUUUUUUUUVVVUUKKUUUUUUUUUUVVVUDK", ...baseSection ].join('\n'),
    [ ...skySection, "KDUUUUUUVVVUUUUUKKUUUUUUUUVVVUUUUUKKUUUUUUUVVVUUUUDK", "KDUUUUUUUVVVUUUUKKUUUUUUUUUVVVUUUUKKUUUUUUUUVVVUUUDK", "KDUUUUVVUUUUUUUUKKUUUUUVVUUUUUUUUUKKUUUUUVVUUUUUUUDK", "KDUUUUUVVUUUUUUUKKUUUUUUVVUUUUUUUUKKUUUUUUVVUUUUUUDK", "KDUUUUUUUUUVVVUUKKUUUUUUUUUUUVVVUUKKUUUUUUUUUUVVVUDK", "KDUUUUUUUUUUVVVUKKUUUUUUUUUUUUVVVUKKUUUUUUUUUUUVVUDK", ...baseSection ].join('\n')
  ];
  return <PixelArt art={windowFrames[frame]} palette={PALETTES.env} pixelSize={7} className="transition-opacity duration-300" />;
};

const RealTimeClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const h = (time.getHours() % 12) * 30 + time.getMinutes() * 0.5;
  const m = time.getMinutes() * 6;
  const s = time.getSeconds() * 6;
  return (
    <div className="relative w-32 h-32 md:w-36 md:h-36 bg-[#faebd7] rounded-full border-8 md:border-[10px] border-[#5d4037] shadow-[inset_0_0_15px_rgba(0,0,0,0.4),0_15px_25px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 rounded-full border-[3px] md:border-[4px] border-[#8b4513] opacity-60" />
      <svg viewBox="0 0 100 100" className="w-full h-full relative z-10">
        {[...Array(12)].map((_, i) => (
          <rect key={i} x="48.5" y="6" width="3" height={i % 3 === 0 ? "10" : "5"} fill="#3e2723" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <rect x="47" y="25" width="6" height="25" rx="3" fill="#2c1d1a" transform={`rotate(${h} 50 50)`} />
        <rect x="48" y="12" width="4" height="38" rx="2" fill="#3e2723" transform={`rotate(${m} 50 50)`} />
        <line x1="50" y1="50" x2="50" y2="10" stroke="#b91c1c" strokeWidth="2" transform={`rotate(${s} 50 50)`} />
        <circle cx="50" cy="50" r="4.5" fill="#5d4037" />
        <circle cx="50" cy="50" r="2" fill="#fbbf24" />
      </svg>
    </div>
  );
};

// --- v14 新增：勵志電子牆元件 ---
const MotivationalBoard = () => {
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    const updateQuote = () => {
      // 5 分鐘 = 300,000 毫秒，以此作為基數對陣列長度取餘數，確保所有用戶看到的都同步
      const index = Math.floor(Date.now() / 300000) % QUOTES.length;
      setQuoteIndex(index);
    };
    updateQuote();
    // 每秒檢查一次是否跨越了 5 分鐘的邊界
    const interval = setInterval(updateQuote, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-56 md:w-72 bg-[#0a0a0a] border-[6px] border-[#2c1d1a] rounded-lg p-3 shadow-[inset_0_0_15px_rgba(0,0,0,1),0_20px_25px_rgba(0,0,0,0.8)] relative overflow-hidden">
      {/* 復古玻璃反光特效 */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
      
      <div className="flex items-center justify-between mb-2 border-b border-[#333] pb-1">
        <span className="text-[10px] text-red-500 font-mono font-black animate-pulse flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full" /> REC
        </span>
        <span className="text-[10px] text-[#666] font-mono tracking-widest">QUOTE OF THE MOMENT</span>
      </div>
      
      <div className="min-h-[60px] flex items-center justify-center px-1">
        <p className="font-mono text-[#4ade80] text-sm md:text-base font-bold text-center leading-relaxed drop-shadow-[0_0_8px_rgba(74,222,128,0.6)]">
          "{QUOTES[quoteIndex]}"
        </p>
      </div>
    </div>
  );
};

const Steam = () => (
  <div className="flex gap-1.5 mb-1 justify-center opacity-70">
    <div className="w-1.5 h-5 bg-white rounded-full animate-[bounce_2s_infinite] delay-100" />
    <div className="w-1.5 h-7 bg-white rounded-full animate-[bounce_2s_infinite]" />
    <div className="w-1.5 h-5 bg-white rounded-full animate-[bounce_2s_infinite] delay-300" />
  </div>
);

const RunningDragonIcon = () => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame(f => (f + 1) % 2), 150); 
    return () => clearInterval(timer);
  }, []);
  const sprite = frame === 0 ? SPRITES.dragonRun1 : SPRITES.dragonRun2;
  return (
    <div className="w-12 h-12 bg-[#8b1a1a] rounded-xl border-2 border-black shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
      <PixelArt art={sprite} palette={PALETTES.dragon} pixelSize={2} className={`transition-transform duration-75 ${frame === 0 ? "translate-y-[2px]" : "-translate-y-[1px]"}`} />
    </div>
  );
};

// 取得本地日期字串
const getLocalDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roomData, setRoomData] = useState({ 
    leftStudying: false, 
    rightStudying: false,
    leftStartTime: null,
    rightStartTime: null,
    leftDailyTotal: 0,
    rightDailyTotal: 0,
    lastActiveDate: getLocalDateStr(),
    leftGoals: [],
    rightGoals: [],
    leftNudge: 0,
    rightNudge: 0
  });
  
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [leftGoals, setLeftGoals] = useState([]);
  const [rightGoals, setRightGoals] = useState([]);
  const [newGoalText, setNewGoalText] = useState("");

  const [isPomodoro, setIsPomodoro] = useState(false);
  const [receiveNudge, setReceiveNudge] = useState(false);
  const prevNudgeRef = useRef(0);

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user || !db || !getRoomRef) return;
    const roomRef = getRoomRef();
    const unsub = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setRoomData(data);
        setLeftGoals(data.leftGoals || []);
        setRightGoals(data.rightGoals || []);
      } else {
        setDoc(roomRef, { 
          leftStudying: false, 
          rightStudying: false,
          leftStartTime: null,
          rightStartTime: null,
          leftDailyTotal: 0,
          rightDailyTotal: 0,
          lastActiveDate: getLocalDateStr(),
          leftGoals: [],
          rightGoals: [],
          leftNudge: 0,
          rightNudge: 0
        });
      }
    }, (err) => console.error("監聽失敗", err));
    return () => unsub();
  }, [user]);

  const isStudying = role === 'left' ? roomData.leftStudying : roomData.rightStudying;
  const leftDragonIsStudying = roomData?.leftStudying || false;
  const rightDragonIsStudying = roomData?.rightStudying || false;

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!role) return;
    const myNudge = role === 'left' ? roomData.leftNudge : roomData.rightNudge;
    if (myNudge && myNudge !== prevNudgeRef.current) {
      if (Date.now() - myNudge < 10000) {
        setReceiveNudge(true);
        setTimeout(() => setReceiveNudge(false), 3500);
      }
      prevNudgeRef.current = myNudge;
    }
  }, [roomData.leftNudge, roomData.rightNudge, role]);

  const todayStr = getLocalDateStr();
  
  const calculateElapsed = (roleKey) => {
    let accumulated = 0;
    if (roomData.lastActiveDate === todayStr) {
      accumulated = roomData[`${roleKey}DailyTotal`] || 0;
    }

    let currentSession = 0;
    if (roomData[`${roleKey}Studying`] && roomData[`${roleKey}StartTime`]) {
      const startTime = roomData[`${roleKey}StartTime`];
      const startD = new Date(startTime);
      const startStr = `${startD.getFullYear()}-${String(startD.getMonth()+1).padStart(2,'0')}-${String(startD.getDate()).padStart(2,'0')}`;

      if (startStr === todayStr) {
        currentSession = Math.max(0, Math.floor((currentTime - startTime) / 1000));
      } else {
        const d = new Date();
        const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        currentSession = Math.max(0, Math.floor((currentTime - todayStart) / 1000));
      }
    }
    return { total: accumulated + currentSession, session: currentSession };
  };

  const leftTime = calculateElapsed('left');
  const rightTime = calculateElapsed('right');
  
  const leftElapsed = leftTime.total;
  const rightElapsed = rightTime.total;
  const myElapsed = role === 'left' ? leftElapsed : rightElapsed;
  const mySession = role === 'left' ? leftTime.session : rightTime.session; 

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const formatPomodoroTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleToggleStudy = async () => {
    if (!role || !getRoomRef) return;
    const roomRef = getRoomRef();
    const roleKey = role === 'left' ? 'left' : 'right';
    const fieldStudying = `${roleKey}Studying`;
    const fieldStartTime = `${roleKey}StartTime`;
    const fieldDailyTotal = `${roleKey}DailyTotal`;
    const currentDateStr = getLocalDateStr();

    const updates = {};
    if (roomData.lastActiveDate !== currentDateStr) {
      updates.leftDailyTotal = 0;
      updates.rightDailyTotal = 0;
      updates.lastActiveDate = currentDateStr;
    }

    if (isStudying) {
      const exactElapsed = role === 'left' ? leftElapsed : rightElapsed;
      updates[fieldStudying] = false;
      updates[fieldStartTime] = null;
      updates[fieldDailyTotal] = exactElapsed;
      updates.lastActiveDate = currentDateStr;
    } else {
      updates[fieldStudying] = true;
      updates[fieldStartTime] = Date.now();
      updates.lastActiveDate = currentDateStr;
      setCurrentTime(Date.now());
    }

    await updateDoc(roomRef, updates);
  };

  const sendNudge = async () => {
    if (!role || !getRoomRef) return;
    const partnerRole = role === 'left' ? 'right' : 'left';
    await updateDoc(getRoomRef(), { [`${partnerRole}Nudge`]: Date.now() });
  };

  const handleAddGoal = async (e) => {
    e.preventDefault();
    if (!newGoalText.trim() || !role) return;
    
    const newGoal = { id: Date.now(), text: newGoalText, completed: false };
    const fieldToUpdate = role === 'left' ? 'leftGoals' : 'rightGoals';
    const currentGoals = role === 'left' ? leftGoals : rightGoals;
    const updatedGoals = [...currentGoals, newGoal];
    
    if (role === 'left') setLeftGoals(updatedGoals);
    else setRightGoals(updatedGoals);
    
    setNewGoalText(""); 
    
    try {
      await updateDoc(getRoomRef(), { [fieldToUpdate]: updatedGoals });
    } catch (err) {
      console.error("Update Error:", err);
    }
  };

  const toggleGoal = async (id, targetRole) => {
    if (role !== targetRole) return;
    const fieldToUpdate = targetRole === 'left' ? 'leftGoals' : 'rightGoals';
    const currentGoals = targetRole === 'left' ? leftGoals : rightGoals;
    const updatedGoals = currentGoals.map(g => g.id === id ? { ...g, completed: !g.completed } : g);
    
    if (targetRole === 'left') setLeftGoals(updatedGoals);
    else setRightGoals(updatedGoals);

    try {
      await updateDoc(getRoomRef(), { [fieldToUpdate]: updatedGoals });
    } catch (err) {
      console.error("Toggle Error:", err);
    }
  };

  const deleteGoal = async (id, targetRole) => {
    if (role !== targetRole) return;
    const fieldToUpdate = targetRole === 'left' ? 'leftGoals' : 'rightGoals';
    const currentGoals = targetRole === 'left' ? leftGoals : rightGoals;
    const updatedGoals = currentGoals.filter(g => g.id !== id);
    
    if (targetRole === 'left') setLeftGoals(updatedGoals);
    else setRightGoals(updatedGoals);

    try {
      await updateDoc(getRoomRef(), { [fieldToUpdate]: updatedGoals });
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  const getProgress = (targetGoals) => {
    if (!targetGoals || targetGoals.length === 0) return 0;
    const completedCount = targetGoals.filter(g => g.completed).length;
    return Math.round((completedCount / targetGoals.length) * 100);
  };

  // --- 登入畫面 ---

  if (!role) {
    return (
      <div className="min-h-screen bg-[#0d0706] flex items-center justify-center p-6 font-sans">
        <div className="bg-[#1a0f0d] p-10 rounded-[3rem] border-[6px] border-[#3e2723] text-center max-w-lg w-full shadow-[0_0_100px_rgba(0,0,0,0.8)]">
          <div className="flex justify-center mb-6"><RunningDragonIcon /></div>
          <h1 className="text-4xl font-black text-[#daa520] mb-4 tracking-wider">呱花秘密基地</h1>
          <p className="text-[#e0d5c1] mb-8 font-bold leading-relaxed text-lg">
            嘿！夥伴現在的狀態是？<br/>
            {roomData.leftStudying || roomData.rightStudying ? (
              <span className="text-[#daa520] animate-pulse">🔥 有人在努力中，快加入吧！</span>
            ) : (
              <span className="text-[#8d6e63]">目前基地很安靜，可以盡情補眠...</span>
            )}
          </p>
          <div className="flex gap-4">
            <button onClick={() => setRole('left')} className={`flex-1 py-6 rounded-3xl border-4 transition-all relative overflow-hidden group ${roomData.leftStudying ? 'bg-[#2c1d1a] border-[#daa520] shadow-[0_0_20px_rgba(218,165,32,0.3)]' : 'bg-[#3e2723] border-transparent hover:border-[#daa520] hover:bg-[#5d4037]'}`}>
              <div className="relative z-10 flex flex-col items-center">
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={4} className={`mb-4 transition-transform group-hover:scale-110 ${!roomData.leftStudying && 'grayscale opacity-50'}`} />
                <span className={`font-black text-xl block ${roomData.leftStudying ? 'text-[#daa520]' : 'text-[#8d6e63]'}`}>
                  {roomData.leftStudying ? '呱呱專注中' : '我是呱呱'}
                </span>
                {roomData.leftStudying && (
                   <span className="text-[10px] text-[#e0d5c1] opacity-60 font-mono mt-2 block tracking-tighter">掛機專注中...</span>
                )}
              </div>
              {roomData.leftStudying && <div className="absolute inset-0 bg-gradient-to-t from-[#daa520]/10 to-transparent pointer-events-none" />}
            </button>

            <button onClick={() => setRole('right')} className={`flex-1 py-6 rounded-3xl border-4 transition-all relative overflow-hidden group ${roomData.rightStudying ? 'bg-[#2c1d1a] border-[#daa520] shadow-[0_0_20px_rgba(218,165,32,0.3)]' : 'bg-[#3e2723] border-transparent hover:border-[#daa520] hover:bg-[#5d4037]'}`}>
              <div className="relative z-10 flex flex-col items-center">
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={4} className={`mb-4 transition-transform group-hover:scale-110 ${!roomData.rightStudying && 'grayscale opacity-50'}`} />
                <span className={`font-black text-xl block ${roomData.rightStudying ? 'text-[#daa520]' : 'text-[#8d6e63]'}`}>
                  {roomData.rightStudying ? '花花專注中' : '我是花花'}
                </span>
                {roomData.rightStudying && (
                   <span className="text-[10px] text-[#e0d5c1] opacity-60 font-mono mt-2 block tracking-tighter">掛機專注中...</span>
                )}
              </div>
              {roomData.rightStudying && <div className="absolute inset-0 bg-gradient-to-t from-[#daa520]/10 to-transparent pointer-events-none" />}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0706] text-[#e0d5c1] font-sans pb-32 overflow-x-hidden">
      
      {/* 全螢幕沉浸番茄鐘 */}
      {isStudying && isPomodoro && (
        <div className="fixed inset-0 z-[200] bg-[#0d0706]/95 backdrop-blur-lg flex flex-col items-center justify-center">
          <div className="text-[100px] md:text-[140px] mb-4 animate-pulse drop-shadow-[0_0_40px_rgba(239,68,68,0.4)]">
            🍅
          </div>
          <div className={`font-mono text-7xl md:text-9xl font-black tracking-widest mb-16 drop-shadow-[0_0_30px_rgba(218,165,32,0.4)] ${1500 - mySession <= 0 ? 'text-red-500 animate-bounce' : 'text-[#daa520]'}`}>
            {formatPomodoroTime(Math.max(0, 1500 - mySession))}
          </div>
          <button 
            onClick={handleToggleStudy}
            className="px-10 py-5 bg-[#2c1d1a] text-[#daa520] font-black text-2xl rounded-[2rem] border-4 border-[#daa520] hover:bg-[#daa520] hover:text-[#0d0706] transition-all shadow-[0_0_20px_rgba(218,165,32,0.2)] active:scale-95"
          >
            結束專注
          </button>
        </div>
      )}

      {/* 戳一下全螢幕特效 */}
      {receiveNudge && !isPomodoro && (
        <div className="fixed inset-0 pointer-events-none z-[150] flex items-center justify-center bg-pink-500/10">
          <div className="animate-bounce flex flex-col items-center">
            <Heart size={120} fill="#f472b6" className="text-pink-400 drop-shadow-[0_0_30px_rgba(244,114,182,0.8)]" />
            <span className="text-white font-black text-2xl md:text-4xl mt-6 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] px-6 py-2 bg-pink-500/80 rounded-full border-4 border-white">
              對方給了你一個愛的鼓勵！
            </span>
          </div>
        </div>
      )}

      <header className="bg-[#1a0f0d] border-b-2 border-[#3e2723] p-4 sticky top-0 z-[100] flex justify-between items-center px-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <RunningDragonIcon />
          <h1 className="text-2xl font-black tracking-widest text-[#daa520]">呱花秘密基地</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-[#8d6e63] bg-[#3e2723] px-3 py-1 rounded-full hidden md:block">
            你是 {role === 'left' ? '呱呱' : '花花'}
          </span>
          <div className="bg-black/80 px-6 py-2 rounded-2xl border-2 border-[#daa520]/40 shadow-[0_0_15px_rgba(218,165,32,0.15)]">
            <span className="text-2xl font-mono font-bold text-[#daa520]">{formatTime(myElapsed)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-8 mt-4">
        {/* 背景與動畫區域 */}
        <section className="relative w-full aspect-[21/9] md:aspect-[16/9] bg-[#3a2723] rounded-[4rem] overflow-hidden border-[12px] border-[#2c1d1a] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col items-center">
          <div className="absolute inset-0 bg-[#4e342e]" />
          <div className="absolute top-[6%] left-[4%] z-10 opacity-100 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]"><AnimatedWindow /></div>
          
          {/* v14: 勵志電子牆 (取代原本的圖書館書櫃) */}
          <div className="absolute top-[8%] right-[6%] z-10 opacity-95">
             <MotivationalBoard />
          </div>
          
          <div className="absolute top-4 md:top-6 left-1/2 -translate-x-1/2 z-10"><RealTimeClock /></div>
          
          {/* 左側：呱呱 */}
          <div className="absolute bottom-[28%] left-[25%] -translate-x-1/2 z-20 flex justify-center items-end">
             {role === 'right' && (
               <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded-xl border border-[#daa520]/50 text-[#daa520] font-mono text-sm font-bold z-50 tracking-wider shadow-[0_0_10px_rgba(0,0,0,0.6)]">
                 {formatTime(leftElapsed)}
               </div>
             )}
             <div className={`transition-all duration-700 ${leftDragonIsStudying ? 'opacity-100 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={11} className="drop-shadow-[0_15px_15px_rgba(0,0,0,0.7)]" />
             </div>
             {!leftDragonIsStudying && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 scale-100">
                  <PixelArt art={SPRITES.dragonSleep} palette={PALETTES.dragon} pixelSize={11} />
                  <div className="absolute -top-10 -right-8"><PixelArt art={SPRITES.zzz} palette={PALETTES.dragon} pixelSize={3.5} /></div>
                </div>
             )}
          </div>
          
          {/* 右側：花花 */}
          <div className="absolute bottom-[28%] left-[75%] -translate-x-1/2 z-20 flex justify-center items-end">
             {role === 'left' && (
               <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded-xl border border-[#daa520]/50 text-[#daa520] font-mono text-sm font-bold z-50 tracking-wider shadow-[0_0_10px_rgba(0,0,0,0.6)]">
                 {formatTime(rightElapsed)}
               </div>
             )}
             <div className={`transition-all duration-700 ${rightDragonIsStudying ? 'opacity-100 scale-100' : 'opacity-0 translate-y-4 scale-95'}`}>
                <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={11} className="drop-shadow-[0_15px_15px_rgba(0,0,0,0.7)]" />
             </div>
             {!rightDragonIsStudying && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 scale-100">
                  <PixelArt art={SPRITES.dragonSleep} palette={PALETTES.dragon} pixelSize={11} />
                  <div className="absolute -top-10 -right-8"><PixelArt art={SPRITES.zzz} palette={PALETTES.dragon} pixelSize={3.5} /></div>
                </div>
             )}
          </div>
          
          <div className="absolute bottom-0 left-0 w-full h-[32%] z-30 bg-[#4e342e] border-t-[20px] border-[#795548] shadow-[0_-20px_40px_rgba(0,0,0,0.6)]">
             <div className="absolute top-0 left-0 w-full h-2 bg-white/10" />
             <div className="absolute top-[-20px] left-0 w-full h-2 bg-black/20" />
          </div>

          <div className="absolute bottom-0 w-full h-full z-40 pointer-events-none">
             <div className={`absolute inset-0 transition-all duration-700 ${leftDragonIsStudying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                 <div className="absolute bottom-[10%] left-[12%] z-[41] flex flex-col items-center">
                    {leftDragonIsStudying && <div className="absolute -top-14 left-1/2 -translate-x-1/2"><Steam /></div>}
                    <div className="drop-shadow-[0_15px_10px_rgba(0,0,0,0.8)]"><PixelArt art={SPRITES.coffeeCupDetailed} palette={PALETTES.env} pixelSize={8} /></div>
                 </div>
                 <div className="absolute bottom-[12%] left-[28%] z-[40]">
                    <div className="drop-shadow-[0_20px_15px_rgba(0,0,0,0.8)]"><PixelArt art={SPRITES.redBook} palette={PALETTES.env} pixelSize={7.5} /></div>
                 </div>
             </div>

             <div className={`absolute inset-0 transition-all duration-700 ${rightDragonIsStudying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                 <div className="absolute bottom-[10%] left-[62%] z-[41] flex flex-col items-center">
                    {rightDragonIsStudying && <div className="absolute -top-14 left-1/2 -translate-x-1/2"><Steam /></div>}
                    <div className="drop-shadow-[0_15px_10px_rgba(0,0,0,0.8)]"><PixelArt art={SPRITES.coffeeCupDetailed} palette={PALETTES.env} pixelSize={8} /></div>
                 </div>
                 <div className="absolute bottom-[12%] left-[78%] z-[40]">
                    <div className="drop-shadow-[0_20px_15px_rgba(0,0,0,0.8)]"><PixelArt art={SPRITES.redBook} palette={PALETTES.env} pixelSize={7.5} /></div>
                 </div>
             </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 z-[50] pointer-events-none" />
        </section>

        <div className="px-6 md:px-12 space-y-6">
          
          <button 
            onClick={handleToggleStudy}
            className={`w-full py-8 rounded-[3rem] font-black text-2xl border-[6px] border-black shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3 transition-all flex items-center justify-center relative ${
              isStudying ? 'bg-[#daa520] text-black' : 'bg-[#388e3c] text-white'
            }`}
          >
            {isStudying ? (
              <div className="flex items-center gap-6"><Coffee size={36} /> 暫時休息</div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <BookOpen size={36} /> 
                <span>開始專注</span>
                <label 
                  onClick={(e) => e.stopPropagation()} 
                  className="flex items-center gap-2 cursor-pointer text-white hover:text-yellow-200 transition-colors font-bold text-base bg-black/30 px-4 py-2 rounded-full ml-4 border-2 border-black/20"
                >
                  <input type="checkbox" checked={isPomodoro} onChange={e => setIsPomodoro(e.target.checked)} className="w-5 h-5 accent-[#daa520]" />
                  🍅 番茄鐘
                </label>
              </div>
            )}
          </button>

          {/* 任務方塊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 呱呱的任務 (左) */}
            <div className={`bg-[#1a0f0d] rounded-[3rem] p-8 border-4 transition-all ${role === 'left' ? 'border-[#3e2723] shadow-2xl' : 'border-black/50 opacity-80'}`}>
               <div className="flex justify-between items-center mb-8 pb-6 border-b-4 border-[#3e2723]">
                  <div className="flex items-center gap-4">
                    <h3 className="text-[#daa520] font-black text-2xl flex items-center gap-3"><Trophy size={28} /> 呱呱的任務</h3>
                    {role === 'right' && (
                      <button onClick={sendNudge} className="flex items-center gap-1 text-[#f472b6] hover:text-pink-400 bg-[#331515] px-3 py-1 rounded-full border-2 border-[#f472b6]/30 hover:scale-105 active:scale-95 transition-all text-sm font-bold shadow-sm ml-2">
                        <Heart size={16} fill="currentColor" /> 戳一下
                      </button>
                    )}
                  </div>
                  
                  <div className="text-right text-sm font-bold text-[#e0d5c1] flex items-center gap-4">
                    進度 {getProgress(leftGoals)}%
                  </div>
               </div>
               
               <div className="space-y-2 mb-8 h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                 {leftGoals.map(goal => (
                   <div 
                     key={goal.id} 
                     onClick={() => toggleGoal(goal.id, 'left')} 
                     className={`p-3 rounded-2xl border-[3px] transition-all flex items-center gap-3 group relative ${
                       role === 'left' ? 'cursor-pointer' : 'cursor-not-allowed'
                     } ${
                       goal.completed ? 'bg-[#2c1d1a] border-[#3e2723] opacity-60' : 'bg-[#0d0706] border-[#5d4037]'
                     }`}
                   >
                     {goal.completed ? <CheckCircle2 size={24} className="text-[#daa520] shrink-0" /> : <Circle size={24} className="text-[#5d4037] shrink-0" />}
                     <span className={`text-base font-bold flex-1 truncate ${goal.completed ? 'line-through text-[#8d6e63]' : ''}`}>{goal.text}</span>
                     {role === 'left' && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id, 'left'); }}
                         className="opacity-0 group-hover:opacity-100 text-[#8b1a1a] hover:text-[#ff4d4d] transition-opacity p-1 shrink-0"
                       >
                         <Trash2 size={18} />
                       </button>
                     )}
                   </div>
                 ))}
                 {leftGoals.length === 0 && <div className="text-center py-6 text-[#3e2723] font-bold italic text-sm">尚未新增任何任務...</div>}
               </div>

               {role === 'left' && (
                 <form onSubmit={handleAddGoal} className="flex gap-4">
                   <input 
                     type="text" 
                     value={newGoalText} 
                     onChange={(e) => setNewGoalText(e.target.value)} 
                     placeholder="新增任務..." 
                     className="flex-1 bg-[#0d0706] border-4 border-[#3e2723] px-6 py-4 rounded-[1.5rem] font-bold text-xl outline-none focus:border-[#daa520] transition-colors shadow-inner"
                   />
                   <button type="submit" className="bg-[#3e2723] p-4 rounded-2xl text-[#daa520] hover:bg-[#daa520] hover:text-[#0d0706] transition-all border-b-4 border-black active:translate-y-1 active:border-b-0"><Plus size={32} strokeWidth={4} /></button>
                 </form>
               )}
            </div>

            {/* 花花的任務 (右) */}
            <div className={`bg-[#1a0f0d] rounded-[3rem] p-8 border-4 transition-all ${role === 'right' ? 'border-[#3e2723] shadow-2xl' : 'border-black/50 opacity-80'}`}>
               <div className="flex justify-between items-center mb-8 pb-6 border-b-4 border-[#3e2723]">
                  <div className="flex items-center gap-4">
                    <h3 className="text-[#daa520] font-black text-2xl flex items-center gap-3">
                      <Trophy size={28} /> 花花的任務
                    </h3>
                    {role === 'left' && (
                      <button onClick={sendNudge} className="flex items-center gap-1 text-[#f472b6] hover:text-pink-400 bg-[#331515] px-3 py-1 rounded-full border-2 border-[#f472b6]/30 hover:scale-105 active:scale-95 transition-all text-sm font-bold shadow-sm ml-2">
                        <Heart size={16} fill="currentColor" /> 戳一下
                      </button>
                    )}
                  </div>

                  <div className="text-right text-sm font-bold text-[#e0d5c1] flex items-center gap-4">
                    進度 {getProgress(rightGoals)}%
                  </div>
               </div>
               
               <div className="space-y-2 mb-8 h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                 {rightGoals.map(goal => (
                   <div 
                     key={goal.id} 
                     onClick={() => toggleGoal(goal.id, 'right')} 
                     className={`p-3 rounded-2xl border-[3px] transition-all flex items-center gap-3 group relative ${
                       role === 'right' ? 'cursor-pointer' : 'cursor-not-allowed'
                     } ${
                       goal.completed ? 'bg-[#2c1d1a] border-[#3e2723] opacity-60' : 'bg-[#0d0706] border-[#5d4037]'
                     }`}
                   >
                     {goal.completed ? <CheckCircle2 size={24} className="text-[#daa520] shrink-0" /> : <Circle size={24} className="text-[#5d4037] shrink-0" />}
                     <span className={`text-base font-bold flex-1 truncate ${goal.completed ? 'line-through text-[#8d6e63]' : ''}`}>{goal.text}</span>
                     {role === 'right' && (
                       <button 
                         onClick={(e) => { e.stopPropagation(); deleteGoal(goal.id, 'right'); }}
                         className="opacity-0 group-hover:opacity-100 text-[#8b1a1a] hover:text-[#ff4d4d] transition-opacity p-1 shrink-0"
                       >
                         <Trash2 size={18} />
                       </button>
                     )}
                   </div>
                 ))}
                 {rightGoals.length === 0 && <div className="text-center py-6 text-[#3e2723] font-bold italic text-sm">尚未新增任何任務...</div>}
               </div>

               {role === 'right' && (
                 <form onSubmit={handleAddGoal} className="flex gap-4">
                   <input 
                     type="text" 
                     value={newGoalText} 
                     onChange={(e) => setNewGoalText(e.target.value)} 
                     placeholder="新增任務..." 
                     className="flex-1 bg-[#0d0706] border-4 border-[#3e2723] px-6 py-4 rounded-[1.5rem] font-bold text-xl outline-none focus:border-[#daa520] transition-colors shadow-inner"
                   />
                   <button type="submit" className="bg-[#3e2723] p-4 rounded-2xl text-[#daa520] hover:bg-[#daa520] hover:text-[#0d0706] transition-all border-b-4 border-black active:translate-y-1 active:border-b-0"><Plus size={32} strokeWidth={4} /></button>
                 </form>
               )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}