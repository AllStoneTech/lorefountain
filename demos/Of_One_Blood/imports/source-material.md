# Source material

> **CONTENT NOTE.** This demo adapts an 1902–03 novel about race, slavery and passing, and it keeps the period's language as written — including racial slurs ("Negress," "nigger") and dialect speech for Black characters — rather than softening it. It also deals with coerced relationships, incest between half-siblings and a coerced marriage, poisoning, murder and suicide.

**Title:** *Of One Blood; or, The Hidden Self*
**Author:** Pauline Elizabeth Hopkins (1859–1930)
**First publication:** Serialized in *The Colored American Magazine*, November 1902 – November 1903
**Public domain status:** Published before 1930; in the U.S. public domain.
**Full text:** [Project Gutenberg #69255](https://www.gutenberg.org/ebooks/69255) (24 chapters)
**Local copy:** `Of One Blood; or, The Hidden Self (Pauline Hopkins, serialized 1902–03).epub`, in this folder — the exact edition the second pass was built from.
**Full text as Markdown:** [`of-one-blood.md`](of-one-blood.md) — the complete text extracted from that EPUB: title, byline, linked table of contents, one heading per chapter (the edition gives only "CHAPTER I." etc., no chapter titles), paragraphs as single lines, verse and letters as block quotes, scene breaks as `---`, italics as `*…*`, followed by the Transcriber's Notes and the Project Gutenberg provenance and license. Page-number markers were dropped; no word was changed (checked programmatically, chapter by chapter, against the EPUB's own text).
**Reading copies:** `Of One Blood - Pauline Hopkins.docx` and `.pdf`, at the project root — the full public-domain text reformatted with a title page, table of contents, and one heading per chapter, for anyone who wants to read the source itself rather than this project's adaptation of it.

## Provenance of this demo

This world was built in two passes. The first pass was written from secondary summaries (Wikipedia, study guides) and got the broad shape of the plot right but missed or invented a number of specifics. The second pass read the actual 24-chapter text (a Gutenberg-sourced EPUB) chapter by chapter and rebuilt every entity, timeline event, and script against it. All 24 `.fountain` scripts map one-to-one onto the novel's 24 chapters.

## What this demo took from the novel

Character names, relationships, and dialogue beats; named locations; the exact sequence and mechanics of the plot (including details easy to get wrong, like who actually poisons whom, and the precise baby-swap mechanism behind the sibling reveal) — all facts and structure from the published work, not its exact wording.

## What this demo did not take

Entity descriptions and timeline events are original write-ups. The `.fountain` scripts dramatize each chapter and, in a good many places, reuse the novel's own lines of dialogue and short phrases (the text is in the public domain); they compress or omit most of the narration. Anyone wanting the author's full words should read `of-one-blood.md` or the novel at the link above.

## Review against the source

Every script, entity, timeline event, glossary term, note and `world/OVERVIEW.md` was re-checked against `of-one-blood.md`, chapter by chapter. Production codes (`1x01`–`1x24`) match chapter numbers I–XXIV one-to-one. Found and fixed:

- **Marriage not secret.** Reuel and Dianthe marry the morning he sails, with the Vances and friends toasting "the marriage of the morrow"; OVERVIEW, entities, and timeline wrongly said "in secret."
- **Expedition not "funded" by Aubrey.** He arranges the paid post; the "Aubrey's money" claim in `aubrey-livingston.md`, `meroe.md` and OVERVIEW was removed.
- **Hallow-eve vision.** Reuel says he spoke to Dianthe there "not in the flesh"; the timeline had called her "a real, waking Dianthe."
- **Canoe accident reveal.** Chapter IX ends on a cry and silence; Aubrey's rescue of Dianthe is not shown until Chapter XX. `1x09` had revealed it; the reveal now sits in `1x20`, and the Dianthe status track follows.
- **Jim Titus's death.** He is crushed by the serpents, not bitten (Ch. XIX).
- **Scrying disk and font.** The disk shows the past (and, specially prepared, one present picture); the font shows the living and the future. The reverse had been written. Ai, not Reuel, proposes calling up the enemy.
- **Prophecy source.** The Ergamenes prophecy is something the camel-driver told Stone, "which the manuscript withholds," not on the parchment.
- **Telassar's location.** Four days from Meroe toward Arabia, reached via a passage under the third pyramid — not "beneath the ruins." Removed "believed extinct," "last heir," and the invented gold-and-purple regalia (the crown, white silk and black diamond are in the text).
- **Baby swap.** Hannah acts in the confusion of the white child's death and tells Marse Mira's boy was the dead one; no text supports "to save him from being sold." Hannah's relations were with old massa (Mira's father, the Doctor's father); the Doctor took up Mira. The scripts and `mira.md` no longer have Hannah made to do parlor tricks or "carried into slavery."
- **Invented physical details** replaced by the source's: Reuel (broad shoulders, black hair, gray eyes, olive tint), Dianthe (chestnut/golden hair, brown eyes), Aubrey (fair, blue eyes), Molly, Ai (not over forty, not "aged"), Candace, Hannah, Professor Stone, Charlie, Cora, Jim, Ababdis; `charlie-vance` also first appears in `1x02`.
- **Smaller entity fixes:** Dianthe came to Vance Hall months after the wreck, not immediately; Mr. Vance didn't fund her (the physicians' annuity was placed in his hands); Charlie was unconscious during Jim's confession; Ai's power compels Aubrey's death, not a confession; Cora's characterization; Livingston Plantation's location is not stated in the text.
- **Scripts:** restored period language that had been softened ("Negress" in `1x05`/`1x08`; Charlie's slur in `1x12`; Hannah's dialect in `1x21`); corrected Aubrey's account of Mira's sale and the "Wonderful!" chorus (`1x06`); Molly's invitation timing (`1x06`); Reuel deciding on Meroe himself (`1x07`); house party at Vance Hall not Bar Harbor (`1x08`); "days," not "weeks," into the crossing (`1x10`); the letter vision, trance and wake-up (`1x11`); Charlie's line "Decidedly, you regret the leopard's claws!" mis-given to Reuel (`1x13`); Ai's greeting, the note Reuel left, and the Sphinx (`1x14`); the lotus-lily line and Reuel's inner thoughts as voice-over (`1x15`); Ai's disk and font sequence (`1x17`); the pyramid pit capture (`1x18`); the Hannah backstory (`1x21`); Dianthe's song restored (`1x22`); Ai's spoken command, "Where will it stop?", and the lawyers (`1x24`); added the unnamed STUDENT who speaks Charlie's early lines (`1x02`); Dianthe's first words after waking (`1x04`); "Weeks pass," unnamed waif, and Aubrey's whisper (`1x05`).
- **Period language** confirmed preserved in `of-one-blood.md` unchanged; the demo keeps "Negro," "Negress," and "nigger" as the novel uses them ("Negress" in Chapters V, VI, VIII, XI and XXI; the slur in Chapter XII).
- **Additional source inconsistencies found** beyond the two already recorded, listed in `world/notes/source-inconsistencies.md`: "Mira" vs "Nina" in the Bible (IX/XX), Hallow-eve vs the first week of November, Aubrey's age vs the swap, half vs full siblings, Aubrey's hair and Dianthe's eyes and hair, and the African calendar.

Unverifiable / inferred: that Hannah and Mira belong to Telassar's royal line (the text only says each of Mira's children bears the lotus mark and that Aubrey falls under the law for the royal line); whether Aubrey ever learns he is Mira's son; what Aubrey whispers to Reuel in Chapter V (the text gives only the reply "I have known it since first we met"); whether the canoe capsizing was deliberate (Jim says Aubrey "killed Miss Molly"; the narration shows him kicking free).

## Known gaps and a source inconsistency worth knowing about

- **Very minor one-scene characters** (party guests like Bert Smith or Skelton) were left out; everyone with a recurring role or a resolved arc is modeled.
- **The novel itself contradicts its own geography**: Aubrey's ancestral home is explicitly Virginia (Laurel Hill) in the early chapters, but explicitly Maryland ("Livingston Hall") by the later ones. Rather than silently picking one, both are modeled as separate location entities, with `livingston-hall.md` marked `canon_status: contradicted` — a real example of the kind of inconsistency LoreFountain's canon-status field exists to surface, not something introduced by this adaptation.
- **The novel also gives one recurring character two different names** — "Ababdis" the camel-driver/Telassar agent is later called "Abdallah" in two chapters (XVIII–XIX, five times), which is also the name of an unrelated Tripoli sheikh introduced earlier. `ababdis.md` is marked `canon_status: contradicted` for the same reason.
