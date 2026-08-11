---
name: Hollow Chain
type: faction
aliases: [the Chain]
tags: [pirates, smugglers]
canon_status: established
significance: main
physical_description: |
  Colors: None unified — deliberately mismatched
  Emblem: A broken chain link, worn as a tattoo or stitched patch rather than a proper insignia
  Uniform: Whatever gear survived the last job; no two Chain crew look like they serve the same outfit

  That's the point — a Hollow Chain ship is built to be mistaken for anything but a Hollow Chain ship, right up until it isn't.
custom_fields:
  goal: Loot whatever's loose before the Concern locks the site down for good
  resources: Fast ships, no legal standing, no loyalty past the next payday
tracked_fields:
  posture:
    - order: 1
      value: Circling the Loom for opportunity, keeping a low profile
      timing: narrative
      in_universe_date: "1x01"
    - order: 2
      value: Tried and failed to take the Chord Key by force; pulled back to wait for a better opening rather than press further
      timing: narrative
      in_universe_date: "1x04"
relations:
  - target: tessera-concern
    relation_type: rival
  - target: verge-compact
    relation_type: rival
    attitude: actively hunted by them
---

A smuggler-pirate cartel under [[Dray Ushant]], circling the Loom for anything portable before the Concern's claim makes looting it a genuinely bad idea. Doesn't care what the Loom is — only what it's worth, and to whom, before someone smarter shows up.
