// src/cart.test.js — BugRep-AI regression suite
// Strict assertions only.  Never weaken these to make a test pass artificially.
// The only valid fix is a correct implementation change in src/cart.js.
//
// This suite tests src/cart.js (the production / patched implementation).
// The Test Agent runs it against src/cart.fixture.js for the RED run by
// temporarily adjusting the require path — see agents/test-agent.md.

const { calculateTotal } = require('./cart');

// ─── Original three tests (must always be present) ───────────────────────────

test('empty cart returns exactly 0', () => {
  expect(calculateTotal([], 10)).toBe(0);
});

test('two $50 items with 10% discount returns 90', () => {
  const items = [{ price: 50 }, { price: 50 }];
  expect(calculateTotal(items, 10)).toBe(90);
});

test('extreme discount (200%) never returns a negative total', () => {
  const items = [{ price: 10 }];
  expect(calculateTotal(items, 200)).toBeGreaterThanOrEqual(0);
});

// ─── Bug-report target: negative total with over-100% discount ───────────────

test('discount above 100% returns 0, not a negative number', () => {
  const items = [{ price: 100 }];
  expect(calculateTotal(items, 150)).toBe(0);
});

// ─── Agreed business rules: discount input validation ────────────────────────

test('undefined discount is treated as 0% (full price returned)', () => {
  const items = [{ price: 80 }];
  expect(calculateTotal(items, undefined)).toBe(80);
});

test('missing discount argument is treated as 0%', () => {
  const items = [{ price: 80 }];
  expect(calculateTotal(items)).toBe(80);
});

test('negative discount is clamped to 0% (no surcharge)', () => {
  const items = [{ price: 100 }];
  expect(calculateTotal(items, -20)).toBe(100);
});

test('NaN discount throws RangeError', () => {
  const items = [{ price: 50 }];
  expect(() => calculateTotal(items, NaN)).toThrow(RangeError);
});

test('Infinity discount throws RangeError', () => {
  const items = [{ price: 50 }];
  expect(() => calculateTotal(items, Infinity)).toThrow(RangeError);
});

test('-Infinity discount throws RangeError', () => {
  const items = [{ price: 50 }];
  expect(() => calculateTotal(items, -Infinity)).toThrow(RangeError);
});

// ─── Agreed business rules: item input validation ────────────────────────────

test('item with undefined price throws TypeError', () => {
  const items = [{ price: 50 }, { price: undefined }];
  expect(() => calculateTotal(items, 10)).toThrow(TypeError);
});

test('item with missing price property throws TypeError', () => {
  const items = [{ name: 'widget' }]; // no price key at all
  expect(() => calculateTotal(items, 10)).toThrow(TypeError);
});

test('item with negative price throws TypeError', () => {
  const items = [{ price: -5 }];
  expect(() => calculateTotal(items, 10)).toThrow(TypeError);
});

// ─── Agreed business rules: decimal precision ────────────────────────────────

test('floating-point prices are rounded to 2 decimal places', () => {
  // 0.1 + 0.2 = 0.30000000000000004 without rounding
  const items = [{ price: 0.1 }, { price: 0.2 }];
  expect(calculateTotal(items, 0)).toBe(0.30);
});

test('discount on decimal prices rounds to 2dp', () => {
  // subtotal 10.005 with 10% discount → 9.0045 → should round to 9.00
  const items = [{ price: 10.005 }];
  expect(calculateTotal(items, 10)).toBe(9.00);
});

// ─── Boundary / combination cases ────────────────────────────────────────────

test('zero discount returns full subtotal', () => {
  const items = [{ price: 200 }];
  expect(calculateTotal(items, 0)).toBe(200);
});

test('100% discount returns exactly 0', () => {
  const items = [{ price: 75 }];
  expect(calculateTotal(items, 100)).toBe(0);
});

test('single item with exact discount', () => {
  const items = [{ price: 120 }];
  expect(calculateTotal(items, 25)).toBe(90); // 120 - 30 = 90
});
