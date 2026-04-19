import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, BookOpen, Coffee, Calendar, Star, User, Trophy, CheckCircle2, Circle, Plus 
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
    // ⚠️ 請在這裡貼上您自己的 Firebase Config ⚠️
    const firebaseConfig = {
      apiKey: "AIzaSyAY4Ef5-Q37OR1EEUR_IEkRx5xi01VLcLo",
      authDomain: "dragon-study-room.firebaseapp.com",
      projectId: "dragon-study-room",
      storageBucket: "dragon-study-room.firebasestorage.app",
      messagingSenderId: "61672911098",
      appId: "1:61672911098:web:72ff8be1958e5971f6d943"
    };
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    getRoomRef = () => doc(db, 'rooms', 'shared-room');
  }
} catch (e) {
  console.error("Firebase 初始化失敗", e);
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
  dragonSleep: [
    "........R.....R.......", "......RRR...RRR.......", "........R.....R.......", ".....KKKKKKKKKKKKK....", "...KKWWWWWWWWWWWWWKK..", "..KWWWWWWWWWWWWWWWWWK.", "..KWWWWKKKWWWWWKKKWWK.", ".KWWWWWWWWWWWWWWWWWZZK", ".KWWWOOOOWWKWWOOOOZWZK", "KKWWWOOOOWWWWWWOOOOZZK", "KWWWWWWWWWWWWWWWWWWKK.", ".KKKKKKKKKKKKKKKKKKK.." 
  ].join('\n'),
  libraryShelf: [
    "TTTTTTTTTTTTTTTT", "D..............D", "D.rr.bb.yy.gg..D", "DLLLLLLLLLLLLLLD", "DS..............", "D.pp.oo.bb.rr..D", "DLLLLLLLLLLLLLLD", "DS..............", "D.ww.gg.pp.oo..D", "DLLLLLLLLLLLLLLD", "DDDDDDDDDDDDDDDD"
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

const PixelArt = ({ art, palette, pixelSize = 4, className = "" }) => {
  const rows = useMemo(() => (Array.isArray(art) ? art : art.trim().split('\n')).map(r => r.trim()), [art]);
  return (
    <div className={`relative ${className}`} style={{ width: rows[0].length * pixelSize, height: rows.length * pixelSize }}>
      {rows.map((row, y) => row.split('').map((char, x) => {
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
    [ ...skySection, "KDUUUUUVVVUUUUUUKKUUUUUUUVVVUUUUUUKKUUUUUUVVVUUUUUDK", "KDUUUUUUUVVVUUUUKKUUUUUUUUUVVVUUUUKKUUUUUUUUVVVUUUDK", "KDUUUVVUUUUUUUUUKKUUUUVVUUUUUUUUUUKKUUUUVVUUUUUUUVDK", "KDUUUUVVUUUUUUUUKKUUUUUVVUUUUUUUUUKKUUUUUVVUUUUUUUDK", "KDUUUUUUUUVVVUUUKKUUUUUUUUUUVVVUUUKKUUUUUUUUUVVVUUDK", "KDUUUUUUUUUVVVUUKKUUUUUUUUUUUVVVUUKKUUUUUUUUUUVVVUDK", ...baseSection ].join('\n'),
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
    <div className="relative w-24 h-24 bg-[#faebd7] rounded-full border-8 border-[#5d4037] shadow-[inset_0_0_15px_rgba(0,0,0,0.3),0_15px_25px_rgba(0,0,0,0.7)] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 rounded-full border-[3px] border-[#8b4513] opacity-60" />
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

const Steam = () => (
  <div className="flex gap-1.5 mb-1 justify-center opacity-70">
    <div className="w-1.5 h-5 bg-white rounded-full animate-[bounce_2s_infinite] delay-100" />
    <div className="w-1.5 h-7 bg-white rounded-full animate-[bounce_2s_infinite]" />
    <div className="w-1.5 h-5 bg-white rounded-full animate-[bounce_2s_infinite] delay-300" />
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roomData, setRoomData] = useState({ leftStudying: false, rightStudying: false });
  const [timer, setTimer] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
  const [goals, setGoals] = useState([
    { id: 1, text: '與夥伴一起待滿 2 小時', completed: false }
  ]);
  const [newGoalText, setNewGoalText] = useState("");

  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("登入失敗", e);
      }
    };
    initAuth();
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !db || !getRoomRef) return;
    const roomRef = getRoomRef();
    const unsub = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomData(snapshot.data());
      } else {
        setDoc(roomRef, { leftStudying: false, rightStudying: false });
      }
    }, (err) => console.error("監聽失敗", err));
    return () => unsub();
  }, [user]);

  const isStudying = role === 'left' ? roomData.leftStudying : roomData.rightStudying;
  const partnerStudying = role === 'left' ? roomData.rightStudying : roomData.leftStudying;

  useEffect(() => {
    let interval;
    if (isStudying) {
      interval = setInterval(() => setTimer(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isStudying]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleToggleStudy = async () => {
    if (!role || !getRoomRef) return;
    if (isStudying) setShowSummary(true);
    const roomRef = getRoomRef();
    const fieldToUpdate = role === 'left' ? 'leftStudying' : 'rightStudying';
    await updateDoc(roomRef, { [fieldToUpdate]: !isStudying });
  };

  const toggleGoal = (id) => {
    setGoals(goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    setGoals([...goals, { id: Date.now(), text: newGoalText, completed: false }]);
    setNewGoalText("");
  };

  const completedCount = goals.filter(g => g.completed).length;
  const progressPercent = goals.length === 0 ? 0 : Math.round((completedCount / goals.length) * 100);

  if (!role) {
    return (
      <div className="min-h-screen bg-[#0d0706] flex items-center justify-center p-6 font-sans">
        <div className="bg-[#1a0f0d] p-10 rounded-[3rem] border-[6px] border-[#3e2723] text-center max-w-lg w-full">
          <h1 className="text-4xl font-black text-[#daa520] mb-4 tracking-wider">龍龍努力室</h1>
          <p className="text-[#e0d5c1] mb-8 font-bold">請選擇你要扮演哪一隻龍？<br/>(你與夥伴請選擇不同邊)</p>
          <div className="flex gap-4">
            <button onClick={() => setRole('left')} className="flex-1 py-6 bg-[#3e2723] hover:bg-[#5d4037] border-4 border-transparent hover:border-[#daa520] rounded-3xl transition-all">
              <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={4} className="mx-auto mb-4" />
              <span className="text-[#daa520] font-black text-xl">坐左邊</span>
            </button>
            <button onClick={() => setRole('right')} className="flex-1 py-6 bg-[#3e2723] hover:bg-[#5d4037] border-4 border-transparent hover:border-[#daa520] rounded-3xl transition-all">
              <PixelArt art={SPRITES.dragonSit} palette={PALETTES.dragon} pixelSize={4} className="mx-auto mb-4" />
              <span className="text-[#daa520] font-black text-xl">坐右邊</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const leftDragonIsStudying = role === 'left' ? isStudying : partnerStudying;
  const rightDragonIsStudying = role === 'right' ? isStudying : partnerStudying;

  return (
    <div className="min-h-screen bg-[#0d0706] text-[#e0d5c1] font-sans pb-32 overflow-x-hidden">
      <header className="bg-[#1a0f0d] border-b-2 border-[#3e2723] p-4 sticky top-0 z-[100] flex justify-between items-center px-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[#8b1a1a] rounded-lg border border-black shadow-inner">
            <Heart size={20} fill="white" className="text-white" />
          </div>
          <h1 className="text-xl font-black tracking-widest text-[#daa520] italic uppercase">Dragon Library</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-[#8d6e63] bg-[#3e2723] px-3 py-1 rounded-full">
            你是 {role === 'left' ? '左邊' : '右邊'} 的龍龍
          </span>
          <div className="bg-black/80 px-6 py-2 rounded-2xl border-2 border-[#daa520]/40 shadow-[0_0_15px_rgba(218,165,32,0.15)]">
            <span className="text-2xl font-mono font-bold text-[#daa520]">{formatTime(timer)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-8">
        
        <section className="relative w-full aspect-[21/9] md:aspect-[16/9] bg-[#3a2723] rounded-[4rem] overflow-hidden border-[12px] border-[#2c1d1a] shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex flex-col items-center">
          <div className="absolute inset-0 bg-[#4e342e]" />
          
          <div className="absolute top-[6%] left-[4%] z-10 opacity-100 drop-shadow-[0_20px_30px_rgba(0,0,0,0.5)]">
             <AnimatedWindow />
          </div>
          <div className="absolute top-[5%] right-[8%] z-10 opacity-80 drop-shadow-xl">
             <PixelArt art={SPRITES.libraryShelf} palette={PALETTES.env} pixelSize={8} />
             <div className="mt-2"><PixelArt art={SPRITES.libraryShelf} palette={PALETTES.env} pixelSize={8} /></div>
          </div>

          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10">
             <RealTimeClock />
          </div>

          <div className="absolute bottom-[28%] left-[25%] -translate-x-1/2 z-20 flex justify-center items-end">
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

          <div className="absolute bottom-[28%] left-[75%] -translate-x-1/2 z-20 flex justify-center items-end">
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
                    {leftDragonIsStudying && (
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2">
                         <Steam />
                      </div>
                    )}
                    <div className="drop-shadow-[0_15px_10px_rgba(0,0,0,0.8)]">
                      <PixelArt art={SPRITES.coffeeCupDetailed} palette={PALETTES.env} pixelSize={8} />
                    </div>
                 </div>
                 <div className="absolute bottom-[12%] left-[28%] z-[40]">
                    <div className="drop-shadow-[0_20px_15px_rgba(0,0,0,0.8)]">
                      <PixelArt art={SPRITES.redBook} palette={PALETTES.env} pixelSize={7.5} />
                    </div>
                 </div>
             </div>

             <div className={`absolute inset-0 transition-all duration-700 ${rightDragonIsStudying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                 <div className="absolute bottom-[10%] left-[62%] z-[41] flex flex-col items-center">
                    {rightDragonIsStudying && (
                      <div className="absolute -top-14 left-1/2 -translate-x-1/2">
                         <Steam />
                      </div>
                    )}
                    <div className="drop-shadow-[0_15px_10px_rgba(0,0,0,0.8)]">
                      <PixelArt art={SPRITES.coffeeCupDetailed} palette={PALETTES.env} pixelSize={8} />
                    </div>
                 </div>
                 <div className="absolute bottom-[12%] left-[78%] z-[40]">
                    <div className="drop-shadow-[0_20px_15px_rgba(0,0,0,0.8)]">
                      <PixelArt art={SPRITES.redBook} palette={PALETTES.env} pixelSize={7.5} />
                    </div>
                 </div>
             </div>
          </div>
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10 z-[50] pointer-events-none" />
        </section>

        <div className="px-6 md:px-12 space-y-6">
          <button 
            onClick={handleToggleStudy}
            className={`w-full py-8 rounded-[3rem] font-black text-2xl border-[6px] border-black shadow-[0_12px_0_#000] active:shadow-none active:translate-y-3 transition-all flex items-center justify-center gap-6 ${
              isStudying ? 'bg-[#daa520] text-black' : 'bg-[#388e3c] text-white'
            }`}
          >
            {isStudying ? <><Coffee size={36} /> 暫時休息，結束這段努力時光</> : <><BookOpen size={36} /> 坐到書桌前，喝杯咖啡開始專注</>}
          </button>

          <div className="bg-[#1a0f0d] p-8 md:p-10 rounded-[3rem] border-4 border-[#3e2723] shadow-2xl">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-8 border-b-2 border-[#3e2723]">
                <div>
                  <h3 className="text-[#daa520] font-black text-2xl flex items-center gap-3">
                    <Trophy size={28} /> 我的專注任務
                  </h3>
                  <p className="text-[#8d6e63] font-bold mt-2">
                    已完成 {completedCount} / {goals.length} 項挑戰
                  </p>
                </div>
                
                <div className="flex-1 max-w-sm">
                  <div className="flex justify-between text-sm font-bold text-[#e0d5c1] mb-2">
                    <span>進度</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-black/60 h-4 rounded-full overflow-hidden border-2 border-[#3e2723] p-0.5">
                    <div 
                      className="bg-gradient-to-r from-[#8b1a1a] to-[#daa520] h-full rounded-full transition-all duration-700 ease-out" 
                      style={{ width: `${progressPercent}%` }} 
                    />
                  </div>
                </div>
             </div>

             <div className="space-y-4 mb-8">
               {goals.map(goal => (
                 <div key={goal.id} onClick={() => toggleGoal(goal.id)} className={`cursor-pointer p-5 md:p-6 rounded-[2rem] border-4 transition-all duration-300 flex items-center gap-5 shadow-lg ${goal.completed ? 'bg-[#2c1d1a] border-[#3e2723] opacity-60' : 'bg-[#0d0706] border-[#5d4037] hover:border-[#daa520]'}`}>
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${goal.completed ? 'text-[#daa520]' : 'text-[#5d4037]'}`}>
                      {goal.completed ? <CheckCircle2 size={32} /> : <Circle size={32} />}
                   </div>
                   <span className={`text-xl font-bold flex-1 ${goal.completed ? 'line-through text-[#8d6e63]' : 'text-[#e0d5c1]'}`}>{goal.text}</span>
                 </div>
               ))}
               {goals.length === 0 && (
                 <p className="text-center text-[#8d6e63] font-bold py-6">目前沒有設定任何任務哦！</p>
               )}
             </div>

             <form onSubmit={handleAddGoal} className="flex gap-4">
               <input type="text" value={newGoalText} onChange={(e) => setNewGoalText(e.target.value)} placeholder="輸入新的任務..." className="flex-1 bg-[#0d0706] border-4 border-[#3e2723] text-[#e0d5c1] px-6 py-4 rounded-[2rem] font-bold text-lg focus:outline-none focus:border-[#daa520] transition-colors placeholder-[#5d4037]" />
               <button type="submit" disabled={!newGoalText.trim()} className="px-8 py-4 bg-[#3e2723] text-[#daa520] font-black rounded-[2rem] border-4 border-transparent hover:border-[#daa520] disabled:opacity-50 disabled:hover:border-transparent transition-all flex items-center gap-2">
                 <Plus size={24} /> <span className="hidden md:inline">新增</span>
               </button>
             </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;