import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export type CeremonyPhase = 'countdown' | 'wish' | 'cutting';

interface BirthdayCeremonyProps {
  phase: CeremonyPhase;
  onCountdownComplete: () => void;
}

const COUNTDOWN_SECONDS = 8;

export const BirthdayCeremony: React.FC<BirthdayCeremonyProps> = ({ phase, onCountdownComplete }) => {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [showPhoto, setShowPhoto] = useState(true);

  useEffect(() => {
    if (phase !== 'countdown') return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const left = Math.max(0, COUNTDOWN_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        window.clearInterval(timer);
        onCountdownComplete();
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase, onCountdownComplete]);

  const isBlown = phase === 'wish' || phase === 'cutting';

  return (
    <div className="birthday-ceremony fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-end safe-bottom" aria-live="polite">
      <div className="birthday-countdown text-center mb-3 sm:mb-5 px-4">
        {phase === 'countdown' ? (
          <>
            <p className="text-[11px] sm:text-xs uppercase tracking-[0.24em] text-[#ffe2a2] font-bold">Make a wish</p>
            <p className="font-serif-luxury text-xl sm:text-3xl font-bold text-white drop-shadow-lg">Blow the candle after the timer ends</p>
            <span className="countdown-number">{secondsLeft}</span>
          </>
        ) : phase === 'wish' ? (
          <p className="font-serif-luxury text-xl sm:text-3xl font-bold text-[#fff0c8] drop-shadow-lg">Your wish is on its way ✦</p>
        ) : (
          <p className="font-serif-luxury text-xl sm:text-3xl font-bold text-[#fff0c8] drop-shadow-lg">Saving you the sweetest slice…</p>
        )}
      </div>

      <div className={`cake-scene ${phase === 'cutting' ? 'is-cutting' : ''}`}>
        <div className="cake-glow" />
        <div className="candle" aria-hidden="true">
          <span className={`candle-flame ${isBlown ? 'is-blown' : ''}`} />
          <span className="candle-wick" />
          <span className="candle-body" />
        </div>

        <div className="cake-photo-frame">
          {showPhoto ? (
            <img src="/cake.png" alt="Birthday cake" onError={() => setShowPhoto(false)} />
          ) : (
            <div className="cake-fallback" aria-label="Birthday cake illustration">
              <span className="cake-cherry">♥</span>
              <span className="cake-frosting" />
              <span className="cake-layer cake-layer--one" />
              <span className="cake-layer cake-layer--two" />
              <span className="cake-plate" />
            </div>
          )}
        </div>
        <div className="cake-knife" aria-hidden="true"><span /></div>
        <div className="cake-slice" aria-hidden="true" />
      </div>
      <p className="birthday-cake-caption"><Sparkles className="w-3.5 h-3.5" /> Made especially for you <Sparkles className="w-3.5 h-3.5" /></p>
    </div>
  );
};
