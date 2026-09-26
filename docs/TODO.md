# TODO

Things that still need to happen, tracked here so they survive between sessions. Not a changelog or a decision log — see `docs/DECISIONS.md` for the rationale behind each of these.

## Before the repository goes public

**Flip repository visibility.** A deliberate action in GitHub's repo settings, done after the marketplace builds have had some real-world testing. Several things only start working once it's public: "Install Demo World" (it fetches `demos/` through GitHub's unauthenticated API, which returns `404` for a private repo), the release-page link from "Check for LoreFountain Updates" (degrades to "couldn't check" while private), and the screenshots on the Marketplace / Open VSX listings, which are relative links resolved against the repository.

**Clarify licensing of the bundled Pro module.** `LICENSE` is MIT, and the packaged `.vsix` carries that license file, but it also contains the (obfuscated, proprietary) paid-tier bundle `dist/pro.js`. Decide how that should read — for example a note in the license/README that MIT covers the free tier and the Pro module is separately licensed — before or at launch.

## Before Pro is enforced (after the launch promo ends)

The license, telemetry, and feedback endpoints on AllStoneTech.com are live and validating input (confirmed 2026-09-24). What remains for real enforcement:

- Seed a `license_tiers` row for product `lorefountain-pro` with a real payment-processor product id (needs the paid listing to exist), then test a real key end to end.
- The launch promo (`licensing/promoConfig.ts`, `PRO_PROMO_UNTIL = 2027-01-01`) unlocks Pro for everyone regardless of license until that date. Before it passes, either enforce or extend it.

## Publishing

- **Publisher accounts.** The VS Code Marketplace publisher `allstonetech` and the Open VSX namespace of the same name need to be created and tokens generated. See `docs/PUBLISHING.md` for the step-by-step.
- **Release workflow and the private Pro module.** `.github/workflows/release.yml` builds a Pro-enabled `.vsix` only when a `PRO_REPO_TOKEN` secret (read access to the private `lorefountain-pro` repo) is configured; without it, it builds a free-tier-only artifact and says so. Configure that secret before turning on any automated marketplace publish, otherwise the stores would receive a build without Pro.

## Screenshots

The README's Install and Getting started sections are text-only for now. Capture these in a clean, throwaway profile (so no personal windows or settings appear), save them as PNGs in `docs/images/`, and add them to the README:

1. The LoreFountain sidebar (World view) open on a demo project, with a few categories expanded.
2. A Story Card editing an entity.
3. A `.fountain` script with a hover preview on a character name.
4. The Story Overview editor showing the rendered body.
5. (Pro) The Entity Graph.

A clean profile with the extension installed, pointed at a demo copy, can be launched with `code --user-data-dir <tmp>/user --extensions-dir <tmp>/ext --install-extension lorefountain-<version>.vsix` followed by `code --user-data-dir <tmp>/user --extensions-dir <tmp>/ext <demo-copy>`.

## Not yet scoped

Nothing currently.
