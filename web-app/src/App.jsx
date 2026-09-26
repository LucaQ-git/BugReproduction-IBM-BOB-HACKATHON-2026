import { useState, useCallback } from 'react';
import { PRODUCTS, DISCOUNT_CODES } from './products.js';
import { calculateTotalBuggy, calculateTotalFixed, runEngine } from './cartEngines.js';
import './App.css';

// ─── helpers ─────────────────────────────────────────────────────────────────
function subtotal(items) {
  return items.reduce((s, i) => s + i.price * i.qty, 0);
}

export default function App() {
  // Cart state: { [productId]: { ...product, qty } }
  const [cartItems, setCartItems] = useState({});
  // Which discount code is selected
  const [selectedCode, setSelectedCode] = useState('NOSAVE');
  // Manual override for custom discount value
  const [customDiscount, setCustomDiscount] = useState('');
  // true = use buggy engine, false = use fixed engine
  const [useBuggy, setUseBuggy] = useState(true);
  // Bug report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [submitStatus, setSubmitStatus] = useState(null); // null | 'sending' | 'ok' | 'error' | 'vercel'
  // Active crash (for pre-filling the report)
  const [activeCrash, setActiveCrash] = useState(null);
  // AI-generated report state
  const [aiStatus, setAiStatus] = useState(null); // null | 'loading' | 'done' | 'error'

  // ── Cart actions ─────────────────────────────────────────────────────────
  const addItem = (product) => {
    setCartItems((prev) => ({
      ...prev,
      [product.id]: prev[product.id]
        ? { ...prev[product.id], qty: prev[product.id].qty + 1 }
        : { ...product, qty: 1 },
    }));
  };

  const removeItem = (productId) => {
    setCartItems((prev) => {
      const next = { ...prev };
      if (next[productId]?.qty > 1) {
        next[productId] = { ...next[productId], qty: next[productId].qty - 1 };
      } else {
        delete next[productId];
      }
      return next;
    });
  };

  const clearCart = () => setCartItems({});

  // ── Discount resolution ──────────────────────────────────────────────────
  const getDiscountValue = useCallback(() => {
    if (customDiscount.trim() !== '') {
      const raw = customDiscount.trim();
      if (raw === 'NaN') return NaN;
      if (raw === 'Infinity' || raw === '+Infinity') return Infinity;
      if (raw === '-Infinity') return -Infinity;
      const num = parseFloat(raw);
      return isNaN(num) ? undefined : num;
    }
    const code = DISCOUNT_CODES.find((c) => c.code === selectedCode);
    return code ? code.value : undefined;
  }, [customDiscount, selectedCode]);

  // ── Compute cart total live ──────────────────────────────────────────────
  const cartItemList = Object.values(cartItems).flatMap((item) =>
    Array.from({ length: item.qty }, () => ({ price: item.price }))
  );
  const discountValue = getDiscountValue();
  const engine = useBuggy ? calculateTotalBuggy : calculateTotalFixed;
  const result = runEngine(engine, cartItemList, discountValue);
  const sub = subtotal(Object.values(cartItems));

  // ── Bug report ────────────────────────────────────────────────────────────
  const openReport = async () => {
    const codeLabel = customDiscount.trim()
      ? `custom value "${customDiscount}"`
      : `discount code "${selectedCode}" (${discountValue})`;

    const preTitle = result.classified.errorType
      ? `[${result.classified.errorType}] calculateTotal with ${codeLabel}`
      : `Unexpected result with ${codeLabel}`;

    setReportTitle(preTitle);
    setReportText('');
    setActiveCrash(result.classified);
    setSubmitStatus(null);
    setAiStatus('loading');
    setReportOpen(true);

    // Call AI to generate the report
    try {
      const cartItemList = Object.values(cartItems).map((i) => ({
        name: i.name,
        qty: i.qty,
        price: i.price,
      }));

      const res = await fetch('/api/analyze-bug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: useBuggy ? 'BUGGY (cart.fixture.js)' : 'FIXED (cart.js)',
          cartItems: cartItemList,
          discountCode: selectedCode,
          discountValue: String(discountValue),
          result: result.classified,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.report) throw new Error(data.error || 'No report returned');
      setReportText(data.report);
      setAiStatus('done');
    } catch (e) {
      // Fall back to a basic template if AI fails
      const itemSummary = Object.values(cartItems)
        .map((i) => `  - ${i.name} x${i.qty} @ $${i.price.toFixed(2)}`)
        .join('\n') || '  (empty cart)';
      setReportText(
        `Bug Report: calculateTotal produced an unexpected result.\n\n` +
        `Engine: ${useBuggy ? 'BUGGY (cart.fixture.js)' : 'FIXED (cart.js)'}\n` +
        `Discount applied: ${codeLabel}\n` +
        `Cart contents:\n${itemSummary}\n\n` +
        `Expected: a valid dollar amount >= $0.00\n` +
        `Received: ${result.classified.display}\n\n` +
        (result.classified.message ? `Details: ${result.classified.message}\n` : '')
      );
      setAiStatus('error');
    }
  };

  const submitReport = async () => {
    setSubmitStatus('sending');
    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: reportTitle, body: reportText }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      // On Vercel the file can't be written — surface the content for manual copy
      setSubmitStatus(data.note ? 'vercel' : 'ok');
    } catch (e) {
      setSubmitStatus('error');
    }
  };

  // ── Derived UI state ──────────────────────────────────────────────────────
  const cartCount = Object.values(cartItems).reduce((s, i) => s + i.qty, 0);
  const selectedCodeObj = DISCOUNT_CODES.find((c) => c.code === selectedCode);
  const hasCrash = result.classified.crashed;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🛒</span>
            <span className="logo-name">ShopDemo</span>
            <span className="logo-tag">Bug Simulation Lab</span>
          </div>
          <div className="engine-toggle">
            <span className="toggle-label">Cart Engine:</span>
            <button
              className={`engine-btn ${useBuggy ? 'engine-buggy active' : 'engine-buggy'}`}
              onClick={() => setUseBuggy(true)}
            >
              🐛 Buggy
            </button>
            <button
              className={`engine-btn ${!useBuggy ? 'engine-fixed active' : 'engine-fixed'}`}
              onClick={() => setUseBuggy(false)}
            >
              ✅ Fixed
            </button>
          </div>
        </div>
      </header>

      <div className="layout">
        {/* ── Product Catalogue ── */}
        <main className="catalogue">
          <h2 className="section-title">Products</h2>
          <div className="product-grid">
            {PRODUCTS.map((p) => (
              <div key={p.id} className="product-card">
                <div className="product-emoji">{p.emoji}</div>
                <div className="product-info">
                  <div className="product-name">{p.name}</div>
                  <div className="product-category">{p.category}</div>
                  <div className="product-price">${p.price.toFixed(2)}</div>
                </div>
                <button className="add-btn" onClick={() => addItem(p)}>
                  {cartItems[p.id] ? `In cart (${cartItems[p.id].qty})` : 'Add to cart'}
                </button>
              </div>
            ))}
          </div>
        </main>

        {/* ── Cart Sidebar ── */}
        <aside className="cart-sidebar">
          <div className="cart-header">
            <h2 className="section-title">Your Cart {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}</h2>
            {cartCount > 0 && <button className="clear-btn" onClick={clearCart}>Clear</button>}
          </div>

          {/* Cart items */}
          {cartCount === 0 ? (
            <p className="empty-msg">Your cart is empty.<br /><span className="muted">Add a product, then try a discount code.</span></p>
          ) : (
            <ul className="cart-list">
              {Object.values(cartItems).map((item) => (
                <li key={item.id} className="cart-item">
                  <span className="cart-item-emoji">{item.emoji}</span>
                  <div className="cart-item-info">
                    <span className="cart-item-name">{item.name}</span>
                    <span className="cart-item-price">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                  <div className="cart-item-qty">
                    <button onClick={() => removeItem(item.id)}>−</button>
                    <span>{item.qty}</span>
                    <button onClick={() => addItem(item)}>+</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Discount section */}
          <div className="discount-section">
            <label className="discount-label">Discount Code</label>
            <select
              className="discount-select"
              value={customDiscount ? '__custom__' : selectedCode}
              onChange={(e) => {
                setCustomDiscount('');
                setSelectedCode(e.target.value);
              }}
            >
              {DISCOUNT_CODES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}{c.broken ? ' ⚠️' : ''}
                </option>
              ))}
            </select>

            <label className="discount-label" style={{ marginTop: '8px' }}>
              Or enter a custom value:
            </label>
            <input
              className="discount-input"
              placeholder='e.g. 20, -5, NaN, Infinity'
              value={customDiscount}
              onChange={(e) => setCustomDiscount(e.target.value)}
            />
            {selectedCodeObj?.broken && !customDiscount && (
              <div className="code-warning">
                ⚠️ {selectedCodeObj.bugDescription}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="totals">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>${sub.toFixed(2)}</span>
            </div>
            <div className="totals-row">
              <span>Discount</span>
              <span>
                {customDiscount.trim()
                  ? `custom: ${customDiscount}`
                  : `${selectedCode} (${discountValue === undefined ? 'none' : discountValue}%)`}
              </span>
            </div>
            <div className={`totals-total ${hasCrash ? 'totals-crash' : ''}`}>
              <span>Total</span>
              <span className="total-value">{result.classified.display}</span>
            </div>
          </div>

          {/* Crash panel */}
          {hasCrash && (
            <div className="crash-panel">
              <div className="crash-header">
                <span className="crash-icon">💥</span>
                <span className="crash-title">
                  {useBuggy ? 'Bug detected in Buggy Engine' : 'Unexpected behaviour in Fixed Engine'}
                </span>
              </div>
              <div className="crash-type">Error type: <strong>{result.classified.errorType}</strong></div>
              <div className="crash-message">{result.classified.message}</div>
              {useBuggy && (
                <div className="crash-hint">
                  Switch to the <strong>Fixed</strong> engine to see how this should behave.
                </div>
              )}
              <button className="report-btn" onClick={openReport}>
                📝 Report this bug
              </button>
            </div>
          )}

          {/* Checkout */}
          {!hasCrash && cartCount > 0 && (
            <button className="checkout-btn">Proceed to Checkout</button>
          )}
        </aside>
      </div>

      {/* ── Engine comparison row ── */}
      <div className="comparison-bar">
        <div className="comparison-inner">
          <span className="comparison-label">Side-by-side comparison:</span>
          <div className="comparison-engines">
            <div className={`comparison-engine ${runEngine(calculateTotalBuggy, cartItemList, discountValue).classified.crashed ? 'engine-crashed' : 'engine-ok'}`}>
              <span className="engine-name">🐛 Buggy</span>
              <span className="engine-result">{runEngine(calculateTotalBuggy, cartItemList, discountValue).classified.display}</span>
            </div>
            <div className={`comparison-engine ${runEngine(calculateTotalFixed, cartItemList, discountValue).classified.crashed ? 'engine-crashed' : 'engine-ok'}`}>
              <span className="engine-name">✅ Fixed</span>
              <span className="engine-result">{runEngine(calculateTotalFixed, cartItemList, discountValue).classified.display}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bug Report Modal ── */}
      {reportOpen && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setReportOpen(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>📝 File a Bug Report</h3>
              <button className="modal-close" onClick={() => setReportOpen(false)}>✕</button>
            </div>
            <p className="modal-intro">
              This will overwrite <code>bugrep-ai/fixtures/bug_report.txt</code> and make it the input for the next <code>node orchestrator.js --auto</code> run.
            </p>
            <label className="modal-label">Title</label>
            <input
              className="modal-input"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
            />
            <label className="modal-label">
              Report body
              {aiStatus === 'loading' && <span className="ai-badge ai-loading"> ✨ AI is generating report…</span>}
              {aiStatus === 'done'    && <span className="ai-badge ai-done"> ✨ Generated by AI</span>}
              {aiStatus === 'error'   && <span className="ai-badge ai-error"> ⚠️ AI unavailable — template used</span>}
            </label>
            <textarea
              className="modal-textarea"
              value={aiStatus === 'loading' ? 'Analysing bug with AI…' : reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={14}
              readOnly={aiStatus === 'loading'}
            />
            {submitStatus === 'ok' && (
              <div className="modal-success">
                ✅ Bug report saved to <code>bugrep-ai/fixtures/bug_report.txt</code>.<br />
                Run <code>node orchestrator.js</code> to start the fix workflow.
              </div>
            )}
            {submitStatus === 'vercel' && (
              <div className="modal-success">
                ✅ Report generated. Copy the text above into{' '}
                <code>bugrep-ai/fixtures/bug_report.txt</code> on your local machine,
                then run <code>node orchestrator.js</code>.
              </div>
            )}
            {submitStatus === 'error' && (
              <div className="modal-error">
                ❌ Could not reach the API. Try again or copy the report text manually.
              </div>
            )}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setReportOpen(false)}>Cancel</button>
              <button
                className="modal-submit"
                onClick={submitReport}
                disabled={submitStatus === 'sending' || submitStatus === 'ok'}
              >
                {submitStatus === 'sending' ? 'Saving…' : submitStatus === 'ok' ? 'Saved ✓' : 'Save Bug Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
