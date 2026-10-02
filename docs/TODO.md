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
- **Marketplace publishing moves to Microsoft Entra ID on 2026-12-01.** Azure DevOps stops supporting tokens scoped to all accessible organizations on that date, and `vsce` needs that scope. A token-based publish works for the first release; every release after the deadline needs `vsce publish --azure-credential` and the managed-identity setup in `docs/PUBLISHING.md`. Confirm whether local-machine publishing is supported, or move the release to a pipeline, before then.
- **Release workflow and the private Pro module.** `.github/workflows/release.yml` builds a Pro-enabled `.vsix` only when a `PRO_REPO_TOKEN` secret (read access to the private `lorefountain-pro` repo) is configured; without it, it builds a free-tier-only artifact and says so. Configure that secret before turning on any automated marketplace publish, otherwise the stores would receive a build without Pro.

## Not yet scoped

Nothing currently.
