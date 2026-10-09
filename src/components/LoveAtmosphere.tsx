import React from 'react';

/**
 * A deliberately small, CSS-only layer that adds a cinematic love-story finish
 * without adding a second canvas, timers, or a particle engine on mobile.
 */
export const LoveAtmosphere: React.FC = () => (
  <div className="love-atmosphere" aria-hidden="true">
    <span className="love-glint love-glint--one">✦</span>
    <span className="love-glint love-glint--two">✦</span>
    <span className="love-glint love-glint--three">♥</span>
  </div>
);
