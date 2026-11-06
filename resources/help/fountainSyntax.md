# Fountain Syntax: Tutorial and Quick Reference

LoreFountain scripts are plain [Fountain](https://fountain.io/) 1.1
screenplays. Fountain is plain text: you never apply a style from a menu.
Each element is recognized from how you write it: capital letters, blank
lines, and a few marks such as `>` or `~`.

This page has two parts:

- **Part 1: Fountain.** Every element of the Fountain 1.1 spec, with an
  example. A script written this way opens in any Fountain app.
- **Part 2: LoreFountain's conventions.** Lines such as `SHOT:`, `PAUSE:`
  and `SFX:` that LoreFountain reads for shot lists, cue sheets and other
  production data. They are ordinary action lines to every other Fountain
  app, so your script stays portable.

LoreFountain extends Fountain but never changes it. When a script doesn't
follow the spec, LoreFountain reads it exactly as Fountain would and adds a
note in the **Problems** panel. It never guesses what you meant.

## Quick reference

| Element | How to write it | Example |
|---|---|---|
| Title page | `Key: value` lines at the very top of the file | `Title: The Long Night` |
| Scene heading | Starts with `INT`, `EXT`, `EST`, `INT./EXT`, `INT/EXT` or `I/E` | `INT. KITCHEN - NIGHT` |
| Forced scene heading | Starts with one `.` | `.FLASHBACK - 1925` |
| Action | Any paragraph that isn't something else | `Rain hammers the window.` |
| Forced action | Starts with `!` | `!SCREAMS.` |
| Character | An all-caps line with dialogue directly under it | `SANGO` |
| Forced character | Starts with `@` | `@McCLANE` |
| Extension | In parentheses after the name | `SANGO (V.O.)` |
| Dual dialogue | `^` after the second character's name | `STEEL ^` |
| Parenthetical | In parentheses, under a character or dialogue line | `(quietly)` |
| Lyrics | Each line starts with `~` | `~Row, row, row your boat` |
| Transition | All caps, ending in `TO:` | `CUT TO:` |
| Forced transition | Starts with `>` | `> FADE OUT.` |
| Centered text | Between `>` and `<` | `>THE END<` |
| Emphasis | `*`, `**`, `***` or `_` around words | `*italic*`, `**bold**`, `_underline_` |
| Page break | Three or more `=` alone on a line | `===` |
| Note | Between `[[` and `]]` | `[[Check the date]]` |
| Boneyard (hidden text) | Between `/*` and `*/` | `/* cut for time */` |
| Section | Starts with one or more `#` | `# Act One` |
| Synopsis | Starts with one `=` | `= Sango finds the ledger.` |
| LoreFountain shot | `SHOT:`, then `POSE:`, `LIGHT:`, `DURATION:` | `SHOT: WIDE on the dock` |
| LoreFountain scene pause | `PAUSE:`, with an optional length | `PAUSE: 2s` |
| LoreFountain sound cue | `SFX:`, `MUSIC:` or `AMB:` | `SFX: a door slams` |
| LoreFountain tag | `[tag]` right after `SHOT:`, `SFX:`, `MUSIC:` or `AMB:` | `SFX: [door-slam] a door slams` |
| LoreFountain episode keys | `Order:` and `Production Code:` on the title page | `Production Code: 1x03` |

## Part 1: Fountain

### A first scene

Here is a short scene that uses the most common elements. Each one is
explained below.

```fountain
Title: The Long Night
Author: Ada Okafor

INT. ARCHIVE - NIGHT

Rows of shelves vanish into the dark. SANGO, sixties, climbs down a ladder
with a ledger under one arm.

SANGO
(to himself)
Forty years, and nobody asked for this one.

He opens the ledger. Every page is blank.

CUT TO:

EXT. ARCHIVE - CONTINUOUS

Rain.
```

The rule of thumb: **blank lines matter**. Most elements are recognized by
what comes before and after them, so leave a blank line between elements
unless this page says otherwise.

### Title page

The title page is optional. If you have one, it must be the first thing in
the file: one `Key: value` per line, ending with a blank line. A page break
follows it automatically.

```fountain
Title: The Long Night
Credit: Written by
Author: Ada Okafor
Source: Based on a story by Kemi Adeyemi
Draft date: 2026-11-05
Contact:
    ada@example.com
    555-0100

INT. ARCHIVE - NIGHT

Rows of shelves vanish into the dark.
```

- Keys can contain spaces (`Draft date`) and end with a colon.
- The standard keys are `Title`, `Credit`, `Author` (or `Authors`),
  `Source`, `Draft date` and `Contact`. Other keys are allowed and
  ignored when the script is printed, which is how LoreFountain stores
  episode numbers (see **Episode keys** in Part 2).
- A value can continue on the following lines if they are indented by
  three or more spaces or a tab, as `Contact:` is above.
- Put `Title:` first. The parser LoreFountain uses only recognizes a title
  page whose first key is a standard one.

### Scene headings

A scene heading is a line that starts with `INT`, `EXT`, `EST`, `INT./EXT`,
`INT/EXT` or `I/E`, followed by a dot or a space, with a blank line before
and after it. Upper or lower case both work, but headings are
conventionally all caps.

```fountain
INT. KITCHEN - NIGHT

EXT. DOCK - DAWN

INT./EXT. MOVING CAR - DAY

I/E. TRUCK - NIGHT
```

To make any other line a scene heading, start it with a single `.`:

```fountain
.FLASHBACK - THE DOCK, 1925

Gulls wheel over an empty pier.
```

Only one dot counts: a line starting with `...` is ordinary action.

You can add a scene number at the end of a heading, between `#` marks.
Numbers can contain letters, dashes and periods:

```fountain
INT. KITCHEN - NIGHT #12#

EXT. DOCK - DAWN #12A#
```

LoreFountain reads each heading's parts for the shot map: the
`INT.`/`EXT.` prefix, the place, and a final time of day such as `DAY`,
`NIGHT` or `CONTINUOUS`. Separate the parts with a hyphen or a dash with a
space on each side, as above.

### Action

Action is the default. Any paragraph that isn't one of the other elements
is action, so most of a script is action.

```fountain
Rain hammers the window. SANGO stands in the doorway, dripping.

He doesn't take off his coat.
```

Line breaks you type are kept, and so is indentation at the start of an
action line.

If a line would otherwise be read as something else, start it with `!` to
force it to be action. The most common case is a short all-caps line with
text directly under it, which Fountain would otherwise read as a character
about to speak:

```fountain
!SCREAMS.
The lights die.
```

Without the `!`, `SCREAMS.` would be a character and `The lights die.`
would be their dialogue.

### Characters

A character cue is a line written entirely in capitals, with a blank line
before it and the dialogue directly under it (no blank line between). It
needs at least one letter, so `COP 2` works but `2` doesn't.

```fountain
SANGO
I told you not to come back here.
```

**Extensions** go in parentheses after the name, on the same line. They can
be in any case:

```fountain
SANGO (V.O.)
Forty years I kept these shelves.

MOTHER (on the radio)
Come home before the rain.

SANGO (CONT'D)
I'm coming.
```

To use a name that isn't all caps, start the line with `@`:

```fountain
@McCLANE
Come out to the coast.
```

### Dialogue

Dialogue is the text under a character cue or a parenthetical. It can run
over several lines. A blank line ends the speech.

```fountain
SANGO
I kept every ledger.
Every single one.
```

To leave a visibly empty line inside one speech, put two spaces on that
line. A truly empty line would end the speech.

### Parentheticals

A parenthetical is a short performance note in parentheses, on its own line
under a character cue or a line of dialogue:

```fountain
SANGO
(quietly)
I kept every ledger.
(beat)
Every single one.
```

Keep the whole speech together with no blank lines in it. A parenthetical
after a blank line is action, not part of the speech, and LoreFountain
warns about it (see **Problems LoreFountain reports** below).

### Dual dialogue

When two characters speak at the same time, add `^` after the second
character's name. Many apps print the two speeches side by side.

```fountain
BRICK
Screw retirement.

STEEL ^
Screw retirement.
```

In the shot map, the second speech is marked as overlapping the first.

### Lyrics

Start each sung line with `~`:

```fountain
~Down by the water
~where the ledgers sleep
```

### Transitions

A transition is a line written in capitals that ends in `TO:`, with a blank
line before and after it:

```fountain
He closes the ledger.

CUT TO:

EXT. DOCK - NIGHT

SMASH CUT TO:

INT. KITCHEN - DAY
```

**Why `FADE OUT.` needs a `>`.** The spec only detects transitions that
end in `TO:`. `FADE OUT.`, `FADE TO BLACK.` and `CUT TO BLACK.` don't, so
under the spec they are action and many apps print them at the left margin.
Start the line with `>` to force it to be a transition everywhere:

```fountain
She turns off the lamp.

> FADE OUT.
```

Some apps, including the parser LoreFountain uses, recognize a bare
`FADE OUT.` anyway, but others don't. Always write `> FADE OUT.` so the
script prints the same in every app.

### Centered text

Put text between `>` and `<` to center it. Spaces inside are optional.

```fountain
>THE END<

> ONE YEAR LATER <
```

Centered text is action, not a transition, even though it starts with `>`.

### Emphasis

```fountain
He *whispers* the name. She **screams** it. They ***both*** run.

The sign reads _CLOSED_.

Prices start at \*5 a ticket.
```

- `*italic*`, `**bold**`, `***bold italic***` and `_underline_`.
- Emphasis can't run across a line break.
- Put a backslash before a `*` or `_` to show it as a plain character.

### Page breaks

A line of three or more `=` signs, and nothing else, forces a page break:

```fountain
Sango locks the archive behind him.

===

INT. KITCHEN - MORNING

Sunlight.
```

### Notes

Text between `[[` and `]]` is a note to yourself. Notes can sit inside a
line or on their own, and never print.

```fountain
Sango opens the ledger. [[Is it 1925 or 1926?]]

[[Ask the props team for a real ledger.]]
```

A note can span several lines, but not a blank line: put two spaces on a
line to leave it visibly empty.

LoreFountain also uses `[[Name]]` as an explicit link to an entity or
glossary term, for a mention it wouldn't otherwise recognize, such as a
nickname. Because the link is a Fountain note, it doesn't print, so keep
the visible wording in the action next to it:

```fountain
The old man [[Sango]] climbs the ladder.
```

### Boneyard

Text between `/*` and `*/` is hidden from the printed script entirely. It
can span many lines, including blank ones. Use it to keep cut material in
the file:

```fountain
/*
INT. ARCHIVE - LATER

Sango reads the ledger by candlelight.
*/

INT. KITCHEN - NIGHT

He is home.
```

LoreFountain ignores everything in a boneyard too. A shot, sound cue or
character name inside one isn't counted anywhere: not in the shot map, the
cue sheet, scene presence or search. Hover previews and autocomplete still
work there while you edit, and **Rename Entity** still updates names inside
it, so cut material is up to date if you restore it.

LoreFountain treats a `/*` with no closing `*/` as ordinary text, so check
that every boneyard is closed.

### Sections and synopses

Sections and synopses help you outline. Neither prints.

- A **section** starts with `#`. More `#` signs make a deeper level:
  `#` for an act, `##` for a sequence, and so on.
- A **synopsis** starts with a single `=` and briefly describes the section
  or scene above it.

```fountain
# Act One

## The Archive

= Sango finds a ledger that should not exist.

INT. ARCHIVE - NIGHT

Rows of shelves vanish into the dark.
```

## Part 2: LoreFountain's conventions

Fountain has no syntax for camera shots, pauses in a scene, or sound cues.
LoreFountain adds them as **convention lines**: an action line that starts
with a keyword and a colon. Every other Fountain app prints them as
ordinary action, so the script is still valid Fountain.

LoreFountain turns them into data files next to each script, rebuilt on
every save:

- `<script>.shots.json`, the shot map: each shot's lines, what's heard in
  it, the entities it mentions, and the cues that start in it.
- `<script>.cues.json`: every sound cue.

Never edit those files by hand; they are overwritten on the next save.
Writing the conventions is free in any project. Exporting them as a shot
list, cue sheet or BBC-style radio script is LoreFountain Pro.

### Writing convention lines

- Write the keyword in capitals, at the start of the line, followed
  directly by a colon: `SHOT:`, not `Shot:` or `SHOT :`. Anything else is
  ordinary action to LoreFountain too.
- Keep convention lines in the action, never in the middle of a speech.
  Finish the speech, leave a blank line, write the convention line, leave
  another blank line, then repeat the character cue with `(CONT'D)`:

```fountain
SANGO
I kept every ledger.

SHOT: CLOSE-UP on the ledger

SANGO (CONT'D)
Every single one.
```

- **Keep a lowercase word in an all-caps convention line**, or leave a
  blank line after it. Fountain reads an all-caps line with text directly
  under it as a character cue. LoreFountain still understands the lines
  correctly, but other apps would print them as a character speaking:

```fountain
SHOT: WIDE on the dock
POSE: Sango kneels by the water

SHOT: CLOSE-UP

POSE: Sango's hands, shaking
```

Both shots above are action in every app. Writing `SHOT: CLOSE-UP` with
`POSE: SANGO KNEELS` directly under it would not be.

Snippets save typing: type `shot`, `pose`, `light`, `dur`, `pause`, `sfx`,
`amb` or `mus` and press Tab. `shot-tag`, `sfx-tag`, `amb-tag` and
`mus-tag` add a tag placeholder.

### Shots: SHOT, POSE, LIGHT and DURATION

`SHOT:` starts a new shot. Describe the framing however you like (`WIDE`,
`CLOSE-UP on Sango`, `OTS from the doorway`); there is no fixed list.

The lines after it add details to that shot, until the next `SHOT:` or
scene heading:

- `POSE:` what the characters are doing in the shot.
- `LIGHT:` the lighting, written as a description.
- `DURATION:` how long the shot lasts.

```fountain
INT. ARCHIVE - NIGHT

SHOT: WIDE, establishing
LIGHT: Cold blue moonlight through high windows
DURATION: 4s

SHOT: CLOSE-UP on Sango
POSE: Sango grips the ladder, jaw tight
LIGHT: Warm lamplight from below
DURATION: about 3 seconds

Sango climbs down.
```

- Shots are numbered within each scene, starting again at 1 after every
  scene heading. Anything in a scene before its first `SHOT:` belongs to
  an unnumbered shot 0 in the shot map.
- A `POSE:`, `LIGHT:` or `DURATION:` line with no `SHOT:` before it in the
  scene is ignored. If one appears twice in a shot, the last one counts.
- `DURATION:` is kept exactly as you wrote it. When it contains a number
  of seconds (`4s`, `2.5 sec`, `~5 seconds`, `about 3 seconds`), the shot
  map also records the number. Text like `quick` is kept, with no number.
- Character names in `SHOT:`, `POSE:` and `LIGHT:` link to their entities
  like any other action text.

### Scene pauses: PAUSE

There are two kinds of pause, and they're written differently:

- **A character's own pause** is a parenthetical inside their speech:
  `(beat)`, `(a beat)`, `(long beat)`, `(pause)`, `(a pause)`,
  `(long pause)` or `(silence)`.
- **A pause in the scene**, belonging to no one, is a `PAUSE:` line. Add a
  length if you like.

```fountain
SANGO
I kept every ledger.
(beat)
Every single one.

PAUSE: 2s

Rain against the glass.

PAUSE:
```

Both kinds appear in order in the shot map's list of what's heard. A
`PAUSE:` length is read the same way as a `DURATION:`.

A line of plain action such as `Beat.` or `A long silence.` stays action.
LoreFountain adds a note suggesting `PAUSE:` if a scene pause is what you
meant.

### Sound cues: SFX, MUSIC and AMB

- `SFX:` a sound effect.
- `MUSIC:` a music cue.
- `AMB:` an ambience or room-tone bed.

```fountain
INT. ARCHIVE - NIGHT

AMB: rain on a tin roof, distant thunder
SFX: a ladder creaks
MUSIC: BED IN - low, patient, unresolved

Sango climbs down.

MUSIC: STING - the ledger is blank
MUSIC: OUT
```

A `MUSIC:` cue can start with two optional keywords, in this order:

- A **role**: `BED`, `STING`, `BRIDGE` or `SOURCE BED`.
- A **timing**: `IN` or `OUT`, for a fade.

Use either, both or neither. A hyphen after them is optional, so
`MUSIC: STING - the reveal` and `MUSIC: STING the reveal` mean the same.
Any other word is simply the start of the description.

To cut a cue but keep it in the file, put it in a boneyard: LoreFountain
ignores it there.

### Tags

A `SHOT:`, `SFX:`, `MUSIC:` or `AMB:` line can carry a **tag** in square
brackets, right after the colon. The tag names the image, clip or sound
file that fulfils the line, through a manifest under `assets/manifests/`:
`shots.json` for shots and `audio.json` for sound. That way a recurring
sound or shot uses the same file every time.

```fountain
SHOT: [1x03-archive-wide] WIDE, establishing
SFX: [door-slam] the archive door slams
MUSIC: [archive-theme] BED IN - low strings
AMB: [rain-tin-roof] steady rain
```

- A tag uses only lowercase letters, digits and single hyphens, and can't
  start or end with a hyphen. Anything else, such as `[Door Slam]`, isn't
  a tag and is read as part of the description.
- On a `MUSIC:` cue, the tag comes before the role and timing.
- Tags are optional. An untagged line just isn't linked to a file yet.
- Start a tag used in only one episode with that episode's production code
  (`1x03-archive-wide`), and leave the code off a tag you reuse across
  episodes (`archive-theme`). Never put scene or shot numbers in a tag;
  they change whenever you add a shot.
- `POSE:`, `LIGHT:`, `DURATION:` and `PAUSE:` don't take tags.

Open `shots.json` or `audio.json` for a form-based editor instead of
editing the JSON.

### Episode keys: Order and Production Code

LoreFountain reads two extra title-page keys. Other Fountain apps ignore
them.

```fountain
Title: The Long Night
Order: 3
Production Code: 1x03

INT. ARCHIVE - NIGHT

Rows of shelves vanish into the dark.
```

- `Order:` the episode's position in its season, as a whole number from 1.
  It sets the order in the Scripts view; dragging an episode there changes
  it. Without one, episodes sort by file name.
- `Production Code:` a permanent episode identifier: the season number,
  `x`, then a two- or three-digit episode number (`1x03`, `12x105`). It
  never changes, even if the episode moves.
- The **New Script** command writes both for you, so they never clash with
  another episode. Keep `Title:` as the first line, above them.
- LoreFountain warns about a value it can't use and ignores it. Two
  scripts with the same production code are reported as an error.

## Problems LoreFountain reports

Script problems appear in the **Problems** panel and as squiggles on the
line. Press **Ctrl+.** (**Cmd+.** on a Mac) on one for a quick fix, or run
**Fix All Script Formatting Issues** to review every safe fix in the
project at once.

- **A parenthetical after a blank line.** The blank line ended the speech,
  so the parenthetical and the lines after it are action. The fix removes
  the blank line, or repeats the character cue with `(CONT'D)` when a
  convention line interrupts the speech.
- **A plain-action pause** such as `Beat.`. The fix replaces it with
  `PAUSE:`.

## Further reading

The official [Fountain syntax guide](https://fountain.io/syntax/) at
fountain.io covers every rule in full. For the Scripts view itself, open
its help (the `?` in its title bar).
