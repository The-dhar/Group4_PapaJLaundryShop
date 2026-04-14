  import React, { useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import TransactionExtrasSummary from '../components/TransactionExtrasSummary';
import { BsEye,BsCashStack } from 'react-icons/bs';
import { useTransactions } from '../context/transactionsContext';
import { getDaysPastDue, isThirtyOrMoreDaysPastDueDate } from '../utils/unclaimedDue';
import '../styles/expressstyle.css';
import '../styles/inventorystyle.css';

function formatInventoryStatus(status) {
  if (status == null || status === '') return '—';
  const map = { in_shop: 'In Shop', picked_up: 'Pick Up' };
  const key = String(status).toLowerCase();
  if (map[key]) return map[key];
  return String(status)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Rush / express extra: matches DB `is_rush` and optional client-only fields on older rows */
function isRushOrder(row) {
  if (row.is_rush === true || row.is_rush === 1) return true;
  if (row.active_extras?.express) return true;
  const ect = row.extra_charge_type;
  if (typeof ect === 'string' && ect.toLowerCase().includes('express')) return true;
  return false;
}

const Express = () => {
  const { 
    transactions, 
    markTransactionPaid, 
    updateTransactionPaidAmount, 
    archiveTransaction 
  } = useTransactions();

  const [filterPayment, setFilterPayment] = useState('All');
  const [filterInventory, setFilterInventory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [viewMode, setViewMode] = useState('view');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [penaltyInput, setPenaltyInput] = useState('');
  const [penaltyOverrideReason, setPenaltyOverrideReason] = useState('');

  /** Suggested policy: warning for 7-29 days, full-amount penalty for 30+ days while still in shop. */
  const calculateSuggestedPenalty = (amount, dueDate, inventoryStatus) => {
    if (String(inventoryStatus || '').toLowerCase() !== 'in_shop') return 0;
    return isThirtyOrMoreDaysPastDueDate(dueDate) ? Number(amount || 0) : 0;
  };

  const parseMoneyInput = (str) => {
    if (str == null || String(str).trim() === '') return null;
    const n = Number(String(str).trim());
    return Number.isFinite(n) ? n : null;
  };

  const selectedTxnPenalty = selectedTxn
    ? Number(selectedTxn.penalty_amount ?? selectedTxn.penalty ?? 0)
    : 0;
  const selectedSuggestedPenalty = selectedTxn
    ? (() => {
        const storedSuggested = Number(selectedTxn.penalty_suggested_amount || 0);
        if (storedSuggested > 0) return storedSuggested;
        return calculateSuggestedPenalty(
          selectedTxn.amount,
          selectedTxn.due_date,
          selectedTxn.inventory_status
        );
      })()
    : 0;
  const penaltyParsed = parseMoneyInput(penaltyInput);
  const penaltyEntered = penaltyParsed !== null ? penaltyParsed : 0;
  const requiredPaymentTotal = selectedTxn
    ? Number(selectedTxn.amount) + penaltyEntered
    : 0;
  const paidParsed = parseMoneyInput(paidAmountInput);
  const paidEntered = paidParsed !== null ? paidParsed : 0;
  const showInsufficientPayment =
    viewMode === 'edit' &&
    selectedTxn &&
    paidParsed !== null &&
    paidParsed + 0.001 < requiredPaymentTotal;
  const showPenaltyOverrideReasonError =
    viewMode === 'edit' &&
    selectedTxn &&
    penaltyEntered + 0.001 < selectedSuggestedPenalty &&
    !String(penaltyOverrideReason || '').trim();

  const filteredData = useMemo(() => {
    const rows = transactions.filter((row) => {
      if (row.archived) return false;
      if (!isRushOrder(row)) return false;
      const matchesPayment = filterPayment === 'All' || row.payment_status === filterPayment;
      const matchesInventory = filterInventory === 'All' || row.inventory_status === filterInventory;
      const matchesSearch =
        row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.receipt.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPayment && matchesInventory && matchesSearch;
    });

    const isPaid = (row) => String(row.payment_status || '').toLowerCase() === 'paid';
    const rowTime = (row) =>
      new Date(row.created_at || row.updated_at || 0).getTime();

    return [...rows].sort((a, b) => {
      const paidA = isPaid(a) ? 1 : 0;
      const paidB = isPaid(b) ? 1 : 0;
      if (paidA !== paidB) return paidA - paidB;
      return rowTime(b) - rowTime(a);
    });
  }, [transactions, filterPayment, filterInventory, searchTerm]);

  // Mark paid logic with fixed payment_method = Cash
  const handleMarkPaid = async () => {
    if (!selectedTxn) return;
    const paidAmount = parseMoneyInput(paidAmountInput);
    if (paidAmount === null) return;

    const penalty = penaltyEntered;
    const required = Number(selectedTxn.amount) + penalty;
    if (paidAmount + 0.001 < required) return;
    if (showPenaltyOverrideReasonError) return;

    await updateTransactionPaidAmount(
      selectedTxn.id,
      paidAmount,
      penalty,
      'Cash',
      penalty + 0.001 < selectedSuggestedPenalty ? penaltyOverrideReason : ''
    );

    await markTransactionPaid(selectedTxn.id);
    setSelectedTxn(null);
    setPaidAmountInput('');
    setPenaltyInput('');
    setPenaltyOverrideReason('');
  };

  const columns = [
    { name: 'Receipt ID', selector: (row) => row.receipt, sortable: true },
    { name: 'Customer', selector: (row) => row.customer_name },
    { name: 'Service', selector: (row) => row.receipt_items?.[0]?.laundryType || 'N/A' },
    {
      name: 'Payment',
      cell: (row) => (
        <span className={`status-pill status-${row.payment_status}`}>{row.payment_status}</span>
      ),
    },
    {
      name: 'Status',
      cell: (row) => (
        <span className={`status-pill status-${row.inventory_status}`}>
          {formatInventoryStatus(row.inventory_status)}
        </span>
      ),
    },
    { name: 'Amount', selector: (row) => `₱${row.amount.toFixed(2)}` },
    {
      name: 'Action',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="express-action-btn view"
            title="View"
            onClick={() => {
              setViewMode('view');
              setSelectedTxn({
                ...row,
                payment_method: "Cash" // force cash on view
              });
              setPaidAmountInput('');
              setPenaltyInput('');
              setPenaltyOverrideReason('');
            }}
          >
            <BsEye />
          </button>

          <button
            className="express-action-btn edit"
            title="Mark Paid/Picked Up"
            onClick={() => {
              setViewMode('edit');
              setSelectedTxn({
                ...row,
                payment_method: "Cash" // force cash on edit
              });
              setPaidAmountInput(row.paid_amount && row.paid_amount !== 0 ? String(row.paid_amount) : '');
              const existingPenalty = Number(row.penalty_amount ?? row.penalty ?? 0) || 0;
              const suggestedPenalty =
                Number(row.penalty_suggested_amount) ||
                calculateSuggestedPenalty(row.amount, row.due_date, row.inventory_status);
              const nextPenalty = existingPenalty > 0 ? existingPenalty : suggestedPenalty;
              setPenaltyInput(nextPenalty > 0 ? String(nextPenalty) : '');
              setPenaltyOverrideReason(String(row.penalty_override_reason || ''));
            }}
          >
           <BsCashStack/> 
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="express-page">
        <div className="table-container">
          <div className="background-table">
            
            {/* Search + Filters */}
            <div className="search-filter-row">
              <input
                type="text"
                placeholder="Search receipt or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)}>
                <option value="All">All Payments</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
              <select value={filterInventory} onChange={(e) => setFilterInventory(e.target.value)}>
                <option value="All">All Inventory</option>
                <option value="in_shop">In Shop</option>
                <option value="picked_up">Picked Up</option>
              </select>
            </div>

            {/* TABLE */}
            <div className="table-wrapper">
              <DataTable
                columns={columns}
                data={filteredData}
                highlightOnHover
                pagination
                paginationPerPage={10}
                paginationRowsPerPageOptions={[5, 10, 20, 50]}
                noDataComponent={
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No rush orders yet. This list only shows orders with the <strong>Rush</strong> extra (express).
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL — same structure & classes as Inventory Management */}
      {selectedTxn && (
        <div className="inventory-modal">
          <div className="inventory-modal-content">
            <div className="inventory-modal-body">
              <h3>Receipt: {selectedTxn.receipt}</h3>
              <p><strong>Customer:</strong> {selectedTxn.customer_name}</p>
              <p><strong>Address:</strong> {selectedTxn.customer_address}</p>

              <p>
                <strong>Services:</strong>
                <ul>
                  {selectedTxn.services.map((svc) => (
                    <li key={svc.id}>
                      ({svc.serviceName}) {svc.kilos} kg @ ₱{svc.rate.toFixed(2)} = ₱{svc.total.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </p>

              <TransactionExtrasSummary txn={selectedTxn} />

              <p><strong>Total Weight:</strong> {selectedTxn.weight} kg</p>
              <p><strong>Total Amount:</strong> ₱{selectedTxn.amount.toFixed(2)}</p>

              <p><strong>Payment Method:</strong> Cash</p>

              <p><strong>Paid Amount:</strong> ₱{(Number(selectedTxn.paid_amount) || 0).toFixed(2)}</p>
              <p><strong>Penalty:</strong> ₱{selectedTxnPenalty.toFixed(2)}</p>
              <p><strong>Suggested Penalty:</strong> ₱{selectedSuggestedPenalty.toFixed(2)}</p>
              {selectedTxn.penalty_override_reason && (
                <p><strong>Penalty Override Reason:</strong> {selectedTxn.penalty_override_reason}</p>
              )}
              <p><strong>Payment Status:</strong> {selectedTxn.payment_status}</p>
              <p><strong>Inventory Status:</strong> {formatInventoryStatus(selectedTxn.inventory_status)}</p>

              <p>
                <strong>Remaining Balance:</strong>{' '}
                <span
                  style={{
                    color:
                      selectedTxn.amount +
                        selectedTxnPenalty -
                        (Number(selectedTxn.paid_amount) || 0) >
                      0
                        ? 'red'
                        : 'green',
                  }}
                >
                  ₱
                  {(
                    selectedTxn.amount +
                    selectedTxnPenalty -
                    (Number(selectedTxn.paid_amount) || 0)
                  ).toFixed(2)}
                </span>
              </p>

              <div className="paid-amount-section">
                <label><strong>Amount Paid:</strong></label>
                <input
                  type="number"
                  className="paid-amount-input"
                  placeholder="Enter amount paid"
                  value={paidAmountInput}
                  disabled={viewMode === 'view'}
                  onChange={(e) => setPaidAmountInput(e.target.value)}
                  min={0}
                  step="0.01"
                />

                {showInsufficientPayment && (
                  <div className="modal-payment-error" role="alert">
                    <span className="modal-payment-error-icon" aria-hidden="true">
                      !
                    </span>
                    <p className="modal-payment-error-text">
                      <strong>Insufficient payment.</strong> Enter at least{' '}
                      <strong>₱{requiredPaymentTotal.toFixed(2)}</strong> before marking as paid.
                    </p>
                  </div>
                )}

                <label><strong>Penalty:</strong></label>
                <input
                  type="number"
                  className="penalty-input"
                  placeholder="Enter penalty amount"
                  value={penaltyInput}
                  disabled={viewMode === 'view'}
                  onChange={(e) => setPenaltyInput(e.target.value)}
                  min={0}
                  step="0.01"
                />

                {viewMode === 'edit' && (
                  <p style={{ margin: '6px 0 0', fontSize: '0.9rem', color: '#475569' }}>
                    Suggested penalty: ₱{selectedSuggestedPenalty.toFixed(2)}
                    {selectedSuggestedPenalty > 0
                      ? ' (30+ days past due)'
                      : getDaysPastDue(selectedTxn?.due_date) >= 7
                          ? ' (7-29 days past due warning only)'
                        : ''}
                  </p>
                )}

                <label><strong>Penalty Override Reason:</strong></label>
                <textarea
                  className="penalty-input"
                  placeholder="Required when penalty is below suggested amount"
                  value={penaltyOverrideReason}
                  disabled={viewMode === 'view'}
                  onChange={(e) => setPenaltyOverrideReason(e.target.value)}
                  rows={3}
                />

                {showPenaltyOverrideReasonError && (
                  <div className="modal-payment-error" role="alert">
                    <span className="modal-payment-error-icon" aria-hidden="true">
                      !
                    </span>
                    <p className="modal-payment-error-text">
                      <strong>Reason required.</strong> Provide a reason before saving a penalty below{' '}
                      <strong>₱{selectedSuggestedPenalty.toFixed(2)}</strong>.
                    </p>
                  </div>
                )}

                {viewMode === 'edit' && paidParsed !== null && (
                  <p className="change-balance">
                    {paidEntered >= requiredPaymentTotal ? (
                      <>
                        Change: ₱{(paidEntered - requiredPaymentTotal).toFixed(2)}
                      </>
                    ) : (
                      <>
                        Balance: ₱{(requiredPaymentTotal - paidEntered).toFixed(2)}
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setSelectedTxn(null)} className="modal-btn secondary">
                Close
              </button>

              {viewMode === 'view' && (
                <button
                  onClick={() => {
                    archiveTransaction(selectedTxn.id);
                    setSelectedTxn(null);
                  }}
                  className="modal-btn cancel"
                >
                  Archive Transaction
                </button>
              )}

              {viewMode === 'edit' && (
                <button
                  type="button"
                  onClick={handleMarkPaid}
                  disabled={
                    selectedTxn.payment_status === 'paid' ||
                    showPenaltyOverrideReasonError ||
                    showInsufficientPayment ||
                    !String(paidAmountInput || '').trim() ||
                    parseMoneyInput(paidAmountInput) === null
                  }
                  className="modal-btn primary"
                >
                  Mark as Paid
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Express;
