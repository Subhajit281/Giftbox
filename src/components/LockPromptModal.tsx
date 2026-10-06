import React, { useState } from 'react';
import { Lock, Sparkles, KeyRound } from 'lucide-react';
import { soundManager } from '../audio/SoundManager';

interface LockPromptModalProps {
  expectedName: string;
  onSuccess: () => void;
  onClose?: () => void;
}

export const LockPromptModal: React.FC<LockPromptModalProps> = ({
  expectedName,
  onSuccess,
}) => {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = inputVal.trim().toLowerCase();
    const cleanExpected = expectedName.trim().toLowerCase();

    if (
      cleanInput === cleanExpected ||
      cleanInput === 'Subhajit' ||
      cleanInput === 'subho' ||
      cleanInput === 'my love' ||
      cleanInput === 'you' ||
      cleanInput === 'subhajit'
    ) {
      setError(null);
      soundManager.playLockRelease();
      onSuccess();
    } else {
      soundManager.playLockError();
      setIsShaking(true);
      setError("That's not his name... think of the guy who made this for you! ❤️");
      setTimeout(() => setIsShaking(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-stone-900/30 backdrop-blur-sm pointer-events-auto animate-fade-in safe-top safe-bottom">
      <div
        className={`glass-panel max-w-sm w-full p-5 sm:p-8 rounded-3xl text-center relative border border-[#d4af37]/50 shadow-2xl bg-white/95 ${
          isShaking ? 'animate-lock-shake' : ''
        }`}
      >
        {/* Glowing Lock Emblem */}
        <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#fdf2f4] border border-[#d4af37]/60 flex items-center justify-center mb-4 sm:mb-6 shadow-md animate-glow-pulse">
          <Lock className="w-8 h-8 text-[#c59b27]" />
        </div>

        {/* Question Title */}
        <h2 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2e0b19] tracking-wide mb-1">
          A Sealed Gift Box
        </h2>
        <p className="font-serif-luxury italic text-base sm:text-lg text-[#8a1c35] mb-4 sm:mb-6">
          "Who is the guy you love?"
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => {
                setInputVal(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter his name..."
              className="w-full px-4 py-3 rounded-2xl bg-white border border-[#d4af37]/60 text-[#2e0b19] placeholder-stone-400 focus:outline-none focus:border-[#c59b27] focus:ring-2 focus:ring-[#d4af37]/30 text-center text-lg font-semibold transition duration-200 shadow-sm"
            />
            <KeyRound className="w-5 h-5 text-[#c59b27] absolute right-3.5 top-3.5 pointer-events-none" />
          </div>

          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 py-2 px-3 rounded-xl border border-rose-200 font-medium">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3.5 px-6 rounded-2xl font-bold tracking-wide text-[#2e0b19] bg-gradient-to-r from-[#d4af37] via-[#f3e5ab] to-[#d4af37] hover:brightness-105 active:scale-[0.98] transition-all duration-200 shadow-lg shadow-[#d4af37]/25 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#8a1c35]" />
            <span>Unlock My Gift</span>
          </button>
        </form>

        <p className="text-[11px] text-stone-500 mt-4 font-sans tracking-wide">
          Normalized for spelling & whitespace
        </p>
      </div>
    </div>
  );
};
