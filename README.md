# Interactive 3D Digital Gift Box 🎁

A cinematic, fully interactive birthday gift experience built strictly in accordance with the **Production Specification & Non-Negotiable Requirements**.

---

## 🌟 Implemented Features & Architecture

### 1. Visual & Art Direction
- **Color Palette**: Deep burgundy (`#3b0a1a`, `#4a0e23`), warm ivory (`#faf6f0`), muted rose (`#c87d88`), and champagne/gold accents (`#d4af37`) against dark neutral cinematic backgrounds.
- **Lighting & Depth**: Key spotlight with soft shadows, fill lighting, radial pedestal shadow, warm interior box light that blooms as the lid opens, and ambient floating golden dust particles.
- **Typography**: Editorial luxury serif (`Cormorant Garamond` & `Playfair Display`) for emotional storytelling and clean sans-serif (`Plus Jakarta Sans`) for controls.

### 2. State Machine & Flow
Explicit state machine implementation matching the PDF specification:
`BOOT` ➔ `LOCKED` ➔ `NAME_ENTRY` ➔ `VALIDATING` ➔ `UNLOCKED` ➔ `UNWRAPPING` ➔ `BOX_OPEN` ➔ `GIFT_SELECTION` ➔ `GIFT_OPENING` ➔ `GIFT_CONTENT` ➔ `GIFT_COMPLETED` ➔ `COLLECTING` ➔ `GIFT_SELECTION` ➔ `ALL_GIFTS_COMPLETED` ➔ `TEDDY_INTRO` ➔ `TEDDY_QUESTION` ➔ `TEDDY_RESPONSE` ➔ `COLLECTION_TAKEN` ➔ `NOTIFICATION` ➔ `DOOR_READY` ➔ `DOOR_OPENING` ➔ `FINAL_HANDOFF`.

### 3. Opening Sequence (Physical Locked Gift Box)
- **3D Gift Box**: Burgundy velvet body, gold trim, cross ribbons, satin bow, and metallic brass padlock.
- **Lock Validation**: Prompt: *"Who is the guy you love?"* Minimalist input with whitespace and case-insensitive normalization. Subtle lock reaction shake & feedback on mismatch.
- **Mechanical Lock Release**: Padlock shackle pivots open, slides out, and drops with metallic acoustic sound effects.
- **Ribbon & Unwrapping**: Bow loosens and unties with tension and easing; wrapping panels slide open; hinged lid swings back 115° with warm golden interior light spilling outward.
- **Instruction**: Settles into the required prompt: *"I left a few things inside for you. Take your time."*

### 4. 7 Distinct Discoverable Gifts & Reveals
Every gift has its own 3D representation inside the box and unique reveal modal:
1. **Wrapped Miniature Companion**: Tap to unwrap ribbon ➔ Reveals a 3D keepsake plush bear with golden heart and sweet companion note.
2. **Wax-Sealed Parchment Love Letter**: Tap to break wax seal ➔ Unfolds handwritten vows & emotional letter on textured parchment.
3. **Vintage Cassette Voice Note**: Retro cassette tape with spinning spools, dynamic audio waveform visualizer, play/pause controls, and spoken voice playback.
4. **Golden Music Box & Our Song**: Wind-up cylinder with playable celesta bell notes & dedicated lyrics to *"Can't Help Falling In Love"*.
5. **Memory Polaroids Bundle**: Fanned vintage Polaroid cards with flip-to-read handwritten memories on the back.
6. **Celestial Star Keepsake**: Glowing celestial constellation sphere with coordinates of the night you met.
7. **Secret Promise Key**: Hidden velvet box nestled in the corner revealing the golden promise key and forever vow.

### 5. Collection Basket System
- When any gift is finished, tapping **"Collect in Basket"** launches a physics-like 3D arc trajectory.
- The item ascends, swooshes across the screen into the wire basket, scales down, and settles with a soft thud.
- The collection basket counter updates (e.g. `4 of 7 collected`).

### 6. Teddy Character Narrative Ending
- Once all 7 gifts are collected, the empty box and filled basket are framed.
- **Barnaby the Keepsake Bear** waddles in with animated legs, arms, and cute footsteps.
- Teddy inspects the basket and playfully asks: *"Can I keep them for myself? 🥺"*
- When the user selects "No": Teddy winks cheekily: *"Hehehe, too bad! I'm taking the basket anyway! Come find me outside! 🧸💨"* and waddles away into the shadows.

### 7. In-World Notification & Final 3D Door
- An intentional in-world glassmorphic notification slides in with a crystal chime:  
  *"Knock knock… If you're done unwrapping your gifts, your guy is waiting to see you outside."*
- A classical arched 3D wooden door appears with the prompt: *"Tap to Open the Door"*.
- Tapping triggers brass handle rotation, latch unclick, and heavy hinges swinging open 85°, revealing a warm starlit portal!
- Final Card: Direct **"Message on WhatsApp"** button opening `wa.me` with pre-filled text, plus a **"Relive The Experience"** replay button.

### 8. Web Audio Procedural Sound Engine
Zero external MP3 dependencies, 100% reliable across browsers:
- Lock shackle snap & metallic clink
- Lock rejection thud
- Ribbon friction swoosh
- Paper crinkling & unwrapping
- Wood hinge creak & golden chime reveal
- Wax seal snap
- Music box celesta / bell notes
- Photo slide swooshes
- Teddy soft footsteps
- In-world notification glass ping
- Brass door latch & heavy door swing
- Ambient background romantic arpeggiated piano melody with toggle controls.

### 9. Customization & Settings
Tap the subtle gear icon (`⚙️`) in the top-right corner to customize:
- Unlock Name (Default: `Subhajit`)
- Recipient Name
- Creator Name
- WhatsApp Number & Pre-filled Message
- Custom Letter Text
- Voice Note Transcript

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build

# 4. Preview production build
npm run preview
```
