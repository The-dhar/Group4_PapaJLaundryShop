import React from 'react';

const RUSH_FEE = 100;

/**
 * Shows rush + combined extras (from DB) in transaction view modals.
 * Detailed detergent/softener/stain lines are not stored separately — only rolled into `extras`.
 */
export default function TransactionExtrasSummary({ txn }) {
  const extrasTotal = Number(txn.extras) || 0;
  const hasRush =
    txn.is_rush === true ||
    txn.is_rush === 1 ||
    txn.active_extras?.express === true;
  const rushLine = hasRush ? RUSH_FEE : 0;
  const otherExtras = hasRush ? extrasTotal - rushLine : extrasTotal;

  const servicesSub =
    Number(txn.subtotal) ||
    (Array.isArray(txn.services) ? txn.services.reduce((s, x) => s + (Number(x.total) || 0), 0) : 0);

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
          {extrasTotal === 0 && hasRush && (
            <span style={{ fontWeight: 'normal', color: '#64748b' }}>
              {' '}
              (rush is on; combined total may appear in order amount)
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
