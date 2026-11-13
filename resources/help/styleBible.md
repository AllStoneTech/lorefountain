# The Style Bible

`world/style.lf.md` is an optional, single file that says how your project
should **look and feel**, so a comic, a video and an illustrated book from the
same world all belong together. A human artist can read it, and so can an AI
image or video tool. LoreFountain itself never generates anything: the file is
data for you, your collaborators and tools such as LoreFountain-Producer.

## Creating it

Command Palette → **LoreFountain: Open Style Bible (Create If Missing)**. It
writes a starting template into your world folder (never over an existing
file) and opens it in the **guided Style Bible editor**. Once it exists, a
**Style Bible** row appears at the top of the World view; click it to open the
editor.

The `.lf.md` ending marks a LoreFountain project document: it is never read as
a character, glossary term or note, so a real character called "Style"
(`style.md`) is fine.

## The guided editor

The form has one control per field, so the file can't be written wrongly:

- **Media**: tap the media this applies to, or add your own. Select none and
  the style applies to every medium (the form says so).
- **Palette**: a name and a colour picker (or hex box) per row. Colours are
  saved in quotes automatically.
- **Reference images**: **Choose file…** picks a file inside the project and
  stores its project-relative path; a missing file shows a warning.
- **Format**: one block per medium with presets (aspect ratios for video,
  trim sizes for comics and books) plus a custom option. Every preset is
  guidance only and is marked *sourced* or *unsourced*; confirm sizes with
  your printer or platform.
- **Notes**: the template's headings as labelled boxes (only those that fit
  your media, or **Show all sections**), and **Additional notes** for anything
  else in the file. Nothing already in the file is lost.
- **Open as text** (top right) shows the raw file for power users. Undo works
  as in any text file.

One caveat: once you change a field in the form, the file's `#` comment lines
in the frontmatter (the template's commented-out examples) are not kept.

## What goes in it

A short block of fields at the top, then ordinary Markdown. Every field is
optional; leave out what you don't need, and any extra fields you add are
kept.

| Field | What it is |
| --- | --- |
| `medium` | Which media this applies to: `comic`, `video`, `illustrated-book`, `animation`, `audio`. Leave it out and it applies to all of them. |
| `art_style` | One line summing up the look. |
| `palette` | Colour names and/or hex values, e.g. `"Harbor teal #2a7f8e"`. |
| `reference_images` | Image paths relative to your project folder, for mood and style (not character sheets). |
| `avoid` | Things that must not appear: `photorealism`, `3D render look`. |
| `format` | Per-medium hints, e.g. `comic: { trim_size: 6.625x10.25 in }`, `video: { aspect_ratio: "16:9" }`. |
| `lettering` | Comic lettering notes: font, balloon style, how sound effects look. |
| `era_reference` | The period the look draws on, e.g. `1925 pulp magazine covers`. |

A list field also accepts a single line of text. **Put hex colours in quotes**:
without them a `#` starts a comment and the colour is lost (LoreFountain tells
you if that happens).

Below the fields, write whatever helps. The template suggests *Overall look*,
*Characters*, *Color & light*, *Line & rendering*, *Framing & composition*,
*Lettering (comic)*, *Motion & pacing (video)*, *Format notes* and *What to
avoid*; add a "Comic" or "Video" heading wherever formats differ. None of the
headings are checked.

## What doesn't go in it

- **A character's own look** (hair, wardrobe, scars) stays in that character's
  Story Card, under Physical Description. The style bible's *Characters*
  section is only for rules that apply to everyone.
- **Character reference sheets** belong in the asset manifests
  (`assets/manifests/characters.json`).
- **Tool and provider settings** (which image tool, text styles for on-screen
  titles) belong in LoreFountain-Producer's own settings.

## Checks

`node agents/validate.js` and the LoreFountain Output channel report:

- a style bible whose fields are the wrong kind (an error, since tools can't
  read it), and
- a `reference_images` path that doesn't exist yet, or points outside the
  project (only a note).

The file is never treated as a character or other entity.

If you use an AI coding tool in this project, `agents/world-builder.md`'s
"Style bible format" section covers the same fields.
