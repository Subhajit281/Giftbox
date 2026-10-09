import React, { useEffect } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface EntryDoorNotificationProps {
  senderName: string;
  message: string;
}

/** A persistent note: it intentionally stays visible until the door is opened. */
export const EntryDoorNotification: React.FC<EntryDoorNotificationProps> = ({ senderName, message }) => {
  useEffect(() => {
    soundManager.playNotificationPing();
  }, []);

  return (
    <div className="fixed top-[max(1rem,env(safe-area-inset-top))] inset-x-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-none animate-fade-in">
      <div className="welcome-notification glass-panel max-w-md w-full p-3 sm:p-4 rounded-2xl border border-[#f2d48b]/70 flex items-start gap-3 text-[#2e0b19]">
        <div className="w-10 h-10 shrink-0 rounded-2xl bg-gradient-to-br from-[#fff0f3] to-[#fde2e7] border border-[#d4af37]/60 flex items-center justify-center shadow-sm">
          <Heart className="w-5 h-5 text-[#8a1c35] fill-current" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-xs font-bold text-[#2e0b19] flex items-center gap-1.5">
            {senderName} <span className="text-[#c59b27]">• Just now</span>
          </p>
          <p className="font-serif-luxury text-base sm:text-lg font-bold leading-snug mt-0.5">“{message}”</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-[#8a1c35] font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-[#c59b27]" /> Your surprise is waiting.
          </p>
        </div>
      </div>
    </div>
  );
};
