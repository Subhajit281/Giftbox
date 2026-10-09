import React, { useState } from 'react';
import { soundManager } from '../audio/SoundManager';
import confetti from 'canvas-confetti';
import { Sparkles, DoorOpen } from 'lucide-react';

interface FinalDoorModalProps {
  doorOpened: boolean;
  onOpenDoor: () => void;
  eyebrow?: string;
  title?: string;
}

export const FinalDoorModal: React.FC<FinalDoorModalProps> = ({
  doorOpened,
  onOpenDoor,
  eyebrow = 'Someone is outside...',
  title = 'Tap to Open',
}) => {
  const [opening, setOpening] = useState(false);

  if (doorOpened) return null; // the story continues in the proposal room

  const handleDoorClick = () => {
    if (opening) return;
    setOpening(true);
    soundManager.playDoorOpen();
    onOpenDoor();
    confetti({
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
          className="premium-door-cta group py-3 sm:py-4 px-5 sm:px-8 rounded-full glass-panel border-2 border-[#d4af37]/70 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center gap-2.5 sm:gap-3.5 bg-white/95 text-[#2e0b19]"
        >
          <DoorOpen className="w-7 h-7 text-[#c59b27] group-hover:rotate-12 transition-transform" />
          <div className="text-left">
            <span className="block text-[11px] uppercase tracking-widest text-[#8a1c35] font-bold">
              {eyebrow}
            </span>
            <span className="font-serif-luxury text-lg sm:text-2xl font-bold text-[#2e0b19]">{title}</span>
          </div>
          <Sparkles className="w-5 h-5 text-[#c59b27] animate-pulse" />
        </button>
      </div>
    </div>
  );
};
