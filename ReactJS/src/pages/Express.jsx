import React, { useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import TransactionExtrasSummary from '../components/TransactionExtrasSummary';
import { BsEye,BsCashStack } from 'react-icons/bs';
import { useTransactions } from '../context/transactionsContext';
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

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [viewMode, setViewMode] = useState('view');
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [penaltyInput, setPenaltyInput] = useState('');

  // Check if past due (penalty rule)
  const isPastDue = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 7 && diffDays <= 30;
  };

  const calculatePenalty = (amount, dueDate) => {
    return isPastDue(dueDate) ? amount * 0.05 : 0;
  };

  const parseAmountInput = (str) => {
    if (str == null || String(str).trim() === '') return null;
    const n = Number(String(str).trim());
    return Number.isFinite(n) ? n : null;
  };

  const requiredPaymentTotal = selectedTxn
    ? Number(selectedTxn.amount) + Number(penaltyInput || 0)
    : 0;
  const paidParsed = parseAmountInput(paidAmountInput);
  const paidEntered = paidParsed !== null ? paidParsed : 0;
  const showInsufficientPayment =
    viewMode === 'edit' &&
    selectedTxn &&
    paidParsed !== null &&
    paidParsed + 0.001 < requiredPaymentTotal;

  const filteredData = useMemo(() => {
    return transactions.filter((row) => {
      if (row.archived) return false;
      if (!isRushOrder(row)) return false;
      if (String(row.payment_status || '').toLowerCase() === 'paid') return false;
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        row.customer_name.toLowerCase().includes(q) ||
        row.receipt.toLowerCase().includes(q);
      return matchesSearch;
    });
  }, [transactions, searchTerm]);

  // Mark paid logic with fixed payment_method = Cash
  const handleMarkPaid = () => {
    if (!selectedTxn) return;
    const paidAmount = Number(paidAmountInput) || 0;
    const penalty = Number(penaltyInput) || 0;
    const required = selectedTxn.amount + penalty;
    if (paidAmount < required) return;

    updateTransactionPaidAmount(
      selectedTxn.id,
      paidAmount,
      penalty,
      "Cash" // FORCE CASH ALWAYS
    );

    markTransactionPaid(selectedTxn.id);
    setSelectedTxn(null);
    setPaidAmountInput('');
    setPenaltyInput('');
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
              const pen = calculatePenalty(row.amount, row.due_date);
              setPenaltyInput(pen > 0 ? String(pen) : '');
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
            
            <div className="search-filter-row express-search-only">
              <input
                type="text"
                placeholder="Search receipt or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search receipt or customer"
              />
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
                    No unpaid rush orders. This list shows rush (express) orders that are still <strong>unpaid</strong>.
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
              <p><strong>Penalty:</strong> ₱{(Number(selectedTxn.penalty) || 0).toFixed(2)}</p>
              <p><strong>Payment Status:</strong> {selectedTxn.payment_status}</p>
              <p><strong>Inventory Status:</strong> {formatInventoryStatus(selectedTxn.inventory_status)}</p>

              <p>
                <strong>Remaining Balance:</strong>{' '}
                <span
                  style={{
                    color:
                      selectedTxn.amount +
                        (Number(selectedTxn.penalty) || 0) -
                        (Number(selectedTxn.paid_amount) || 0) >
                      0
                        ? 'red'
                        : 'green',
                  }}
                >
                  ₱
                  {(
                    selectedTxn.amount +
                    (Number(selectedTxn.penalty) || 0) -
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
                />

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
                    showInsufficientPayment ||
                    !String(paidAmountInput || '').trim() ||
                    parseAmountInput(paidAmountInput) === null
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
