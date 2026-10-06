import React, { useState } from 'react';
import { soundManager } from '../audio/SoundManager';
import confetti from 'canvas-confetti';
import { Sparkles, MessageCircle, RotateCcw, Heart, DoorOpen } from 'lucide-react';
import type { ExperienceConfig } from '../content/giftData';

interface FinalDoorModalProps {
  config: ExperienceConfig;
  doorOpened: boolean;
  onOpenDoor: () => void;
  onRestart: () => void;
}

export const FinalDoorModal: React.FC<FinalDoorModalProps> = ({
  config,
  doorOpened,
  onOpenDoor,
  onRestart,
}) => {
  const [opening, setOpening] = useState(false);

  const getWhatsAppUrl = () => {
    const cleanNumber = config.whatsappNumber.replace(/[^0-9]/g, '');
    const encodedMsg = encodeURIComponent(config.whatsappMessage);
    return `https://wa.me/${cleanNumber}?text=${encodedMsg}`;
  };

  const handleDoorClick = () => {
    if (doorOpened || opening) return;
    setOpening(true);
    soundManager.playDoorOpen();
    onOpenDoor();

    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.5 },
      colors: ['#ffd700', '#f78fb3', '#ffffff', '#e55039'],
    });

    // Auto-launch WhatsApp after door opens
    setTimeout(() => {
      window.open(getWhatsAppUrl(), '_blank');
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 pointer-events-none safe-top safe-bottom">
      {!doorOpened ? (
        /* Floating Cue over 3D Door */
        <div className="pointer-events-auto text-center animate-fade-in">
          <button
            onClick={handleDoorClick}
            className="group py-3 sm:py-4 px-5 sm:px-8 rounded-full glass-panel border-2 border-[#d4af37]/70 shadow-2xl hover:border-[#c59b27] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer flex items-center gap-2.5 sm:gap-3.5 bg-white/95 text-[#2e0b19]"
          >
            <DoorOpen className="w-7 h-7 text-[#c59b27] group-hover:rotate-12 transition-transform" />
            <div className="text-left">
              <span className="block text-[11px] uppercase tracking-widest text-[#8a1c35] font-bold">
                Someone is outside...
              </span>
              <span className="font-serif-luxury text-lg sm:text-2xl font-bold text-[#2e0b19]">
                Tap to Open
              </span>
            </div>
            <Sparkles className="w-5 h-5 text-[#c59b27] animate-pulse" />
          </button>
        </div>
      ) : (
        /* Final Reveal Screen after door swings open */
        <div className="glass-panel max-w-lg w-full p-5 sm:p-10 rounded-2xl sm:rounded-3xl border-2 border-[#d4af37]/50 shadow-2xl text-center pointer-events-auto animate-fade-in space-y-4 sm:space-y-6 bg-white/95 text-[#2e0b19]">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-[#ffe3e8] via-[#ffd0d9] to-[#fce4ba] border border-[#d4af37]/50 flex items-center justify-center text-4xl shadow-md animate-glow-pulse">
            <Heart className="w-10 h-10 text-[#8a1c35] fill-current animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#8a1c35] font-bold">
              Right Outside
            </span>
            <h2 className="font-serif-luxury text-2xl sm:text-4xl font-bold text-[#2e0b19]">
              I'm Waiting For You
            </h2>
            <p className="font-serif-luxury text-base sm:text-lg text-stone-700 italic leading-relaxed font-medium">
              "The gifts inside were just the beginning. The real surprise is outside waiting for you right now."
            </p>
          </div>

          <div className="pt-2 space-y-3">
            {/* Primary Action: Direct WhatsApp link */}
            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 rounded-2xl font-bold tracking-wide text-white bg-gradient-to-r from-[#25d366] via-[#20be5b] to-[#128c7e] hover:brightness-105 active:scale-95 transition-all shadow-xl shadow-green-600/25 flex items-center justify-center gap-3 cursor-pointer"
            >
              <MessageCircle className="w-6 h-6 fill-current text-white" />
              <span className="text-sm sm:text-lg">Talk with your love, {config.creatorName}</span>
            </a>

            {/* Replay action */}
            <button
              onClick={onRestart}
              className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#8a1c35]" />
              <span>Unwrap Everything Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
