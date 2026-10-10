import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GiftBoxScene } from './GiftBoxScene';
import { loadSavedConfig} from '../state/ExperienceState';
import type { ExperienceState } from '../state/ExperienceState';
import { INITIAL_GIFTS } from '../content/giftData';
import type { GiftItem, ExperienceConfig } from '../content/giftData';
import { soundManager } from '../audio/SoundManager';

import { GiftRevealModal } from '../components/GiftRevealModal';
import { TeddyEndingModal } from '../components/TeddyEndingModal';
import { FakeNotification } from '../components/FakeNotification';
import { FinalDoorModal } from '../components/FinalDoorModal';
import { ProposalOverlay } from '../components/ProposalOverlay';
import { ProposalNotification } from '../components/ProposalNotification';
import { ExperienceHUD } from '../components/ExperienceHUD';
import { BirthdayCelebration } from '../components/BirthdayCelebration';
import { BirthdayCeremony } from '../components/BirthdayCeremony';
import type { CeremonyPhase } from '../components/BirthdayCeremony';
import { EntryDoorNotification } from '../components/EntryDoorNotification';
import { LoveAtmosphere } from '../components/LoveAtmosphere';
import { Sparkles } from 'lucide-react';

const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

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
  const [proposalDoorOpened, setProposalDoorOpened] = useState(false);
  const [entryDoorOpened, setEntryDoorOpened] = useState(false);
  const [birthdayPhase, setBirthdayPhase] = useState<CeremonyPhase | null>(null);
  const [entryReady, setEntryReady] = useState(false);
  const stateRef = useRef<ExperienceState>('BOOT');
  const doorTapRef = useRef<() => void>(() => {});
  const giftDoorBusy = useRef(false);
  const [celebration, setCelebration] = useState<'idle' | 'playing' | 'leaving' | 'done'>('idle');
  const proposalDoorOpenedRef = useRef(false);
  const entryDoorOpenedRef = useRef(false);
  const proposalRun = useRef(0);
  const birthdayRun = useRef(0);
  const answerLock = useRef(false);
  const [curtain, setCurtain] = useState(true); // the story opens from black

  // Initialize 3D Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new GiftBoxScene(containerRef.current, {
      onBoxClick: () => {},
      onGiftClick: (giftId: string) => {
        handleSelectGift(giftId);
      },
      onDoorClick: () => doorTapRef.current(),
    });

    sceneRef.current = scene;
    scene.populateGifts(gifts);

    // The story now begins at the front door, not at the gift box.
    let cancelled = false;
    let noticeTimer = 0;

    const minDelay = new Promise<void>((resolve) =>
      window.setTimeout(resolve, 500)
    );

    Promise.all([
      scene.warmUp().catch(() => {}),
      minDelay,
    ]).then(() => {
      if (cancelled) return;

      stateRef.current = 'ENTRY_DOOR';
      setCurrentState('ENTRY_DOOR');
      scene.setState('ENTRY_DOOR');
      setCurtain(false); // the door fades in out of the dark, alone
      noticeTimer = window.setTimeout(() => setEntryReady(true), 1900); // then the message arrives
    });

    return () => {
      cancelled = true;
      window.clearTimeout(noticeTimer);
      proposalRun.current++; // cancels any running proposal sequence
      scene.destroy();
    };
  }, []);

  // Sync state with 3D scene
  const transitionTo = useCallback((nextState: ExperienceState) => {
    stateRef.current = nextState;
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

  // The gift room keeps the original unfolding sequence, without a second name prompt.
  const handleGiftUnwrap = useCallback(() => {
    transitionTo('UNLOCKED');

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

  }, [transitionTo]);

  const handleCountdownComplete = useCallback(async () => {
    const id = ++birthdayRun.current;
    const alive = () => birthdayRun.current === id;
    const scene = sceneRef.current;
    if (!scene) return;

    // 1. the candle is blown out
    setBirthdayPhase('wish');
    transitionTo('BIRTHDAY_WISH');
    await scene.blowOutBirthdayCandle(); if (!alive()) return;
    await wait(300); if (!alive()) return;

    // 2. the knife cuts the cake
    setBirthdayPhase('cutting');
    transitionTo('CAKE_CUTTING');
    await scene.cutBirthdayCake(); if (!alive()) return;

    // 3. celebration
    setBirthdayPhase('celebrate');
    transitionTo('BIRTHDAY_CELEBRATION');
    setCelebration('playing');
    await scene.celebrateBirthday(); if (!alive()) return;
    setCelebration('leaving');
    setBirthdayPhase(null);
    window.setTimeout(() => { if (birthdayRun.current === id) setCelebration('done'); }, 750);

    // 4. a second door rises, then the message to open it
    await scene.presentBirthdayDoor(); if (!alive()) return;
    transitionTo('GIFT_DOOR_READY');
  }, [transitionTo]);

  const handleEntryDoor = useCallback(async () => {
    if (entryDoorOpenedRef.current) return;
    entryDoorOpenedRef.current = true;
    setEntryDoorOpened(true);
    transitionTo('ENTRY_DOOR_OPENING');
    await wait(1150);
    setCurtain(true);
    await wait(560);
    sceneRef.current?.enterBirthdayRoom();
    setBirthdayPhase('countdown');
    transitionTo('BIRTHDAY_COUNTDOWN');
    void sceneRef.current?.startBirthdayCountdown(8);
    setCurtain(false);
  }, [transitionTo]);

  const handleGiftDoor = useCallback(async () => {
    if (giftDoorBusy.current) return;
    giftDoorBusy.current = true;
    transitionTo('GIFT_TRANSITION');
    await sceneRef.current?.openBirthdayDoor();
    setCurtain(true);
    await wait(620);
    sceneRef.current?.leaveBirthdayRoom();
    transitionTo('GIFT_READY');
    setCurtain(false);
  }, [transitionTo]);

  // A tap on a 3D door does the same as its button.
  useEffect(() => {
    doorTapRef.current = () => {
      if (stateRef.current === 'ENTRY_DOOR' && entryReady) void handleEntryDoor();
      else if (stateRef.current === 'GIFT_DOOR_READY') void handleGiftDoor();
    };
  }, [entryReady, handleEntryDoor, handleGiftDoor]);

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

  // ───── Proposal sequence ─────
  const runProposal = useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene) return;
    const id = ++proposalRun.current;
    const alive = () => proposalRun.current === id;

    setCurtain(true);                       // fade to black
    await wait(800); if (!alive()) return;

    transitionTo('PROPOSAL_ENTER');
    scene.enterProposalRoom();
    soundManager.playPlaylist('proposal');
    await wait(200); if (!alive()) return;
    setCurtain(false);                      // fade into the balloon room
    await wait(1100); if (!alive()) return;

    await scene.playProposalWalkIn();       if (!alive()) return;
    await wait(900); if (!alive()) return;  // pause — they look at each other

    await scene.playRoseAndKneel();         if (!alive()) return;
    await wait(700); if (!alive()) return;  // beat before he asks

    transitionTo('PROPOSAL_ASK');           // bubble appears…
    void scene.burstSparkles();             // …at the exact same moment sparkles burst
    await wait(4200); if (!alive()) return;

    transitionTo('PROPOSAL_ANSWER');        // her YES / Definitely yes bubble
  }, [transitionTo]);

  const handleProposalAnswer = useCallback(async () => {
    if (answerLock.current) return;
    answerLock.current = true;
    const scene = sceneRef.current;
    const id = proposalRun.current;
    const alive = () => proposalRun.current === id;
    if (!scene) return;

    await wait(400); if (!alive()) return;  // let her answer sink in
    transitionTo('PROPOSAL_ACCEPTED');
    await scene.playAcceptRose();           if (!alive()) return;

    await wait(800); if (!alive()) return;  // pause before the kiss
    transitionTo('PROPOSAL_KISS');
    await scene.playKiss();                 if (!alive()) return;

    await wait(600); if (!alive()) return;
    transitionTo('PROPOSAL_NOTIFICATION');  // stays until she taps it
  }, [transitionTo]);

  const handleOpenWhatsApp = useCallback(() => {
    const num = config.whatsappNumber.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${num}?text=${encodeURIComponent(config.whatsappMessage)}`;
    const w = window.open(url, '_blank');
    if (w) w.opener = null;
    else window.location.href = url; // popup blocked → same-tab redirect
  }, [config]);

  const getAnchor = useCallback(
    (who: 'boy' | 'girl') => sceneRef.current?.getHeadScreenPosition(who) ?? null,
    [],
  );

  // Final door click (ref guard prevents a double tap from replaying the proposal).
  const handleProposalDoor = useCallback(() => {
    if (proposalDoorOpenedRef.current) return;
    proposalDoorOpenedRef.current = true;
    // This is a direct tap. Priming here keeps the chosen proposal song permitted
    // when the room fades in a moment later on mobile browsers.
    soundManager.primePlaylist('proposal');
    setProposalDoorOpened(true);
    transitionTo('DOOR_OPENING');
    window.setTimeout(() => void runProposal(), 1700); // let the door swing open first
  }, [transitionTo, runProposal]);

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

  const activeGift = gifts.find((g) => g.id === selectedGiftId);

  return (
    <div className="relative w-full h-[100dvh] min-h-[100svh] bg-[#fbf7f2] overflow-hidden select-none experience-shell">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="absolute inset-0 z-0 touch-none" />
      <LoveAtmosphere />

      {/* Experience HUD */}
      <ExperienceHUD
        currentState={currentState}
        gifts={gifts}
        isAudioMuted={isAudioMuted}
        isMusicPlaying={isMusicPlaying}
        onToggleMute={handleToggleMute}
        onToggleMusic={handleToggleMusic}
      />

      {(celebration === 'playing' || celebration === 'leaving') && (
        <BirthdayCelebration recipientName={config.recipientName} leaving={celebration === 'leaving'} />
      )}

      {/* The opening invitation remains until she opens the front door. */}
      {currentState === 'ENTRY_DOOR' && entryReady && (
        <>
          <EntryDoorNotification senderName={`${config.creatorName} ❤️`} message="Tap the door to open it, baby." />
          <FinalDoorModal
            doorOpened={entryDoorOpened}
            onOpenDoor={handleEntryDoor}
            eyebrow="A birthday surprise is inside"
            title="Open the door"
            burst={false}
          />
        </>
      )}

      {birthdayPhase && (
        <BirthdayCeremony phase={birthdayPhase} onCountdownComplete={handleCountdownComplete} />
      )}

      {currentState === 'GIFT_DOOR_READY' && (
        <>
          <EntryDoorNotification senderName={`${config.creatorName} ❤️`} message="Tap the door to see what I kept for you in the next room." />
          <FinalDoorModal
            doorOpened={false}
            onOpenDoor={handleGiftDoor}
            eyebrow="One more little surprise"
            title="Go to the gift room"
            burst={false}
          />
        </>
      )}

      {/* The gift journey starts here, after the birthday room. */}
      {currentState === 'GIFT_READY' && (
        <div
          onClick={handleGiftUnwrap}
          className="fixed inset-0 z-20 flex flex-col items-center justify-center p-4 cursor-pointer pointer-events-auto"
        >
          <div className="glass-panel w-full max-w-sm py-5 px-6 sm:px-10 rounded-3xl border border-[#d4af37]/50 shadow-2xl animate-float-gentle text-center space-y-2">
            <span className="text-xs uppercase tracking-widest text-[#8a1c35] font-semibold">
              The next room was worth the wait
            </span>
            <h1 className="font-serif-luxury text-2xl sm:text-3xl font-bold text-[#2e0b19]">
              A Gift, Tied With Love
            </h1>
            <div className="pt-2">
              <span className="premium-gold-cta py-2.5 px-6 rounded-full bg-gradient-to-r from-[#d4af37] via-[#f3e5ab] to-[#d4af37] text-[#1c030c] font-semibold text-sm shadow-lg flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-[#380b18]" />
                <span>Tap to Unwrap</span>
              </span>
            </div>
          </div>
        </div>
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

      {(currentState === 'DOOR_READY' || currentState === 'DOOR_OPENING') && (
        <FinalDoorModal doorOpened={proposalDoorOpened} onOpenDoor={handleProposalDoor} />
      )}

      {(currentState === 'PROPOSAL_ASK' || currentState === 'PROPOSAL_ANSWER') && (
        <ProposalOverlay
          phase={currentState === 'PROPOSAL_ASK' ? 'ask' : 'answer'}
          getAnchor={getAnchor}
          onAnswer={handleProposalAnswer}
        />
      )}

      {currentState === 'PROPOSAL_NOTIFICATION' && (
        <ProposalNotification senderName={`${config.creatorName} ❤️`} onOpen={handleOpenWhatsApp} />
      )}

      {/* Scene-change curtain */}
      <div
        className="fixed inset-0 z-[60] bg-black pointer-events-none transition-opacity duration-700"
        style={{ opacity: curtain ? 1 : 0 }}
      />

    </div>
  );
};
