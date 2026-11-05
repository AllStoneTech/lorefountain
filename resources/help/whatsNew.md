# What's New in LoreFountain 1.1

## Shot maps: link every shot to its image

A `SHOT:` line can now carry a **`[tag]`**, the same kind of handle sound
cues already use:

```
SHOT: [1x01-basement-wide] WIDE, establishing — LUCIEN's basement office
SHOT: [archive-ident] WIDE, abstract — the recurring ident
```

The tag points into a new file, `assets/manifests/shots.json`, which says
which still or clip fills that shot (and, for a still, how it should move).
Prefix an episode's shots with its production code (`1x01-...`), leave the
prefix off shots you reuse across episodes, and never put scene or shot
numbers in a tag — those change whenever you insert a shot.

Every script with shots also gets a `<script-name>.shots.json` file next to
it, rebuilt on every save: each shot's lines, what's heard in it, who and
what it mentions, and the cues that start in it. It's there for video tools;
you never need to edit it.

## Two kinds of pause

- **A character's own pause** stays a parenthetical in their dialogue:
  `(beat)`, `(pause)`, `(long beat)`...
- **A pause in the scene** is a new line: `PAUSE:`, or `PAUSE: 2s` with a
  length.

## Quick fixes for script formatting

Script problems now show in the **Problems** panel and as squiggles in the
editor, not only in the LoreFountain output.

The most common one: in Fountain, a blank line ends a character's speech.
A `(beat)` after a blank line, and everything after it, is read as action,
so every Fountain tool shows it that way. Put your cursor on the warning and
press **Ctrl+.** (**Cmd+.** on a Mac) for a one-click fix:

- **Join to the previous speech** removes the blank line.
- **Re-cue the speaker** adds `NAME (CONT'D)` when a `SHOT:` or other line
  has to sit in the middle of the speech.
- **Replace with PAUSE:** turns a standalone `Beat.` line into a scene pause.

**Fix All Script Formatting Issues** (Command Palette) applies every safe fix
across your project at once. You'll see each change in a preview first and
can untick any you don't want; nothing changes until you apply it.

## Also

- **Check for LoreFountain Updates** is now in the Command Palette.
- Line numbers after long action blocks are now correct, which also fixes
  where cues land in the Pro Cue Sheet and BBC Radio Script exports.
- You can turn these notices off in Settings: **LoreFountain › Notifications**.

Reopen this page any time with **LoreFountain: What's New**.
