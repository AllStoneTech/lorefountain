# BBC Radio Drama Export (LoreFountain Pro)

BBC Radio Drama Export is a paid-tier feature: reflows a single script
into BBC-style radio-drama layout — a Word document, not a Fountain
file. If running **"Export BBC Radio Script (Pro)"** instead prompts for
a license key, run **Command Palette → "LoreFountain: Enter License
Key"** to unlock it.

## Running it

Per script, not per project. With a `.fountain` file active, run the
command (editor title bar or Command Palette) to export that script
directly. With no `.fountain` file active and more than one script in
the project, you'll get a picker. Output is always `.docx`, saved next
to the script as `<script-name>.bbc-radio.docx`.

## Cue terminology, translated to house style

LoreFountain's own `SFX:`/`MUSIC:`/`AMB:` cues are translated to BBC
radio convention on export:

| LoreFountain | BBC radio script |
|---|---|
| `SFX:` | **FX:** |
| `MUSIC:` | **GRAMS:** |
| `AMB:` | **ATMOS:** |

Any Role/Timing modifier on a `MUSIC:` cue (`BED`, `STING`, `BRIDGE`,
`SOURCE BED`, `IN`, `OUT`) carries over into the translated line.

## What's deliberately different from the screenplay

These aren't gaps — they're intentional decisions about what actually
translates to audio-only radio format:

- **Dual dialogue** renders as two ordinary sequential turns, no overlap
  marker — radio layout has no side-by-side track concept the way a
  screenplay page does.
- **Transitions** (`CUT TO:`, etc.) are dropped entirely, not rendered
  as a direction — they're visual-editing language with no meaning in
  an audio-only medium.
- **Scene numbers are fully sequential** (1, 2, 3…) by the order scenes
  appear, not Fountain's own optional scene-number annotation — matching
  real BBC radio-script practice.

## Format

12pt Courier New throughout. Character names sit flush left with
dialogue continuing after the colon; wrapped lines land at a hanging
indent rather than the left margin. Directions and cues are uppercase
and underlined at a fixed indent. No Table of Contents — a single linear
script has no cross-section navigation need for one.
