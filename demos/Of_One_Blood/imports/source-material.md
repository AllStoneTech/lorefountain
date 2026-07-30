# Source material

**Title:** *Of One Blood; or, The Hidden Self*
**Author:** Pauline Elizabeth Hopkins (1859–1930)
**First publication:** Serialized in *The Colored American Magazine*, November 1902 – November 1903
**Public domain status:** Published before 1930; in the U.S. public domain.
**Full text:** [Project Gutenberg #69255](https://www.gutenberg.org/ebooks/69255) (24 chapters)
**Local copy:** `Of One Blood; or, The Hidden Self (Pauline Hopkins, serialized 1902–03).epub`, in this folder — the exact edition the second pass was built from.
**Reading copies:** `Of One Blood - Pauline Hopkins.docx` and `.pdf`, at the project root — the full public-domain text reformatted with a title page, table of contents, and one heading per chapter, for anyone who wants to read the source itself rather than this project's adaptation of it.

## Provenance of this demo

This world was built in two passes. The first pass was written from secondary summaries (Wikipedia, study guides) and got the broad shape of the plot right but missed or invented a number of specifics. The second pass read the actual 24-chapter text (a Gutenberg-sourced EPUB) chapter by chapter and rebuilt every entity, timeline event, and script against it. All 24 `.fountain` scripts map one-to-one onto the novel's 24 chapters.

## What this demo took from the novel

Character names, relationships, and dialogue beats; named locations; the exact sequence and mechanics of the plot (including details easy to get wrong, like who actually poisons whom, and the precise baby-swap mechanism behind the sibling reveal) — all facts and structure from the published work, not its exact wording.

## What this demo did not take

No prose, dialogue, or descriptive passages were copied verbatim from the original novel — every entity description, timeline event, and `.fountain` script scene here is an original write-up or dramatization for demonstration purposes. Anyone wanting the author's actual words should read the novel itself at the link above.

## Known gaps and a source inconsistency worth knowing about

- **Very minor one-scene characters** (party guests like Bert Smith or Skelton) were left out; everyone with a recurring role or a resolved arc is modeled.
- **The novel itself contradicts its own geography**: Aubrey's ancestral home is explicitly Virginia (Laurel Hill) in the early chapters, but explicitly Maryland ("Livingston Hall") by the later ones. Rather than silently picking one, both are modeled as separate location entities, with `livingston-hall.md` marked `canon_status: contradicted` — a real example of the kind of inconsistency LoreFountain's canon-status field exists to surface, not something introduced by this adaptation.
- **The novel also gives one recurring character two different names** — "Ababdis" the camel-driver/Telassar agent is later called "Abdallah" in two chapters, which is also the name of an unrelated Tripoli sheikh introduced earlier. `ababdis.md` is marked `canon_status: contradicted` for the same reason.
