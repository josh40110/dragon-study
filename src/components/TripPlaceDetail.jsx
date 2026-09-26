import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronLeft, ChevronRight, ExternalLink, MapPin, MessageCircle, Play, Plus, Sparkles, Star, X } from 'lucide-react';
import { TRIP_CATEGORIES, TRIP_CITIES } from '../constants/tripGuide';
import { TRIP_EXPERT_PICKS, TRIP_INSIGHTS } from '../constants/tripInsights';
import WIKIVOYAGE from '../constants/tripWikivoyage.json';
import { placeOf } from '../utils/tripGeo';
import { VideoCard } from './TripMedia';

/** 全站 index.css 的 unlayered `p/span { white-space: nowrap }` 會壓過 utility class */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const CAT_BY_KEY = new Map(TRIP_CATEGORIES.map((c) => [c.key, c]));
const CITY_BY_KEY = new Map(TRIP_CITIES.map((c) => [c.key, c]));
const STAR_LABEL = { move: '候選', fun: '想去', food: '想吃', stay: '候選' };

const LINK_CLASS =
  'inline-flex items-center gap-1 rounded-lg bg-[#eaf2fc] px-2 py-1 text-[11px] font-black text-[#2f6db5] hover:bg-[#dbe8f8] transition-colors';

/** 自己加的連結只接受 http(s) */
const isSafeUrl = (url) => /^https?:\/\/\S+$/i.test(url || '');

function searchTerms(item) {
  const city = CITY_BY_KEY.get(item.city);
  const where = city ? city.local.split(' / ')[0] : '';
  return {
    city,
    map: item.map || `${item.local || item.name} ${where}`.trim(),
    en: `${item.local && /[a-z]/i.test(item.local) ? item.local : item.name} ${where}`.trim(),
    zh: `${item.name} ${city ? city.name : ''}`.trim(),
  };
}

/** 看原始評論的地方：評論本身不能搬進來，給連結直接去看 */
function reviewLinks(item) {
  const q = searchTerms(item);
  return [
    { label: 'Google 地圖評論', url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q.map)}` },
    { label: 'Tripadvisor', url: `https://www.tripadvisor.com.tw/Search?q=${encodeURIComponent(q.en)}` },
    { label: '中文遊記', url: `https://www.google.com/search?q=${encodeURIComponent(`${q.zh} 心得`)}` },
  ];
}

/** Wikivoyage 頁面網址（分區頁的 / 要保留） */
function wikivoyageUrl(page, section) {
  const slug = encodeURIComponent(page.replace(/ /g, '_')).replace(/%2F/g, '/');
  return `https://en.wikivoyage.org/wiki/${slug}${section ? `#${section.replace(/ /g, '_')}` : ''}`;
}

/** 影片和國外攻略：連過去看，內容永遠是最新的 */
function moreLinks(item) {
  const q = searchTerms(item);
  const wv = WIKIVOYAGE[item.id];
  const wvPage = wv ? wikivoyageUrl(wv.page, wv.section) : q.city?.wikivoyage ? wikivoyageUrl(q.city.wikivoyage[0]) : null;
  return [
    { label: 'YouTube 中文', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q.zh)}` },
    { label: 'YouTube 外文', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(q.en)}` },
    ...(wvPage ? [{ label: wv ? 'Wikivoyage' : `Wikivoyage（${q.city.name}）`, url: wvPage }] : []),
  ];
}

/**
 * Wikivoyage 對這個地點的介紹（tools/trip/fetch_wikivoyage.mjs 抓的英文原文）。
 * CC BY-SA 4.0：來源、授權、原頁連結都要留著。
 */
function WikivoyageNote({ item }) {
  const wv = WIKIVOYAGE[item.id];
  if (!wv || (!wv.content && !wv.hours && !wv.price)) return null;
  const facts = [
    wv.hours && ['⏱', wv.hours],
    wv.price && ['💰', wv.price],
    wv.address && ['📍', wv.address],
  ].filter(Boolean);
  // 名稱接著簡介是一整句（Wikivoyage 的寫法），翻譯時不要斷開
  const lead = [wv.pageOnly ? '' : wv.name, wv.content].filter(Boolean).join(' ');
  const translateText = [lead, ...facts.map(([, text]) => text)].filter(Boolean).join('\n');
  return (
    <Section
      icon={<BookOpen size={14} />}
      title="Wikivoyage 怎麼說"
      note={`英文原文・CC BY-SA 4.0・時間價格可能過時${wv.lastedit ? `（這筆 ${wv.lastedit} 更新）` : ''}`}
    >
      <div className="rounded-xl bg-[#f1f6fb] border border-[#d6e4f2] p-2 space-y-1.5">
        {wv.pageOnly && (
          <div className="text-[11px] font-black text-[#2f6db5]" style={WRAP}>
            📖 {wv.page.replace('/', '・')} 的地區介紹
          </div>
        )}
        {wv.content && (
          <p lang="en" className="text-[12px] font-semibold text-[#2d3f52] leading-relaxed" style={WRAP}>
            {!wv.pageOnly && (
              <b className="font-black">
                {wv.name}
                {wv.alt ? ` (${wv.alt})` : ''}{' '}
              </b>
            )}
            {wv.content}
          </p>
        )}
        {facts.length > 0 && (
          <div className="space-y-0.5">
            {facts.map(([icon, text]) => (
              <p key={icon} lang="en" className="text-[11px] font-bold text-[#4a5b6d] leading-snug" style={WRAP}>
                {icon} {text}
              </p>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <a href={wikivoyageUrl(wv.page, wv.section)} target="_blank" rel="noreferrer" className={LINK_CLASS}>
            <ExternalLink size={11} />
            看 Wikivoyage 原頁
          </a>
          <a
            href={`https://translate.google.com/?sl=en&tl=zh-TW&op=translate&text=${encodeURIComponent(translateText)}`}
            target="_blank"
            rel="noreferrer"
            className={LINK_CLASS}
          >
            <ExternalLink size={11} />
            翻成中文
          </a>
        </div>
      </div>
    </Section>
  );
}

/** 全螢幕看照片：← → 切換、Esc 關閉 */
function Lightbox({ photos, index, name, onIndex, onClose }) {
  const photo = photos[index];
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex((index + 1) % photos.length);
      if (e.key === 'ArrowLeft') onIndex((index - 1 + photos.length) % photos.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, photos.length, onIndex, onClose]);
  if (!photo) return null;
  return (
    <div className="fixed inset-0 z-[400] bg-black/90 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <img
        src={photo.src}
        alt={name}
        className="max-h-[84vh] max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <div className="mt-3 flex items-center gap-3 text-white" onClick={(e) => e.stopPropagation()}>
        {photos.length > 1 && (
          <button onClick={() => onIndex((index - 1 + photos.length) % photos.length)} className="p-2 rounded-full bg-white/15 hover:bg-white/30" title="上一張">
            <ChevronLeft size={18} />
          </button>
        )}
        <span className="text-[13px] font-black">
          {name}・{index + 1} / {photos.length}
        </span>
        {photos.length > 1 && (
          <button onClick={() => onIndex((index + 1) % photos.length)} className="p-2 rounded-full bg-white/15 hover:bg-white/30" title="下一張">
            <ChevronRight size={18} />
          </button>
        )}
      </div>
      {photo.credit && (
        <a
          href={photo.credit.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-1 text-[11px] font-bold text-white/60 hover:text-white"
        >
          照片：{photo.credit.author}／{photo.credit.license}（Wikimedia Commons）
        </a>
      )}
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white hover:bg-white/30" title="關閉">
        <X size={20} />
      </button>
    </div>
  );
}

function Gallery({ item }) {
  const place = placeOf(item);
  const [failed, setFailed] = useState(() => new Set());
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  // 載入失敗的照片直接從相簿拿掉
  const photos = [
    ...(place?.img ? [{ src: place.img, thumb: place.thumb, credit: place.credit, note: place.note }] : []),
    ...(place?.gallery || []).map((g) => ({ src: g.url, thumb: g.thumb, credit: g.credit, note: g.note })),
  ].filter((photo) => !failed.has(photo.src));
  const cat = CAT_BY_KEY.get(item.cat);

  if (photos.length === 0) {
    return (
      <div className="h-full min-h-[120px] rounded-2xl bg-gradient-to-br from-[#f3e9d6] to-[#e6dac1] flex items-center justify-center text-5xl">
        {cat?.emoji}
      </div>
    );
  }
  const index = Math.min(active, photos.length - 1);
  const current = photos[index];
  const markFailed = (src) => setFailed((prev) => new Set(prev).add(src));
  const go = (step) => setActive((index + step + photos.length) % photos.length);

  return (
    <div className="group relative h-full min-h-[140px] overflow-hidden rounded-2xl bg-[#e6dac1]">
      <img
        key={current.src}
        src={current.src}
        alt={item.name}
        onError={() => markFailed(current.src)}
        onClick={() => setZoomed(true)}
        className="h-full w-full object-cover cursor-zoom-in"
      />
      {current.note && (
        <span
          className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-black text-white"
          title="這張照片不是這個地方本身，只是讓你知道大概長什麼樣子"
        >
          {current.note}圖
        </span>
      )}
      <span className="absolute right-2.5 top-2.5 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-black text-white">
        {index + 1} / {photos.length}・點圖放大
      </span>
      {photos.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white opacity-70 group-hover:opacity-100 hover:bg-black/60"
            title="上一張"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white opacity-70 group-hover:opacity-100 hover:bg-black/60"
            title="下一張"
          >
            <ChevronRight size={18} />
          </button>
          <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
            {photos.map((photo, i) => (
              <button
                key={photo.src}
                onClick={() => setActive(i)}
                className={`h-10 w-14 overflow-hidden rounded-lg border-2 shadow transition-all ${
                  i === index ? 'border-white scale-105' : 'border-white/40 opacity-80 hover:opacity-100'
                }`}
                aria-label={`第 ${i + 1} 張照片`}
              >
                <img
                  src={photo.thumb || photo.src}
                  alt=""
                  loading="lazy"
                  onError={() => markFailed(photo.src)}
                  className="h-full w-full object-cover"
                />
              </button>
            ))}
          </div>
        </>
      )}
      {current.credit && (
        <a
          href={current.credit.url}
          target="_blank"
          rel="noreferrer"
          title={`照片：${current.credit.author}／${current.credit.license}（Wikimedia Commons）`}
          className="absolute bottom-2.5 right-2.5 max-w-[40%] truncate rounded-md bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white/90 hover:bg-black/70"
        >
          © {current.credit.author}・{current.credit.license}
        </a>
      )}
      {zoomed && (
        <Lightbox photos={photos} index={index} name={item.name} onIndex={setActive} onClose={() => setZoomed(false)} />
      )}
    </div>
  );
}

function Section({ icon, title, children, note }) {
  return (
    <section>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1.5">
        <h4 className="text-[13px] font-black text-[#b07d0a] flex items-center gap-1.5">
          {icon}
          {title}
        </h4>
        {note && (
          <span className="text-[10px] font-bold text-[#b3a084]" style={WRAP}>
            {note}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * 地點介紹（參考旅遊網站的活動頁）：大照片＋相簿、一句話吸引點、亮點、網友心得、實用資訊。
 * status：{ dayLabel, inDay, stopNumber, scheduledDays }，決定下方按鈕是「加入」還是「移出」。
 */
export default function TripPlaceDetail({
  item,
  pick,
  status,
  onAdd,
  onRemove,
  onUpdatePick,
  onOpenCard,
  onBack,
  dayOptions,
  onAddToDay,
  videos,
  onPlayVideo,
}) {
  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-[#9a8568] p-6">
        <div className="text-4xl">🗺️</div>
        <div className="font-black text-[#6b5540]">點左邊的站點、右邊的地點或地圖上的圖釘</div>
        <div className="text-[12px] font-bold" style={WRAP}>
          這裡會出現照片、亮點和網友心得，看完再決定要不要排進去。
        </div>
      </div>
    );
  }

  const cat = CAT_BY_KEY.get(item.cat);
  const city = CITY_BY_KEY.get(item.city);
  const insight = TRIP_INSIGHTS[item.id];
  const star = Boolean(pick?.star);
  const booked = Boolean(pick?.booked);
  const facts = [
    item.time && ['⏱', `建議停留 ${item.time}`],
    insight?.bestTime && ['🕐', insight.bestTime],
    item.when && ['🗓', item.when],
    item.cost && ['💰', item.cost],
  ].filter(Boolean);
  const officialLinks = [
    ...(item.links || []),
    ...(isSafeUrl(item.url) ? [{ label: '連結', url: item.url }] : []),
  ];

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* @container：面板夠寬時亮點和網友心得並排，一眼看完不用捲 */}
      <div className="@container flex-1 min-h-0 overflow-y-auto parchment-scrollbar pr-1 space-y-2.5">
        <div className="relative h-[clamp(150px,26vh,260px)] lg:h-[clamp(170px,33vh,340px)]">
          <Gallery key={item.id} item={item} />
          {onBack && (
            <button
              onClick={onBack}
              className="absolute left-2.5 top-9 z-10 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-black text-white hover:bg-black/75"
            >
              <ArrowLeft size={12} />
              總覽
            </button>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[#f0e5d0] px-2 py-0.5 text-[11px] font-black text-[#8a755b]">
              {cat?.emoji} {cat?.label}
            </span>
            {city && (
              <span className="rounded-full bg-[#f0e5d0] px-2 py-0.5 text-[11px] font-black text-[#8a755b]">
                {city.flag} {city.name}
              </span>
            )}
            {item.custom && (
              <span className="rounded-full bg-[#e8eefc] px-2 py-0.5 text-[11px] font-black text-[#3b5bab]">自己加的</span>
            )}
            {item.verify && (
              <span
                className="rounded-full bg-[#fdebc8] px-2 py-0.5 text-[11px] font-black text-[#9a5b0a]"
                title="票價、時刻或營業日每年會變，出發前以官網為準"
              >
                出發前再確認
              </span>
            )}
            {(TRIP_EXPERT_PICKS[item.id] || []).map((pickBadge) => (
              <span
                key={pickBadge.source + pickBadge.label}
                className="rounded-full bg-[#1f3a5f] px-2 py-0.5 text-[11px] font-black text-white"
                title={pickBadge.note || ''}
              >
                📘 {pickBadge.source} {pickBadge.label}
              </span>
            ))}
            {status?.scheduledDays?.length > 0 && (
              <span className="rounded-full bg-[#fff3c4] px-2 py-0.5 text-[11px] font-black text-[#b07d0a]">
                📅 已排在 Day {status.scheduledDays.join('、')}
              </span>
            )}
          </div>
          <h3 className="mt-1.5 text-xl md:text-2xl font-black leading-tight text-[#4a3526]" style={WRAP}>
            {item.name}
          </h3>
          {item.local && (
            <div className="text-[12px] font-bold text-[#9a8568]" style={WRAP}>
              {item.local}
            </div>
          )}
          {insight?.tagline && (
            <p className="mt-1.5 text-[14px] font-black text-[#8a5a0a]" style={WRAP}>
              「{insight.tagline}」
            </p>
          )}
        </div>

        {facts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {facts.map(([icon, text]) => (
              <span
                key={text}
                className="rounded-lg bg-[#f7f0e2] border border-[#e6dac1] px-2 py-1 text-[11px] font-bold text-[#4a3526]"
                style={WRAP}
              >
                {icon} {text}
              </span>
            ))}
          </div>
        )}

        <div className="grid gap-3 @lg:grid-cols-2">
        {insight?.highlights?.length > 0 && (
          <Section icon={<Sparkles size={14} />} title="亮點">
            <ul className="space-y-1">
              {insight.highlights.map((text) => (
                <li key={text} className="flex gap-2 text-[13px] font-bold text-[#4a3526] leading-snug" style={WRAP}>
                  <span className="text-[#daa520] shrink-0">✦</span>
                  <span style={WRAP}>{text}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(insight?.praise?.length > 0 || insight?.gripes?.length > 0) && (
          <Section
            icon={<MessageCircle size={14} />}
            title="網友怎麼說"
            note="整理自公開評論與遊記的常見說法，非逐字引用"
          >
            <div className="grid gap-1.5">
              <div className="rounded-xl bg-[#eef8ef] border border-[#cfe9d2] p-2 space-y-1">
                <div className="text-[11px] font-black text-[#166534]">👍 大家喜歡</div>
                {(insight.praise || []).map((text) => (
                  <p key={text} className="text-[12px] font-bold text-[#2d5a3a] leading-snug" style={WRAP}>
                    {text}
                  </p>
                ))}
              </div>
              <div className="rounded-xl bg-[#fdf3e6] border border-[#f0d9b5] p-2 space-y-1">
                <div className="text-[11px] font-black text-[#9a5b0a]">👎 要注意</div>
                {(insight.gripes || []).map((text) => (
                  <p key={text} className="text-[12px] font-bold text-[#7a4a10] leading-snug" style={WRAP}>
                    {text}
                  </p>
                ))}
              </div>
            </div>
          </Section>
        )}
        </div>

        <WikivoyageNote item={item} />

        {videos?.length > 0 && (
          <Section icon={<Play size={14} />} title="影片" note="點了在這裡播放">
            <div className="flex gap-2 overflow-x-auto pb-1 parchment-scrollbar">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} onPlay={onPlayVideo} compact />
              ))}
            </div>
          </Section>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-[#9a8568]">看原始評論：</span>
          {reviewLinks(item).map((link) => (
            <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className={LINK_CLASS}>
              <ExternalLink size={11} />
              {link.label}
            </a>
          ))}
          {officialLinks.map((link) => (
            <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className={LINK_CLASS}>
              <ExternalLink size={11} />
              {link.label}
            </a>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-black text-[#9a8568]">找影片・攻略：</span>
          {moreLinks(item).map((link) => (
            <a key={link.label} href={link.url} target="_blank" rel="noreferrer" className={LINK_CLASS}>
              <ExternalLink size={11} />
              {link.label}
            </a>
          ))}
        </div>

        {(item.desc || item.tips?.length > 0) && (
          <Section icon={<MapPin size={14} />} title="介紹與小提醒">
            {item.desc && (
              <p className="text-[12px] font-bold text-[#6b5540] leading-relaxed" style={WRAP}>
                {item.desc}
              </p>
            )}
            {item.tips?.map((tip) => (
              <p key={tip} className="mt-1 text-[12px] font-bold text-[#8a6d3b] leading-relaxed" style={WRAP}>
                💡 {tip}
              </p>
            ))}
          </Section>
        )}
      </div>

      {/* 操作列固定在底部，內容再長也按得到 */}
      <div className="shrink-0 mt-2 pt-2 border-t-2 border-dashed border-[#e6dac1] flex items-center gap-1.5">
        {status?.inDay ? (
          <button
            onClick={() => onRemove(item)}
            className="px-3 py-1.5 rounded-xl border-2 border-[#f0c8c0] bg-[#fdf1ee] text-[12px] font-black text-[#c0392b] flex items-center gap-1"
          >
            <X size={13} />
            從 {status.dayLabel} 移出<span className="hidden sm:inline">（第 {status.stopNumber} 站）</span>
          </button>
        ) : dayOptions && !status?.dayLabel ? (
          <select
            value=""
            onChange={(e) => e.target.value && onAddToDay(item, e.target.value)}
            className="max-w-[170px] px-2 py-1.5 rounded-xl border-2 border-[#daa520] bg-[#fff7e3] text-[12px] font-black text-[#b07d0a] cursor-pointer focus:outline-none"
            aria-label="排進哪天"
          >
            <option value="">＋ 排進哪天</option>
            {dayOptions.map((d) => (
              <option key={d.id} value={d.id} disabled={d.has}>
                {d.label}
                {d.has ? '（已排）' : ''}
              </option>
            ))}
          </select>
        ) : (
          status?.dayLabel && (
            <button
              onClick={() => onAdd(item)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[12px] font-black text-[#5a3c0e] shadow-[0_3px_0_#a9760a] active:translate-y-0.5 active:shadow-[0_1px_0_#a9760a] flex items-center gap-1"
            >
              <Plus size={13} />
              加進 {status.dayLabel}
            </button>
          )
        )}
        <button
          onClick={() => onUpdatePick(item.id, { star: !star })}
          className={`px-2.5 py-1.5 rounded-xl border-2 text-[12px] font-black flex items-center gap-1 ${
            star ? 'bg-[#fff3c4] border-[#daa520] text-[#b07d0a]' : 'bg-[#fdf9f1] border-[#e6dac1] text-[#9a8568] hover:border-[#daa520]'
          }`}
        >
          <Star size={13} fill={star ? '#daa520' : 'none'} />
          {STAR_LABEL[item.cat]}
        </button>
        <button
          onClick={() => onUpdatePick(item.id, { booked: !booked })}
          className={`px-2.5 py-1.5 rounded-xl border-2 text-[12px] font-black flex items-center gap-1 ${
            booked ? 'bg-[#e8f7e9] border-[#16a34a] text-[#166534]' : 'bg-[#fdf9f1] border-[#e6dac1] text-[#9a8568] hover:border-[#16a34a]'
          }`}
        >
          <Check size={13} />
          {item.cat === 'food' ? '已訂位' : '已訂'}
        </button>
        <button
          onClick={() => onOpenCard(item)}
          className="ml-auto px-2 py-1.5 rounded-xl text-[12px] font-black text-[#9a8568] hover:text-[#b07d0a]"
          title="到清單頁看完整卡片、寫備註"
        >
          <span className="hidden sm:inline">完整卡片・備註 </span>→
        </button>
      </div>
    </div>
  );
}
