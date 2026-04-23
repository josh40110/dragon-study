import { useMemo } from 'react';

export default function PixelArt({ art, palette, pixelSize = 4, className = '' }) {
  const rows = useMemo(() => (Array.isArray(art) ? art : art.trim().split('\n')).map((r) => r.trim()), [art]);

  return (
    <div className={`relative ${className}`} style={{ width: rows[0].length * pixelSize, height: rows.length * pixelSize }}>
      {rows.flatMap((row, y) =>
        row.split('').map((char, x) => {
          if (char === '.' || char === ' ' || !palette[char]) return null;
          return (
            <div
              key={`${x}-${y}`}
              style={{
                position: 'absolute',
                left: x * pixelSize,
                top: y * pixelSize,
                width: pixelSize,
                height: pixelSize,
                backgroundColor: palette[char],
              }}
            />
          );
        }),
      )}
    </div>
  );
}
