import React, { useEffect } from 'react';
import { soundManager } from '../audio/SoundManager';
import { Heart } from 'lucide-react';

interface FakeNotificationProps {
  senderName: string;
  onDismiss: () => void;
}

export const FakeNotification: React.FC<FakeNotificationProps> = ({
  senderName,
  onDismiss,
}) => {
  useEffect(() => {
    soundManager.playNotificationPing();
    const timer = setTimeout(() => {
      onDismiss();
    }, 6000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-[max(1.5rem,env(safe-area-inset-top))] inset-x-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-auto">
      <div
        onClick={onDismiss}
        className="glass-panel max-w-md w-full p-3 sm:p-4 rounded-2xl sm:rounded-3xl border-2 border-[#d4af37]/60 shadow-2xl flex items-start gap-3 cursor-pointer transform transition hover:scale-[1.02] active:scale-[0.98] bg-white/95 text-[#2e0b19]"
      >
        {/* Sender Icon */}
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#fff0f3] to-[#fde2e7] border border-[#d4af37]/60 flex items-center justify-center shrink-0 shadow-sm">
          <Heart className="w-5 h-5 text-[#8a1c35] fill-current" />
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#2e0b19] flex items-center gap-1.5">
              <span>{senderName}</span>
              <span className="text-[10px] text-[#c59b27] font-semibold tracking-wide">
                • Just now
              </span>
            </span>
            <span className="text-[10px] uppercase font-mono text-stone-500 font-bold">
              In-Game
            </span>
          </div>

          <p className="font-serif-luxury text-base text-[#2e0b19] mt-1 font-bold leading-snug">
            "Knock, knock… If you're done unwrapping, your guy is waiting to see you outside..."
          </p>

          <span className="text-xs text-[#8a1c35] mt-1.5 block font-semibold">
            Tap notification to proceed ✨
          </span>
        </div>
      </div>
    </div>
  );
};
