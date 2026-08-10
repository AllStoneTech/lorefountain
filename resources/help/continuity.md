# The Continuity View (LoreFountain Pro)

Continuity Management is a paid-tier feature: automated consistency
checking over the same World/Scripts data you already maintain, rather than
a place you author new content directly. If this view instead shows a
single row prompting for a license key, run
**Command Palette → "LoreFountain: Enter License Key"** to unlock it.

## What each category shows

- **Overview** — an at-a-glance health summary, expanded by default: one
  line per category below it (Canon breakdown, Presence, open Flags,
  Doubling conflicts, Timeline event counts).
- **Canon Status** — every entity grouped by its `canon_status` field
  (established / tentative / contradicted / unset). Populate it by setting
  **Canon Status** on an entity's Story Card.
- **Presence** — which characters are on-screen in which scenes, across
  every script. This is derived automatically by scanning scene headings and
  character cues — nothing to populate by hand, just write scripts normally
  with recognizable character names.
- **Flags** — automatic mismatches between what a script implies and what
  the World declares:
  - *Location mismatch*: a character appears in a scene at a location that
    doesn't match their declared `located-in` relation. Keep that relation
    current on the character's Story Card to avoid false positives.
  - *First-appearance mismatch*: an entity's `first_appearance` field names
    an episode earlier than where it actually first appears in the scripts.
  These are computed, not created directly — fix the underlying field or
  the script, and the flag clears on its own.
- **Doubling** — flags two characters sharing the same `voice_actor` value
  appearing together in one scene (a casting conflict for audio drama).
  Populate it by setting **Voice Actor** on each Character's Story Card.
- **Timeline** — browses Timeline events (World view → Timeline) with both
  positions shown side by side: narrative (`production_code` or a manual
  `narrative_order`) and chronological (`chronological_order` /
  `in_universe_date`). **Command Palette → "LoreFountain: View As of
  Episode"** filters the world down to only what's been established by a
  chosen episode, using this same data — an event needs a resolvable
  narrative position and a `chronological_order` to be included.
