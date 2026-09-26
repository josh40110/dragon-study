/** textarea 不受全站 nowrap 影響，但長字串仍要能斷行 */
const WRAP = { whiteSpace: 'normal', overflowWrap: 'anywhere' };

const SHARED =
  'w-full min-w-0 rounded-xl border-2 px-2 py-1 placeholder:text-[#c0ad8c] ' +
  'focus:border-[#daa520] focus:bg-[#fdf9f1] focus:outline-none transition-colors';

/** 顏色、字級整組換，避免同一個屬性的 class 互相打架 */
const TONES = {
  plain: 'border-transparent bg-transparent hover:border-[#e6dac1] font-bold text-[#4a3526]',
  boxed: 'border-dashed border-[#e0d3b6] bg-[#fdf9f1]/70 hover:border-[#daa520] font-bold text-[12px] text-[#6b5540]',
  title: 'border-transparent bg-transparent hover:border-[#e6dac1] font-black text-2xl md:text-3xl text-[#4a3526]',
};

/**
 * 看起來像文字、點了就能改的欄位。失焦或按 Enter 才寫入，打字過程不會一直送 Firestore。
 * 用 key={value} 讓對方改了同一格時重新帶入最新內容。
 */
export default function TripEditableText({
  value,
  placeholder,
  onSave,
  multiline = false,
  tone = 'plain',
  className = '',
  label,
  autoFocus = false,
  onDone,
}) {
  const current = value || '';
  const classes = `${SHARED} ${TONES[tone] || TONES.plain} ${className}`;

  const commit = (e) => {
    const next = e.target.value.trim();
    if (next !== current.trim()) onSave(next);
    onDone?.();
  };

  const handleKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.currentTarget.value = current;
      e.currentTarget.blur();
    }
  };

  if (multiline) {
    return (
      <textarea
        key={current}
        defaultValue={current}
        placeholder={placeholder}
        aria-label={label || placeholder}
        rows={2}
        autoFocus={autoFocus}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`${classes} resize-none leading-snug`}
        style={WRAP}
      />
    );
  }

  return (
    <input
      key={current}
      defaultValue={current}
      placeholder={placeholder}
      aria-label={label || placeholder}
      autoFocus={autoFocus}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      className={classes}
    />
  );
}
