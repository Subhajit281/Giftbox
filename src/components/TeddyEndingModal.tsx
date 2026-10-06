import React, { useState } from 'react';
import { soundManager } from '../audio/SoundManager';
import { Sparkles, Heart } from 'lucide-react';

interface TeddyEndingModalProps {
  onTeddyDecided: () => void;
}

export const TeddyEndingModal: React.FC<TeddyEndingModalProps> = ({
  onTeddyDecided,
}) => {
  const [step, setStep] = useState<'asking' | 'spared'>('asking');

  const handleDecision = () => {
    soundManager.playTeddyStep();
    setStep('spared');

    // Teddy smiles, keeps items there, and walks away
    setTimeout(() => {
      soundManager.playTeddyStep();
      onTeddyDecided();
    }, 4500);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 sm:p-6 pointer-events-none">
      <div className="glass-panel max-w-md w-full p-5 sm:p-8 rounded-2xl sm:rounded-3xl border border-[#d4af37]/50 shadow-2xl pointer-events-auto animate-fade-in text-center relative mb-2 sm:mb-0 bg-white/95 text-[#2e0b19]">
        {/* Cute Floating Teddy Emblem */}
        <div className="w-20 h-20 mx-auto -mt-14 mb-3 rounded-full bg-gradient-to-br from-[#f5d5be] via-[#dfb08c] to-[#c48652] border-2 border-[#d4af37] flex items-center justify-center text-4xl shadow-xl animate-float-gentle">
          🧸
        </div>

        {step === 'asking' ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs uppercase tracking-widest text-[#8a1c35] font-bold">
                Cute Threat Detected 🧸
              </span>
              <h3 className="font-serif-luxury text-2xl font-bold text-[#2e0b19]">
                "Should I take it all away?"
              </h3>
            </div>

            <p className="font-serif-luxury text-lg italic text-stone-700 leading-relaxed font-medium">
              "You opened all the treasures! They look so cute in this bin. Should I take them all away? 🥺"
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleDecision}
                className="py-3 px-4 rounded-2xl font-bold text-sm text-[#8a1c35] bg-[#fff0f3] hover:bg-[#fde2e7] border border-[#d4af37]/45 transition active:scale-95 cursor-pointer shadow-sm"
              >
                Nooo! 🥺
              </button>
              <button
                onClick={handleDecision}
                className="py-3 px-4 rounded-2xl font-bold text-sm text-[#2e0b19] bg-gradient-to-r from-[#d4af37] to-[#f3e5ab] hover:brightness-105 transition active:scale-95 cursor-pointer shadow-md"
              >
                Definitely not! 😤
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2 animate-fade-in">
            <span className="text-xs uppercase tracking-widest text-[#8a1c35] font-bold flex items-center justify-center gap-1.5">
              <span>Teddy is smiling warmly</span>
              <Heart className="w-3.5 h-3.5 text-[#c16e7d] fill-current" />
            </span>
            <h3 className="font-serif-luxury text-2xl font-bold text-[#2e0b19]">
                "Oh, so you're in love with him..."
            </h3>
            <p className="font-serif-luxury text-lg italic text-stone-700 leading-relaxed font-medium">
                "Okay, I am keeping all of these for you then! 🥰 Look how happy you are!"
            </p>
            <div className="text-xs text-[#8a1c35] flex items-center justify-center gap-1.5 pt-2 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-[#c59b27]" />
              <span>Teddy pats the bin and waddles away happily...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
