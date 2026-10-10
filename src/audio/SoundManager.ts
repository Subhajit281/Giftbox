import { AUDIO_PLAYLIST } from '../content/playlist';
import type { PlaylistSlot } from '../content/playlist';

// Web Audio API procedural sound engine: zero dependencies, zero broken links, 100% reliable across browsers.

class ProceduralSoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmPlaying: boolean = false;
  private bgmInterval: number | null = null;
  private masterGain: GainNode | null = null;
  private playlistAudio = new Map<PlaylistSlot, HTMLAudioElement>();
  private loopingPlaylists = new Set<PlaylistSlot>();
  private activePlaylist: PlaylistSlot | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // --- Sound Effects ---

  // Mechanical Lock Release
  public playLockRelease() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;

    // Metallic click snap
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1400, t);
    osc1.frequency.exponentialRampToValueAtTime(320, t + 0.08);
    gain1.gain.setValueAtTime(0.5, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(t);
    osc1.stop(t + 0.12);

    // Resonant metallic shackle ring
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, t + 0.06);
    osc2.frequency.exponentialRampToValueAtTime(740, t + 0.45);
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.setValueAtTime(0.35, t + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(t + 0.06);
    osc2.stop(t + 0.5);

    // Spring clink
    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const tSub = this.ctx.currentTime;
      const osc3 = this.ctx.createOscillator();
      const gain3 = this.ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1760, tSub);
      gain3.gain.setValueAtTime(0.2, tSub);
      gain3.gain.exponentialRampToValueAtTime(0.001, tSub + 0.25);
      osc3.connect(gain3);
      gain3.connect(this.masterGain);
      osc3.start(tSub);
      osc3.stop(tSub + 0.25);
    }, 120);
  }

  // Lock Error Thud
  public playLockError() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.2);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  // Ribbon Untie / Whoosh
  public playRibbonUntie() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Filtered noise buffer for fabric glide
    const bufferSize = this.ctx.sampleRate * 0.4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(2400, t + 0.35);
    filter.Q.value = 3;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.25, t + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.4);
  }

  // Paper Unwrapping / Rustle
  public playPaperRustle() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
    noise.stop(t + 0.5);
  }

  // Hinged Lid Open & Warm Ambient Sigh
  public playLidOpening() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Wooden friction creak
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.3);
    osc.frequency.linearRampToValueAtTime(90, t + 0.7);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 450;

    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.7);

    // Warm golden chime sweep as light reveals
    setTimeout(() => {
      this.playChimeReveal();
    }, 400);
  }

  // Heavenly Golden Pentatonic Chimes
  public playChimeReveal() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C5, E5, G5, C6, E6
    const baseTime = this.ctx.currentTime;

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const noteTime = baseTime + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.2, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.9);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(noteTime);
      osc.stop(noteTime + 0.9);
    });
  }

  // Wax Seal Snap & Parchment
  public playSealBreak() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.05);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);

    this.playPaperRustle();
  }

  // Music Box Bell Note
  public playMusicBoxNote(freq: number, duration: number = 0.8) {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, t);

    // Subtle overtone for bell acoustic resonance
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2.02, t);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
  }

  // Photo Slide / Card Swoosh
  public playPhotoSlide() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  // Basket Collect Swoosh & Settle
  public playBasketCollect() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Upward swoosh
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(840, t + 0.3);

    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.35);

    // Soft landing drop
    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const tDrop = this.ctx.currentTime;
      const oscDrop = this.ctx.createOscillator();
      const gainDrop = this.ctx.createGain();
      oscDrop.type = 'sine';
      oscDrop.frequency.setValueAtTime(260, tDrop);
      oscDrop.frequency.exponentialRampToValueAtTime(110, tDrop + 0.15);

      gainDrop.gain.setValueAtTime(0.2, tDrop);
      gainDrop.gain.exponentialRampToValueAtTime(0.001, tDrop + 0.15);

      oscDrop.connect(gainDrop);
      gainDrop.connect(this.masterGain);
      oscDrop.start(tDrop);
      oscDrop.stop(tDrop + 0.15);
    }, 280);
  }

  // Cute Soft Teddy Footsteps
  public playTeddyStep() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150 + Math.random() * 30, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.08);

    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // In-World Notification Crystal Ping
  public playNotificationPing() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, t); // B5
    osc1.frequency.setValueAtTime(1318.51, t + 0.08); // E6

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1975.53, t + 0.08); // B6 harmonic

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.7);
    osc2.stop(t + 0.7);
  }

  // Door Opening: Brass handle latch & deep hinge creak
  public playDoorOpen() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    // Brass latch release
    const oscLatch = this.ctx.createOscillator();
    const gainLatch = this.ctx.createGain();
    oscLatch.type = 'triangle';
    oscLatch.frequency.setValueAtTime(620, t);
    oscLatch.frequency.exponentialRampToValueAtTime(180, t + 0.1);

    gainLatch.gain.setValueAtTime(0.35, t);
    gainLatch.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    oscLatch.connect(gainLatch);
    gainLatch.connect(this.masterGain);
    oscLatch.start(t);
    oscLatch.stop(t + 0.12);

    // Deep wood hinge swing
    setTimeout(() => {
      if (!this.ctx || !this.masterGain) return;
      const tHinge = this.ctx.currentTime;
      const oscHinge = this.ctx.createOscillator();
      const gainHinge = this.ctx.createGain();
      oscHinge.type = 'sawtooth';
      oscHinge.frequency.setValueAtTime(80, tHinge);
      oscHinge.frequency.linearRampToValueAtTime(115, tHinge + 0.5);
      oscHinge.frequency.linearRampToValueAtTime(70, tHinge + 1.1);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 350;

      gainHinge.gain.setValueAtTime(0.12, tHinge);
      gainHinge.gain.exponentialRampToValueAtTime(0.001, tHinge + 1.2);

      oscHinge.connect(filter);
      filter.connect(gainHinge);
      gainHinge.connect(this.masterGain);
      oscHinge.start(tHinge);
      oscHinge.stop(tHinge + 1.2);
    }, 100);
  }

  // Background Ambient Romantic Music (Procedural Arpeggiator)
  // --- Birthday room ---

  /** Short burst of filtered noise; the building block for blow / slice / pop / bang sounds. */
  private noiseBurst(
    duration: number,
    type: BiquadFilterType,
    f0: number,
    f1: number,
    q: number,
    peak: number,
    attack: number,
    delay = 0,
  ) {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + delay;
    const size = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + duration);
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t);
    src.stop(t + duration);
  }

  /** A soft breath of air that blows the candle out. */
  public playBlow() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    this.noiseBurst(1.1, 'bandpass', 500, 1500, 0.8, 0.5, 0.25);
    this.noiseBurst(0.7, 'highpass', 1800, 900, 0.5, 0.1, 0.2, 0.1);
  }

  /** Blade pressing through sponge: a quick sheared rush with a low thump at the board. */
  public playKnifeSlice() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    this.noiseBurst(0.55, 'bandpass', 3200, 900, 1.4, 0.2, 0.05);
    const t = this.ctx.currentTime + 0.42;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.14);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Party-popper: sharp pop, then a falling shimmer of paper. */
  public playPartyPop() {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.45, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
    this.noiseBurst(0.12, 'highpass', 2600, 1800, 0.7, 0.55, 0.004);
    this.noiseBurst(1.6, 'highpass', 5200, 3200, 0.6, 0.09, 0.05, 0.08);
  }

  /** Distant firework: whistle up, crack, crackle. */
  public playFireworkBang(delay = 0) {
    this.initContext();
    if (this.isMuted || !this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime + delay;
    const whistle = this.ctx.createOscillator();
    const wg = this.ctx.createGain();
    whistle.type = 'sine';
    whistle.frequency.setValueAtTime(600, t);
    whistle.frequency.exponentialRampToValueAtTime(1900, t + 0.5);
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.linearRampToValueAtTime(0.05, t + 0.15);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
    whistle.connect(wg);
    wg.connect(this.masterGain);
    whistle.start(t);
    whistle.stop(t + 0.55);
    this.noiseBurst(0.5, 'lowpass', 1400, 120, 0.6, 0.55, 0.004, delay + 0.5);
    this.noiseBurst(0.9, 'highpass', 4800, 3000, 0.5, 0.1, 0.1, delay + 0.56);
  }

  /** The first bars of a happy-birthday phrase on bright celesta bells. */
  public playBirthdayChime() {
    this.initContext();
    if (this.isMuted || !this.ctx) return;
    // G G A G C B | G G A G D C  (C major, bell register)
    const notes: Array<[number, number]> = [
      [784, 0], [784, 0.28], [880, 0.56], [784, 1.1], [1047, 1.66], [988, 2.34],
      [784, 3.2], [784, 3.48], [880, 3.76], [784, 4.3], [1175, 4.86], [1047, 5.54],
    ];
    notes.forEach(([freq, at]) => window.setTimeout(() => this.playMusicBoxNote(freq, 0.9), at * 1000));
  }

  public startBackgroundMusic() {
    if (this.bgmPlaying) return;
    this.initContext();
    this.bgmPlaying = true;

    // Romantic chord progression in D major (D - F#m - G - A)
    const chords = [
      [293.66, 369.99, 440.0, 587.33], // D maj (D4, F#4, A4, D5)
      [293.66, 369.99, 440.0, 554.37], // Dmaj7 / F#m
      [392.0, 493.88, 587.33, 783.99],  // G maj (G4, B4, D5, G5)
      [440.0, 554.37, 659.25, 880.0],   // A maj (A4, C#5, E5, A5)
    ];

    let chordIdx = 0;
    let step = 0;

    this.bgmInterval = window.setInterval(() => {
      if (this.isMuted || !this.ctx || !this.masterGain || !this.bgmPlaying) return;
      const chord = chords[chordIdx];
      const noteFreq = chord[step % chord.length];
      const t = this.ctx.currentTime;

      // Gentle piano-celesta note
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(noteFreq, t);

      gain.gain.setValueAtTime(0.045, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.2);

      step++;
      if (step >= 8) {
        step = 0;
        chordIdx = (chordIdx + 1) % chords.length;
      }
    }, 600);
  }

  public stopBackgroundMusic() {
    this.bgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  public isMusicPlaying(): boolean {
    return this.bgmPlaying;
  }

  // --- Personal music playlists ---

  private getPlaylistAudio(slot: PlaylistSlot) {
    let audio = this.playlistAudio.get(slot);
    if (!audio) {
      audio = new Audio();
      audio.preload = 'auto';
      audio.volume = this.isMuted ? 0 : 0.68;
      this.playlistAudio.set(slot, audio);
    }
    return audio;
  }

  private playPlaylistTrack(slot: PlaylistSlot, index: number) {
    const tracks = AUDIO_PLAYLIST[slot];
    const audio = this.getPlaylistAudio(slot);

    if (!tracks.length) {
      if (this.activePlaylist === slot) this.activePlaylist = null;
      return;
    }
    if (index >= tracks.length) {
      if (this.loopingPlaylists.has(slot)) {
        this.playPlaylistTrack(slot, 0);
      } else {
        if (this.activePlaylist === slot) this.activePlaylist = null;
      }
      return;
    }

    audio.onended = () => this.playPlaylistTrack(slot, index + 1);
    audio.onerror = () => {
      if (index + 1 < tracks.length) this.playPlaylistTrack(slot, index + 1);
      else {
        audio.onended = null;
        audio.onerror = null;
        this.loopingPlaylists.delete(slot);
        if (this.activePlaylist === slot) this.activePlaylist = null;
      }
    };
    audio.src = tracks[index];
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 0.68;
    void audio.play().catch(() => {
      // A missing file or a browser autoplay restriction should leave the experience usable.
    });
  }

  /** Starts every valid file in the configured slot, one after another. */
  public playPlaylist(slot: PlaylistSlot, loop = false) {
    const overlaysRoomMusic = slot === 'giftOpen' && this.loopingPlaylists.size > 0;
    this.playlistAudio.forEach((audio, key) => {
      if (key !== slot && (!overlaysRoomMusic || !this.loopingPlaylists.has(key))) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    if (!overlaysRoomMusic) {
      this.loopingPlaylists.clear();
      if (loop) this.loopingPlaylists.add(slot);
      this.activePlaylist = slot;
    }
    this.playPlaylistTrack(slot, 0);
  }

  /** Primes a track from a direct tap so delayed scene transitions remain playable on mobile Safari. */
  public primePlaylist(slot: PlaylistSlot) {
    const tracks = AUDIO_PLAYLIST[slot];
    if (!tracks.length) return;
    const audio = this.getPlaylistAudio(slot);
    audio.src = tracks[0];
    audio.muted = true;
    void audio.play().then(() => {
      audio.muted = false;
      audio.volume = 0.68;
      // If the room has already started its playlist, do not interrupt it.
      if (this.activePlaylist !== slot) {
        audio.pause();
        audio.currentTime = 0;
      }
    }).catch(() => {
      audio.muted = false;
    });
  }

  public stopPlaylist(slot?: PlaylistSlot) {
    this.playlistAudio.forEach((audio, key) => {
      if (!slot || key === slot) {
        audio.pause();
        audio.currentTime = 0;
        this.loopingPlaylists.delete(key);
      }
    });
    if (!slot || this.activePlaylist === slot) this.activePlaylist = null;
  }
}

export const soundManager = new ProceduralSoundEngine();
