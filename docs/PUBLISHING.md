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
2. Create a publisher at [marketplace.visualstudio.com/manage/createpublisher](https://marketplace.visualstudio.com/manage/createpublisher). The **ID must match `package.json`'s `"publisher"`** (`All-Stone-Tech`). Optionally verify the `allstonetech.com` domain for the verified-publisher badge.
3. In Azure DevOps, open User settings → Personal access tokens → New Token (or go to `https://dev.azure.com/<organization>/_usersSettings/tokens`). The organization needs no project; only the organization itself. Set **Organization** to *All accessible organizations* (an organization-scoped token is rejected by the Marketplace), the scope to **Marketplace → Manage** (custom defined, show all scopes), and the expiry to about 30 days.
4. Keep the token in an environment variable, never in a tracked file:
   ```powershell
   $env:VSCE_PAT = "<token>"
   ```
5. Check it works: `npx vsce verify-pat All-Stone-Tech`.

> **Deadline: December 1, 2026.** Microsoft is retiring Azure DevOps tokens scoped to *All accessible organizations*, which is the only scope `vsce` accepts. A token works until that date, so the steps above are fine for a release made before it, and there is no point setting a longer expiry. For any release after it, see [Publishing after December 1, 2026](#publishing-after-december-1-2026).

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
   npx ovsx create-namespace All-Stone-Tech -p $env:OVSX_PAT
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

## Publishing after December 1, 2026

Open VSX is unaffected: it keeps using `OVSX_PAT`. Only the VS Code Marketplace side changes. After the deadline, `vsce publish` has to authenticate with Microsoft Entra ID instead of a token:

```powershell
npx vsce publish --packagePath lorefountain-<version>.vsix --azure-credential
```

What the [VS Code publishing documentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace) describes is a CI/CD setup:

1. Create a **user-assigned managed identity** in Azure (not an app registration) and note its client ID, tenant ID, and subscription.
2. In Azure DevOps, create an **Azure Resource Manager service connection** using *Workload Identity Federation (manual)*, then add the matching federated credential to the managed identity.
3. Look up the identity's profile `id` with `az rest -u https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798` from a pipeline step that uses the service connection.
4. Add that `id` as a member of the `All-Stone-Tech` publisher, with the **Contributor** role, on the Marketplace management page.
5. Publish from that pipeline with `vsce publish --azure-credential`.

The documentation does not say whether publishing from a developer machine (for example after `az login`) is supported, so don't count on it. Check it, or the current docs, well before December rather than on release day. Moving the release to a pipeline that can use the federated identity is the documented route.

## GitHub release workflow

`.github/workflows/release.yml` runs on any `v*` tag: it typechecks, lints, tests, packages, and attaches the `.vsix` to a GitHub Release. Set a `PRO_REPO_TOKEN` repository secret (a fine-grained token with read access to the private `lorefountain-pro` repository) so the artifact includes the Pro module; without it the workflow still runs but builds, and labels, a free-tier-only file. The marketplace publish steps in that workflow are intentionally commented out — enable them only once `PRO_REPO_TOKEN` and `OVSX_PAT` are configured. For the Marketplace step, a `VSCE_PAT` secret only works until December 1, 2026; after that the step needs the Entra setup above instead.

## Marketplace icon and metadata

`resources/icon.png` (512×512 PNG) is wired in via `package.json`'s `"icon"` field. The listing's category, keywords, and gallery banner also live in `package.json`. Listing screenshots are stored in `docs/images/` and referenced from the README.
