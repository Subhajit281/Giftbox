/**
 * Drop your audio files into `public/audio/` using these names.
 * You can add extra tracks to each array — the first file that loads will play.
 *
 *   public/audio/birthday-room.mp3 → plays in the birthday room
 *   public/audio/gift-room.mp3     → plays in the keepsake room
 *   public/audio/proposal.mp3      → plays in the proposal room
 *   public/audio/gift-open.mp3     → plays when she opens the letters gift
 */
export const AUDIO_PLAYLIST = {
  birthdayRoom: ['/audio/birthday-room.mp3'],
  giftRoom: ['/audio/gift-room.mp3'],
  giftOpen: ['/audio/gift-open.mp3'],
  proposal: ['/audio/proposal.mp3'],
} as const;

export type PlaylistSlot = keyof typeof AUDIO_PLAYLIST;
