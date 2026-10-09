import React, { useMemo } from 'react';

const makeRng = (seed: number) => () => {
  seed += 0x6d2b79f5;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** A focused three-second wish moment, deliberately light enough for phones. */
export const BirthdayCelebration: React.FC<{ recipientName: string }> = ({ recipientName }) => {
  const sparkles = useMemo(() => {
    const random = makeRng(20);
    return Array.from({ length: 42 }, (_, index) => ({
      x: `${((random() * 2 - 1) * 46).toFixed(1)}vw`,
      height: `${(48 + random() * 56).toFixed(1)}dvh`,
      drift: `${((random() * 2 - 1) * 9).toFixed(1)}vw`,
      delay: `${(random() * 0.35).toFixed(2)}s`,
      size: `${(5 + random() * 9).toFixed(0)}px`,
      extra: index > 27,
    }));
  }, []);

  return (
    <div className="birthday-wish fixed inset-0 z-[45] pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="birthday-wish-glow" />
      {sparkles.map((sparkle, index) => (
        <i
          key={index}
          className={`wish-sparkle${sparkle.extra ? ' wish-sparkle--extra' : ''}`}
          style={{
            '--wish-x': sparkle.x,
            '--wish-height': sparkle.height,
            '--wish-drift': sparkle.drift,
            '--wish-delay': sparkle.delay,
            '--wish-size': sparkle.size,
          } as React.CSSProperties}
        />
      ))}
      <div className="birthday-wish-message">
        <span>Made with all my love</span>
        <h2>Happy 20th Birthday</h2>
        <strong>{recipientName}</strong>
      </div>
    </div>
  );
};
