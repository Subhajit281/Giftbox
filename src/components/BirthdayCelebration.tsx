import React, { useMemo } from 'react';

// Seeded RNG so the layout is random-looking but stable across re-renders
const makeRng = (seed: number) => () => {
  seed += 0x6d2b79f5;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const COLORS = ['#f8c7d5', '#f2cf77', '#c991ae', '#f6d38b', '#dda4bc', '#f2c15d', '#e58fa6', '#ffe3a1'];

export const BirthdayCelebration: React.FC<{ playing?: boolean }> = ({ playing = true }) => {
  const { balloons, sparkles } = useMemo(() => {
    const r = makeRng(20);

    const balloons = Array.from({ length: 22 }, (_, i) => ({
      color: COLORS[i % COLORS.length],
      bx: `${((r() * 2 - 1) * 44).toFixed(1)}vw`,          // burst x (from centre)
      by: `${-(22 + r() * 62).toFixed(1)}dvh`,             // burst height
      drift: `${((r() * 2 - 1) * 8).toFixed(1)}vw`,        // sideways drift while rising
      delay: `${(r() * 0.35).toFixed(2)}s`,
      dur: `${(7.2 + r() * 1.2).toFixed(2)}s`,
      size: (0.7 + r() * 0.55).toFixed(2),
      swayDur: `${(1.3 + r() * 1.1).toFixed(2)}s`,
      swayDeg: `${(8 + r() * 8).toFixed(1)}deg`,
      swayDelay: `${(-r() * 2).toFixed(2)}s`,
      extra: i >= 14, // hidden on small phones
    }));

    const sparkles = Array.from({ length: 80 }, (_, i) => ({
      sx: `${((r() * 2 - 1) * 48).toFixed(1)}vw`,
      sy: `${-(8 + r() * 88).toFixed(1)}dvh`,
      fd: `${((r() * 2 - 1) * 6).toFixed(1)}vw`,
      delay: `${(r() * 0.35).toFixed(2)}s`,
      
      // 9.0s → 10.2s
      dur: `${(9 + r() * 1.2).toFixed(2)}s`,
      
      size: `${(6 + r() * 10).toFixed(0)}px`,
      twinkle: `${(0.6 + r() * 0.8).toFixed(2)}s`,
      extra: i >= 48,
    }));

    return { balloons, sparkles };
  }, []);

  return (
        <div className={`birthday-celebration${playing ? '' : ' is-paused'} fixed inset-0 z-[35] pointer-events-none overflow-hidden`} aria-hidden="true">
      <div className="birthday-glow" />

      {sparkles.map((s, i) => (
        <i
          key={`s${i}`}
          className={`birthday-sparkle${s.extra ? ' birthday-sparkle--extra' : ''}`}
          style={{
            '--sx': s.sx, '--sy': s.sy, '--sfd': s.fd,
            '--sparkle-delay': s.delay, '--sparkle-dur': s.dur,
            '--sparkle-size': s.size, '--twinkle-dur': s.twinkle,
          } as React.CSSProperties}
        />
      ))}

      {balloons.map((b, i) => (
        <div
          key={`b${i}`}
          className={`birthday-balloon${b.extra ? ' birthday-balloon--extra' : ''}`}
          style={{
            '--balloon-color': b.color, '--balloon-size': b.size,
            '--bx': b.bx, '--by': b.by, '--bdrift': b.drift,
            '--balloon-delay': b.delay, '--balloon-dur': b.dur,
            '--sway-dur': b.swayDur, '--sway-deg': b.swayDeg, '--sway-delay': b.swayDelay,
          } as React.CSSProperties}
        >
          <div className="birthday-balloon-sway">
            <span className="birthday-balloon-body" />
            <span className="birthday-balloon-knot" />
            <span className="birthday-balloon-string" />
          </div>
        </div>
      ))}

      <div className="birthday-message">
        <span className="birthday-eyebrow">Made with all my love</span>
        <h2>
          <span className="birthday-title-line">Happy 20th Birthday</span>
          <span className="birthday-name">Diya</span>
        </h2>
        <p>May this year feel as magical as you are ✦</p>
      </div>
    </div>
  );
};