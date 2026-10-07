import React, { useEffect } from 'react';
import { Heart } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface Props {
  senderName: string;
  onOpen: () => void;
}

export const ProposalNotification: React.FC<Props> = ({ senderName, onOpen }) => {
  useEffect(() => {
    soundManager.playNotificationPing();
  }, []);

  return (
    <div className="fixed top-[max(1.5rem,env(safe-area-inset-top))] inset-x-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-auto animate-fade-in">
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
        className="glass-panel max-w-md w-full p-3 sm:p-4 rounded-2xl border-2 border-[#d4af37]/60 shadow-2xl flex items-start gap-3 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition bg-white/95 text-[#2e0b19]"
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#fff0f3] to-[#fde2e7] border border-[#d4af37]/60 flex items-center justify-center shrink-0">
          <Heart className="w-5 h-5 text-[#8a1c35] fill-current animate-pulse" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <span className="text-xs font-bold flex items-center gap-1.5">
            <span>{senderName}</span>
            <span className="text-[10px] text-[#c59b27] font-semibold">• Just now</span>
          </span>
          <p className="font-serif-luxury text-base font-bold leading-snug mt-1">
            "Heylloo darling! If you liked it then talk to me now, by clicking the notification 🥺💌"
          </p>
          <span className="text-xs text-[#8a1c35] mt-1.5 block font-semibold">Tap to see ✨</span>
        </div>
      </div>
    </div>
  );
};