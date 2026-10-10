import React from 'react';
import { Volume2, VolumeX, ShoppingBag, Sparkles, Heart, Rotate3D, Settings } from 'lucide-react';
import type { ExperienceState } from '../state/ExperienceState';
import type { GiftItem } from '../content/giftData';

interface ExperienceHUDProps {
  currentState: ExperienceState;
  gifts: GiftItem[];
  isAudioMuted: boolean;
  onToggleMute: () => void;
  onOpenSettings: () => void;
}

export const ExperienceHUD: React.FC<ExperienceHUDProps> = ({
  currentState,
  gifts,
  isAudioMuted,
  onToggleMute,
  onOpenSettings,
}) => {
  const collectedCount = gifts.filter((g) => g.isCollected).length;
  const totalCount = gifts.length;

  return (
    <div className="fixed inset-0 pointer-events-none z-30 flex flex-col justify-between p-2 sm:p-3 md:p-5 safe-top safe-bottom">
      {/* Top Section */}
      <div className="flex flex-col items-center w-full gap-1.5 sm:gap-2">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between w-full">
          {/* Audio Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
            <button
              onClick={onOpenSettings}
              aria-label="Personalize your messages"
              title="Personalize your messages"
              className="p-2 sm:p-2.5 rounded-full glass-pill hover:bg-rose-50 text-[#3b0a1a] transition cursor-pointer shadow-md active:scale-95 border border-[#d4af37]/40"
            >
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#c59b27]" />
            </button>
            <button
              onClick={onToggleMute}
              aria-label="Toggle SFX Mute"
              className="p-2 sm:p-2.5 rounded-full glass-pill hover:bg-rose-50 text-[#3b0a1a] transition cursor-pointer shadow-md active:scale-95 border border-[#d4af37]/40"
              title={isAudioMuted ? 'Unmute Sound Effects' : 'Mute Sound Effects'}
            >
              {isAudioMuted ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#c59b27]" />}
            </button>
          </div>

          <div className="w-8 sm:w-9" aria-hidden="true" />
        </div>

        {/* Narrative Instruction Banner: Positioned prominently at TOP of page */}
        {(currentState === 'BOX_OPEN' || currentState === 'GIFT_SELECTION') && (
          <div className="text-center pointer-events-auto animate-fade-in mt-0.5 sm:-mt-2">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 glass-pill py-1.5 sm:py-2 px-1 sm:px-2 md:px-3 rounded-full border border-[#f2d48b]/70 shadow-[0_10px_30px_rgba(28,4,15,0.24)] bg-[#fffdf9]/90 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#c59b27] shrink-0 animate-pulse" />
              <p className="font-serif-luxury text-xs sm:text-sm md:text-base font-semibold text-[#3b0a1a] italic tracking-wide">
                "I tucked a few little surprises inside for you."
              </p>
              <Heart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#c16e7d] fill-current shrink-0" />
            </div>
            
            {/* Swipe instruction */} 
            <p className="font-serif-luxury text-xs sm:text-sm md:text-base font-semibold text-[#ffffff] italic tracking-wide">
              Gently swipe to explore your surprises
            </p>
          </div>
        )}
      </div>

      {(currentState === 'BOX_OPEN' || currentState === 'GIFT_SELECTION' || currentState === 'GIFT_COMPLETED') && (
        <div className="absolute left-1/2 bottom-24 -translate-x-1/2 sm:bottom-28 pointer-events-none md:hidden">
          <div className="glass-pill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wide text-[#54112b] whitespace-nowrap">
            <Rotate3D className="h-3.5 w-3.5 text-[#c59b27]" />
            Swipe to explore the keepsake
          </div>
        </div>
      )}

      {/* Bottom Bar: discreet progress only — the gifts remain a surprise. */}
      <div className="flex flex-col items-center w-full pointer-events-auto">
        {(currentState === 'BOX_OPEN' ||
          currentState === 'GIFT_SELECTION' ||
          currentState === 'GIFT_OPENING' ||
          currentState === 'GIFT_CONTENT' ||
          currentState === 'GIFT_COMPLETED' ||
          currentState === 'COLLECTING' ||
          currentState === 'ALL_GIFTS_COMPLETED') && (
          <div className="glass-pill py-2 px-3.5 sm:px-5 rounded-full border border-[#f2d48b]/60 shadow-[0_10px_28px_rgba(28,4,15,0.22)] flex items-center gap-2.5 sm:gap-3 bg-[#fffdf9]/92">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#fff6db] to-[#f5ddb0] border border-[#d4af37]/55 flex items-center justify-center text-[#c59b27] shadow-inner">
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8a1c35]" />
            </div>
            <div className="text-left">
              <span className="block text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-[#a87a19] font-bold">
                Private collection
              </span>
              <span className="font-serif-luxury text-xs sm:text-sm font-bold text-[#2e0b19]">
                {collectedCount} of {totalCount} collected
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
