/**
 * Public-launch promo window (ADR-0033/licensing plan): a deliberate,
 * disclosed trial period during which every user gets LoreFountain Pro
 * unlocked with no license key required — covering the gap between
 * `lorefountain` going public and the real license backend (Gumroad tiers,
 * production deployment) actually being live and verified end-to-end.
 *
 * This is the ONLY thing you need to edit to extend or end the promo: change
 * {@link PRO_PROMO_UNTIL} and ship a new release. Nothing else in the
 * licensing flow needs to change — `extension.ts`'s `activateProTier` checks
 * {@link isPromoActive} before it ever looks at a real license.
 */

/**
 * Everyone gets Pro unlocked until this date. Set to the confirmed
 * public-launch promo end date, 2027-01-01.
 */
export const PRO_PROMO_UNTIL = new Date('2027-01-01T00:00:00Z');

/**
 * Whether the public-launch promo is still active.
 *
 * @param now - Injectable for testing; defaults to the real current time.
 * @returns `true` if Pro should be unlocked for everyone regardless of license status.
 */
export function isPromoActive(now: Date = new Date()): boolean {
  return now < PRO_PROMO_UNTIL;
}
