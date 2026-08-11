# Entity Graph (LoreFountain Pro)

Entity Graph is a paid-tier feature: a visual map of the deliberate,
typed relationships you've declared between entities. If running
**"Show Entity Graph (Pro)"** instead prompts for a license key, run
**Command Palette → "LoreFountain: Enter License Key"** to unlock it.

## What it shows

- One node per entity that's a source or target of at least one
  `relations:` entry — shaped and colored by type (character, location,
  faction, object, concept, arc all look distinct at a glance).
- One labeled edge per relation, pointing from source to target, labeled
  with its `relation_type` (e.g. "sibling," "rules," "member").
- The layout is force-directed and re-lays itself out automatically
  whenever your World data changes — no manual arranging.

## What it doesn't show

Only declared `relations:` entries are drawn — **not** automatic mentions
or backlinks (a name simply appearing in another entity's prose, or in a
script). Mixing those in would turn this into a hairball of every
name-drop in the project rather than the deliberate relationship web
you've actually authored. If an entity has no `relations:` of its own and
nothing else targets it, it simply won't appear as a node — that's
expected, not a bug. Add a `relations:` entry on its Story Card to bring
it into the graph.

## Using it

- Click any node to open that entity's Story Card directly.
- Pan and zoom like any other graph view; drag nodes to rearrange them
  temporarily (the next data change re-lays everything out again).
- Re-running the command reveals the same panel rather than opening a
  second one; each workspace folder in a multi-root workspace gets its
  own independent panel.
