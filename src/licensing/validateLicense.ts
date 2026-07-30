/**
 * License-key validation (Spec §10): the paid tier is unlocked via a license
 * key checked against a small endpoint on the AllStoneTech.com domain.
 *
 * **TEMPORARY STUB.** There is no real backend yet — the endpoint's contract
 * (request/response shape, processor-agnostic proxy design, product
 * registry) is specced in `lorefountain-business/licensing/
 * IMPLEMENTATION_PLAN.md`, being built in a separate thread against the
 * AllStoneTech.com project. Until that exists, this always resolves
 * `{ valid: true }` regardless of the key given, so the rest of the
 * client-side license flow (`licenseState.ts`'s caching/grace-period logic,
 * the `enterLicenseKey`/`showLicenseStatus` commands, gating the pro module
 * load in `extension.ts`) can be built and tested locally now.
 *
 * TODO(licensing): replace this function's body with a real
 * `fetch('https://allstonetech.com/api/license/validate', ...)` call once
 * that endpoint exists — see `docs/TODO.md`. Nothing else in this module
 * should need to change: `licenseState.ts` is already written against this
 * exact return contract.
 */

/** One of the plan's documented `reason` values — kept small deliberately, matching whatever the (future) processor actually reports. */
export type LicenseInvalidReason = 'not-found' | 'refunded' | 'disputed' | 'expired';

export interface LicenseValidationResult {
  valid: boolean;
  tier?: string;
  reason?: LicenseInvalidReason;
  /** ISO timestamp after which a cached result should be re-validated. */
  revalidateAfter?: string;
}

/** Matches the plan's suggested default re-validation cadence (Section 3/6). */
const REVALIDATE_AFTER_DAYS = 7;

/**
 * Validate a license key. STUBBED: always resolves valid — see this
 * module's doc comment.
 *
 * @param licenseKey - The key to validate. Ignored entirely by the stub.
 * @returns The validation result.
 */
export async function validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
  void licenseKey;
  const revalidateAfter = new Date(Date.now() + REVALIDATE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return { valid: true, tier: 'pro', revalidateAfter };
}
