/**
 * Drop your audio files into `public/audio/` using these names.
 * You can add extra tracks to each array — the first file that loads will play.
 *
 *   public/audio/gift-open.mp3   → plays when she opens the letters gift
 *   public/audio/proposal.mp3    → plays when walking into the proposal room
 */
export const AUDIO_PLAYLIST = {
  giftOpen: ['/audio/gift-open.mp3'],
  proposal: ['/audio/proposal.mp3'],
} as const;

export type PlaylistSlot = keyof typeof AUDIO_PLAYLIST;
