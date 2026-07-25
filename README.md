# LoreFountain

A Fountain-native worldbuilding layer for VS Code (and VS Code forks: Cursor,
Windsurf, Antigravity). LoreFountain links character cues and scene headings in
`.fountain` scripts to structured, plain-Markdown **entity** files — characters,
locations, factions, objects, and concepts — with typed relationships, hover
previews, autocomplete, and backlinks.

> Working title, open to revision.

## Principles

- **Files are the source of truth.** Scripts are `.fountain`; entities are `.md`
  with YAML frontmatter. No feature requires data that lives only in a database.
- **The index is disposable.** A local SQLite database is a rebuildable cache,
  never authoritative — it is git-ignored and safe to delete and re-index.
- **No AI features in the extension.** LoreFountain structures data so existing
  AI coding agents already in your IDE work better; it does not compete with them.

## Status

Early scaffold. Building the **free tier** first — entity creation via a Story
Card form, Fountain-native linking (hover + autocomplete), backlinks, and the
files-as-truth + SQLite/JSON1 index — toward a dogfooding milestone (migrating a
real Series Bible). Paid-tier features (graph/timeline views, continuity
management, casting, advanced exports) are deliberately out of scope for now.

## Development

Requires Node.js and npm.

```bash
npm install
npm run build      # bundle to dist/ via esbuild
npm run watch      # incremental rebuilds
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test:unit  # vitest (pure-logic tests)
```

Press <kbd>F5</kbd> in VS Code to launch the **Run Extension** configuration in an
Extension Development Host. The `watch` task's problem matcher is self-contained
(`.vscode/tasks.json`, tied to explicit begin/end lines `esbuild.js` prints on every
build) — no third-party extension is required for F5 to work.

## License

MIT © All Stone Tech. See [LICENSE](LICENSE). The Fountain parsing dependencies
(Afterwriting, Fountain.js) are likewise MIT-licensed.
