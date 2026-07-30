/**
 * License key storage and cached-validation state (Spec §10): the key
 * itself lives in `vscode.SecretStorage` (never settings/`globalState` —
 * it's a credential), the last validation result is cached in
 * `globalState` keyed by a hash of the key (never the raw key), and
 * re-validation only happens once the cache goes stale — "cached locally
 * with periodic re-validation, not on every file operation" per the spec.
 *
 * An offline grace period covers `validateLicense` genuinely failing to
 * reach the network: the last known-good cached result stays trusted for
 * {@link OFFLINE_GRACE_DAYS} before falling back to unlicensed. This branch
 * can't be exercised today since `validateLicense` is a stub that never
 * throws (see `validateLicense.ts`) — it's here so the real endpoint drops
 * in without needing this file to change.
 *
 * The date-math decisions ({@link isCacheFresh}, {@link isWithinGrace}) are
 * pulled out as pure functions specifically so they're unit-testable
 * without a `vscode` mock; the rest of this module is thin `vscode`-facing
 * glue, verified manually like the rest of this codebase's command layer.
 */

import * as crypto from 'node:crypto';
import * as vscode from 'vscode';
import { validateLicense, type LicenseInvalidReason } from './validateLicense';

const SECRET_KEY = 'lorefountain.licenseKey';
const CACHE_KEY_PREFIX = 'lorefountain.licenseCache.';

/** How long a locally-stored key remains untrusted-without-a-real-network-check before it's treated as offline-expired (Section 3/6 of the plan's placeholder defaults — not settled numbers). */
const OFFLINE_GRACE_DAYS = 30;

interface CachedLicense {
  valid: boolean;
  tier?: string;
  reason?: LicenseInvalidReason;
  /** ISO timestamp of when this result was actually obtained (used for the offline-grace window). */
  validatedAt: string;
  /** ISO timestamp after which this cache entry is stale and must be re-checked. */
  revalidateAfter?: string;
}

export interface LicenseStatus {
  valid: boolean;
  tier?: string;
  reason?: LicenseInvalidReason;
  /** True when this result came from a stale cache during the offline-grace window rather than a fresh check. */
  stale: boolean;
}

/** Whether a cached result is still fresh enough to trust without re-checking. */
export function isCacheFresh(cached: Pick<CachedLicense, 'revalidateAfter'> | undefined, now: Date): boolean {
  if (!cached?.revalidateAfter) return false;
  return new Date(cached.revalidateAfter) > now;
}

/** Whether a cached result, though stale, is still within the offline-grace window (real network failure only). */
export function isWithinGrace(cached: Pick<CachedLicense, 'validatedAt'> | undefined, now: Date): boolean {
  if (!cached) return false;
  const graceMs = OFFLINE_GRACE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() - new Date(cached.validatedAt).getTime() < graceMs;
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Resolve current license status for whatever key is stored, re-validating
 * when the cache is stale. Returns `undefined` when no key is stored at
 * all — "unlicensed," not an error.
 *
 * Never throws — any unexpected failure (reading `secrets`/`globalState`,
 * hashing, etc., not just the `validateLicense` network-failure path this
 * already handled) falls back to `undefined` ("treat as unlicensed"),
 * matching every other "never throw" boundary in this codebase
 * (`parseEntityFile`, `buildIndexFromDisk`, `loadProModule`, ...). A license
 * check failing must never be able to take down the rest of extension
 * activation.
 *
 * @param context - The extension context (for `secrets`/`globalState`).
 * @returns The current status, or `undefined` if no key has ever been entered (or the check itself failed).
 */
export async function getLicenseStatus(context: vscode.ExtensionContext): Promise<LicenseStatus | undefined> {
  try {
    const key = await context.secrets.get(SECRET_KEY);
    if (!key) return undefined;

    const cacheKey = CACHE_KEY_PREFIX + hashKey(key);
    const cached = context.globalState.get<CachedLicense>(cacheKey);
    const now = new Date();

    if (cached && isCacheFresh(cached, now)) {
      return { valid: cached.valid, tier: cached.tier, reason: cached.reason, stale: false };
    }

    try {
      const result = await validateLicense(key);
      const toCache: CachedLicense = {
        valid: result.valid,
        tier: result.tier,
        reason: result.reason,
        validatedAt: now.toISOString(),
        revalidateAfter: result.revalidateAfter,
      };
      await context.globalState.update(cacheKey, toCache);
      return { valid: result.valid, tier: result.tier, reason: result.reason, stale: false };
    } catch {
      // Real network failure — not reachable today with the stub, see module doc comment.
      if (cached && isWithinGrace(cached, now)) {
        return { valid: cached.valid, tier: cached.tier, reason: cached.reason, stale: true };
      }
      return { valid: false, stale: true };
    }
  } catch {
    return undefined;
  }
}

/**
 * Store a license key, replacing any previously stored one.
 *
 * @param context - The extension context.
 * @param key - The raw license key.
 */
export async function storeLicenseKey(context: vscode.ExtensionContext, key: string): Promise<void> {
  await context.secrets.store(SECRET_KEY, key);
}

/**
 * Remove the stored license key, if any.
 *
 * @param context - The extension context.
 */
export async function clearLicenseKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}
