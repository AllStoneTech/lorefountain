# Shot List Export (LoreFountain Pro)

Shot List Export is a paid-tier feature: turns a script's `SHOT:`/
`POSE:`/`LIGHT:`/`DURATION:` annotations into a pre-production camera
breakdown. If running **"Export Shot List (Pro)"** instead prompts for a
license key, run **Command Palette → "LoreFountain: Enter License
Key"** to unlock it.

## The annotation convention

See `agents/script-writer.md`'s "shot-list convention" section for the
full syntax — in short: `SHOT:` opens a new shot (freeform framing,
e.g. `WIDE`, `CLOSE-UP on SANGO`); `POSE:`, `LIGHT:`, and `DURATION:`
set fields on whichever shot is currently open. Shots number
sequentially within each scene, resetting at every scene heading. This
convention is free to annotate in any project — only the export itself
requires Pro.

## Running it

Per script — editor title bar or Command Palette, same
active-editor/picker behavior as the other per-script exports. You'll
be asked for a format — **CSV**, **Markdown**, or **Both** — then one
save dialog (`<script-name>.shot-list.csv` as the primary filename).
Choosing Both writes a `.md` sibling automatically and opens it.

## What's in it

- **CSV columns**: `Scene #, Scene Heading, Shot #, Description, Pose,
  Lighting, Duration`.
- **Markdown**: `Scene | Shot # | Description | Pose | Lighting |
  Duration`, with Scene combined into one readable cell.

`Duration` is always the raw text you typed after `DURATION:` (e.g.
`~5 seconds`), not a parsed number — what you actually wrote is what a
human reviewing the sheet wants to see. A `POSE:`/`LIGHT:`/`DURATION:`
line with no `SHOT:` open yet is simply ignored, not an error.
