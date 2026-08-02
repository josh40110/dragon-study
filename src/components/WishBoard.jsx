import { useCallback, useMemo, useState } from 'react';
import { Check, Sparkles, Trash2 } from 'lucide-react';
import { updateRoom } from '../lib/roomStore';
import { createItemId } from '../constants/roomDefaults';

/** 全站 index.css 的 unlayered `p/span { white-space: nowrap }` 會壓過 utility class */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const ROLE_LABEL = { left: '呱呱', right: '花花' };

function formatStamp(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 舊資料或壞資料一律過濾掉，避免整頁炸掉 */
function normalizeWishes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w) => w && typeof w === 'object' && typeof w.text === 'string')
    .map((w) => ({
      id: String(w.id ?? ''),
      text: w.text,
      by: w.by === 'left' || w.by === 'right' ? w.by : null,
      createdAt: Number.isFinite(w.createdAt) ? w.createdAt : 0,
      done: Boolean(w.done),
      doneAt: Number.isFinite(w.doneAt) ? w.doneAt : null,
      doneBy: w.doneBy === 'left' || w.doneBy === 'right' ? w.doneBy : null,
    }))
    .filter((w) => w.id);
}

export default function WishBoard({ role, roomData }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const wishes = useMemo(() => normalizeWishes(roomData?.wishes), [roomData?.wishes]);

  const { pending, done } = useMemo(() => {
    const sorted = [...wishes];
    return {
      // 未完成：新的在上面，才看得到剛許的願
      pending: sorted.filter((w) => !w.done).sort((a, b) => b.createdAt - a.createdAt),
      // 已完成：最近完成的在上面
      done: sorted.filter((w) => w.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)),
    };
  }, [wishes]);

  const write = useCallback(async (nextWishes, label) => {
    setBusy(true);
    try {
      await updateRoom({ wishes: nextWishes }, { merge: true });
    } catch (err) {
      console.error(`${label}失敗:`, err);
    } finally {
      setBusy(false);
    }
  }, []);

  const handleAdd = useCallback(async () => {
    const clean = text.trim();
    if (!clean || !role) return;
    const wish = {
      id: createItemId(),
      text: clean,
      by: role,
      createdAt: Date.now(),
      done: false,
      doneAt: null,
      doneBy: null,
    };
    setText('');
    await write([...wishes, wish], '新增許願');
  }, [role, text, wishes, write]);

  const handleToggle = useCallback(
    async (wish) => {
      const next = wishes.map((w) =>
        w.id === wish.id
          ? { ...w, done: !w.done, doneAt: !w.done ? Date.now() : null, doneBy: !w.done ? role : null }
          : w,
      );
      await write(next, '更新許願狀態');
    },
    [role, wishes, write],
  );

  const handleDelete = useCallback(
    async (wish) => {
      await write(
        wishes.filter((w) => w.id !== wish.id),
        '刪除許願',
      );
    },
    [wishes, write],
  );

  const renderWish = (wish) => (
    <div
      key={wish.id}
      className={`flex items-start gap-3 rounded-2xl border-2 px-4 py-3 transition-colors ${
        wish.done ? 'border-[#e6dac1] bg-[#f3efe3]' : 'border-[#e6dac1] bg-[#f7f0e2]'
      }`}
    >
      <button
        onClick={() => handleToggle(wish)}
        disabled={busy}
        className={`mt-0.5 w-6 h-6 rounded-lg border-2 shrink-0 flex items-center justify-center transition-colors ${
          wish.done
            ? 'bg-[#16a34a] border-[#16a34a] text-white'
            : 'bg-[#fdf9f1] border-[#caa53f] hover:bg-[#fff7e3]'
        }`}
        title={wish.done ? '取消完成' : '標記完成'}
      >
        {wish.done && <Check size={14} strokeWidth={3} />}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`font-bold text-[15px] leading-snug ${wish.done ? 'text-[#9a8568] line-through' : 'text-[#4a3526]'}`}
          style={WRAP}
        >
          {wish.text}
        </p>
        <div className="text-[11px] text-[#b3a084] font-bold mt-1" style={WRAP}>
          {ROLE_LABEL[wish.by] || '某人'} 許於 {formatStamp(wish.createdAt)}
          {wish.done && wish.doneAt ? ` · ${ROLE_LABEL[wish.doneBy] || '某人'} 完成於 ${formatStamp(wish.doneAt)}` : ''}
        </div>
      </div>

      <button
        onClick={() => handleDelete(wish)}
        disabled={busy}
        className="p-2 rounded-xl text-[#c4b291] hover:text-[#c0392b] hover:bg-[#f3e9d6] transition-colors shrink-0"
        title="刪除"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_10px_0_#e0d3b6]">
        <h2 className="text-[#b07d0a] font-black text-2xl flex items-center gap-2">
          <Sparkles size={22} />
          許願池
        </h2>
        <p className="text-[#9a8568] font-bold text-sm mt-1" style={WRAP}>
          想到什麼還沒做的功能就丟進來，兩個人都看得到。做完了就打勾。
        </p>

        <div className="mt-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleAdd();
            }}
            placeholder="例如：想要能看每週的專注統計圖"
            className="flex-1 min-w-0 px-4 py-3 rounded-2xl border-2 border-[#e6dac1] bg-[#f7f0e2] text-[#4a3526] font-bold focus:outline-none focus:border-[#daa520] placeholder:text-[#c0ad8c]"
          />
          <button
            onClick={handleAdd}
            disabled={busy || !text.trim()}
            className="px-5 py-3 rounded-2xl bg-gradient-to-b from-[#f3c44e] to-[#dca01d] text-[#5a3c0e] font-black shadow-[0_6px_0_#a9760a] active:translate-y-1 active:shadow-[0_2px_0_#a9760a] transition-all disabled:opacity-50 disabled:shadow-none disabled:active:translate-y-0 shrink-0"
          >
            許願
          </button>
        </div>
      </section>

      <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-[#b07d0a] font-black text-lg">還沒實現</h3>
          <span className="text-[#9a8568] font-black text-sm">{pending.length} 個願望</span>
        </div>
        {pending.length === 0 ? (
          <p className="text-[#9a8568] font-bold text-center py-8" style={WRAP}>
            目前沒有待實現的願望，想到什麼就打在上面吧 ✨
          </p>
        ) : (
          <div className="space-y-2.5">{pending.map(renderWish)}</div>
        )}
      </section>

      {done.length > 0 && (
        <section className="bg-[#fdf9f1] border-4 border-[#e6dac1] rounded-[2rem] p-6 shadow-[0_8px_0_#e0d3b6]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-[#b07d0a] font-black text-lg">已經實現 🎉</h3>
            <span className="text-[#9a8568] font-black text-sm">{done.length} 個</span>
          </div>
          <div className="space-y-2.5">{done.map(renderWish)}</div>
        </section>
      )}
    </div>
  );
}
