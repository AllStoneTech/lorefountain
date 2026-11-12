# Open questions for a literary author using this bible

- **Where do you put the point of view?** The narrator slips between Dantès, Danglars, Villefort and Franz. LoreFountain has no point-of-view field; `tracked_fields` on [[Edmond Dantès]] (identity, whereabouts) is the closest tool.
- **How should aliases work for a man with six names?** Every name Dantès uses is an alias on one card, so "Abbé Busoni" and "Lord Wilmore" link to him in any chapter. A novelist who wants *dramatic irony* (the reader knows, the characters do not) has no way to flag which characters know which alias yet.
- **Could scene headings give presence tracking?** Chapters contain no scene headings, so the Continuity views that rely on scenes have nothing to bite on. A writer could add forced headings (a line starting with `.`) at section breaks, but this changes the manuscript text and was not tried.
- **Chapters versus episodes.** Chapter-per-file keeps each chapter reviewable, but arcs reference chapters as "production codes". The codes (`1x01` to `5x117`) put the book's five volumes in the "season" slot.
- **Serial installments.** The book was published in newspaper installments. Fountain has no concept of an installment boundary, so chapter files are the only division the tool sees.
- **Which of the slips are deliberate?** None looks deliberate. See [[the continuity ledger|continuity-ledger]] in this folder.
