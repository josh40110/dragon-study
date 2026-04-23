import { useEffect, useState } from 'react';
import { PALETTES, SPRITES } from '../constants/pixelArtData';
import PixelArt from './PixelArt';

export default function RunningDragonIcon() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % 2), 150);
    return () => clearInterval(timer);
  }, []);

  const sprite = frame === 0 ? SPRITES.dragonRun1 : SPRITES.dragonRun2;

  return (
    <div className="w-12 h-12 bg-[#8b1a1a] rounded-xl border-2 border-black shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center overflow-hidden">
      <PixelArt
        art={sprite}
        palette={PALETTES.dragon}
        pixelSize={2}
        className={`transition-transform duration-75 ${frame === 0 ? 'translate-y-[2px]' : '-translate-y-[1px]'}`}
      />
    </div>
  );
}
