// src/cart.js — Production implementation
// Satisfies all business rules documented in docs/cart_rules.md plus the
// additional input-validation rules agreed with the project owner.

/**
 * Calculate the discounted total for a shopping cart.
 *
 * @param {Array<{price: number}>} items            - Cart items (each must have a finite, non-negative price)
 * @param {number}                 [discountPercentage=0] - Discount in % (0–100; clamped if negative; throws if NaN/Infinite)
 * @returns {number} Total rounded to 2 decimal places, never below 0.
 * @throws {TypeError}  if any item has a missing, non-numeric, or negative price.
 * @throws {RangeError} if discountPercentage is NaN or ±Infinity.
 */
function calculateTotal(items, discountPercentage) {
  // ── Validate discount ─────────────────────────────────────────────────────
  // Default: undefined / missing → 0
  if (discountPercentage === undefined || discountPercentage === null) {
    discountPercentage = 0;
  }

  // NaN or ±Infinity are programming errors, not edge cases to swallow
  if (typeof discountPercentage !== 'number' || !isFinite(discountPercentage)) {
    throw new RangeError(
      `discountPercentage must be a finite number; received ${discountPercentage}`
    );
  }

  // Negative discount = no benefit, clamp to 0 (Business Rule: total never rises from discount)
  if (discountPercentage < 0) {
    discountPercentage = 0;
  }

  // ── Empty cart guard (Business Rule #3) ──────────────────────────────────
  if (!items || items.length === 0) {
    return 0;
  }

  // ── Validate each item ────────────────────────────────────────────────────
  for (const item of items) {
    const p = item.price;
    if (p === undefined || p === null || typeof p !== 'number' || !isFinite(p)) {
      throw new TypeError(
        `Each item must have a finite numeric price; received ${p}`
      );
    }
    if (p < 0) {
      throw new TypeError(
        `Item prices must be non-negative; received ${p}`
      );
    }
  }

  // ── Compute total ─────────────────────────────────────────────────────────
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const discount = (subtotal * discountPercentage) / 100;
  const raw      = subtotal - discount;

  // Business Rule #2: total must never drop below 0
  const floored  = raw < 0 ? 0 : raw;

  // Round to 2 decimal places (standard currency precision)
  return Math.round(floored * 100) / 100;
}

module.exports = { calculateTotal };
