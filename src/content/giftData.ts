export interface LetterCard {
  title: string;
  body: string;
  signOff?: string;
}

export interface GiftItem {
  id: string;
  type: 'wrapped' | 'letters' | 'letter' | 'voice' | 'song' | 'photos' | 'interest' | 'secret';
  title: string;
  subtitle: string;
  previewIcon: string;
  boxColor: string;
  accentColor: string;
  isOpened: boolean;
  isCollected: boolean;
  content: {
    heading: string;
    subheading?: string;
    bodyText?: string;
    letters?: LetterCard[];
    photos?: Array<{ url: string; caption: string; date?: string; backNote?: string }>;
    audioTitle?: string;
    audioDuration?: string;
    lyrics?: string[];
    specialActionLabel?: string;
  };
}

export interface ExperienceConfig {
  unlockName: string;
  recipientName: string;
  creatorName: string;
  whatsappNumber: string;
  whatsappMessage: string;
  customLetterText: string;
  voiceNoteTranscript: string;
}

export const DEFAULT_CONFIG: ExperienceConfig = {
  unlockName: 'Subhajit',
  recipientName: 'Diya',
  creatorName: 'Subhajit',
  whatsappNumber: '916001155729',
  whatsappMessage: "Please write below if you liked it. Thats a small gift I thought of making for you while we are still away. Its just a beginning, I want to celebrate your birthday in much bigger ways in future🥺❤️.",
  customLetterText: `From the very first moment our paths crossed, you brought a warmth and magic into my life that nothing else could ever compare to.

Every smile you share, every laugh we've had, every quiet late-night talk has become one of my most cherished memories. You are kind, beautiful, brilliant, and completely irreplaceable to me.

I made this little world just for you, to remind you on this special day how deeply loved, celebrated, and appreciated you are.

Happy Birthday, my love. Today, tomorrow, and every day after.

Forever yours,
Subhajit ❤️`,
  voiceNoteTranscript: "Hey... I just wanted you to hear this in my own voice. You mean more to me than words on a screen can ever express. Thank you for being you, for filling my life with so much happiness. I have something special waiting for you... Keep opening your gifts, okay? Love you always.",
};

export const INITIAL_GIFTS: GiftItem[] = [
  {
    id: 'gift-1',
    type: 'wrapped',
    title: 'A Little Forever Hug',
    subtitle: 'Miniature Keepsake Box',
    previewIcon: '🧸',
    boxColor: '#8a2846',
    accentColor: '#f7d070',
    isOpened: false,
    isCollected: false,
    content: {
      heading: 'A Tiny Companion For You',
      subheading: 'Whenever you miss me or need a smile',
      bodyText: 'Inside this tiny box is a little companion that carries all my hugs. Whenever you have a long day, feel tired, or just need to know someone is cheering for you with all their heart, remember this little guy is holding that love for you.',
      specialActionLabel: 'Unwrap Mini Box',
    },
  },
  {
    id: 'gift-2',
    type: 'letters',
    title: 'Four Little Letters',
    subtitle: 'Open Them One At A Time',
    previewIcon: '💌',
    boxColor: '#d4af37',
    accentColor: '#8a2846',
    isOpened: false,
    isCollected: false,
    content: {
      heading: 'A Few Words, Kept Just For You',
      subheading: 'There are four letters inside. Swipe through them slowly.',
      specialActionLabel: 'Open the Letters',
      // Personalize these four notes whenever you are ready.
      letters: [
        {
          title: 'Letter One · The Beginning',
          body: 'Somewhere along the way, knowing you became one of the softest and happiest parts of my days. I hope you always know how special that is to me.',
          signOff: 'With a full heart,',
        },
        {
          title: 'Letter Two · The Little Things',
          body: 'It is the little things I keep close: your laugh, your kindness, the way you make ordinary moments feel warm. You make life feel more beautiful simply by being in it.',
          signOff: 'Always noticing you,',
        },
        {
          title: 'Letter Three · My Promise',
          body: 'On the easy days and the difficult ones too, I want to be someone who reminds you how capable, loved, and wonderful you are. I will keep choosing you with care.',
          signOff: 'Here for you,',
        },
        {
          title: 'Letter Four · Just Us',
          body: 'This is only a small gift, but every part of it carries the same truth: you mean so much to me. Thank you for being exactly who you are.',
          signOff: 'Forever yours,\nSubhajit ❤️',
        },
      ],
    },
  },
  // {
  //   id: 'gift-2',
  //   type: 'letter',
  //   title: 'A Sealed Parchment',
  //   subtitle: 'Wax-Sealed Love Letter',
  //   previewIcon: '💌',
  //   boxColor: '#d4af37',
  //   accentColor: '#800020',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'From My Heart To Yours',
  //     subheading: 'Break the wax seal to read',
  //     bodyText: '', // Filled from config
  //     specialActionLabel: 'Break Wax Seal',
  //   },
  // },
  // {
  //   id: 'gift-3',
  //   type: 'voice',
  //   title: 'A Voice Memo For You',
  //   subtitle: 'Vintage Cassette Tape',
  //   previewIcon: '🎙️',
  //   boxColor: '#301824',
  //   accentColor: '#e5a3b0',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'Listen Closely...',
  //     subheading: 'Recorded just for this moment',
  //     audioTitle: 'A Heartfelt Message — Subhajit.wav',
  //     audioDuration: '0:34',
  //     bodyText: 'Tap play to listen to what I wanted to tell you today.',
  //     specialActionLabel: 'Play Voice Memo',
  //   },
  // },
  // {
  //   id: 'gift-4',
  //   type: 'song',
  //   title: 'Our Special Melody',
  //   subtitle: 'Golden Music Box',
  //   previewIcon: '🎵',
  //   boxColor: '#4a202d',
  //   accentColor: '#ffd700',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'Music Box Melody',
  //     subheading: 'A song that always makes me think of you',
  //     audioTitle: 'Can\'t Help Falling In Love (Celesta & Acoustic Chimes)',
  //     lyrics: [
  //       'Wise men say only fools rush in...',
  //       'But I can\'t help falling in love with you.',
  //       'Shall I stay? Would it be a sin...',
  //       'If I can\'t help falling in love with you?'
  //     ],
  //     specialActionLabel: 'Wind Music Box',
  //   },
  // },
  // {
  //   id: 'gift-5',
  //   type: 'photos',
  //   title: 'Moments In Time',
  //   subtitle: 'Ribbon-Tied Polaroids',
  //   previewIcon: '📷',
  //   boxColor: '#201018',
  //   accentColor: '#f0c6c6',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'Favorite Memories Together',
  //     subheading: 'Tap photos to flip and read notes',
  //     photos: [
  //       {
  //         url: 'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=700&q=80',
  //         caption: 'Under the warm city lights',
  //         date: 'The Night Everything Changed',
  //         backNote: 'I remember this exact evening. You laughed so hard your eyes crinkled, and I knew right then I never wanted to be anywhere else.'
  //       },
  //       {
  //         url: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=700&q=80',
  //         caption: 'Sunset by the quiet shore',
  //         date: 'Our Favorite Escape',
  //         backNote: 'Just the sound of the breeze and your hand in mine. Peaceful, effortless, perfect.'
  //       },
  //       {
  //         url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=700&q=80',
  //         caption: 'Warm coffees & endless talks',
  //         date: 'A Cozy Sunday Afternoon',
  //         backNote: 'Hours slipped away like minutes. We can talk about everything and nothing at all.'
  //       },
  //       {
  //         url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=700&q=80',
  //         caption: 'Looking at the stars',
  //         date: 'Your Birthday Eve',
  //         backNote: 'Wishing on every shooting star that every single dream of yours comes true this year.'
  //       }
  //     ],
  //     specialActionLabel: 'Untie Photo Bundle',
  //   },
  // },
  // {
  //   id: 'gift-6',
  //   type: 'interest',
  //   title: 'Celestial Keepsake',
  //   subtitle: 'Constellation Locket',
  //   previewIcon: '✨',
  //   boxColor: '#1c1b35',
  //   accentColor: '#9ac4f8',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'The Night Our Stars Aligned',
  //     subheading: 'Coordinates: 12° October • Infinite Love',
  //     bodyText: 'They say the stars in the night sky take billions of years to align just right. Out of all the galaxies and all the time in the universe, I got to find you. That makes me the luckiest person in existence.',
  //     specialActionLabel: 'Open Celestial Locket',
  //   },
  // },
  // {
  //   id: 'gift-7',
  //   type: 'secret',
  //   title: 'A Secret Promise',
  //   subtitle: 'Hidden Velvet Case',
  //   previewIcon: '🗝️',
  //   boxColor: '#2b0918',
  //   accentColor: '#ffdf79',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'The Golden Promise Key',
  //     subheading: 'To my heart, today and always',
  //     bodyText: 'You found the secret compartment! This golden key is a symbol of my unending support, patience, loyalty, and love for you. No matter what changes in this world, this key never rusts and never locks you out.',
  //     specialActionLabel: 'Unlock Secret Box',
  //   },
  // },
  // {
  //   id: 'gift-8',
  //   type: 'interest',
  //   title: 'A Starlight Wish',
  //   subtitle: 'Moonlit Keepsake',
  //   previewIcon: '🌙',
  //   boxColor: '#251437',
  //   accentColor: '#c9b7ff',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'One Wish, Made For You',
  //     subheading: 'Written somewhere between the stars',
  //     bodyText: 'If I could tuck one wish into the night sky for you, it would be this: that life always finds a way to be gentle with your heart, and that you never forget how brightly you are loved.',
  //     specialActionLabel: 'Open Moonlit Keepsake',
  //   },
  // },
  // {
  //   id: 'gift-9',
  //   type: 'secret',
  //   title: 'A Sweet Little Token',
  //   subtitle: 'Rose-Gold Treasure Case',
  //   previewIcon: '💗',
  //   boxColor: '#6b1738',
  //   accentColor: '#f6a8bd',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'A Token of My Favorite Thing',
  //     subheading: 'You, exactly as you are',
  //     bodyText: 'This tiny treasure is a reminder that the smallest things about you are the ones I hold closest: your laugh, your kindness, and every little way you make ordinary days feel extraordinary.',
  //     specialActionLabel: 'Open Treasure Case',
  //   },
  // },
  // {
  //   id: 'gift-10',
  //   type: 'song',
  //   title: 'Our Midnight Melody',
  //   subtitle: 'After-Hours Music Box',
  //   previewIcon: '🎼',
  //   boxColor: '#17192e',
  //   accentColor: '#88b8ff',
  //   isOpened: false,
  //   isCollected: false,
  //   content: {
  //     heading: 'A Song for the Quiet Hours',
  //     subheading: 'For every late-night thought of us',
  //     audioTitle: 'Midnight Promise — Music Box Edition',
  //     lyrics: [
  //       'For every quiet moment, I will find my way to you.',
  //       'For every new tomorrow, I will choose you too.',
  //       'Under every starlight, one thing will stay true:',
  //       'Home has always sounded a little like you.'
  //     ],
  //     specialActionLabel: 'Play Midnight Melody',
  //   },
  // },
];

