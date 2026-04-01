import React from 'react';

const RUSH_FEE = 100;

function sumServiceLines(txn) {
  if (!Array.isArray(txn.services)) return 0;
  return txn.services.reduce((s, x) => {
    const line = Number(x.total) || Number(x.rate) || 0;
    return s + line;
  }, 0);
}

/**
 * Shows rush + combined extras. Uses DB `extras` when set; otherwise infers from total_amount − subtotal
 * (fixes older rows where `is_rush` was saved but `extras` stayed 0).
 */
export default function TransactionExtrasSummary({ txn }) {
  const storedExtras = Number(txn.extras) || 0;
  const totalAmt = Number(txn.amount) || 0;
  const subFromDb = Number(txn.subtotal) || 0;
  const lineSum = sumServiceLines(txn);
  const baseSub = subFromDb > 0 ? subFromDb : lineSum;

  const derivedExtras = Math.max(0, totalAmt - baseSub);
  const extrasTotal = storedExtras > 0.0001 ? storedExtras : derivedExtras;
  const inferredFromTotal = storedExtras <= 0.0001 && derivedExtras > 0.0001;

  const hasRush =
    txn.is_rush === true ||
    txn.is_rush === 1 ||
    txn.active_extras?.express === true;

  const otherExtras = hasRush ? extrasTotal - RUSH_FEE : extrasTotal;

  const showOtherLine = (() => {
    if (!hasRush) return Math.abs(extrasTotal) > 0.0001;
    if (extrasTotal === 0) return false;
    return Math.abs(otherExtras) > 0.0001;
  })();

  const showSection =
    hasRush ||
    Math.abs(extrasTotal) > 0.0001 ||
    (typeof txn.active_extras === 'object' && txn.active_extras && Object.keys(txn.active_extras).length > 0);

  if (!showSection && extrasTotal === 0 && !hasRush) {
    return (
      <p style={{ marginTop: '12px' }}>
        <strong>Extras:</strong> None
      </p>
    );
  }

  const servicesSub = baseSub > 0 ? baseSub : lineSum;

  return (
    <div style={{ marginTop: '12px', marginBottom: '8px' }}>
      <p>
        <strong>Extras &amp; add-ons</strong>
      </p>
      <ul style={{ marginTop: '6px', paddingLeft: '20px' }}>
        <li>
          <strong>Rush (Express):</strong> {hasRush ? `Yes (+₱${RUSH_FEE.toFixed(2)})` : 'No'}
        </li>
        {showOtherLine && (
          <li>
            <strong>Other add-ons</strong> (detergent, softener, stain removal, discounts, etc.): ₱
            {otherExtras.toFixed(2)}
          </li>
        )}
        <li>
          <strong>Total extras (net):</strong> ₱{extrasTotal.toFixed(2)}
          {inferredFromTotal && (
            <span style={{ fontWeight: 'normal', color: '#64748b' }}>
              {' '}
              (order total − services subtotal; `extras` was not stored in the database for this receipt)
            </span>
          )}
        </li>
      </ul>
      {servicesSub > 0 && (
        <p style={{ marginTop: '8px' }}>
          <strong>Services subtotal:</strong> ₱{servicesSub.toFixed(2)}
        </p>
      )}
    </div>
  );
}
