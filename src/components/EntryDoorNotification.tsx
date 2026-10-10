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
      <div
        role="status"
        aria-label={`Notification from ${senderName}, just now: ${message}`}
        className="welcome-notification glass-panel max-w-sm w-full p-2.5 sm:p-3 rounded-2xl border border-[#f2d48b]/55 flex items-start gap-2.5 text-[#2e0b19]"
      >
        <div className="relative w-10 h-10 shrink-0 rounded-full bg-gradient-to-br from-[#9a2948] via-[#702038] to-[#351522] border border-[#d4af37]/70 flex items-center justify-center shadow-md">
          <span className="font-serif-luxury text-base font-bold text-[#fff3d5]">{senderName.trim().charAt(0).toUpperCase()}</span>
          <span className="absolute -right-0.5 -bottom-0.5 w-4 h-4 rounded-full bg-[#fff8e9] border border-[#d4af37]/70 flex items-center justify-center">
            <Heart className="w-2.5 h-2.5 text-[#8a1c35] fill-current" />
          </span>
        </div>
        <div className="min-w-0 text-left">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="text-xs font-bold text-[#2e0b19]">{senderName}</span>
            <span aria-hidden="true" className="text-[10px] text-[#a87a19]">•</span>
            <span className="text-[10px] font-medium text-stone-500">Just now</span>
          </div>
          <p className="font-serif-luxury text-[11px] sm:text-xs font-semibold leading-snug mt-1">“{message}”</p>
        </div>
      </div>
    </div>
  );
};
