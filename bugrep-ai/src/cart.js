// src/cart.js — Production implementation (patched)

function calculateTotal(items, discountPercentage) {
  // Rule 6: NaN or ±Infinity discount → RangeError
  if (typeof discountPercentage === 'number' &&
      (isNaN(discountPercentage) || !isFinite(discountPercentage))) {
    throw new RangeError('discountPercentage must be a finite number');
  }

  // Rule 4: undefined/missing discount → treat as 0%
  // Rule 5: negative discount → clamp to 0%
  let discount = (discountPercentage === undefined || discountPercentage === null)
    ? 0
    : discountPercentage;
  if (discount < 0) discount = 0;

  // Rule 3: empty cart always returns 0
  if (items.length === 0) return 0;

  // Rules 7 & 8: validate each item's price
  for (const item of items) {
    if (item.price === undefined || item.price === null || typeof item.price !== 'number' || isNaN(item.price)) {
      throw new TypeError('Each item must have a numeric price');
    }
    if (item.price < 0) {
      throw new TypeError('Item prices must be non-negative');
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  // Rule 2: total must never be negative (discount > 100%)
  const clamped = Math.max(0, total);

  // Rule 9: round to 2 decimal places
  return Math.round(clamped * 100) / 100;
}

module.exports = { calculateTotal };
