import React, { useState } from 'react';
import { soundManager } from '../audio/SoundManager';
import confetti from 'canvas-confetti';
import { Sparkles, DoorOpen } from 'lucide-react';

interface FinalDoorModalProps {
  doorOpened: boolean;
  onOpenDoor: () => void;
  eyebrow?: string;
  title?: string;
  /** Fire the 2D confetti burst on tap (kept for the final door only). */
  burst?: boolean;
}

export const FinalDoorModal: React.FC<FinalDoorModalProps> = ({
  doorOpened,
  onOpenDoor,
  eyebrow = 'Someone is outside...',
  title = 'Tap to Open',
  burst = true,
}) => {
  const [opening, setOpening] = useState(false);

  if (doorOpened) return null; // the story continues in the proposal room

  const handleDoorClick = () => {
    if (opening) return;
    setOpening(true);
    soundManager.playDoorOpen();
    onOpenDoor();
    if (burst) confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#ffd700', '#f78fb3', '#ffffff', '#e55039'],
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 pointer-events-none safe-top safe-bottom">
      <div className="pointer-events-auto text-center animate-fade-in">
        <button
          onClick={handleDoorClick}
          className="door-invitation premium-door-cta group py-2.5 sm:py-3 px-4 sm:px-5 rounded-2xl glass-panel shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 cursor-pointer flex items-center gap-2.5 sm:gap-3 text-[#2e0b19]"
        >
          <DoorOpen className="w-6 h-6 shrink-0 text-[#b28b52] group-hover:translate-x-0.5 transition-transform" />
          <div className="text-left">
            <span className="block text-[10px] uppercase tracking-[0.16em] text-[#8a1c35] font-bold">
              {eyebrow}
            </span>
            <span className="font-serif-luxury text-base sm:text-lg font-semibold text-[#2e0b19]">{title}</span>
          </div>
          <Sparkles className="w-4 h-4 shrink-0 text-[#b28b52]" />
        </button>
      </div>
    </div>
  );
};
