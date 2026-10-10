import React, { useEffect, useState } from 'react';

export type CeremonyPhase = 'countdown' | 'wish' | 'cutting' | 'celebrate';

interface BirthdayCeremonyProps {
  phase: CeremonyPhase;
  onCountdownComplete: () => void;
}

export const BIRTHDAY_COUNTDOWN_SECONDS = 10;
const RING = 2 * Math.PI * 21;

/** Captions and the timer only. The cake, candle and knife are all real 3D in the scene. */
export const BirthdayCeremony: React.FC<BirthdayCeremonyProps> = ({ phase, onCountdownComplete }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const startedAt = performance.now();
    let done = false;
    const timer = window.setInterval(() => {
      const t = (performance.now() - startedAt) / 1000;
      setElapsed(Math.min(BIRTHDAY_COUNTDOWN_SECONDS, t));
      if (t >= BIRTHDAY_COUNTDOWN_SECONDS && !done) {
        done = true;
        window.clearInterval(timer);
        onCountdownComplete();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, onCountdownComplete]);

  if (phase === 'celebrate') return null;

  const secondsLeft = Math.max(0, Math.ceil(BIRTHDAY_COUNTDOWN_SECONDS - elapsed));

  return (
    <div className="birthday-ceremony fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-start safe-top" aria-live="polite">
      <div className="birthday-countdown-card text-center mt-2 sm:mt-10 px-4 py-4 sm:py-5">
        {phase === 'countdown' ? (
          <>
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.24em] text-[#ffe2a2] font-bold">A moment just for you</p>
            <p className="font-serif-luxury text-lg sm:text-2xl font-semibold text-white drop-shadow-lg">Make a wish, my love</p>
            <p className="mt-1 text-xs sm:text-sm text-[#fff3d5]">Ready, my love? Blow at zero.</p>
            <div className="countdown-ring" role="timer">
              <svg viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r="21" className="countdown-ring-track" />
                <circle
                  cx="24" cy="24" r="21"
                  className="countdown-ring-fill"
                  strokeDasharray={RING}
                  strokeDashoffset={RING * (elapsed / BIRTHDAY_COUNTDOWN_SECONDS)}
                />
              </svg>
              <span>{secondsLeft}</span>
            </div>
            <p className="mt-1 text-[10px] uppercase tracking-[0.22em] text-[#ffe2a2]/85">seconds to your wish</p>
          </>
        ) : phase === 'wish' ? (
          <p className="font-serif-luxury text-xl sm:text-3xl font-bold text-[#fff0c8] drop-shadow-lg">Your wish is on its way ✦</p>
        ) : (
          <p className="font-serif-luxury text-xl sm:text-3xl font-bold text-[#fff0c8] drop-shadow-lg">Saving you the sweetest slice…</p>
        )}
      </div>
    </div>
  );
};
