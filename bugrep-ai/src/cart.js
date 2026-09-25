// src/cart.js — Patched by IBM Bob 2.0 (BugRep-AI)
function calculateTotal(items, discountPercentage) {
  if (!items || items.length === 0) {
    return 0; // Guard clause: empty cart always returns 0 (Business Rule #3)
  }
  let subtotal = items.reduce((sum, item) => sum + item.price, 0);
  let discount = (subtotal * discountPercentage) / 100;
  let finalTotal = subtotal - discount;
  return finalTotal < 0 ? 0 : finalTotal; // Business Rule #2: total >= 0
}

module.exports = { calculateTotal };
