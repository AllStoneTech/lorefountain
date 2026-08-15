# Publishing

How to get `lorefountain` onto a real marketplace, once you're ready. This
is a one-time account-setup process per registry, then a one-line publish
command per release. See `docs/TODO.md` for what's still blocking a public
release generally (license backend, repo visibility) — none of that blocks
*this* setup, but a public marketplace listing implies real customers, so
don't run `publish` for real until those are settled.

## Why two registries

The [README](../README.md) advertises support for VS Code and its forks
(Cursor, Windsurf, Antigravity). The **VS Code Marketplace**
(marketplace.visualstudio.com) is contractually restricted to genuine
Microsoft-branded products — non-Microsoft forks don't query it at all.
They query **Open VSX Registry** (open-vsx.org) instead. So being a "real"
extension for this project's stated audience means publishing to both.

## One-time setup

### VS Code Marketplace (`vsce`)

1. Create an Azure DevOps organization (free) at [dev.azure.com](https://dev.azure.com) if you don't have one.
2. Create a **publisher** matching `package.json`'s `"publisher": "allstonetech"` at the [Marketplace publisher management page](https://marketplace.visualstudio.com/manage) — this hasn't been verified against a real account yet (see the project's identity notes).
3. Generate a Personal Access Token in Azure DevOps with **Marketplace → Manage** scope.
4. Store it as an environment variable, never in a file this repo tracks:
   ```bash
   export VSCE_PAT=xxxxxxxxxxxx
   ```

### Open VSX Registry (`ovsx`)

1. Create an account at [open-vsx.org](https://open-vsx.org) (sign in with GitHub).
2. Agree to the Open VSX publisher agreement (required once, in your account settings).
3. Claim the `allstonetech` namespace:
   ```bash
   npx ovsx create-namespace allstonetech -p <your-open-vsx-token>
   ```
4. Generate an access token from your Open VSX profile settings.
5. Store it as an environment variable:
   ```bash
   export OVSX_PAT=xxxxxxxxxxxx
   ```

## Publishing a release

Both registries take the same `.vsix` — build once, publish twice:

```bash
npm run package        # produces lorefountain-<version>.vsix (also what each publish command below does internally)
npm run publish:vsce   # vsce publish — reads VSCE_PAT
npm run publish:ovsx   # ovsx publish — reads OVSX_PAT
```

Both `vsce` and `ovsx` bump nothing on their own — the version published is
whatever `package.json`'s `"version"` currently is, so bump it first (per
this project's existing "minor per shipped feature" convention, see
`docs/DECISIONS.md`).

## Marketplace icon

`resources/icon.png` (512×512 PNG) is wired in via `package.json`'s
`"icon"` field and confirmed accepted by `vsce package`. Generated from a
text prompt describing the activity-bar glyph's exact geometry, so it stays
recognizable as the same "double drop" fountain shape used elsewhere in the
extension.
