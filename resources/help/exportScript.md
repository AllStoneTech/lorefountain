# Script Export

**Export Script…** turns a script into a file other people and other apps
can use. It's free in every project.

| Format | What it's for |
|---|---|
| **PDF** | Reading and printing. Industry screenplay layout in Courier. |
| **Fountain** | Any other Fountain app: Highland, Fade In, Final Draft's Fountain import, WriterSolo. |
| **Final Draft (.fdx)** | Final Draft, and tools that take FDX but not Fountain, such as scheduling software. |
| **Web page (.html)** | One file anyone can open in a browser, laid out like the script. |
| **Word (.docx)** | Editing or commenting in Word or Google Docs. Each screenplay element has its own Word style. |
| **Transcript** | Dialogue only, for accessibility, show notes or publishing. |

## Running it

Click the export icon in a script's editor title bar, right-click a script
or a season in the Scripts view, or run **LoreFountain: Export Script…**
from the Command Palette. A dialog opens:

1. **Format.**
2. **What to include**, by preset or by box (below).
3. **Layout** (PDF, Word and web page): **Screenplay**, **Comic script**,
   or **Automatic**, which uses the comic script layout in a project whose
   type is **Comic or graphic novel**, and for any script with `PAGE:` lines. **Mark comic pages left or right** adds `(LEFT)` or
   `(RIGHT)` to each comic page heading.
4. **Page:** US Letter or A4, and whether to start with the title page
   (PDF and Word only).
5. **Scripts:** this script, or every script in its season. A whole season
   goes into one folder you choose, one file per script.

Files are saved to an `exports` folder in your project unless you pick
another place. LoreFountain remembers your choices in
`lorefountain.config.json` for next time.

## What to include

| Preset | What it keeps |
|---|---|
| **Pure Fountain** | Standard Fountain only. Every LoreFountain line (`SHOT:`, `SFX:`, `PAUSE:` ...), `[tag]` and `Order:`/`Production Code:` key is removed, so the script reads like any ordinary screenplay. Notes, sections and synopses stay, because they are part of Fountain. |
| **Production draft** | Everything in the script. |
| **Audio draft** | Sound cues and pauses, without shot lines or tags. |
| **Custom** | Your own choice. Change any box and the preset becomes Custom, which is saved for this project. |

The boxes: shot lines, sound cues, scene pauses, comic lines, asset
`[tags]` (dropping a tag keeps its line), notes, sections, synopses,
boneyard (cut text, off in every preset), and the `Order:` and
`Production Code:` keys. **Scene numbers** can stay as written, be
numbered automatically (`#1#`, `#2#` ...), or be removed.

The transcript always holds dialogue only, so these options don't apply to it.

## Comic scripts

A script written with `PAGE:` and `PANEL:` lines exports in the comic
"full script" layout that artists and letterers expect:

```
PAGE ONE (SPLASH, 1 panel)

PANEL 1
Wide. The harbour at dawn.

    1.  CAPTION:        Lagos, 1897.
    2.  ADÉ (WHISPER):  They're late.
    3.  SFX:            KLONK
```

- Each comic page starts a new sheet. A page that runs longer than a sheet
  continues under `PAGE ONE (CONTINUED)`. A spread (`PAGE: 2-3`) is headed
  `PAGES TWO–THREE`.
- Captions, balloons and sound effects are numbered per page, starting at 1
  on each page, so the letterer can match each one to the art.
- The comic lines and `SFX:` lettering are always kept, whatever the
  preset. Shot lines, tags and notes follow your choices, so `SHOT:` lines
  in a narrated comic are left out unless you tick them.
- Anything before the first `PAGE:` or `PANEL:` isn't part of the comic, so
  it's left out.
- Final Draft has no comic format, so a comic exported to `.fdx` is a
  screenplay. `.fountain` exports are the same in either layout.

## Good to know

- **Every export is standard Fountain underneath.** If a kept `SHOT:` line
  would read as a character name in other apps, the export starts it with
  `!`, even if you never fixed the warning in the script.
- **Notes never print** in the PDF, Word or Final Draft files, as in every
  Fountain app. That includes `[[Name]]` entity links: keep the visible
  name in the text next to a link.
- **The PDF** follows the industry layout: 1.5 inch left margin, dialogue
  3.5 inches wide, page numbers from page 2, `(MORE)` and `(CONT'D)` when a
  speech crosses a page, and no scene heading or character name left alone
  at the bottom of a page. Letters Courier Prime lacks (Yoruba's ẹ, ọ, ṣ and
  tone marks, for example) print in Noto Sans Mono, at the same width.
- **Word** handles its own page breaks, so it doesn't add `(MORE)` or
  `(CONT'D)`. It uses Courier Prime when it's installed and Courier New
  otherwise.
- **Final Draft:** `SHOT:` lines become Final Draft Shot paragraphs. Notes,
  sections and synopses are left out.
- **Bookmarks and language.** A PDF lists each scene (or comic page) as a
  bookmark, so you can jump straight to it. PDF, Word and web page exports
  declare the project's language for screen readers and spell checkers:
  English unless you set `"export": { "language": "yo" }` (or any language
  tag) in `lorefountain.config.json`.
- **Don't save a `.fountain` export in your scripts folder.** LoreFountain
  would read it as another script, with the same Production Code as the
  original. The dialog asks before doing that.

The PDF fonts are Courier Prime and Noto Sans Mono, both under the SIL Open
Font License (included with the extension).
