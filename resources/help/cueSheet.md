# SFX/Cue-Sheet Export (LoreFountain Pro)

Cue-Sheet Export is a paid-tier feature: turns a script's `SFX:`/
`MUSIC:`/`AMB:` cues into a working list for a recording or mixing
session. If running **"Export Cue Sheet (Pro)"** instead prompts for a
license key, run **Command Palette → "LoreFountain: Enter License
Key"** to unlock it.

## Running it

Per script — editor title bar or Command Palette, with the same
active-editor/picker behavior as other per-script exports. You'll be
asked for a format — **CSV**, **Markdown**, or **Both** — then one save
dialog (CSV as the primary filename, `<script-name>.cue-sheet.csv`).
Choosing Both writes a `.md` sibling automatically and opens it; the
`.csv` isn't opened as a text document, since it's meant for a
spreadsheet.

## What's in it

Every cue in document order, numbered sequentially, with the scene it
falls in (blank/"—" for a cue before the first scene heading, not a
scene-0 placeholder).

- **CSV columns**: `Cue #, Scene #, Scene Heading, Type, Music Role,
  Timing, Description, Checked`. Scene # and Scene Heading are separate
  columns so a spreadsheet can sort/filter the number cleanly; `Checked`
  is intentionally blank, for ticking off cues live during a session.
- **Markdown**: `Cue # | Scene | Type | Role / Timing | Description` —
  Scene and Role/Timing are combined into single readable cells here,
  since this version is for reading, not spreadsheet sorting.

Cue type and Music Role/Timing keep LoreFountain's own vocabulary
(`SFX`/`MUSIC`/`AMB`, `BED`/`STING`/`BRIDGE`/`SOURCE BED`, `IN`/`OUT`) —
this export doesn't translate terminology. If you need BBC house style
(`FX`/`GRAMS`/`ATMOS`) instead, that's what **BBC Radio Drama Export**
(also Pro) produces, as a full script reflow rather than a working cue
list.
