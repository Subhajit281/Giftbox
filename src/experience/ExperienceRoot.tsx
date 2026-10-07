import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GiftBoxScene } from './GiftBoxScene';
import { loadSavedConfig} from '../state/ExperienceState';
import type { ExperienceState } from '../state/ExperienceState';
import { INITIAL_GIFTS } from '../content/giftData';
import type { GiftItem, ExperienceConfig } from '../content/giftData';
import { soundManager } from '../audio/SoundManager';

import { LockPromptModal } from '../components/LockPromptModal';
import { GiftRevealModal } from '../components/GiftRevealModal';
import { TeddyEndingModal } from '../components/TeddyEndingModal';
import { FakeNotification } from '../components/FakeNotification';
import { FinalDoorModal } from '../components/FinalDoorModal';
import { ExperienceHUD } from '../components/ExperienceHUD';
import { BirthdayCelebration } from '../components/BirthdayCelebration';
import { Sparkles } from 'lucide-react';

export const ExperienceRoot: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GiftBoxScene | null>(null);

  // Application State
  const [currentState, setCurrentState] = useState<ExperienceState>('BOOT');
  const [gifts, setGifts] = useState<GiftItem[]>(INITIAL_GIFTS);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [config] = useState<ExperienceConfig>(loadSavedConfig());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [doorOpened, setDoorOpened] = useState(false);
  const [celebration, setCelebration] = useState<'idle' | 'playing' | 'done'>('idle');
  const celebrationTimer = useRef<number | null>(null);

  // Initialize 3D Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new GiftBoxScene(containerRef.current, {
      onBoxClick: () => {
        setCurrentState((prev) =>
          prev === 'LOCKED' ? 'NAME_ENTRY' : prev
        );
      },
      onGiftClick: (giftId: string) => {
        handleSelectGift(giftId);
      },
      onDoorClick: () => {
        handleOpenDoor();
      },
    });

    sceneRef.current = scene;
    scene.populateGifts(gifts);

    // Initial transition to LOCKED
    let cancelled = false;

    const minDelay = new Promise<void>((resolve) =>
      window.setTimeout(resolve, 500)
    );

    Promise.all([
      scene.warmUp().catch(() => {}),
      minDelay,
    ]).then(() => {
      if (cancelled) return;

      setCurrentState('LOCKED');
      scene.setState('LOCKED');
    });

    return () => {
      cancelled = true;
      scene.destroy();
    };
  }, []);

  // Sync state with 3D scene
  const transitionTo = useCallback((nextState: ExperienceState) => {
    setCurrentState(nextState);
    if (sceneRef.current) {
      sceneRef.current.setState(nextState);
    }
  }, []);

  // Handle gift selection
  const handleSelectGift = useCallback((giftId: string) => {
    const gift = gifts.find((g) => g.id === giftId);
    if (!gift || gift.isCollected) return;

    setSelectedGiftId(giftId);
    transitionTo('GIFT_CONTENT');
    soundManager.playPhotoSlide();

    // If Gift 1 (wrapped mini present), trigger the mini teddy popping out in 3D!
    if (gift.type === 'wrapped' && sceneRef.current) {
      setTimeout(() => {
        sceneRef.current?.triggerMiniTeddyPop();
      }, 600);
    }
  }, [gifts, transitionTo]);

  // Handle gift collection into bin
  const handleCollectGift = useCallback(() => {
    if (!selectedGiftId) return;

    transitionTo('COLLECTING');
    const currentId = selectedGiftId;
    setSelectedGiftId(null);

    // Launch item along 3D projectile arc into the bin
    if (sceneRef.current) {
      sceneRef.current.launchItemIntoBin(currentId, () => {
        setGifts((prevGifts) => {
          const updated = prevGifts.map((g) =>
            g.id === currentId ? { ...g, isCollected: true, isOpened: true } : g
          );

          const allDone = updated.every((g) => g.isCollected);
          if (allDone) {
            // All unwrapped! Transition to Teddy character sequence
            setTimeout(() => {
              transitionTo('ALL_GIFTS_COMPLETED');
              setTimeout(() => {
                transitionTo('TEDDY_INTRO');
                // Teddy starts walking into the screen
                sceneRef.current?.setTeddyWalk(true);

                setTimeout(() => {
                  transitionTo('TEDDY_QUESTION');
                }, 3000);
              }, 1200);
            }, 600);
          } else {
            transitionTo('GIFT_SELECTION');
          }

          return updated;
        });
      });
    }
  }, [selectedGiftId, transitionTo]);

  // Handle Unwrapping: 3D Ribbons untie and box walls fall apart!
  const handleUnlockSuccess = useCallback(() => {
    transitionTo('UNLOCKED');
    setCelebration('playing');

    soundManager.playRibbonUntie();
    soundManager.playPaperRustle();

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        sceneRef.current?.startUnwrappingAnimation(() => {
          soundManager.playLidOpening();
          transitionTo('BOX_OPEN');
          setTimeout(() => transitionTo('GIFT_SELECTION'), 800);
        });
      }),
    );

    if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
    celebrationTimer.current = window.setTimeout(() => setCelebration('done'), 10000);
  }, [transitionTo]);

  // Teddy character decided sequence
  const handleTeddyDecided = useCallback(() => {
    transitionTo('COLLECTION_TAKEN');
    // Teddy turns around and walks away out of the screen
    if (sceneRef.current) {
      sceneRef.current.setTeddyWalk(false);
    }

    // After teddy walks away, show the in-world notification
    setTimeout(() => {
      transitionTo('NOTIFICATION');
    }, 2800);
  }, [transitionTo]);

  // Dismiss notification -> Fake Door appears
  const handleDismissNotification = useCallback(() => {
    transitionTo('DOOR_READY');
  }, [transitionTo]);

  // Door click
  const handleOpenDoor = useCallback(() => {
    if (doorOpened) return;
    setDoorOpened(true);
    transitionTo('DOOR_OPENING');

    setTimeout(() => {
      transitionTo('FINAL_HANDOFF');
    }, 1500);
  }, [doorOpened, transitionTo]);

  // Audio toggles
  const handleToggleMute = useCallback(() => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    soundManager.setMuted(nextMuted);
  }, [isAudioMuted]);

  const handleToggleMusic = useCallback(() => {
    if (isMusicPlaying) {
      soundManager.stopBackgroundMusic();
      setIsMusicPlaying(false);
    } else {
      soundManager.startBackgroundMusic();
      setIsMusicPlaying(true);
    }
  }, [isMusicPlaying]);

  // Restart / Replay
  const handleRestart = useCallback(() => {
    if (celebrationTimer.current) window.clearTimeout(celebrationTimer.current);
    setCelebration('idle');
    const freshGifts = INITIAL_GIFTS.map((g) => ({
      ...g,
      isOpened: false,
      isCollected: false,
    }));
    setGifts(freshGifts);
    setSelectedGiftId(null);
    setDoorOpened(false);

    if (sceneRef.current) {
      sceneRef.current.populateGifts(freshGifts);
    }

    transitionTo('LOCKED');
  }, [transitionTo]);

  const activeGift = gifts.find((g) => g.id === selectedGiftId);

  return (
    <div className="relative w-full h-[100dvh] min-h-[100svh] bg-[#fbf7f2] overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="absolute inset-0 z-0 touch-none" />

      {/* Experience HUD */}
      <ExperienceHUD
        currentState={currentState}
        gifts={gifts}
        isAudioMuted={isAudioMuted}
        isMusicPlaying={isMusicPlaying}
        onToggleMute={handleToggleMute}
        onToggleMusic={handleToggleMusic}
      />

          {celebration !== 'done' && <BirthdayCelebration playing={celebration === 'playing'} />}

      {/* Initial Locked Huge Gift Box Message Overlay */}
      {currentState === 'LOCKED' && (
        <div
          onClick={() => transitionTo('NAME_ENTRY')}
          className="fixed inset-0 z-20 flex flex-col items-center justify-center p-4 cursor-pointer pointer-events-auto"
        >
          <div className="glass-panel w-full max-w-sm py-5 px-6 sm:px-10 rounded-3xl border border-[#d4af37]/50 shadow-2xl animate-float-gentle text-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#8a1c35] font-semibold">
              A Special Present For You
            </span>
            <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2e0b19]">
              Tied With Love
            </h1>
            <div className="pt-2">
              <span className="py-2.5 px-6 rounded-full bg-gradient-to-r from-[#d4af37] via-[#f3e5ab] to-[#d4af37] text-[#1c030c] font-semibold text-sm shadow-lg flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-[#380b18]" />
                <span>Tap to Unwrap</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Name Input & Verification Modal */}
      {currentState === 'NAME_ENTRY' && (
        <LockPromptModal
          expectedName={config.unlockName}
          onSuccess={handleUnlockSuccess}
          onClose={() => transitionTo('LOCKED')}
        />
      )}

      {/* Detailed Interactive Gift Modal */}
      {currentState === 'GIFT_CONTENT' && activeGift && (
        <GiftRevealModal
          gift={activeGift}
          config={config}
          onCollect={handleCollectGift}
          onClose={() => {
            setSelectedGiftId(null);
            transitionTo('GIFT_SELECTION');
          }}
        />
      )}

      {/* Teddy Bear Ending Interactive Dialogue */}
      {(currentState === 'TEDDY_QUESTION' || currentState === 'TEDDY_RESPONSE') && (
        <TeddyEndingModal onTeddyDecided={handleTeddyDecided} />
      )}

      {/* In-World Fictional Push Notification */}
      {currentState === 'NOTIFICATION' && (
        <FakeNotification
          senderName={`${config.creatorName} ❤️`}
          onDismiss={handleDismissNotification}
        />
      )}

      {/* Final 3D Door & WhatsApp Redirect */}
      {(currentState === 'DOOR_READY' ||
        currentState === 'DOOR_OPENING' ||
        currentState === 'FINAL_HANDOFF') && (
        <FinalDoorModal
          config={config}
          doorOpened={doorOpened}
          onOpenDoor={handleOpenDoor}
          onRestart={handleRestart}
        />
      )}

    </div>
  );
};
