<!-- lorefountain-docs-version: 1 -->
# scripts/

The manuscript. These are `.fountain` files, but in this demo they hold **prose**, not screenplay: each file is one chapter of *The Count of Monte Cristo*, written as plain paragraphs. Any entity or glossary term's name appearing in a paragraph is recognized and linked automatically, which is the whole point of the experiment.

## One chapter, one file, five volumes

`scripts/Volume 1/1x01-marseilles-the-arrival/1x01-marseilles-the-arrival.fountain` is chapter 1. The five volume folders mirror the book's own divisions (chapters 1–27, 28–47, 48–73, 74–95, 96–117). The Production Code is the volume number, an `x`, and the book's chapter number, so chapter 61 is `3x61`. `Order` is the chapter number. Neither number changes if you reorder or split chapters later.

Every file starts with the standard title page (`Title:`, `Order:`, `Production Code:`) and a `# Chapter N. Title` heading, which Fountain treats as a non-printing section.

## Rules this manuscript follows

- Each paragraph is one line. Hard-wrapped lines break multi-word names across line breaks and the name no longer matches.
- Italics use `*asterisks*`. In Fountain `_underscores_` mean underline.
- Letters and other indented blocks keep their original line breaks.
- Nothing is written as a cue, scene heading or transition. See the project README, "What a novelist gets, and what they don't", for what that costs.

If you add your own chapters, avoid starting a paragraph with `INT.`/`EXT.`, a line with no lowercase letters, a line ending in ` TO:`, or a line starting with `>`, `~`, `=`, `.`, `@` or `[[`. A leading `!` forces most of these back to ordinary text; a line ending in `TO:` has to be reworded.

If you're an AI working in this project, see `agents/script-writer.md` at the project root.
