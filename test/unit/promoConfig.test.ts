/**
 * Unit tests for the public-launch promo window (`src/licensing/promoConfig.ts`).
 */

import { describe, it, expect } from 'vitest';
import { isPromoActive, PRO_PROMO_UNTIL } from '../../src/licensing/promoConfig';

describe('isPromoActive', () => {
  it('is active before the promo end date', () => {
    const beforeEnd = new Date(PRO_PROMO_UNTIL.getTime() - 24 * 60 * 60 * 1000);
    expect(isPromoActive(beforeEnd)).toBe(true);
  });

  it('is not active after the promo end date', () => {
    const afterEnd = new Date(PRO_PROMO_UNTIL.getTime() + 24 * 60 * 60 * 1000);
    expect(isPromoActive(afterEnd)).toBe(false);
  });

  it('is not active exactly at the promo end date', () => {
    expect(isPromoActive(new Date(PRO_PROMO_UNTIL.getTime()))).toBe(false);
  });
});
