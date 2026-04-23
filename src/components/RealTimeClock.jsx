import { useEffect, useState } from 'react';

export default function RealTimeClock() {
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
          <rect key={i} x="48.5" y="6" width="3" height={i % 3 === 0 ? '10' : '5'} fill="#3e2723" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <rect x="47" y="25" width="6" height="25" rx="3" fill="#2c1d1a" transform={`rotate(${h} 50 50)`} />
        <rect x="48" y="12" width="4" height="38" rx="2" fill="#3e2723" transform={`rotate(${m} 50 50)`} />
        <line x1="50" y1="50" x2="50" y2="10" stroke="#b91c1c" strokeWidth="2" transform={`rotate(${s} 50 50)`} />
        <circle cx="50" cy="50" r="4.5" fill="#5d4037" />
        <circle cx="50" cy="50" r="2" fill="#fbbf24" />
      </svg>
    </div>
  );
}
