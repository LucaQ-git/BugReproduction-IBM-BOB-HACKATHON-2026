// cartEngines.js
// Two versions of calculateTotal living side-by-side in the browser.
// "buggy" is a faithful port of cart.fixture.js — intentionally broken.
// "fixed" is a faithful port of cart.js — all business rules implemented.

// ─── BUGGY ENGINE (cart.fixture.js) ──────────────────────────────────────────
export function calculateTotalBuggy(items, discountPercentage) {
  let subtotal = items.reduce((sum, item) => sum + item.price, 0);
  let discount = (subtotal * discountPercentage) / 100;
  return subtotal - discount;
}

// ─── FIXED ENGINE (cart.js) ──────────────────────────────────────────────────
export function calculateTotalFixed(items, discountPercentage) {
  // Rule 6: NaN or ±Infinity discount → RangeError
  if (
    typeof discountPercentage === 'number' &&
    (isNaN(discountPercentage) || !isFinite(discountPercentage))
  ) {
    throw new RangeError('discountPercentage must be a finite number');
  }

  // Rule 4: undefined/missing → 0%
  // Rule 5: negative → clamp to 0%
  let discount =
    discountPercentage === undefined || discountPercentage === null
      ? 0
      : discountPercentage;
  if (discount < 0) discount = 0;

  // Rule 3: empty cart always returns 0
  if (items.length === 0) return 0;

  // Rules 7 & 8: validate each item price
  for (const item of items) {
    if (
      item.price === undefined ||
      item.price === null ||
      typeof item.price !== 'number' ||
      isNaN(item.price)
    ) {
      throw new TypeError('Each item must have a numeric price');
    }
    if (item.price < 0) {
      throw new TypeError('Item prices must be non-negative');
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  // Rule 2: total never negative
  const clamped = Math.max(0, total);

  // Rule 9: round to 2 decimal places
  return Math.round(clamped * 100) / 100;
}

// ─── CRASH CLASSIFIER ────────────────────────────────────────────────────────
// Given a raw result value (or thrown error), return a structured crash report.
export function classifyResult(value, error) {
  if (error) {
    return {
      crashed: true,
      errorType: error.constructor?.name || 'Error',
      message: error.message,
      display: `💥 ${error.constructor?.name}: ${error.message}`,
    };
  }
  if (typeof value === 'number' && isNaN(value)) {
    return {
      crashed: true,
      errorType: 'NaN',
      message: 'Result is NaN — undefined or invalid input silently propagated',
      display: '🔴 Result: NaN',
    };
  }
  if (typeof value === 'number' && !isFinite(value)) {
    return {
      crashed: true,
      errorType: 'Infinity',
      message: `Result is ${value} — Infinity propagated through arithmetic`,
      display: `🔴 Result: ${value}`,
    };
  }
  if (typeof value === 'number' && value < 0) {
    return {
      crashed: true,
      errorType: 'NegativeTotal',
      message: `Result is ${value} — total dropped below zero (no clamp applied)`,
      display: `🔴 Result: $${value.toFixed(2)} (negative!)`,
    };
  }
  return {
    crashed: false,
    errorType: null,
    message: null,
    display: `$${typeof value === 'number' ? value.toFixed(2) : value}`,
  };
}

// Run an engine safely and return { value, error, classified }
export function runEngine(engineFn, items, discountPercentage) {
  let value = null;
  let error = null;
  try {
    value = engineFn(items, discountPercentage);
  } catch (e) {
    error = e;
  }
  return { value, error, classified: classifyResult(value, error) };
}
