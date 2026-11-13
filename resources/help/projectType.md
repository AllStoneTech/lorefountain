# Project Type

`project_type` says **what kind of writing project this is**: a feature
screenplay, a comic, a long-running series, a novel. It is one line in
`lorefountain.config.json`:

```json
{
  "project_type": "serialized_universe"
}
```

It describes how you **write**, never how the work is **rendered**. Whether a
story ends up as video, a podcast master or a printed book is a different
decision, made in tools such as LoreFountain-Producer.

## What it does, and what it doesn't

A project type is a **label with recommendations**. It records the kind of
project so you, your collaborators and any AI agent working in the folder
start from the same understanding. It shows which conventions suit the type
(see the table below).

It never changes your files, never switches a LoreFountain convention off,
and never overrides a setting you wrote yourself. For example, a `comic`
project still uses whatever `comic.preset` you set, and a `prose` project can
still use sound cues if you want them. A project with **no** `project_type`,
or `custom`, behaves exactly as it did before project types existed.

## Setting it

- **After you update:** the first time you open an existing project that has a
  `lorefountain.config.json` but no `project_type`, LoreFountain asks **What
  kind of project is this?** with a dropdown. It asks once per project.
- **A new project:** **LoreFountain: Initialize Workspace** asks as soon as it
  creates the config file. The demo worlds from **Install Demo World** come
  with their type already set.
- **Any time:** Command Palette → **LoreFountain: Set Project Type**.
- **By hand:** add the line shown above. The config file's editor offers the
  allowed values.

Choosing **Not sure yet / Skip**, or closing the dropdown, leaves the file
untouched and is remembered, so you aren't asked again on your own. To stop
the question for every project, turn off the setting
`lorefountain.notifications.projectType`.

Only that one line is added to your config. Every other setting is kept as it
was.

## The types

| `project_type` | What it is | Structure under `scripts/` |
| --- | --- | --- |
| `screenplay` | **Feature screenplay.** One self-contained film in standard screenplay format. | A single script, or one folder per draft. |
| `tv_series` | **TV series or anthology.** A show with a fixed run, or self-contained episodes under one banner. | One folder per season, one folder per episode. |
| `serialized_universe` | **Serialized universe.** A long-running original series, possibly with a frame story, whose arcs and cast carry across seasons. | One folder per season, one per episode, with arcs tying episodes together. |
| `audio_drama` | **Audio drama or podcast.** A story told in sound: dialogue, narration, music and effects. | One folder per season, one per episode. |
| `comic` | **Comic or graphic novel.** A Page/Panel script written for an artist. | One folder per issue or chapter, written as `PAGE:` and `PANEL:` blocks. |
| `prose` | **Novel or serial prose fiction.** Chapters of prose, with the story bible alongside as a record of the world. | One quiet `.fountain` file per chapter. |
| `tabletop` | **Tabletop RPG campaign.** A campaign run by a game master: secrets, hooks and session notes. | One folder per session. |
| `custom` | **Something else, or leave as is.** No recommendation. | Whatever you already use. |

### Which conventions each type recommends

| `project_type` | Sound cues | Shot maps | Arcs | Continuity tools | Page/Panel | `assets/` |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| `screenplay` | | | | | | |
| `tv_series` | yes | yes | | | | |
| `serialized_universe` | yes | yes | yes | yes | | yes |
| `audio_drama` | yes | | | | | |
| `comic` | yes | yes | | | yes | |
| `prose` | | | | yes | | |
| `tabletop` | | | | yes | | |
| `custom` | | | | | | |

These are recommendations only. In the table:

- **Sound cues** are the `SFX:`, `MUSIC:` and `AMB:` lines.
- **Shot maps** are the `SHOT:`, `POSE:`, `LIGHT:` and `DURATION:` lines.
- **Arcs** are the arc entity type, for a storyline that spans several episodes
  or seasons.
- **Continuity tools** are canon status, presence, flags, doubling and the
  timeline.
- **Page/Panel** is the comic script format.
- **`assets/`** is the folder of manifests that map a cue or entity to the file
  that fulfils it.

## Choosing between neighbours

- **`tv_series` or `serialized_universe`?** Pick `serialized_universe` when the
  same world and cast keep going across seasons and arcs matter more than
  single episodes. A show with a fixed run, or one that is a set of separate
  stories, is a `tv_series`.
- **`screenplay` or `tv_series`?** A screenplay is one film. If you are
  adapting a long book into a feature, it is still a `screenplay`; a book
  turned into one episode per chapter is a `tv_series`.
- **`audio_drama` or `tv_series`?** If the finished work is only heard, use
  `audio_drama`. If it will also be seen and you want shot maps, use
  `tv_series`.
- **`comic` or `prose`?** A comic is written as pages and panels for an artist.
  A graphic work told in prose is `prose`.

## Changing your mind

Run **Set Project Type** again, or edit the line. Nothing else depends on it, so
a change is safe and takes effect the next time the project is read.

## For AI agents

`AGENTS.md` tells an AI agent to read `project_type` before it writes. An agent
should use the type to pick the right conventions and folder structure, and
should never add a convention the writer's type doesn't call for without being
asked.
