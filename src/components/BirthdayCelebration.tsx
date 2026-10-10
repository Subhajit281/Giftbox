import React from 'react';

/** The greeting only. Confetti, fireworks, balloons and light all happen in 3D. */
export const BirthdayCelebration: React.FC<{ recipientName: string; leaving?: boolean }> = ({ recipientName, leaving }) => (
  <div className={`birthday-wish${leaving ? ' is-leaving' : ''} fixed inset-0 z-[45] pointer-events-none overflow-hidden`} aria-hidden="true">
    <div className="birthday-wish-message">
      <span>Made with all my love</span>
      <h2>Happy 20th Birthday</h2>
      <strong>{recipientName}</strong>
    </div>
  </div>
);
