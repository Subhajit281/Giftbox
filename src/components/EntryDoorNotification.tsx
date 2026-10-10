import React, { useEffect } from 'react';
import { Heart } from 'lucide-react';
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
    <div className="fixed top-[max(0.5rem,env(safe-area-inset-top))] inset-x-0 z-50 flex justify-center px-3 pointer-events-none animate-fade-in">
      <div aria-label={`A birthday invitation from ${senderName}: ${message}`} className="welcome-notification glass-panel max-w-sm w-full p-1.5 sm:p-2 rounded-xl border border-[#f2d48b]/45 flex items-center gap-2 text-[#2e0b19]">
        <div className="w-7 h-7 shrink-0 rounded-lg bg-gradient-to-br from-[#fff0f3] to-[#fde2e7] border border-[#d4af37]/60 flex items-center justify-center shadow-sm">
          <Heart className="w-4 h-4 text-[#8a1c35] fill-current" />
        </div>
        <div className="min-w-0 text-left">
          <p className="font-serif-luxury text-[11px] sm:text-xs font-bold leading-tight">“{message}”</p>
        </div>
      </div>
    </div>
  );
};
