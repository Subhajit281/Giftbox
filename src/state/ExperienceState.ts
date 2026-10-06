import { DEFAULT_CONFIG } from '../content/giftData';
import type { GiftItem, ExperienceConfig } from '../content/giftData';

export type ExperienceState =
  | 'BOOT'
  | 'LOCKED'
  | 'NAME_ENTRY'
  | 'VALIDATING'
  | 'UNLOCKED'
  | 'UNWRAPPING'
  | 'BOX_OPEN'
  | 'GIFT_SELECTION'
  | 'GIFT_OPENING'
  | 'GIFT_CONTENT'
  | 'GIFT_COMPLETED'
  | 'COLLECTING'
  | 'ALL_GIFTS_COMPLETED'
  | 'TEDDY_INTRO'
  | 'TEDDY_QUESTION'
  | 'TEDDY_RESPONSE'
  | 'COLLECTION_TAKEN'
  | 'NOTIFICATION'
  | 'DOOR_READY'
  | 'DOOR_OPENING'
  | 'FINAL_HANDOFF';

export interface AppStoreState {
  currentState: ExperienceState;
  gifts: GiftItem[];
  selectedGiftId: string | null;
  config: ExperienceConfig;
  isAudioMuted: boolean;
  nameInputError: string | null;
  isAnimating: boolean;
  doorOpened: boolean;
}

// Local storage key for persistent user customizations
const STORAGE_KEY = 'interactive_giftbox_config_v1';

export function loadSavedConfig(): ExperienceConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: ExperienceConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

