# Source material

> **CONTENT NOTE.** This demo preserves period language, including racial slurs, because it adapts a historical text (1899) faithfully. The novel uses these words in the mouths of white teachers, judges, mobs and the Cadeville secret society, and the screenplay keeps them in the same mouths and the same scenes. Nothing here endorses them.

**Title:** *Imperium in Imperio: A Study of the Negro Race Problem. A Novel*
**Author:** Sutton E. Griggs (1872–1933)
**First publication:** 1899, self-published and sold by the author and his associates in Black communities
**Public domain status:** Published 1899; the author died in 1933 — public domain in the United States and in life-plus-70 countries.
**Full text:** [Project Gutenberg #15454](https://www.gutenberg.org/ebooks/15454) (20 chapters)
**Local copy:** `imperium-in-imperio.md`, in this folder — the exact edition this adaptation was built from, converted from the Gutenberg plain text (see "Format conversion").

## Provenance of this demo

Every entity, timeline event, and script here was written against the full 20-chapter text, not from secondary summaries. The chapters are reorganized into eight screenplay sequences (see below); the plot itself is unchanged.

## Chapter-to-sequence map

| Sequence | Production Code | Novel chapters |
|---|---|---|
| 1 — The Cistern | 1x01 | I–IV (first day at the Winchester school, the parson's advice, twelve years under Leonard, the oration contest, the cistern) |
| 2 — Equality or Death | 1x02 | V–VII (Mr. King's dream and check, Stowe University, the student rebellion, the baccalaureate, the socks, the cab fare) |
| 3 — The Senator's Son | 1x03 | VIII–IX (Fairfax Belgrave and Bernard's schooling, the Washington interview, Norfolk, meeting Viola, the contested election) |
| 4 — Richmond | 1x04 | X–XI (Belton and Antoinette, the newspaper and the dismissals, the disguise, the white child) and, from XIX, Antoinette's exclusion from her church |
| 5 — Cadeville | 1x05 | XII (the train, Monroe, the college, the old man's history, the church, Dr. Zackland's plot, the hanging and the dissecting table, the trial, the Supreme Court) |
| 6 — Married and Yet Not Married | 1x06 | XIII–XV, as far as the telegram (Bernard's proposal, Viola's death and letters, Bernard's vow) |
| 7 — Thomas Jefferson College | 1x07 | XV (from the arrival in Waco), XVI, and the first part of XVII (the mock execution, the revelation of the Imperium, Bernard's presidency, Cuba, the Cook murder) |
| 8 — The Parting of Ways | 1x08 | XVII (the session and Bernard's message), XVIII (the debate and Belton's speech), XIX (the Plan of Action, the resignation, Antoinette, the execution), XX (Berl Trout's confession) |

## What this adaptation took from the novel

Character names and relationships; the sequence and mechanics of every major event; the secret Imperium's structure (a one-chamber Congress with 145 seats, a President, an army, a treasury); the two opposing programs (Bernard's seizure of Texas and the ceding of Louisiana to foreign allies, versus Belton's loyalty to the Union); and the ending.

## What this adaptation changed

- **Dialogue follows the novel closely.** After the source-fidelity review (below) almost every spoken line is the novel's own wording, condensed in places. Belton's last words, Bernard's graveside vow, Berl Trout's confession, the Plan of Action, Viola's letters, the Senator's story, Bernard's message and Belton's speech to the Congress all stay close to the text.
- **Slurs are kept.** The source puts racist language in several characters' mouths (the teacher on the school steps, the commencement judges, the Louisiana train and restaurant, Dr. Zackland and the postmaster, the Senator quoting Leonard, Bernard to Belton, Zackland's note). The screenplay keeps those words in those mouths. The Cadeville secret society is named, as in the novel, the "Nigger Rulers" (`world/nigger-rulers.md`).
- **The novel's narrator is dropped.** Griggs's authorial commentary becomes action and image. Berl Trout's closing confession, which in the book is a written statement, becomes a voice-over in the last sequence.
- **Compression.** The speeches (Bernard's message and Belton's answer), the Senator's story, Viola's letters, Belton's account of the Imperium, and the Cadeville old man's history are condensed by omitting paragraphs, not by rewording. Left out entirely: Chapter V's long account of Mr. King's views, Belton's Stowe sermon-day musings, Chapter IX's description of Virginia's electoral machinery (reduced to a few scenes), and the narrator's commentary.

## Known gaps

- Minor background characters (the preacher, classmates, the Bowser brothers) have no entity files of their own.
- The novel withholds the Senator's name and the name of the state he represents; so does this project (see `world/the-senator.md`).
- The Cook murder echoes a real 1898 killing of a Black postmaster in Lake City, South Carolina. This project follows the novel, which names the victim Felix A. Cook.

## Format conversion

The Gutenberg plain-text file (`imperium-in-imperio.txt`) was converted to Markdown and the `.txt` removed (the project keeps source texts as well-formatted `.md`). Paragraphs were reflowed to one line each, headings and a linked table of contents added, verse, letters and quotations kept as line-preserved block quotes, and `_italic_` markers turned into Markdown emphasis. The Project Gutenberg header, footer and full license are kept verbatim in the "License and provenance" section at the end of the `.md`.

**Verification.** A script compared the word sequence of the `.md` body with the original text between the Gutenberg START/END markers (whitespace and markup characters normalized; added heading text excluded; headings compared case-insensitively). Result: **53,927 words in the body, identical in order and spelling**; 154 words of title page, Gutenberg contents table and two repeated half-titles were replaced by the generated contents list. The license section was compared character for character with the original header and footer (identical). Nothing was corrected, modernized or respelled.

## Review against the source

All 20 chapters, the preface and Berl Trout's Dying Declaration were read in full; then every script, entity, timeline, glossary and note file and `world/OVERVIEW.md` were checked line by line against the text. The first-draft scripts departed from the novel in many places, so all eight were rewritten from the text rather than patched; the world files were corrected in place.

### What was found and fixed

**Language (the owner's restoration).** About 30 spoken lines had been euphemized or dropped; they are back in the speakers' mouths as the novel has them: Leonard on the school steps (Ch. II) and in the Senator's account of the war (Ch. VIII); the commencement judges (Ch. IV); the Louisiana train and the Monroe restaurant (Ch. XII); the doctor, the postmaster and "Nigger Rulers" in the Cadeville scenes, including Zackland's note; and Bernard's "white folks' niggers" to Belton (Ch. XV). The secret society is now `Nigger Rulers` (`world/nigger-rulers.md`, replacing `the-cadeville-rulers.md`), with aliases, and all links (`cadeville`, `dr-zackland`, `the-cadeville-postmaster`, the Night-at-Cadeville timeline event) point to it. The period dialect of Hannah, the parson, Abe Lincoln and the schoolchildren is restored.

**Facts in the scripts (all fixed).**
- Sequence 1: Belton was "eighteen" at commencement (the text gives eight plus twelve years, so about twenty); the judges were a trustee, the Mayor and "a local pastor" (they are the Mayor and two trustees, the congressman having declined); the "scored the same on matter / insolent" excuse and the Congressman's words were invented (the novel says "on the ground of good behavior" and that he lamented Belton's defeat by prejudice); Leonard kept the medal in his hand (it was gone); an invented Bernard/Belton scene after the cistern ("Harvard") was cut; the whole Chapter III parson episode, the pranks, and the declamation heroes were missing.
- Sequence 2: Editor King's reading of an invented line from the oration, "I intend to get a better one," a single "good coat," "twenty young men," three hundred raised hands (all the students; the girls sign through a student's sister), and "Revenge comes home to roost" were invented or wrong. Hannah's presence at the commencement was misplaced, the dream and the cab fare were missing, and the Lovejoy sermon was a paraphrase.
- Sequence 3: Bernard was shown reaching Norfolk before Washington (he goes to Washington from Harvard, then to Norfolk); his "twenty-two" years, the Senator's invented phrases ("wife in law and mistress in public," "thirty years") and a train scene with the bearded man were wrong; the Senator's story, the "mortgaged property" exchange, the cloak-room scene, the election figures (11,823 vs. 4,162), Leonard's five-thousand-dollar purchase of the tabulated statement, and the fifteen clergymen's affidavits were missing.
- Sequence 4: the paper's name "The Richmond Voice" was invented (the novel gives none); the wedding came before the dismissal from the post office (correct), but the party was in "Nermal Parlor" (the novel doesn't say) and the "trip to Baltimore" was "distant cities"; the kidnapping was a "bet"; the church trial was staged with invented deacons' lines; Belton's flight to Winchester came the same night (the novel: months).
- Sequence 5: Dr. Zackland dies in a cord scuffle and Belton "lifts his hand" (the novel: the mob hangs Belton, the postmaster shoots him at the base of the skull, three men carry him to the dissecting table, Belton stabs Zackland through the throat with the doctor's knife and pins Zackland's own note); the Monroe restaurant, the Bowser brothers' story, the jail, the Governor at Baton Rouge, the mob and the postmaster as jury foreman were cut or invented ("forty men," a sheriff's telegram, "a Black board of trustees," a Governor's speech); the Supreme Court speech and the cell dialogue between Bernard and Belton were invented (the novel gives no text for either).
- Sequence 6: the bridge scene, Viola's refusal and her letter were paraphrased with invented lines; the letters to her mother and father were missing; all are now the novel's wording (condensed).
- Sequence 7: Berl Trout "administered the oath" at the inauguration (invented; the novel gives Trout no scene); "map with a line down the Mississippi," lynching lists, "the lights of the tower," the closing exchange about Texas were invented; Belton's explanation of the Imperium was scattered and wrong in places (the three months' examination, the speaker's election after the trial, the unanimous presidential vote); Cuba, the Maine and the Cook murder were missing.
- Sequence 8: the Cook murder was staged with an invented detail (Cook carrying a child); Bernard's message and Belton's speech were rewritten as invented sentences ("We have asked for the vote... I do not tell you what to do," "Make laws"); Belton's five resolutions were replaced by an invented proposal, and the Plan of Action was cut to six invented points instead of the eight in the text; "It's an empire," "I'll go where he can't stop me," "I will use them," "Fire" (the novel: "the word of command"), "Berl Trout third from the left" and Trout carrying his folder to Washington were invented. All now follow Chapters XVII-XX.

**Facts in `world/`.** Corrected: Zackland "killed in self-defense" (he is stabbed by Belton as he lies on the table); the Rulers "decide who may preach" (the text names voting and building); Dr. Lovejoy "frail, retired" (the novel says "venerable"); Cadeville mob "nearly murdered" (he is hanged and shot); Berl Trout first appearing in 1x07 (he does not appear in the novel's story until Chapter XX); the Imperium's "flag," "motto" and "decoy interrogation room" (invented); the chamber "on the floor below" (the first floor); the Marriage Certificate "copy shown to Leonard"; the Plan of Action's last point ("sparing the Union"); Viola's vow ("a light-skinned man" vs. "a mulatto man"); Leonard as "campaign manager" ("acting under instructions from Bernard's father"); the timeline's Spring 1898 date and "white child" sequence; the glossary's "1880s" law dates; every `appears_in`/`episodes` list updated to match the rewritten scripts; and about twenty physical descriptions, casting notes and personal details not found in the text were removed or labeled as adaptation notes (examples: Berl Trout "graying, middle-aged," Cook "slight, dignified," Editor King "gray-brown hair," Hannah's "head-cloth").

### What could not be verified, and source irregularities

- The year of the Spanish-American War chapters: the novel prints "April--" with no year; the 1898 date comes from the historical Lake City killing and is outside the text.
- Bernard's and Belton's ages after the commencement, the age of Belton's child, Fairfax's age, and the Senator's name, state and committee are not given in the novel; the screenplay gives none.
- The novel is internally inconsistent in places, and the screenplay follows it rather than fixing it: the doctor is "Zakeland" once (in the postmaster's mouth, Ch. XII) and "Zackland" everywhere else; Belton tells Bernard "over seven million five hundred thousand" people and then "seven million two hundred and fifty thousand" in the same scene; and Chapter VI calls the Stowe president only "a venerable white minister" (he is named Dr. Lovejoy in Ch. VII).
- Dr. Lovejoy's identity as the recommender in Sequence 5 and the president of Sequence 2's rebellion rests on the novel's "the president of Stowe University" and Chapter VII's naming.
- How Berl Trout reveals the Imperium is not in the novel; the screenplay shows nothing.

### Complete list of invented spoken lines

After the rewrite, these are the only spoken or printed lines not taken from the novel's own wording:

1. 1x02, Dr. Lovejoy: "Belton, you are about to allow a pair of dirty socks to wreck your whole life." (the novel narrates this sermon as indirect speech: Belton "was about to allow a pair of dirty socks to wreck his whole life")
2. 1x03, Leonard: "The time is ripe for you to announce yourself for Congress." (the novel: Leonard "told him that the time was ripe for Bernard to announce himself for Congress")
3. 1x02, the opening title card: "THE WINCHESTER SCHOOL HAS FINISHED WITH BOTH BOYS. BERNARD'S MOTHER SENDS HIM TO HARVARD UNIVERSITY. BELTON HAS NO MEANS." (summarizes Ch. V)
4. Title cards that summarize the narrator: 1x02 "A PROMISE HE WILL KEEP. REMEMBER IT."; 1x03 "THE TOWN SPECULATED ABOUT HER FOR A YEAR OR TWO, THEN GAVE UP.", "FOR A COUPLE OF YEARS: BERNARD AT HER SIDE...", the election and Supreme Court admission cards; 1x04 "FIVE EVENINGS IN EACH WEEK." (Ch. X's "five evenings"); 1x06 the closing "Come unto me" card (the narrator's own sentence).
5. Speaker attributions where the novel gives indirect speech or a nameless speaker: 1x01 "TRUSTEE" (the novel: "They said"); 1x02 "STUDENT" and "STUDENTS" (Ch. VI: "He was told," "A number tapped their heads... saying"); 1x03 "FRIEND," "GIRL," "ANOTHER GIRL," "MULATTO GIRL" (as in the text); 1x05 "SPOKESMAN," "OLD MAN," "CLERK," "POLICEMAN"; 1x08 "AGED MEMBER," "BOLD SPEAKER," "A MEMBER." Words are the novel's.
6. Scene and staging not in the novel (no dialogue): Berl Trout seated among the Chiefs in 1x08; Dr. Lovejoy shown choosing Belton in 1x05; Bernard reading the news in Norfolk in 1x05; the dormitory scene in 1x08; spliced sentences within each long speech (paragraphs removed, wording kept).

No other dialogue is invented. Where the screenplay joins two passages of a speech, the joined sentences are the novel's.
