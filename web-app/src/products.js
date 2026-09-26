// products.js — fake product catalogue
export const PRODUCTS = [
  { id: 1, name: 'Wireless Headphones',  price: 79.99,  emoji: '🎧', category: 'Electronics' },
  { id: 2, name: 'Mechanical Keyboard',  price: 129.99, emoji: '⌨️', category: 'Electronics' },
  { id: 3, name: 'USB-C Hub',            price: 49.99,  emoji: '🔌', category: 'Electronics' },
  { id: 4, name: 'Running Shoes',        price: 94.50,  emoji: '👟', category: 'Apparel'     },
  { id: 5, name: 'Backpack',             price: 59.00,  emoji: '🎒', category: 'Apparel'     },
  { id: 6, name: 'Coffee Thermos',       price: 34.99,  emoji: '☕', category: 'Home'        },
  { id: 7, name: 'Desk Lamp',            price: 44.99,  emoji: '💡', category: 'Home'        },
  { id: 8, name: 'Notebook (A5)',        price: 12.99,  emoji: '📓', category: 'Stationery'  },
];

// Preset discount codes — includes both valid and intentionally broken ones
export const DISCOUNT_CODES = [
  { code: 'SAVE10',    value: 10,        label: '10% off',           broken: false },
  { code: 'HALF',      value: 50,        label: '50% off',           broken: false },
  { code: 'FULLOFF',   value: 100,       label: '100% off (free!)',  broken: false },
  { code: 'OVER100',   value: 150,       label: '150% off',          broken: true,  bugDescription: 'Discount > 100% — returns negative total instead of $0.00' },
  { code: 'NEGATIVE',  value: -20,       label: '-20% (surcharge?)', broken: true,  bugDescription: 'Negative discount — acts as a surcharge instead of clamping to 0%' },
  { code: 'NOTANUM',   value: NaN,       label: 'NaN discount',      broken: true,  bugDescription: 'NaN discount — silently propagates NaN into result instead of throwing RangeError' },
  { code: 'INFINITE',  value: Infinity,  label: '∞% off',            broken: true,  bugDescription: 'Infinity discount — silently produces -Infinity instead of throwing RangeError' },
  { code: 'NOSAVE',    value: undefined, label: 'No code entered',   broken: false },
];
