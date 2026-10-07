import React, { useEffect, useRef, useState } from 'react';

type Who = 'boy' | 'girl';

interface Props {
  phase: 'ask' | 'answer';
  getAnchor: (who: Who) => { x: number; y: number } | null;
  onAnswer: () => void;
}

export const ProposalOverlay: React.FC<Props> = ({ phase, getAnchor, onAnswer }) => {
  const boyRef = useRef<HTMLDivElement>(null);
  const girlRef = useRef<HTMLDivElement>(null);
  const [answered, setAnswered] = useState(false);

  // Follow the 3D heads every frame, writing straight to the DOM (no React re-renders).
  useEffect(() => {
    let raf = 0;
    const place = (el: HTMLDivElement | null, who: Who) => {
      if (!el) return;
      const a = getAnchor(who);
      if (!a) {
        el.style.visibility = 'hidden';
        return;
      }
      const half = el.offsetWidth / 2 + 8;
      const x = Math.min(Math.max(a.x, half), window.innerWidth - half);
      const y = Math.max(a.y, el.offsetHeight + 12);
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      el.style.visibility = 'visible';
    };
    const loop = () => {
      place(boyRef.current, 'boy');
      place(girlRef.current, 'girl');
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, getAnchor]);

  const choose = () => {
    if (answered) return;
    setAnswered(true);
    onAnswer();
  };

  return (
    <div className="fixed inset-0 z-30 pointer-events-none">
      {phase === 'ask' && (
        <div ref={boyRef} style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden' }}>
          <div className="chat-bubble bubble-pop">I LOVE YOU SO MUCHHH, DIYA🌹</div>
        </div>
      )}

      {phase === 'answer' && (
        <div
          ref={girlRef}
          style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'auto' }}
        >
          <div className="chat-bubble bubble-pop">
            <div className="bubble-actions">
              <button className="bubble-btn" disabled={answered} onClick={choose}>
                I LOVE YOU TOOOOO, SUBHAJIT🥺💖
              </button>
              <button className="bubble-btn bubble-btn-gold" disabled={answered} onClick={choose}>
                LOVE YOU SOOO MUCHHH BABY🥰🥰😭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};