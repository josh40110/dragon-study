import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

/** 同樣外觀的圖釘共用同一個 icon，避免每次重繪都換 icon 造成閃爍 */
const iconCache = new Map();
function iconFor(html, size) {
  const key = `${size}|${html}`;
  if (!iconCache.has(key)) {
    iconCache.set(
      key,
      L.divIcon({
        className: '',
        html,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
      }),
    );
  }
  return iconCache.get(key);
}

/** 只有 fitKey 變了（換一天、增減站點）才重新取景；拖拉換順序時地圖不要一直跳 */
function FitBounds({ points, fitKey }) {
  const map = useMap();
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  });
  useEffect(() => {
    const pts = pointsRef.current;
    if (!pts.length) return;
    if (pts.length === 1) map.setView(pts[0], 14);
    else map.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
  }, [fitKey, map]);
  // 容器尺寸變了（剛顯示出來、切換分頁、旋轉手機）Leaflet 不會自己知道：更新尺寸並重新取景，
  // 否則在隱藏狀態下初始化的地圖只會框到一小塊
  useEffect(() => {
    const el = map.getContainer();
    if (typeof ResizeObserver === 'undefined') return undefined;
    let timer = null;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        map.invalidateSize();
        const pts = pointsRef.current;
        if (pts.length > 1) map.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
        else if (pts.length === 1) map.setView(pts[0], 14);
      }, 150);
    });
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);
  return null;
}

/** 選到的地點不在畫面裡時平移過去（只平移不縮放，免得看不出它在整天路線的哪裡） */
function FocusPoint({ point }) {
  const map = useMap();
  const key = point ? `${point[0]},${point[1]}` : '';
  const pointRef = useRef(point);
  useEffect(() => {
    pointRef.current = point;
  });
  useEffect(() => {
    const pt = pointRef.current;
    if (pt && !map.getBounds().pad(-0.1).contains(pt)) map.panTo(pt);
  }, [key, map]);
  return null;
}

/**
 * markers：{ id, lat, lng, html, size, zIndex, popup, tooltip, onClick }
 *   html 只放數字、emoji 這類自己產生的內容；使用者輸入的名稱放 tooltip（React 會跳脫）
 * lines：{ id, positions, color, dashed, weight, label }
 */
export default function TripLeafletMap({ markers, lines, fitPoints, fitKey, focus = null, className = '' }) {
  return (
    // z-0 自成一層，Leaflet 內部 400+ 的 z-index 才不會蓋過置頂的 header
    // 圖磚降一點彩度、加一點暖色，跟羊皮紙底色比較搭
    <div
      className={`relative z-0 overflow-hidden rounded-2xl border-2 border-[#e6dac1] bg-[#eef1f4] [&_.leaflet-tile-pane]:[filter:saturate(0.8)_sepia(0.12)] ${className}`}
    >
      <MapContainer center={[55, 15]} zoom={4} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        {/* OpenStreetMap 官方圖磚：免金鑰，但規定要標出處、不能大量抓（兩個人用沒問題） */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {lines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.positions}
            pathOptions={{
              color: line.color,
              weight: line.weight || 4,
              opacity: 0.85,
              dashArray: line.dashed ? '8 8' : null,
              lineCap: 'round',
            }}
          >
            {line.label && (
              <Tooltip permanent direction="center" className="trip-leg-label">
                {line.label}
              </Tooltip>
            )}
          </Polyline>
        ))}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.lat, marker.lng]}
            icon={iconFor(marker.html, marker.size || 30)}
            zIndexOffset={marker.zIndex || 0}
            eventHandlers={marker.onClick ? { click: marker.onClick } : undefined}
          >
            {marker.tooltip && (
              <Tooltip direction="top" offset={[0, -(marker.size || 30) / 2]}>
                {marker.tooltip}
              </Tooltip>
            )}
            {marker.popup && <Popup minWidth={220} maxWidth={260}>{marker.popup}</Popup>}
          </Marker>
        ))}
        <FitBounds points={fitPoints} fitKey={fitKey} />
        <FocusPoint point={focus} />
      </MapContainer>
    </div>
  );
}
