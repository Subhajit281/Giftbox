import React, { useState, useEffect } from 'react';
import type { GiftItem, ExperienceConfig, LetterCard } from '../content/giftData';
import { soundManager } from '../audio/SoundManager';
import confetti from 'canvas-confetti';
import {
  Play,
  Pause,
  Sparkles,
  Heart,
  Music,
  CheckCircle2,
  X,
  Compass,
  KeyRound,
} from 'lucide-react';

interface GiftRevealModalProps {
  gift: GiftItem;
  config: ExperienceConfig;
  onCollect: () => void;
  onClose: () => void;
}

export const GiftRevealModal: React.FC<GiftRevealModalProps> = ({
  gift,
  config,
  onCollect,
  onClose,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isPhotoFlipped, setIsPhotoFlipped] = useState(false);
  const [musicNoteIndex, setMusicNoteIndex] = useState(0);
  const [letterIndex, setLetterIndex] = useState(0);
  const [letterDirection, setLetterDirection] = useState<'next' | 'previous'>('next');
  const touchStartX = React.useRef<number | null>(null);

  const letters: LetterCard[] = gift.content.letters || [];
  const activeLetter = letters[letterIndex];

  const showLetter = (nextIndex: number) => {
    if (!letters.length || nextIndex < 0 || nextIndex >= letters.length) return;
    setLetterDirection(nextIndex > letterIndex ? 'next' : 'previous');
    setLetterIndex(nextIndex);
    soundManager.playPaperRustle();
  };

  // Trigger reveal action
  const handleReveal = () => {
    switch (gift.type) {
      case 'wrapped':
        soundManager.playRibbonUntie();
        setTimeout(() => soundManager.playChimeReveal(), 300);
        break;
      case 'letter':
        soundManager.playSealBreak();
        break;
      case 'letters':
        soundManager.playSealBreak();
        soundManager.playPlaylist('giftOpen');
        break;
      case 'voice':
        soundManager.playPhotoSlide();
        break;
      case 'song':
        soundManager.playChimeReveal();
        break;
      case 'photos':
        soundManager.playPhotoSlide();
        break;
      case 'interest':
      case 'secret':
        soundManager.playChimeReveal();
        break;
    }

    confetti({
      particleCount: 50,
      spread: 65,
      origin: { y: 0.6 },
      colors: ['#d4af37', '#e2a9b0', '#ffffff', '#8a2846'],
    });

    setIsRevealed(true);
  };

  // Cassette / Voice Note player simulation
  useEffect(() => {
    let interval: number;
    if (isPlayingAudio) {
      interval = window.setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 100) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 3;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  const toggleVoiceNote = () => {
    if (!isPlayingAudio) {
      soundManager.playPhotoSlide();
      setIsPlayingAudio(true);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(config.voiceNoteTranscript);
        utterance.rate = 0.9;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } else {
      setIsPlayingAudio(false);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  };

  // Music Box Melody playback
  const playNextMusicBoxNote = () => {
    const melody = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const freq = melody[musicNoteIndex % melody.length];
    soundManager.playMusicBoxNote(freq, 0.9);
    setMusicNoteIndex((prev) => prev + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-stone-900/35 backdrop-blur-md overflow-y-auto pointer-events-auto safe-top safe-bottom">
      <div className="glass-panel max-w-xl w-full rounded-2xl sm:rounded-3xl p-4 sm:p-8 relative border border-[#d4af37]/50 shadow-2xl flex flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] bg-white/95 text-[#2e0b19]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Gift Header */}
        <div className="text-center mb-3 sm:mb-4 pr-8">
          <span className="text-xs uppercase tracking-widest text-[#8a1c35] font-bold bg-[#fdf2f4] px-3.5 py-1 rounded-full border border-[#d4af37]/35">
            {gift.subtitle}
          </span>
          <h2 className="font-serif-luxury text-xl sm:text-3xl font-bold text-[#2e0b19] mt-2">
            {gift.title}
          </h2>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto my-2 pr-1">
          {!isRevealed ? (
            /* Pre-reveal unopened teaser */
            <div className="text-center py-8 sm:py-12 space-y-6">
              <div className="relative inline-block animate-float-gentle">
                <div className="w-28 h-28 mx-auto rounded-3xl bg-gradient-to-br from-[#fff2f4] to-[#fde5ea] border-2 border-[#d4af37]/60 flex items-center justify-center text-5xl shadow-xl">
                  {gift.previewIcon}
                </div>
                <div className="absolute -bottom-2 -right-2 bg-[#d4af37] text-[#2e0b19] p-2 rounded-full shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h3 className="font-serif-luxury text-xl font-bold text-[#2e0b19]">
                  {gift.content.heading}
                </h3>
                <p className="text-sm text-stone-600 max-w-sm mx-auto font-medium">
                  {gift.content.subheading || 'A special moment prepared for you.'}
                </p>
              </div>

              <button
                onClick={handleReveal}
                className="premium-gold-cta py-3.5 px-8 rounded-full font-bold text-[#2e0b19] bg-gradient-to-r from-[#d4af37] via-[#f5e29f] to-[#d4af37] hover:brightness-105 active:scale-95 transition shadow-lg shadow-[#d4af37]/25 flex items-center gap-2 mx-auto cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#8a1c35]" />
                <span>{gift.content.specialActionLabel || 'Open This Gift'}</span>
              </button>
            </div>
          ) : (
            /* Specific Revealed Gift Experience */
            <div className="space-y-6 animate-fade-in">
              {/* 1. Wrapped Miniature Companion */}
              {gift.type === 'wrapped' && (
                <div className="text-center space-y-4 py-4">
                  <div className="w-28 h-28 mx-auto rounded-full bg-[#fdf2f4] border-2 border-[#d4af37] flex items-center justify-center text-5xl shadow-xl animate-glow-pulse">
                    🧸
                  </div>
                  <h3 className="font-serif-luxury text-2xl font-bold text-[#2e0b19]">
                    {gift.content.heading}
                  </h3>
                  <p className="font-serif-luxury text-lg text-stone-700 leading-relaxed max-w-md mx-auto italic font-medium">
                    "{gift.content.bodyText}"
                  </p>
                  <div className="p-4 rounded-2xl bg-[#fff6f8] border border-[#d4af37]/30 text-xs text-[#8a1c35] font-semibold">
                    ❤️ Handcrafted keepsake to remind you that you are always cherished.
                  </div>
                </div>
              )}

              {/* A four-card letter gift, revealed one note at a time. */}
              {gift.type === 'letters' && activeLetter && (
                <div className="space-y-4 py-1 text-center">
                  <div className="flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#8a1c35] font-bold">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    <span>Letter {letterIndex + 1} of {letters.length}</span>
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  </div>

                  <div
                    key={letterIndex}
                    className={`parchment-paper relative min-h-72 sm:min-h-80 p-6 sm:p-9 rounded-2xl shadow-xl border border-[#c5a059]/50 flex flex-col text-left transition-all duration-300 ${letterDirection === 'next' ? 'animate-letter-in-right' : 'animate-letter-in-left'}`}
                    onTouchStart={(event) => {
                      touchStartX.current = event.changedTouches[0]?.clientX ?? null;
                    }}
                    onTouchEnd={(event) => {
                      const start = touchStartX.current;
                      const end = event.changedTouches[0]?.clientX;
                      touchStartX.current = null;
                      if (start === null || end === undefined || Math.abs(start - end) < 45) return;
                      showLetter(start > end ? letterIndex + 1 : letterIndex - 1);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-[#a87f54]/30 pb-3">
                      <div>
                        <p className="font-serif-luxury text-xs italic text-[#704830] font-semibold">For {config.recipientName}</p>
                        <h3 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2e0b19] mt-1">{activeLetter.title}</h3>
                      </div>
                      <Heart className="w-5 h-5 shrink-0 text-[#8a1c35] fill-current" />
                    </div>
                    <p className="font-serif-luxury text-lg sm:text-xl leading-relaxed tracking-wide font-medium text-[#261017] whitespace-pre-line my-auto py-6">
                      {activeLetter.body}
                    </p>
                    <p className="font-serif-luxury text-base sm:text-lg italic text-[#704830] whitespace-pre-line">{activeLetter.signOff}</p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => showLetter(letterIndex - 1)}
                      disabled={letterIndex === 0}
                      className="py-2.5 px-4 rounded-xl border border-[#d4af37]/50 text-sm font-bold text-[#6d253b] disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[#fff8ea] transition cursor-pointer"
                    >
                      Previous
                    </button>
                    <div className="flex gap-1.5" aria-label={`Viewing letter ${letterIndex + 1} of ${letters.length}`}>
                      {letters.map((_, index) => (
                        <span key={index} className={`h-1.5 rounded-full transition-all ${index === letterIndex ? 'w-6 bg-[#8a1c35]' : 'w-1.5 bg-[#d4af37]/45'}`} />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => showLetter(letterIndex + 1)}
                      disabled={letterIndex === letters.length - 1}
                      className="py-2.5 px-4 rounded-xl bg-[#8a1c35] text-white text-sm font-bold disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[#68142f] transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                  <p className="text-[11px] text-stone-500 font-medium">Swipe a letter left or right to move between them.</p>
                </div>
              )}

              {/* 2. Wax-Sealed Parchment Love Letter */}
              {gift.type === 'letter' && (
                <div className="parchment-paper text-[#261017] p-6 sm:p-8 rounded-2xl shadow-xl border border-[#c5a059]/50 space-y-4 text-left">
                  <div className="border-b border-[#a87f54]/30 pb-3 flex justify-between items-center">
                    <span className="font-serif-luxury italic text-sm text-[#704830] font-semibold">
                      To: {config.recipientName}
                    </span>
                    <Heart className="w-4 h-4 text-[#8a1c35] fill-current" />
                  </div>
                  <div className="font-serif-luxury text-lg sm:text-xl leading-relaxed whitespace-pre-line tracking-wide font-medium">
                    {config.customLetterText || gift.content.bodyText}
                  </div>
                </div>
              )}

              {/* 3. Vintage Cassette Voice Memo */}
              {gift.type === 'voice' && (
                <div className="space-y-5 text-center py-2">
                  <div className="max-w-md mx-auto p-6 rounded-2xl bg-[#faf6f2] border border-[#d4af37]/40 shadow-lg">
                    {/* Cassette visualization */}
                    <div className="flex items-center justify-between mb-4 bg-white p-3 rounded-xl border border-[#d4af37]/25 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-full border-2 border-[#8a1c35] flex items-center justify-center ${
                            isPlayingAudio ? 'animate-spin' : ''
                          }`}
                        >
                          <div className="w-3 h-3 bg-[#8a1c35] rounded-full" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-[#2e0b19]">
                            {gift.content.audioTitle}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            Duration: {gift.content.audioDuration}
                          </p>
                        </div>
                      </div>
                      <div
                        className={`w-9 h-9 rounded-full border-2 border-[#8a1c35] flex items-center justify-center ${
                          isPlayingAudio ? 'animate-spin' : ''
                        }`}
                      >
                        <div className="w-3 h-3 bg-[#8a1c35] rounded-full" />
                      </div>
                    </div>

                    {/* Waveform Bars */}
                    <div className="flex items-center justify-center gap-1.5 h-12 mb-4">
                      {[18, 36, 65, 45, 80, 50, 95, 30, 70, 40, 85, 25, 60, 90, 45].map(
                        (h, i) => (
                          <div
                            key={i}
                            className={`w-1.5 rounded-full transition-all duration-150 ${
                              isPlayingAudio
                                ? 'bg-gradient-to-t from-[#8a1c35] to-[#c59b27]'
                                : 'bg-[#e5d4db]'
                            }`}
                            style={{
                              height: isPlayingAudio ? `${Math.max(15, (h * (audioProgress % 10)) / 5)}%` : `${h * 0.4}%`,
                            }}
                          />
                        )
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#edd9e0] h-2 rounded-full overflow-hidden mb-4">
                      <div
                        className="bg-[#c59b27] h-full transition-all duration-200"
                        style={{ width: `${audioProgress}%` }}
                      />
                    </div>

                    {/* Controls */}
                    <button
                      onClick={toggleVoiceNote}
                      className="py-3 px-8 rounded-full bg-gradient-to-r from-[#d4af37] via-[#f5e29f] to-[#d4af37] text-[#2e0b19] font-bold flex items-center gap-2 mx-auto hover:brightness-105 active:scale-95 transition shadow-md cursor-pointer"
                    >
                      {isPlayingAudio ? (
                        <>
                          <Pause className="w-4 h-4 fill-current text-[#8a1c35]" />
                          <span>Pause Voice Note</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current text-[#8a1c35]" />
                          <span>Play Voice Note</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Transcript quote */}
                  <div className="p-4 rounded-xl bg-[#fff8fa] border border-[#d4af37]/30 max-w-md mx-auto text-left shadow-sm">
                    <p className="text-xs uppercase tracking-wider text-[#8a1c35] mb-1 font-bold">
                      Voice Note Words:
                    </p>
                    <p className="font-serif-luxury italic text-sm text-[#2e0b19] font-medium leading-relaxed">
                      "{config.voiceNoteTranscript}"
                    </p>
                  </div>
                </div>
              )}

              {/* 4. Golden Music Box & Lyrics */}
              {gift.type === 'song' && (
                <div className="space-y-5 text-center py-2">
                  <div className="relative inline-block">
                    <div
                      onClick={playNextMusicBoxNote}
                      className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#ffd700] via-[#e5c158] to-[#b38827] flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition group"
                    >
                      <Music className="w-10 h-10 text-[#2e0b19] group-hover:rotate-12 transition-transform" />
                    </div>
                    <span className="text-xs text-[#8a1c35] mt-2 block font-semibold">
                      Tap box to chime bell notes 🔔
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-serif-luxury text-2xl font-bold text-[#2e0b19]">
                      {gift.content.audioTitle}
                    </h3>
                    <div className="p-5 rounded-2xl bg-[#fffaf5] border border-[#d4af37]/35 max-w-md mx-auto space-y-2 shadow-sm">
                      {gift.content.lyrics?.map((line, idx) => (
                        <p
                          key={idx}
                          className="font-serif-luxury text-base text-[#2e0b19] italic font-medium"
                        >
                          "{line}"
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Memory Polaroids Bundle */}
              {gift.type === 'photos' && gift.content.photos && (
                <div className="space-y-4 py-1">
                  <div className="text-center text-xs text-[#8a1c35] font-semibold">
                    Showing memory {activePhotoIndex + 1} of {gift.content.photos.length} • Tap photo to flip
                  </div>

                  {/* Polaroid Frame */}
                  <div className="flex justify-center">
                    <div
                      onClick={() => {
                        soundManager.playPhotoSlide();
                        setIsPhotoFlipped(!isPhotoFlipped);
                      }}
                      className="w-72 sm:w-80 p-3 pb-6 bg-white rounded-xl shadow-xl border border-stone-200 cursor-pointer transform hover:rotate-1 transition-all duration-300"
                    >
                      {!isPhotoFlipped ? (
                        <div>
                          <div className="w-full h-56 bg-stone-100 rounded-lg overflow-hidden relative">
                            <img
                              src={gift.content.photos[activePhotoIndex].url}
                              alt={gift.content.photos[activePhotoIndex].caption}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="mt-3 text-center">
                            <p className="font-serif-luxury text-lg font-bold text-stone-800">
                              {gift.content.photos[activePhotoIndex].caption}
                            </p>
                            <p className="text-xs text-stone-500 mt-0.5">
                              {gift.content.photos[activePhotoIndex].date}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-72 p-4 flex flex-col justify-between text-left text-stone-800">
                          <div>
                            <span className="text-[11px] uppercase tracking-wider text-rose-800 font-bold">
                              Note on the back:
                            </span>
                            <p className="font-serif-luxury text-lg italic mt-2 leading-relaxed">
                              "{gift.content.photos[activePhotoIndex].backNote}"
                            </p>
                          </div>
                          <div className="text-right text-xs text-stone-400 font-serif-luxury">
                            Always & Forever ❤️
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Photo selector buttons */}
                  <div className="flex justify-center gap-2 pt-2">
                    {gift.content.photos.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          soundManager.playPhotoSlide();
                          setActivePhotoIndex(i);
                          setIsPhotoFlipped(false);
                        }}
                        className={`w-3 h-3 rounded-full transition-all cursor-pointer ${
                          activePhotoIndex === i
                            ? 'bg-[#c59b27] w-6'
                            : 'bg-stone-300 hover:bg-stone-400'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 6. Celestial Star Keepsake */}
              {gift.type === 'interest' && (
                <div className="text-center space-y-4 py-3">
                  <div className="w-28 h-28 mx-auto rounded-full bg-gradient-to-tr from-[#edf3fc] via-[#e5eefc] to-[#d8e6f8] border-2 border-[#9ac4f8] flex items-center justify-center shadow-lg relative overflow-hidden animate-glow-pulse">
                    <Compass className="w-12 h-12 text-[#2c5282] animate-spin" style={{ animationDuration: '24s' }} />
                  </div>
                  <h3 className="font-serif-luxury text-2xl font-bold text-[#2e0b19]">
                    {gift.content.heading}
                  </h3>
                  <p className="text-xs text-[#2b6cb0] font-mono tracking-widest uppercase font-bold">
                    {gift.content.subheading}
                  </p>
                  <p className="font-serif-luxury text-lg text-stone-700 leading-relaxed max-w-md mx-auto italic font-medium">
                    "{gift.content.bodyText}"
                  </p>
                </div>
              )}

              {/* 7. Secret Promise Box */}
              {gift.type === 'secret' && (
                <div className="text-center space-y-4 py-3">
                  <div className="w-24 h-24 mx-auto rounded-3xl bg-[#fdf2f4] border-2 border-[#ffd700] flex items-center justify-center text-4xl shadow-lg animate-glow-pulse">
                    <KeyRound className="w-12 h-12 text-[#c59b27]" />
                  </div>
                  <h3 className="font-serif-luxury text-2xl font-bold text-[#2e0b19]">
                    {gift.content.heading}
                  </h3>
                  <p className="font-serif-luxury text-lg text-stone-700 leading-relaxed max-w-md mx-auto italic font-medium">
                    "{gift.content.bodyText}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action: Collect into Basket */}
        <div className="pt-3 sm:pt-4 border-t border-stone-200 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="text-[11px] sm:text-xs text-stone-500 hover:text-stone-900 px-2 sm:px-3 py-2 transition cursor-pointer font-medium"
          >
            Keep looking inside box
          </button>

          {isRevealed && (
            <button
              onClick={() => {
                soundManager.playBasketCollect();
                onCollect();
              }}
              className="py-2.5 sm:py-3 px-3 sm:px-6 rounded-xl sm:rounded-2xl text-sm sm:text-base font-bold tracking-wide text-[#2e0b19] bg-gradient-to-r from-[#d4af37] via-[#f3e5ab] to-[#d4af37] hover:brightness-105 active:scale-95 transition shadow-lg shadow-[#d4af37]/25 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-[#8a1c35]" />
              <span>Collect in Basket</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
