# LoreFountain

A Fountain-native worldbuilding layer for VS Code (and VS Code forks: Cursor,
Windsurf, Antigravity). LoreFountain links character cues and scene headings in
`.fountain` scripts to structured, plain-Markdown **entity** files — characters,
locations, factions, objects, concepts, and arcs — with typed relationships,
hover previews, autocomplete, and backlinks.

> Working title, open to revision.

## Principles

- **Files are the source of truth.** Scripts are `.fountain`; entities are `.md`
  with YAML frontmatter. No feature requires data that lives only in a database.
- **The index is disposable.** A local SQLite database is a rebuildable cache,
  never authoritative — it is git-ignored and safe to delete and re-index.
- **No AI features in the extension.** LoreFountain structures data so existing
  AI coding agents already in your IDE work better; it does not compete with them.

## Status

`v0.11.0`. The free tier is fully built: the entity model (character, location,
faction, object, concept, arc) with typed relationships, significance
grouping, and freeform physical descriptions; a glossary; a dual-ordered
Timeline; a Story Card editor and Story Overview document; hover previews and
autocomplete; Rename Entity with reference propagation; Structured Search;
broken-reference detection; transcript export; a headless `validate.js` for
CI/AI-agent use with no VS Code dependency; and project-level AI agent
instructions (`AGENTS.md`/`agents/*.md`) with their own version tracking.

**LoreFountain Pro** (paid tier) adds Continuity Management, an Entity Graph
view, Story-Bible Export, BBC Radio Drama Export, SFX/Cue-Sheet Export, and
Shot List Export — all shipped. License validation now calls a real backend
endpoint, though that endpoint isn't deployed yet; a time-boxed public-launch
promo keeps Pro unlocked for everyone in the meantime (see `docs/TODO.md`).
See `CHANGELOG.md` for what shipped when, and `docs/DECISIONS.md` for the
full rationale behind each of these.

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

`npm run package` (and `vsce`'s `vscode:prepublish` hook) builds with `--production`,
which minifies and then runs `javascript-obfuscator` over `dist/extension.js`,
`dist/pro.js`, and `dist/entityGraphClient.js`. Obfuscation strength defaults to
`max`; switch it with `npm run build:obfuscate-balanced` (lighter, smaller
`.vsix`, no runtime overhead) or `npm run build:obfuscate-off` (minify only). See
the header of `esbuild.js` and `docs/DECISIONS.md` (ADR-0035) for the full
rationale and size/performance trade-offs.

Press <kbd>F5</kbd> in VS Code to launch the **Run Extension** configuration in an
Extension Development Host. The `watch` task's problem matcher is self-contained
(`.vscode/tasks.json`, tied to explicit begin/end lines `esbuild.js` prints on every
build) — no third-party extension is required for F5 to work.

## License

MIT © All Stone Tech. See [LICENSE](LICENSE). The Fountain parsing dependencies
(Afterwriting, Fountain.js) are likewise MIT-licensed.
