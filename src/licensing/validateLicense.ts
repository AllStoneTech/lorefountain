/**
 * License-key validation (Spec §10): the paid tier is unlocked via a license
 * key checked against `POST /api/license/validate` on the AllStoneTech.com
 * domain — implemented per `lorefountain-business/licensing/
 * LICENSING_IMPLEMENTATION_PLAN.md`, a thin proxy/normalizer in front of
 * whatever payment processor (Gumroad today) actually issued the key.
 *
 * The endpoint always answers `200` for a real yes/no (`{valid, tier,
 * revalidateAfter}` or `{valid: false, reason}`) — a non-2xx status or a
 * response that doesn't match the documented shape means the endpoint itself
 * is unreachable/misbehaving, not "invalid key," so both cases throw. That
 * distinction matters to the caller: `licenseState.ts`'s `getLicenseStatus`
 * treats a thrown error as a real network failure and falls back to its
 * offline-grace window, while a normal `{valid: false, ...}` return is
 * treated as a confirmed "not licensed."
 *
 * `fetchImpl` is a parameter, not a module-level import, specifically so
 * unit tests can supply a stub instead of hitting the network (this
 * project's tests never make live external calls) — same convention as
 * `demoDownloader.ts`.
 */

import { z } from 'zod';

type FetchLike = typeof fetch;

/** Where the extension checks license keys — see this module's doc comment. */
export const LICENSE_ENDPOINT = 'https://allstonetech.com/api/license/validate';

/** This product's identifier in the `license_tiers` registry (`lorefountain-business`'s Supabase schema). */
export const LICENSE_PRODUCT_ID = 'lorefountain-pro';

/** One of the plan's documented `reason` values — kept small deliberately, matching whatever the (future) processor actually reports. */
export type LicenseInvalidReason = 'not-found' | 'refunded' | 'disputed' | 'expired' | 'device-limit-reached';

export interface LicenseValidationResult {
  valid: boolean;
  tier?: string;
  reason?: LicenseInvalidReason;
  /** ISO timestamp after which a cached result should be re-validated. */
  revalidateAfter?: string;
}

const licenseInvalidReasonSchema = z.enum(['not-found', 'refunded', 'disputed', 'expired', 'device-limit-reached']);

/** Matches the endpoint's documented `POST /api/license/validate` response shape exactly — see `AllStoneTech.com`'s `route.ts`. */
const licenseResponseSchema = z.union([
  z.object({ valid: z.literal(true), tier: z.string(), revalidateAfter: z.string() }),
  z.object({ valid: z.literal(false), reason: licenseInvalidReasonSchema }),
]);

/**
 * Validate a license key against the real endpoint.
 *
 * @param licenseKey - The key to validate, as entered by the user.
 * @param deviceId - Stable per-install identifier (see `licenseState.ts`'s `getOrCreateDeviceId`), used to enforce each tier's device-activation cap.
 * @param fetchImpl - Injectable `fetch`, defaults to the global one.
 * @returns The validation result.
 * @throws If the request fails outright, the endpoint responds with a non-2xx status, or the response body doesn't match the documented shape — all treated as "endpoint unreachable" by the caller, never as "key is invalid."
 */
export async function validateLicense(
  licenseKey: string,
  deviceId: string,
  fetchImpl: FetchLike = fetch,
): Promise<LicenseValidationResult> {
  const response = await fetchImpl(LICENSE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ licenseKey, product: LICENSE_PRODUCT_ID, deviceId }),
  });

  if (!response.ok) {
    throw new Error(`License endpoint returned ${response.status}`);
  }

  const parsed = licenseResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error(`License endpoint returned an unexpected response shape: ${parsed.error.message}`);
  }

  return parsed.data;
}
