# Audio playlist

Replace these filenames with the songs you want. Keep the names exactly as written so the experience can find them.

| File | When it plays |
| --- | --- |
| `birthday-room.mp3` | Automatically plays in the birthday room |
| `gift-room.mp3` | Automatically plays in the keepsake gift room |
| `gift-open.mp3` | When she opens the four-letter gift |
| `proposal.mp3` | Automatically plays in the proposal room |

Add your chosen room tracks using the filenames above, or update the matching arrays in `src/content/playlist.ts`. MP3, M4A, and OGG work. Room music starts after the first tap that opens each room and continues through the scene; there is no in-page music-off control. Add extra tracks to a room's array to play them in sequence and loop them.
