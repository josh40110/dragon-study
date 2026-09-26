import { useEffect, useState } from 'react';
import { Play, X } from 'lucide-react';

/** 全站 index.css 的 unlayered `p/span { white-space: nowrap }` 會壓過 utility class */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

/**
 * 圖片載入失敗（沒網路、外部圖片被移除）就換成替代內容，不要留一個破圖示。
 * 用 key={src} 讓換圖時重設失敗狀態。
 */
export function SafeImg({ src, alt = '', className = '', fallback = null, ...rest }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return fallback;
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} {...rest} />;
}

/** YouTube 縮圖卡；點了在頁面裡播放（youtube-nocookie，不追蹤） */
export function VideoCard({ video, onPlay, compact = false }) {
  return (
    <button
      onClick={() => onPlay(video)}
      className={`group text-left rounded-xl overflow-hidden border-2 border-[#e6dac1] bg-[#f7f0e2] hover:border-[#daa520] transition-colors ${
        compact ? 'w-[180px] shrink-0' : ''
      }`}
      title={video.original ? `原標題：${video.original}` : video.title}
    >
      <div className="relative aspect-video bg-[#2c1d1a]">
        <SafeImg
          src={`https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`}
          className="h-full w-full object-cover"
          loading="lazy"
          fallback={<div className="h-full w-full flex items-center justify-center text-3xl">🎬</div>}
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-10 h-10 rounded-full bg-black/60 group-hover:bg-[#c0392b] flex items-center justify-center transition-colors">
            <Play size={18} className="text-white ml-0.5" fill="white" />
          </span>
        </span>
      </div>
      <div className="px-2 py-1.5">
        <div className="text-[11px] font-black text-[#4a3526] leading-snug line-clamp-2" style={WRAP}>
          {video.title}
        </div>
        <div className="text-[10px] font-bold text-[#9a8568]" style={WRAP}>
          {video.channel}
          {video.note ? `・${video.note}` : ''}
        </div>
      </div>
    </button>
  );
}

export function VideoModal({ video, onClose }) {
  useEffect(() => {
    if (!video) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video, onClose]);
  if (!video) return null;
  return (
    <div className="fixed inset-0 z-[400] bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="min-w-0 text-white font-black text-sm" style={WRAP}>
            {video.title}
            <span className="ml-2 text-white/60 font-bold">{video.channel}</span>
            {video.original && (
              <div className="text-[11px] font-bold text-white/50" style={WRAP}>
                原標題：{video.original}
              </div>
            )}
          </div>
          <button onClick={onClose} className="shrink-0 p-2 rounded-full bg-white/15 text-white hover:bg-white/30" title="關閉（Esc）">
            <X size={18} />
          </button>
        </div>
        <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-[12px] font-bold text-white/70 hover:text-white"
        >
          在 YouTube 上看 →
        </a>
      </div>
    </div>
  );
}
