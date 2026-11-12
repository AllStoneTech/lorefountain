# Source material

> **Content note.** *The Heroic Slave* (1853) uses period language, including racial slurs, in the mouths of slaveholders, slave-traders, tavern loafers and sailors. This project **preserves that language faithfully** in the cleaned source files and in the scripts, because it adapts a historical text and the words are how the source characterizes these men. Nothing has been censored or softened. It also describes whipping, the killing of a wife and the slave trade.

**Title:** *The Heroic Slave*
**Author:** Frederick Douglass (c. 1818–1895)
**First publication:** 1853 (in the gift-book *Autographs for Freedom*), a novella in four parts based on the 1841 revolt aboard the brig *Creole*
**Public domain status:** Published 1853; the author died in 1895 — public domain worldwide.
**Full text:** [Wikisource, The Heroic Slave](https://en.wikisource.org/wiki/The_Heroic_Slave) (not on Project Gutenberg)
**Local copy:** `the-heroic-slave.md`, in this folder — the complete text of all four parts, formatted (title, parts as headings, epigraphs as block quotes), corrected against the 1853 first printing (see "Comparison with the 1853 original"). Also here: `the-heroic-slave-wikisource-transcription.md` (the Wikisource text unchanged, which the scripts were written from) and `the-heroic-slave-1853-original-ocr.md` (raw OCR of the 1853 print). About 16,800 words. Every demo in this project keeps the full source text inside its own folder.

## How the text was obtained and cleaned

The four parts were fetched from Wikisource as raw wikitext. A small script then removed the `{{header}}` template block, the `<\/br>` line-break tags, the `''italic''` and `'''bold'''` markers, the leading `:` indent characters on epigraph attributions, and the wiki links in the header, and trimmed blank lines. The four cleaned parts were then joined into the single `the-heroic-slave.txt` with a `PART n` divider before each, and the raw `.raw` and index stub files were deleted.

**Verification.** The number of words in each cleaned body was compared with the number in the raw body after stripping the same markup: 2,077 / 6,068 / 4,902 / 3,697 words for parts 1–4, identical in each case. A search for any leftover `{`, `}`, `<`, `>`, `[`, `]` or doubled apostrophe in the clean files finds none. After joining, the combined body's word count (16,823, including epigraphs) was checked against the sum of the parts. A later full read of the text against the scripts, entities and notes (see "Review against the source" below) found the demo faithful and corrected the items listed there.

**Not corrected in the scripts.** Wikisource marks its transcription as roughly 75% proofread. The scripts and world files were written from the transcription as it stood; the corrected text now in `the-heroic-slave.md` fixes 22 places (table below). A few scripts already followed the corrected reading ("occurrence", "sheltered", the single "I saw that"). The places where scripts still quote the transcription's wording are listed after the table; they are left for the owner to decide.

**Format conversion.** `the-heroic-slave.txt` was replaced by Markdown files: the Wikisource text was converted to `the-heroic-slave-wikisource-transcription.md` with the word sequence verified identical (16,823 words) before the `.txt` was deleted; the corrected `the-heroic-slave.md` was produced from it by the 22 listed corrections only (16,824 words; verified that exactly those 22 regions differ).

## Comparison with the 1853 original

**Original found.** The 1853 first printing, in *Autographs for Freedom*, ed. Julia Griffiths (Boston: John P. Jewett and Company; Cleveland: Jewett, Proctor, and Worthington; pp. 174–239), is digitized on the Internet Archive. Three scans of that printing were used (OCR text from `https://archive.org/download/<id>/<id>_djvu.txt`):

| Role | Internet Archive identifier | Notes |
|---|---|---|
| Primary | [`autographsforfre00grifrich`](https://archive.org/details/autographsforfre00grifrich) | Making of America / Richmond scan; best OCR. Raw OCR of the novella is saved as `the-heroic-slave-1853-original-ocr.md`. |
| Cross-check | [`autographsforfre1853grif`](https://archive.org/details/autographsforfre1853grif) | Boston scan of the same printing. |
| Tie-break | [`autographsforfr00socigoog`](https://archive.org/details/autographsforfr00socigoog) | Google Books scan; noisier OCR. |

Other copies exist (London: Sampson Low, 1853: `autographsforfre00grif_2`, `autographsforfre53grif`; the 1854 second series) but were not needed. No Project Gutenberg copy of the novella was found (Gutenberg's only search match for the title is an unrelated juvenile book). HathiTrust, the Library of Congress and Google Books were not consulted: the Internet Archive scans were sufficient.

**Method.** The OCR text was cut to the novella, page running heads and page numbers were dropped, and end-of-line hyphenation was rejoined. It was aligned word by word with the Wikisource-derived text (case, quotation marks, in-word hyphens and OCR spacing around punctuation normalized). Every divergence region was then reviewed by hand. A difference counts as **confirmed** only when at least two scans agree against the transcription; OCR errors that appear in one scan only (about 115 regions, such as `ais` for `his`, `1` for `I`) were discarded. Page images were not inspected for individual words; confirmations rest on agreement between independently scanned copies.

**Result.** 22 confirmed differences (all are Wikisource typos, omissions or spelling differences, not OCR errors), corrected in `the-heroic-slave.md`. Apart from the "not applied" items below, the corrected text and the original agree word for word.

### Confirmed differences (corrected in `the-heroic-slave.md`)

| # | Where | Wikisource-derived text | 1853 original | Type | Quoted in scripts/world? |
|---|---|---|---|---|---|
| 1 | Part 1 epigraph | why weepest **though**? | why weepest **thou**? | typo | no |
| 2 | Part 1, soliloquy | that others may in idleness! | that others may **live** in idleness! | omitted word | **yes**: 1x01 line 135 |
| 3 | Part 2 epigraph | loud-**howlig** wolves | loud-**howling** wolves | typo | no |
| 4 | Part 2 epigraph attribution | Shakespeare | **Shakspeare** | spelling (the print's trailing period not reproduced) | no |
| 5 | Part 2 | singular **occurence** | **occurrence** | typo | no (script already has "occurrence") |
| 6 | Part 2 | revived **man** bygone scenes | revived **many** bygone scenes | typo | no |
| 7 | Part 2, Madison's story | tied **tip** to the limb | tied **up** to the limb | typo | no |
| 8 | Part 2, Madison's story | wilderness that **sheltererd** me | **sheltered** | typo | no (script already has "sheltered") |
| 9 | Part 2, Madison's story | hiding myself as well I could | as well **as** I could | omitted word | **yes**: 1x03 line 29 |
| 10 | Part 2, Madison's story | by which I saw that **I saw that** he was | by which I saw that he was | duplicated words | no (script already single) |
| 11 | Part 2, Madison's story | Here **lie** took out | Here **he** took out | typo | no |
| 12 | Part 2, Madison's letter | Thank God that there such a land | there **is** such a land | omitted word | no |
| 13 | Part 3 | character, **buiness**, residence | **business** | typo | no |
| 14 | Part 3 | Loafer."Well, | Loafer. "Well, | missing space | no |
| 15 | Part 3 | but you **I've** got an insight | but you've got an insight | stray word | no |
| 16 | Part 3 | noses **tomatch**. | noses **to match**. | typo | no (world/the-keepers.md already has "to match") |
| 17 | Part 4 epigraph (Childe Harold) | **hemselves** must strike | **themselves** | typo | no |
| 18 | Part 4 | murderous business on enlightened shores | on **the** enlightened shores | omitted word | **yes**: 1x05 line 26 |
| 19 | Part 4 | against a white man, the **white** community | the **whole** community | typo | **yes**: 1x05 line 82 |
| 20 | Part 4 | The effect of **the** words was marked | The effect of **these** words | wording | no |
| 21 | Part 4 | every **wooly** head | every **woolly** head | spelling | **yes**: `world/glossary/darkey.md` (alias and quotation) |
| 22 | Part 4 | He seldom spake **to to** any one | spake to any one | duplicated word | no |

### Differences found but not applied (need a page-image check)

The scans agree on these, but they are punctuation or spelling questions where the OCR engines may share a bias, so the transcription's reading is left in `the-heroic-slave.md`:

| Where | Wikisource-derived text | OCR of the 1853 print |
|---|---|---|
| Part 1, "Herculean strength" | strength**:** yet | strength**;** yet |
| Part 2, "happy home" | their own happy home in | happy home**,** in |
| Part 2, Madison's story | afraid to speak lest | speak**,** lest |
| Part 2, "bundle" | little bundle**:** -- | bundle**;** -- |
| Part 2, "did 'nt eat your food raw" | your food raw | **you** food raw (all three scans); probably a shared OCR drop of the final letter |
| Part 2, "in the melée" | melée | melee (OCR does not read accents) |
| Part 4, "temporary tumultuous exclamations" | tumultuous | **tumultous** (all three scans); possibly a misprint in the 1853 print, or shared OCR; unresolved |
| Part 4, mate's reply | "Well, **Sir**," | "Well, **sir**," |
| Part 4, "took the ship from, you" | from**,** you | from (no comma) |
| Part 4 | fair warning YOU SHALL | warning**,** YOU SHALL |
| Several places | em dashes: OCR sees a dash at "skin, —hiding", "Madison, —Madison", "well, —and", "quarters, —for", "Friend, —for such", "are: —Madison", "weighed, —jibs", where the transcription has none | dash insertions seen by OCR; unverified |
| Throughout | hyphenated compounds split across a line in the print ("ill-starred", "centre-table", "hiding-place", "blood-thirsty", "half-bushel", "dish-water", "round-tops", "good-disposed") | cannot be decided from OCR; the transcription's hyphens kept |

Not compared: quotation marks (OCR spacing makes them unreliable), italics, and paragraph/line layout (the transcription's layout is kept).

### Scripts and world files that quote a wording differing from the original

Left unchanged for the owner to decide: `scripts/Season 01/1x01-the-pine-woods` (line 135, "may in idleness"), `1x03-the-tree` (line 29, "as well I could"), `1x05-the-marine-coffee-house` (line 26, "on enlightened shores"; line 82, "the white community"), and `world/glossary/darkey.md` ("wooly head", in the aliases and the quotation).

## Part-to-script map

| Script | Production Code | Novella part | What it covers |
|---|---|---|---|
| The Pine Woods | 1x01 | Part 1 | The narrator's opening; spring 1835; Madison's soliloquy; Listwell's resolve |
| The Fireside | 1x02 | Part 2, first half | Winter 1840; the dog; Madison arrives; supper; the whipping; the first escape; five years in the swamp; the fire; "how I got my food" |
| The Tree | 1x03 | Part 2, second half | The tree and the woodcutters; the old man's prayer and whipping; the Great Bear; the tinder-box; Ohio's laws; Cleveland; the *Admiral*; the Windsor letter |
| The Tavern | 1x04 | Part 3 | The old tavern; Wilkes; the night; the gang in the bowling alley; Madison's return for Susan; the ten dollars; breakfast; Wilkes again; Richmond; the files; the brig sails |
| The Marine Coffee-house | 1x05 | Part 4, first half | The "American slave trade" opening; Williams and Grant; Grant introduces Madison; the files; **plus one dramatized scene in the hold** |
| The Creole | 1x06 | Part 4, second half | The rising; the helm; Madison's speeches; the storm; Nassau; the procession |

## What this adaptation took from the novella

Every event, in order; the cast and their relationships; the dates (spring 1835, winter 1840, 16 December 1840, 1841, "two months after"); the numbers (forty stripes, thirty-nine lashes, sixty lashes, five years, fourteen men, one hundred and thirty, nineteen, eighteen besides himself, sixty miles from Nassau, ninth day out); and the speeches, which are used nearly verbatim, with only the changes needed for speaking aloud: Madison's soliloquy, his account of his life, his letter, his speeches on the deck, the dialogue at the tavern and the coffee-house debate.

## What this adaptation changed or added

1. **Medium.** Prose narration becomes script. Reported speech (the old man's speech to the hunters, the captain of the *Admiral*, the Nassau soldiers) is turned into direct dialogue. In 1x03 the *Admiral*'s captain's reply and in 1x06 the sergeant's reply are paraphrases of what the text only reports; the sergeant is a speaking role the text does not give, though his words ("we do not recognize persons as property") come from the text.
2. **The Narrator.** The author's first-person voice is kept as a character, The Narrator. A handful of connective narration lines are new: the episode-ending titles ("Part Three. The Tree."), "He had no way of knowing that he would see that face again" (1x01), "But this was not the last that Mr. Listwell would hear of Madison Washington" (1x03), and the closing lines of 1x06 ("We do not know where he walked from that wharf…"). 1x05's "What Mr. Grant could not see" is also new narration.
3. **The scene in the hold (1x05).** Grant only infers that Madison filed through his fetters "the first night out". The drama dramatizes it as sound: files, clicks, a whispered count to two, whispers of "Steady" and "Not yet. Wait." This is the largest invention and is marked `canon_status: tentative` in the timeline.
4. **Everything audible.** Birdsong, church bells, the wolf, the fire, the work-song of the woodcutters, the plantation song at the tavern, the drum, and every music cue are new; the text names only some of these sounds.
5. **Small voices.** Names for roles the text leaves anonymous (The Overseer, The Hunters, The Landlord, A Loafer, The Man in Chains, The First/Second/Third Keeper, The Sergeant) are cast designations, not character names. These spoken lines are invented, not in the text: "Gently, now. He is afraid of us." and "Eat, Mr. Washington" (Mrs. Listwell, 1x02, including her addressing Madison as "Mr. Washington"); "Madison. Madison. Madison." (Susan, 1x02); Madison's "Thank you, ma'am"; "Don't be afraid" and "...Child." and "I will, child. I will whistle." (Madison and the old man, 1x03); "I will not forget you, sir" and "Go with God" (Madison and Listwell at the *Admiral*, 1x03); and in 1x06 the pre-attack exchange between Captain Clarke and Mr. Jameson ("Squall coming…", "She's carried well…"), Madison's "Stand back, sir" and "No!", and Madison's "Come down."
6. **The Creole's captain named early.** The text names Captain Clarke only in Grant's account; the drama has the captain's voice call "Aloft! Make sail" at Richmond in 1x04 under that name, for continuity.
7. **No dialect softening, no censorship.** Dialect and slurs are as written by Douglass. Wilkes's eye-dialect ("alloys", "becase", "Virginy") is preserved; the profanity abbreviated in the original ("d -- d") is written "d----d" (1x04, and the hunter's line in 1x03).
8. **Chronology of memory.** The novella lets Madison narrate his past in the first person while Listwell listens; the script keeps Madison's voice-over and cuts to the remembered scene, rather than staying at the fireside.

## Historical context (outside the text)

`world/notes/the-real-creole.md` records background on the real 1841 *Creole* revolt, the Bahamas and Britain's abolition of slavery. It is outside Douglass's text. The core facts (date, route, the captain and slave-trader's names, headcounts, the April 1842 release) were checked against published sources and are cited in the note; the rest stays **tentative** and should be checked before any detail is relied on. Nothing in the scripts depends on it except what the text itself states.

## Review against the source

The whole text was read against the six scripts, the entity files, the timeline and the notes. Result: the plot, order of events, numbers, names and nearly all of the dialogue match the text; the scripts quote the speeches closely. Items found and corrected in that review:

1. The "Known gaps" list wrongly said Madison's children were unstated. The text states he left a wife and **two little children** (Part 2); only their names, ages and fate are unstated.
2. The list of invented lines above was incomplete; it now covers every spoken line the text does not give.
3. The hunter's "d----d old scoundrel" in 1x03 had lost its profanity; it is restored.
4. `world/susan.md` said Susan speaks only in memory and in her scream; the script also gives her three whispered "Madison"s in 1x02 (invented).
5. The note on the real *Creole* was updated with checked facts.

## Known gaps

- Madison's children's names, ages and fate (the text says there are two), the master's name, the plantation's location, the old man's legal status, and the outcome with the American consul are all unstated in the text; the scripts leave them unstated (see `world/notes/open-questions.md`).
- The Wikisource transcription is itself only roughly 75% proofread, so the text here may differ from the printed 1853 original in small ways.
- Listwell does not reappear after 1x04; the novella gives no coda for him.
- The novella's four parts are uneven (2,077 to 6,068 words); the split into six episodes is an adaptation choice, not the author's structure.
- No actors are cast. `voice_actor` is left empty throughout.
