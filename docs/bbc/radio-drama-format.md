# BBC Radio Drama Script Format — Research Notes

Reference material gathered ahead of building the **BBC Radio Drama
Export** paid-tier feature (see `docs/TODO.md`/`pro/README.md`). The
official BBC Writers' Room template
(`downloads.bbc.co.uk/writersroom/scripts/bbcradioscene.pdf`) could not be
fetched directly in this environment — `bbc.co.uk`, `reddit.com`, and
`web.archive.org` were all blocked. These notes are synthesized from
secondary sources that describe the same convention in enough concrete
detail to build against; revisit against a real produced BBC script or the
official template directly if one becomes available before implementation.

## Page layout

- **Font**: 12pt Courier or Courier New.
- **Spacing**: double-spaced throughout.
- Wide left gutter reserved for handwritten director/cast annotations —
  this is *why* the indentation below looks as generous as it does.

## Character cues and dialogue

- Character name sits **flush against the left margin**, followed by a
  colon.
- Dialogue is **indented roughly 4cm from the margin**, continuing after
  the colon — not stacked on its own line below the name the way a
  screenplay/Fountain character cue is.

## Directions and scene numbers

- Stage/scene directions are indented **roughly 9cm from the left edge**,
  written in **UPPERCASE and underlined**.
- Scene numbers are optional, sharing that same ~9cm indent.
- **No literal scene-heading text** (no `INT./EXT. LOCATION — TIME`) — the
  audience can't see it, so unlike screen format it carries no narrative
  information. Scene boundaries are marked structurally (by number), not
  described.
- **No act breaks** — radio drama runs continuous; acts, as a structural
  unit, don't apply the way they do on stage.

## Performance directions

- Parenthetical delivery directions (e.g. `(IN A SEXY TONE)`) are used
  sparingly — "use the minimum necessary to convey the meaning."
- A small set of standard abbreviations covers recurring vocal directions
  rather than free-text description every time.

## Source

Synthesized from a UK screenwriter's blog post on radio script formatting,
which explicitly cites and summarizes the BBC Writers' Room formatting
guidance: [Formatting Scripts #3: Radio](https://johnmcwriter.wordpress.com/2012/06/06/formatting-scripts-3-radio/).

See also `docs/bbc/audio-drama-cue-conventions.md` for FX/music cue
notation — that source is the broader (non-BBC-specific) audio-drama
tradition, useful for both this feature and the separately-queued
SFX/Cue-Sheet Export.
