// cart.fixture.test.js
// RED-run regression tests — target the BUGGY fixture, NOT cart.js.
// All assertions are strict; none may be weakened.

const { calculateTotal } = require('./cart.fixture');

// ── Rule 3: Empty cart must always return 0 ───────────────────────────────────

test('empty cart with no discount returns 0', () => {
  expect(calculateTotal([], 0)).toBe(0);
});

// PRIMARY BUG (bug_report.txt): empty cart + undefined discount yields NaN/negative
test('empty cart with undefined discount returns 0 (bug: yields NaN)', () => {
  expect(calculateTotal([], undefined)).toBe(0);
});

test('empty cart with a non-zero discount returns 0 (bug: may yield NaN or negative)', () => {
  expect(calculateTotal([], 10)).toBe(0);
});

// ── Rule 1 + 9: Normal items + valid discount, rounded to 2 dp ───────────────

test('normal items with 0% discount returns full subtotal', () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }], 0)).toBe(15);
});

test('normal items with 10% discount returns correct discounted total', () => {
  // subtotal = 20, discount = 2, total = 18.00
  expect(calculateTotal([{ price: 10 }, { price: 10 }], 10)).toBe(18);
});

test('decimal amounts are rounded to 2 decimal places', () => {
  // subtotal = 10, 3% discount = 0.30, total = 9.70
  expect(calculateTotal([{ price: 10 }], 3)).toBe(9.7);
});

test('decimal result requiring rounding is rounded to 2 dp', () => {
  // subtotal = 10, 33.333% discount ≈ 3.3333, total ≈ 6.6667 → 6.67
  expect(calculateTotal([{ price: 10 }], 33.333)).toBe(6.67);
});

// ── Rule 2: Total never below 0 — discount > 100% ────────────────────────────

test('discount greater than 100% clamps total to 0 (bug: returns negative)', () => {
  expect(calculateTotal([{ price: 10 }], 150)).toBe(0);
});

test('discount exactly 100% returns 0', () => {
  expect(calculateTotal([{ price: 10 }], 100)).toBe(0);
});

// ── Rule 4: Missing/undefined discountPercentage treated as 0% ───────────────

test('undefined discountPercentage returns full subtotal (bug: yields NaN)', () => {
  expect(calculateTotal([{ price: 20 }], undefined)).toBe(20);
});

test('no discount argument at all returns full subtotal (bug: yields NaN)', () => {
  expect(calculateTotal([{ price: 20 }])).toBe(20);
});

// ── Rule 5: Negative discountPercentage clamped to 0% ────────────────────────

test('negative discount is clamped to 0 (bug: acts as surcharge)', () => {
  expect(calculateTotal([{ price: 50 }], -20)).toBe(50);
});

// ── Rule 6: NaN or Infinity discount throws RangeError ────────────────────────

test('NaN discount throws RangeError (bug: silently produces NaN)', () => {
  expect(() => calculateTotal([{ price: 10 }], NaN)).toThrow(RangeError);
});

test('Infinity discount throws RangeError (bug: silently produces -Infinity)', () => {
  expect(() => calculateTotal([{ price: 10 }], Infinity)).toThrow(RangeError);
});

test('-Infinity discount throws RangeError (bug: silently produces Infinity)', () => {
  expect(() => calculateTotal([{ price: 10 }], -Infinity)).toThrow(RangeError);
});

// ── Rule 7 & 8: Invalid item prices throw TypeError ───────────────────────────

test('item with undefined price throws TypeError (bug: silently accumulates NaN)', () => {
  expect(() => calculateTotal([{ price: undefined }], 0)).toThrow(TypeError);
});

test('item with missing price property throws TypeError (bug: silently accumulates NaN)', () => {
  expect(() => calculateTotal([{}], 0)).toThrow(TypeError);
});

test('item with negative price throws TypeError (bug: silently accepts)', () => {
  expect(() => calculateTotal([{ price: -5 }], 0)).toThrow(TypeError);
});
