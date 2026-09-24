import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Flame, Timer } from 'lucide-react';
import { getHeartbeatMs, isRoleStudying } from '../hooks/useStudyTimer';

const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

/** 兩個人各有自己的顏色，紀錄列一眼分得出來是誰 */
const ROLES = [
  { key: 'left', label: '呱呱', accent: '#2f7d32', soft: '#e8f7e9', chip: '#3f8f43' },
  { key: 'right', label: '花花', accent: '#b4506b', soft: '#fbeaf0', chip: '#c26483' },
];
const ROLE = Object.fromEntries(ROLES.map((r) => [r.key, r]));

const pad = (n, width = 2) => String(n).padStart(width, '0');

/** 時刻；紀錄列只到秒，展開與合計才顯示毫秒 */
function clockTime(ms, withMs = false) {
  const d = new Date(ms);
  const base = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return withMs ? `${base}.${pad(d.getMilliseconds(), 3)}` : base;
}

function duration(ms, withMs = false) {
  const t = Math.max(0, Math.floor(ms));
  const base = `${pad(Math.floor(t / 3600000))}:${pad(Math.floor((t % 3600000) / 60000))}:${pad(
    Math.floor((t % 60000) / 1000),
  )}`;
  return withMs ? `${base}.${pad(t % 1000, 3)}` : base;
}

const dayKey = (ms) => new Date(ms).toDateString();

function dayHeading(ms) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === today.toDateString()) return '今天';
  if (d.toDateString() === yesterday.toDateString()) return '昨天';
  return `${d.getMonth() + 1} / ${d.getDate()}`;
}

function normalizeSessions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s) => s && Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s) => ({
      id: String(s.id ?? `${s.by}-${s.start}`),
      by: s.by === 'left' || s.by === 'right' ? s.by : 'left',
      start: s.start,
      end: s.end,
      ms: Number.isFinite(s.ms) ? s.ms : s.end - s.start,
    }));
}

/** 一列紀錄；點一下展開看到毫秒 */
function LogRow({ entry, live, ratio, expanded, onToggle }) {
  const role = ROLE[entry.by] || ROLES[0];
  return (
    <button
      onClick={() => onToggle(entry.id)}
      /* block 不能省：button 預設 inline-block，配上全站的 white-space:nowrap 會讓所有列擠成一行 */
      className={`block w-full text-left rounded-xl border-2 pl-0 overflow-hidden transition-colors ${
        live ? 'border-[#daa520] bg-[#fff7e3]' : 'border-[#e6dac1] bg-[#f7f0e2] hover:border-[#caa53f]'
      }`}
    >
      <div className="flex">
        {/* 左側色條：誰的紀錄 */}
        <span className="w-1.5 shrink-0" style={{ background: live ? '#daa520' : role.accent }} />

        <span className="flex-1 min-w-0 px-2.5 py-1.5">
          <span className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black flex items-center gap-1" style={{ color: role.accent }}>
              {role.label}
              {live && <span className="text-[#b07d0a] animate-pulse">● 專注中</span>}
            </span>
            <span
              className="font-mono font-black tabular-nums text-[15px]"
              style={{ color: live ? '#b07d0a' : '#4a3526' }}
            >
              {duration(entry.ms)}
            </span>
          </span>

          {/* 長度長條：跟當天最長的一次比 */}
          <span className="block h-1 rounded-full bg-[#e6dac1] mt-1 overflow-hidden">
            <span
              className="block h-full rounded-full transition-[width] duration-500"
              style={{ width: `${Math.max(4, Math.round(ratio * 100))}%`, background: live ? '#daa520' : role.chip }}
            />
          </span>

          <span className="block text-[11px] text-[#8a755b] font-bold font-mono tabular-nums mt-1" style={WRAP}>
            {clockTime(entry.start)}
            <span className="text-[#c0ad8c]"> → </span>
            {live ? <span className="text-[#b07d0a]">進行中</span> : clockTime(entry.end)}
          </span>

          {expanded && (
            <span className="block mt-1.5 pt-1.5 border-t border-[#e6dac1] text-[10px] text-[#9a8568] font-bold font-mono tabular-nums space-y-0.5">
              <span className="block">開始 {clockTime(entry.start, true)}</span>
              <span className="block">結束 {live ? '進行中' : clockTime(entry.end, true)}</span>
              <span className="block text-[#b07d0a]">長度 {duration(entry.ms, true)}</span>
            </span>
          )}
        </span>
      </div>
    </button>
  );
}

/**
 * 打卡紀錄：每次專注的開始、結束與長度。
 * 高度由旁邊的小屋動畫決定，內容一律在自己的捲動區長，不會撐開外框。
 */
export default function StudyLogPanel({ roomData, role }) {
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState(null); // null = 兩個人都看
  const [expandedId, setExpandedId] = useState(null);
  const rafRef = useRef(0);
  const listRef = useRef(null);
  const stickToTopRef = useRef(true);

  const liveEntries = useMemo(() => {
    const list = [];
    ROLES.forEach(({ key }) => {
      if (!isRoleStudying(roomData, key, now)) return;
      const start = Number(roomData?.[`${key}StartTime`]);
      if (!Number.isFinite(start)) return;
      const beat = getHeartbeatMs(roomData, key);
      list.push({
        id: `live-${key}-${start}`,
        by: key,
        start,
        end: now,
        ms: Math.max(0, (beat != null ? Math.max(now, beat) : now) - start),
      });
    });
    return list;
  }, [now, roomData]);

  const hasLive = liveEntries.length > 0;

  useEffect(() => {
    if (!hasLive) return undefined;
    const loop = () => {
      setNow(Date.now());
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [hasLive]);

  // 新的在最上面：由舊到新是由下往上
  const past = useMemo(
    () => normalizeSessions(roomData?.sessions).sort((a, b) => b.start - a.start),
    [roomData?.sessions],
  );

  /** 各自的今日合計（含正在進行的那一段），不受篩選影響 */
  const todayTotals = useMemo(() => {
    const today = new Date().toDateString();
    const totals = { left: 0, right: 0 };
    past.forEach((s) => {
      if (dayKey(s.start) === today) totals[s.by] += s.ms;
    });
    liveEntries.forEach((s) => {
      totals[s.by] += s.ms;
    });
    return totals;
  }, [liveEntries, past]);

  /** 依篩選後的清單，並插入日期分隔 */
  const rows = useMemo(() => {
    const all = [...liveEntries.map((e) => ({ ...e, live: true })), ...past].filter(
      (e) => !filter || e.by === filter,
    );
    const longest = all.reduce((max, e) => Math.max(max, e.ms), 1);
    const out = [];
    let lastDay = null;
    all.forEach((entry) => {
      const key = dayKey(entry.start);
      if (key !== lastDay) {
        out.push({ type: 'day', id: `day-${key}`, label: dayHeading(entry.start) });
        lastDay = key;
      }
      out.push({ type: 'row', ...entry, ratio: entry.ms / longest });
    });
    return out;
  }, [filter, liveEntries, past]);

  const longestEver = useMemo(() => {
    const pool = filter ? past.filter((s) => s.by === filter) : past;
    return pool.reduce((max, s) => Math.max(max, s.ms), 0);
  }, [filter, past]);

  // 最新的在最上面，所以新紀錄進來時黏在頂端；使用者往下翻舊紀錄時就不要硬拉回去
  const rowCount = rows.length;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !stickToTopRef.current) return;
    el.scrollTop = 0;
  }, [rowCount, filter]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToTopRef.current = el.scrollTop < 40;
  };

  const visibleCount = rows.filter((r) => r.type === 'row').length;

  return (
    /* 外層只負責佔位；面板本身絕對定位，紀錄再多也不會把動畫區撐高 */
    <div className="relative shrink-0 h-[420px] lg:h-auto lg:w-[340px] xl:w-[400px] 2xl:w-[460px]">
      <aside className="absolute inset-0 flex flex-col rounded-[2.5rem] 2xl:rounded-[2.8rem] border-[10px] 2xl:border-[12px] border-[#2c1d1a] bg-[#fdf9f1] shadow-[0_30px_70px_rgba(74,52,33,0.35)] overflow-hidden">
        <div className="shrink-0 px-3.5 py-2.5 bg-gradient-to-b from-[#3a2817] to-[#1b120b] border-b-4 border-[#2c1d1a] relative overflow-hidden">
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent" />

          <div className="relative flex items-center justify-between gap-2 mb-2">
            <span className="flex items-center gap-1.5 text-[#f4cd57] font-black text-base tracking-wider">
              <ClipboardList size={16} />
              打卡紀錄
            </span>
            <span className="text-[10px] font-black text-[#c8a86a]">
              {filter ? `${ROLE[filter].label} ${visibleCount}` : `共 ${past.length}`} 筆
            </span>
          </div>

          {/* 點名字就只看那個人的紀錄，再點一次看全部 */}
          <div className="relative grid grid-cols-2 gap-2">
            {ROLES.map(({ key, label, chip }) => {
              const active = filter === key;
              const isLive = liveEntries.some((e) => e.by === key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    setFilter((prev) => (prev === key ? null : key));
                    stickToTopRef.current = true;
                  }}
                  title={active ? '再點一次看兩個人的紀錄' : `只看${label}的紀錄`}
                  className={`rounded-xl px-2 py-1.5 border-2 text-left transition-all ${
                    active ? 'bg-[#4a3418] shadow-[0_0_0_2px_rgba(244,205,87,0.35)]' : 'bg-black/25 hover:bg-black/35'
                  }`}
                  style={{ borderColor: active ? '#f4cd57' : `${chip}88` }}
                >
                  <span className="text-[10px] font-black flex items-center gap-1" style={{ color: active ? '#f4cd57' : '#c8a86a' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: chip }} />
                    {label}
                    {role === key && <span className="text-[9px] opacity-70">（你）</span>}
                    {isLive && <span className="text-[#f4cd57] animate-pulse">●</span>}
                  </span>
                  <span className="block font-mono font-black tabular-nums text-[#f4cd57] text-[15px] drop-shadow-[0_0_8px_rgba(244,205,87,0.4)]">
                    {duration(todayTotals[key], true)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2.5 space-y-1.5 parchment-scrollbar [scrollbar-gutter:stable]"
        >
          {visibleCount === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
              <Timer size={28} className="text-[#e0d3b6]" />
              <p className="text-[#b3a084] font-bold text-sm text-center" style={WRAP}>
                {filter ? `${ROLE[filter].label}今天還沒有紀錄` : '還沒有紀錄。按下「開始專注」就會記在這裡。'}
              </p>
            </div>
          ) : (
            rows.map((item) =>
              item.type === 'day' ? (
                <div key={item.id} className="flex items-center gap-2 pt-1.5 first:pt-0">
                  <span className="h-px flex-1 bg-[#e6dac1]" />
                  <span className="text-[10px] font-black text-[#b3a084]">{item.label}</span>
                  <span className="h-px flex-1 bg-[#e6dac1]" />
                </div>
              ) : (
                <LogRow
                  key={item.id}
                  entry={item}
                  live={Boolean(item.live)}
                  ratio={item.ratio}
                  expanded={expandedId === item.id}
                  onToggle={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                />
              ),
            )
          )}
        </div>

        {longestEver > 0 && (
          <div className="shrink-0 px-3 py-1.5 border-t-2 border-[#e6dac1] bg-[#f7f0e2] flex items-center justify-center gap-1.5">
            <Flame size={12} className="text-[#daa520]" />
            <span className="text-[10px] font-black text-[#9a8568]">
              最長一次 <span className="font-mono tabular-nums text-[#b07d0a]">{duration(longestEver)}</span>
            </span>
          </div>
        )}
      </aside>
    </div>
  );
}
