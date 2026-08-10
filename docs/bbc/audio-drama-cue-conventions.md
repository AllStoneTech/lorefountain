# Audio Drama Cue-Writing Conventions — Research Notes

Companion to `docs/bbc/radio-drama-format.md`. This source describes the
broader (US/general audio-drama, not BBC-specific) convention for writing
dialogue, sound-effect, and music cues in a produced-for-audio script.
Relevant to both the future **BBC Radio Drama Export** feature and the
separately-queued **SFX/Cue-Sheet Export** feature, since LoreFountain's
existing `SFX:`/`MUSIC:`/`AMB:` cue convention (`src/cues/parseCues.ts`)
already captures similar structured data.

## Overall format

- 12pt bold Courier New (or 14pt for readability), double-spaced —
  optimized for live, real-time reading during recording, not just
  silent reading.
- Every cue — dialogue, music, and sound effects — gets its own number,
  restarting from 1 per page or per scene, so a director can call out
  "page 14, cue 8" instead of reading lines aloud to locate a spot.

## Dialogue cues

- Character name in ALL CAPS, left-aligned/indented; dialogue follows on
  the next line, also indented, in mixed case — never underlined.
- Lines break at natural phrases, roughly 60–70 characters, for easy
  tracking mid-read.
- Delivery directions in parentheses, ALL CAPS, e.g. `(SARCASTIC)`,
  `(GASPS)`, `(LAUGHING)`.
- Technical/processing directions in brackets, e.g. `[FILTERED]`,
  `[REVERB]`, `[P.A. ECHO]`, distinguishing voice-processing notes from
  performance notes.
- Special markers: `(ENTERING/EXITING)`, `(DISTANT, OFF MIC)`, `(TO SAM)`,
  `[CUE]` (wait for a director signal), `[CONT'D...]` (dialogue continues
  next page).
- Numbers/uncommon words get a bracketed phonetic pronunciation inline.

## Music cues

- Underlined, numbered separately from dialogue/SFX.
- Structure: a **cue type** in parentheses — `(BRIDGE)` standalone between
  scenes, `(BED)` underlying dialogue, `(STING)` brief punctuation,
  `(SOURCE BED)` diegetic music the characters themselves hear — plus a
  **track id** in brackets (e.g. `[MUS-21]`) and a short descriptive name.
- Engineer playback instructions appended as needed: `FADE IN`,
  `FADE OUT`, `FADE UNDER`, `ESTABLISH`, `UNDER`, `DUCK UNDER`,
  `LET IT FINISH`, `CROSSFADE`, `CUT ABRUPTLY`.

## Sound-effect cues

- Underlined, structured as **noun → verb → modifier**, describing the
  actual sound rather than the device producing it (avoid "the sound
  of…").
- Attribute effects to a specific character/source where it matters
  ("Tim's footsteps," not generic footsteps).
- Pre-recorded/sampled effects get a bracketed id, e.g. `[FX-24S]`.
- Crowd sound ("walla") is marked `WALLA--` plus a short description;
  favor mumbling over intelligible words so it doesn't compete with
  scripted dialogue.
- Silence is cued explicitly, e.g. "SILENCE FOR 3 SECONDS THEN [REVERBED]
  CRASH."

## Page furniture

- Header (top right): program title, episode number, page number, small
  font (distinct from script body text).
- Footer: production company / writer contact / revision date.
- Revised pages marked `REVISED`, with inserted pages lettered
  (`49-A`, `49-B`) rather than renumbering the whole script.

## Source

[How to Write Radio Play Script Cues for Dialogue, Music, and Sound Effects](https://ruyasonic.com/wrt_cues.htm).
