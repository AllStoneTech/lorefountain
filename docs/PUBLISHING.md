# Publishing

How to release LoreFountain to the two extension registries. The account setup is one-time per registry; after that a release is a build plus two publish commands.

## Why two registries

The README advertises support for VS Code and its forks (Cursor, Windsurf, Antigravity). The **VS Code Marketplace** (marketplace.visualstudio.com) is restricted to Microsoft-branded products — non-Microsoft forks don't query it. They use the **Open VSX Registry** (open-vsx.org) instead. Supporting the whole audience means publishing to both.

Two things to know before the first publish:

- **There is no private listing.** As soon as `vsce publish` succeeds, the extension is publicly discoverable, whether or not the GitHub repository is public.
- **README images and links are relative to the repository.** `vsce` rewrites them against the `repository` URL in `package.json`, so screenshots and links to `CONTRIBUTING.md` and similar only resolve once the repository is public.

## One-time setup

### VS Code Marketplace (`vsce`)

1. Create a free organization at [dev.azure.com](https://dev.azure.com) with a Microsoft account, if you don't have one.
2. Create a publisher at [marketplace.visualstudio.com/manage/createpublisher](https://marketplace.visualstudio.com/manage/createpublisher). The **ID must match `package.json`'s `"publisher"`** (`allstonetech`). Optionally verify the `allstonetech.com` domain for the verified-publisher badge.
3. In Azure DevOps, open User settings → Personal access tokens → New Token. Set **Organization** to *All accessible organizations* and the scope to **Marketplace → Manage** (custom defined, show all scopes).
4. Keep the token in an environment variable, never in a tracked file:
   ```powershell
   $env:VSCE_PAT = "<token>"
   ```
5. Check it works: `npx vsce verify-pat allstonetech`.

### Open VSX (`ovsx`)

1. Sign in at [open-vsx.org](https://open-vsx.org) with GitHub; the site walks you through linking an Eclipse Foundation account.
2. Sign the **Open VSX Publisher Agreement** from your profile (required once; publishing is rejected without it).
3. Generate an access token under Profile → Settings → Access Tokens.
4. Keep it in an environment variable:
   ```powershell
   $env:OVSX_PAT = "<token>"
   ```
5. Claim the namespace once:
   ```powershell
   npx ovsx create-namespace allstonetech -p $env:OVSX_PAT
   ```
6. Optional: open a namespace-ownership request in the [`EclipseFdn/open-vsx.org`](https://github.com/EclipseFdn/open-vsx.org/issues) repository, otherwise the namespace shows as unverified.

## Publishing a release

Build once, publish the same file to both registries. Build from a checkout that includes the private `pro/` submodule — without it the bundle is free-tier only.

```powershell
npm version <new-version> --no-git-tag-version   # bump first; see docs/DECISIONS.md (ADR-0032)
npm run package                                   # produces lorefountain-<version>.vsix
npx vsce publish --packagePath lorefountain-<version>.vsix   # reads VSCE_PAT
npx ovsx publish lorefountain-<version>.vsix                 # reads OVSX_PAT
```

Neither tool bumps the version for you: what's published is whatever `package.json`'s `"version"` is. Update `CHANGELOG.md` (and its date) in the same change.

After both succeed, tag the release (`git tag v<version>` and push the tag) so the GitHub Release workflow attaches a build to it.

## GitHub release workflow

`.github/workflows/release.yml` runs on any `v*` tag: it typechecks, lints, tests, packages, and attaches the `.vsix` to a GitHub Release. Set a `PRO_REPO_TOKEN` repository secret (a fine-grained token with read access to the private `lorefountain-pro` repository) so the artifact includes the Pro module; without it the workflow still runs but builds, and labels, a free-tier-only file. The marketplace publish steps in that workflow are intentionally commented out — enable them only once `PRO_REPO_TOKEN`, `VSCE_PAT`, and `OVSX_PAT` are all configured.

## Marketplace icon and metadata

`resources/icon.png` (512×512 PNG) is wired in via `package.json`'s `"icon"` field. The listing's category, keywords, and gallery banner also live in `package.json`. Listing screenshots are stored in `docs/images/` and referenced from the README.
