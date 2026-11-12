# Source material

> **Content note.** The manuscript in `scripts/` is the unaltered public-domain text of the Gutenberg translation. It keeps the original's period language and attitudes. Only mechanical formatting was changed (listed below); no words were added, removed or modernised.

**Title:** *The Count of Monte Cristo*
**Author:** Alexandre Dumas (père), with Auguste Maquet credited as co-author in the Gutenberg header
**First publication:** serialized 1844–46
**Public domain status:** Dumas died in 1870 so the work is public domain worldwide. The translation is a nineteenth-century English one, also public domain.
**Edition used:** Project Gutenberg eBook #1184, <https://www.gutenberg.org/ebooks/1184>, downloaded in the "Plain Text UTF-8" form; the Gutenberg header reports "Most recently updated: October 25, 2026".
**Local copy:** `the-count-of-monte-cristo.md` in this folder: the Gutenberg text (the "Plain Text UTF-8" download, 2,785,469 bytes) converted to Markdown, with the Gutenberg license header and footer intact. The original `.txt` was removed after verification (see "Format conversion").
**Completeness:** unabridged. It contains five volumes and all 117 chapters (the table of contents and the chapter headings both count to 117) plus 30 footnotes at the end.

## How the chapters were split

A script (kept outside this demo, in the session scratchpad) read the Gutenberg file, cut it at the " Chapter N. Title" lines, assigned the volume from the `VOLUME …` lines, and wrote one file per chapter to `scripts/Volume V/<code>-<slug>/<code>-<slug>.fountain`.

- **Codes:** `<volume>x<chapter number>`, for example chapter 28 is `2x28` and chapter 117 is `5x117`. All 117 are unique (the validator reports no duplicate codes).
- **Title page:** `Title: Chapter N. <title>`, `Order: N`, `Production Code: <code>`. Chapter 61's title wraps over two lines in the source and was rejoined ("…That Eat His Peaches").
- **Heading:** `# Chapter N. <title>`, a Fountain section (non-printing).
- **Volumes:** 1 = chapters 1–27, 2 = 28–47, 3 = 48–73, 4 = 74–95, 5 = 96–117.

## Formatting changes made to the prose

1. Hard-wrapped lines joined into one line per paragraph. Blocks with any indented line (letters, documents such as the Spada will) were left exactly as they were.
2. `_text_` (Gutenberg italics) became `*text*` (Fountain italics). The text contains no asterisks otherwise.
3. The 443 illustration placeholders (lines like `0023m`) were removed.
4. Blank-line runs were collapsed to one.

Not copied into the chapter files: the Gutenberg front matter, the volume headings and the 30 footnote bodies at the end (they remain in the full text). The footnote *numbers* stay in the chapters, fused to the preceding word, exactly as printed.

**Verification.** After the split, the word stream of all 117 chapter files (with markup stripped) was compared with the word stream of the Gutenberg body: the only difference is the single word "Peaches" in the chapter-61 heading, which the source prints on a separate line.

## What the story bible took from the text

Entities, aliases, dates, relations and arcs were written from the text of the chapters, never from memory or secondary summaries. Chapter numbers are cited in the entity bodies. The continuity flags (`canon_status: contradicted`) are listed in `../world/notes/continuity-ledger.md`, each with the chapters that disagree.

## Known gaps

- **Reading coverage.** Chapters 1–42 were read in full in the first pass and re-checked by search in the second; chapters 43–117 were read in full, chapter by chapter, in the second pass (see "Review against the source" below). Chapters 1–42 are the less carefully re-verified half.
- **Characters not given cards:** many minor figures (Gaetano, Captain Baldi, Beppo, Teresa, Cucumetto, Prince Lobanieff, the Duc de Blacas, Dandré, Mademoiselle Cornélie, Florentin, El-Kobbir, Kourchid, Madeleine and Antoinette d'Avrigny, the telegraph operator at Montlhéry and others). Several appear only in a chapter or two.
- **Aliases:** "Zaccone" is now an alias of the Count (chs. 69–72). "Adelmonte" has its own tentative card because the book never says whether he exists apart from the Count. (A search found no "Madame Pierre" in the text, so the earlier note about that name was wrong.)
- **Weekday and date slips** are recorded but not resolved; the ledger gives all the quotations.
- **Tracked fields** are used only on Dantès (identity, whereabouts). Who-knows-what-when is the obvious next addition.
- **Presence and scene tools** have nothing to work with; see the project README, "What a novelist gets, and what they don't".

## Format conversion

The Gutenberg plain-text file (`the-count-of-monte-cristo.txt`) was converted to Markdown and the `.txt` removed (the project keeps source texts as well-formatted `.md`). Paragraphs were reflowed to one line each, headings and a linked table of contents added, verse, letters and quotations kept as line-preserved block quotes, and `_italic_` markers turned into Markdown emphasis. The Project Gutenberg header, footer and full license are kept verbatim in the "License and provenance" section at the end of the `.md`. The 30 fused footnote anchors in the text (e.g. `Byron5`) are written `Byron<sup>5</sup>` (same characters, superscript markup), and the footnote bodies follow under a "Footnotes" heading. Three places where the Gutenberg italics markers are unbalanced in the source (a letter beginning `_‘Se alle sei…`, `21_st May…ten_`, `_ l’Impartial_`) keep their underscores as literal escaped `\_` characters.

**Verification.** A script compared the word sequence of the `.md` body with the original text between the Gutenberg START/END markers (whitespace and markup characters normalized; added heading text excluded; headings compared case-insensitively). Result: **459,937 words in the body, identical in order and spelling**; the title block and the volume/chapter contents (588 words) were replaced by the generated contents list, and the 442 `NNNNm` image-placeholder lines of the Gutenberg file were kept as HTML comments (`<!-- illustration 0023m -->`); a second whole-file check (lower-cased, punctuation-stripped) found only the title/contents block as a difference. The license section was compared character for character with the original header and footer (identical). Nothing was corrected, modernized or respelled.

## Review against the source

A second pass compared the demo with `the-count-of-monte-cristo.md`. It read chapters 43–117 in full, then checked every entity, glossary term, timeline event, note and the overview against the text.

**Manuscript.** A script cut the source at its 117 chapter headings and compared each chapter's word stream (comments, `<sup>` tags and Markdown emphasis stripped) with the matching `.fountain` file's body. All 117 chapters match word for word. Titles, `Order:` values, Production Codes (`<volume>x<NN>`, zero-padded to two digits up to 99) and volume folders are right for all 117 (chapters 1–27, 28–47, 48–73, 74–95, 96–117).

**Fixed (wrong or unsupported):**
- Caderousse's burglary and death were placed at Auteuil in five files (his card, the Auteuil house, the timeline event, the Caderousse arc). They happen at the Count's house at 30 Avenue des Champs-Élysées (chs. 82–83); the house now has its own card.
- Benedetto was "arrested in Belgium"; he is arrested at the Bell and Bottle in Compiègne (ch. 98).
- Bertuccio's gong code (ch. 46) is Ali, Baptistin, Bertuccio, not "valet, majordomo, Bertuccio". Baptistin is a valet de chambre, not a footman.
- The Marquis de Saint-Méran does not die "in chapters 72–74": he dies on the road and is reported in chapters 71–72; only the Marquise dies in 73.
- Edward's and Valentine's first appearances (2x47, 3x51), Eugénie's (3x53), Albert's, Haydée's and many `appears_in` lists were corrected.
- The Danglars ransom arc said "5,050,000 francs"; Danglars carries 5,050,000 and keeps 50,000, so he pays 5,000,000.
- The arcs listed wrong or missing chapters (the Villefort arc cited the ball, ch. 68; the telegraph is chs. 60–61). Their `episodes` lists were rebuilt against the chapters, and two arcs (The False Cavalcantis, The Poisonings) were added.
- Haydée's sale, Madame Danglars's names and Noirtier's brucine, the Count's aliases and who knows his name were rewritten from the text; "Zaccone", "Major Black", "Giacomo Busoni" and "Lord Ruthven" are now aliases of the Count; the overview no longer says the three men "let" the denunciation stand.
- Marked `contradicted` where the book truly disagrees with itself: Benedetto (and his birth event), Madame Danglars, Valentine, Renée de Saint-Méran, Noirtier, Hôtel de Londres, the Rue Meslay house, and four new timeline events or arcs. The ledger quotes 31 conflicts; those new in this pass (items 13–31) include Renée's death date, Valentine's age, the Nargonne and Servières spellings, Benedetto's birth night, the brucine treatment, Haydée's age at sale and the calendar of 1838.

**Added.** 19 entities (the Champs-Élysées house, the Villefort house, the Rue Meslay house, the Allées de Meilhan house, Père-Lachaise, La Force, the Tréport estate, Joannes, Assunta, General de Quesnel, Vasiliki, Selim, Myrtho, M. Deschamps, Abbé Adelmonte, Noirtier's will, the club statement and two arcs), 6 glossary terms (brucine, aqua Tofana, corbeille, Palikar, Romaic, doctor of the dead) and 13 timeline events (including the telling-order reveals of the Count's name).

**Could not be verified or left open.** The first-appearance chapters for a few minor early characters (Peppino, Countess G——, Haydée's first sighting in Rome) were taken from the first pass. Chapters 1–42 were checked only by targeted search (aliases, dates, numbers cited in cards), not re-read. Some "month and day" dates in 1838 (the burglary night, the duel) are derived from other chapters and not printed; the cards say so. The book's calendar for July–September 1838 cannot be made consistent (ledger item 30).
