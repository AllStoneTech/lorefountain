# Contributing to LoreFountain

Thanks for considering a contribution. This document covers how to get a dev
environment running, what a good pull request looks like here, and what's out
of scope.

## Scope: what lives in this repo

This repo holds the **free tier** of LoreFountain — the entity model, World
tree, Story Card/Story Overview editors, Timeline, hover/completion,
Structured Search, and everything else described in the README. **LoreFountain
Pro** (Continuity Management, Entity Graph, Story-Bible/BBC Radio/Cue-Sheet/
Shot-List export) lives in a separate, private submodule at `pro/` and isn't
open for external contributions — if `pro/` is missing when you clone this
repo, that's expected; the build produces a free-tier-only extension without
it, exactly as it does for every contributor.

## Getting started

See the [README's Development section](README.md#development) for the full
setup: `npm install`, then `npm run build`/`watch`/`typecheck`/`lint`/
`test:unit`. Press <kbd>F5</kbd> in VS Code to launch an Extension Development
Host and try your change against a real workspace.

## Before opening a pull request

- **Run the checks locally first**: `npm run typecheck`, `npm run lint`, and
  `npm run test:unit` should all pass clean.
- **Add unit tests for new pure logic** (parsing, schema, aggregation) —
  this project keeps a strict split between pure, unit-tested logic and thin
  `vscode`-facing glue (see `docs/DECISIONS.md` for the reasoning behind
  that split in specific features). `vscode`-facing code is generally
  verified manually via the Extension Development Host instead.
- **Keep changes focused.** A pull request that does one thing is much
  easier to review than one that mixes a feature with an unrelated
  refactor or formatting pass.
- **Explain the "why," not just the "what,"** in your PR description —
  what problem this solves and why this approach, not a restatement of the
  diff. See `docs/DECISIONS.md` for the style of rationale this project
  favors.

## Reporting bugs and requesting features

Please use the issue templates — they ask for the specific details (VS Code
version, extension version, steps to reproduce) that make a bug report
actionable.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you're expected to uphold it.

## Security issues

Please don't open a public issue for a security vulnerability — see
[SECURITY.md](SECURITY.md) for how to report one privately.
