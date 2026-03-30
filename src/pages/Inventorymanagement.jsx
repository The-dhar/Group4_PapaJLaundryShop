import React, { useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import { BsEye,BsCashStack} from 'react-icons/bs';
import { useTransactions } from '../context/transactionsContext';
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

const Inventorymanagement = () => {
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

  /** Parses amount field; null = walang valid number na na-enter pa */
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
  /** May na-type nang halaga sa Amount Paid at mas mababa ito sa kabuuang dapat bayarin */
  const showInsufficientPayment =
    viewMode === 'edit' &&
    selectedTxn &&
    paidParsed !== null &&
    paidParsed + 0.001 < requiredPaymentTotal;

  const filteredData = useMemo(() => {
    return transactions.filter((row) => {
      const matchesPayment = filterPayment === 'All' || row.payment_status === filterPayment;
      const matchesInventory = filterInventory === 'All' || row.inventory_status === filterInventory;
      const matchesSearch =
        row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.receipt.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPayment && matchesInventory && matchesSearch && !row.archived;
    });
  }, [transactions, filterPayment, filterInventory, searchTerm]);

  // Mark paid logic with fixed payment_method = Cash
  const handleMarkPaid = () => {
  if (!selectedTxn) return;
  const paidAmount = parseAmountInput(paidAmountInput);
  if (paidAmount === null) return;
  const penalty = Number(penaltyInput) || 0;
  const required = Number(selectedTxn.amount) + penalty;
  if (paidAmount + 0.001 < required) return;

  updateTransactionPaidAmount(
    selectedTxn.id,
    paidAmount,
    penalty,
    "Cash" 
  );

  markTransactionPaid(selectedTxn.id);
  
  // CLEAR OR REFRESH: This ensures the next time you open it, 
  // it pulls the fresh data from the transactions array.
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
            className="inventory-action-btn view"
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
            className="inventory-action-btn edit"
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
      <div className="inventory-page">
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
              />
            </div>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {selectedTxn && (
        <div className="inventory-modal">
          <div className="inventory-modal-content">
          <div className="inventory-modal-body">
            
            <h3>Receipt: {selectedTxn.receipt}</h3>
            <p><strong>Customer:</strong> {selectedTxn.customer_name}</p>
            <p><strong>Address:</strong> {selectedTxn.customer_address}</p>

            <p><strong>Services:</strong>
             <ul>
              {selectedTxn.services.map((svc) => (
                <li key={svc.id}>
                  ({svc.serviceName}) {svc.kilos} kg @ ₱{svc.rate.toFixed(2)} = ₱{svc.total.toFixed(2)}
                </li>
              ))}
            </ul>
            </p>
           

            <p><strong>Total Weight:</strong> {selectedTxn.weight} kg</p>
            <p><strong>Total Amount:</strong> ₱{selectedTxn.amount.toFixed(2)}</p>

            {/* ALWAYS CASH */}
            <p><strong>Payment Method:</strong> Cash</p>

            <p><strong>Paid Amount:</strong> ₱{(Number(selectedTxn.paid_amount) || 0).toFixed(2)}</p>
            <p><strong>Penalty:</strong> ₱{(Number(selectedTxn.penalty) || 0).toFixed(2)}</p>
            <p><strong>Payment Status:</strong> {selectedTxn.payment_status}</p>
            <p><strong>Inventory Status:</strong> {formatInventoryStatus(selectedTxn.inventory_status)}</p>
            {/* Add this after your Paid Amount and Penalty <p> tags */}
            <p>
              <strong>Remaining Balance:</strong> 
              <span style={{ color: (selectedTxn.amount + (Number(selectedTxn.penalty) || 0) - (Number(selectedTxn.paid_amount) || 0)) > 0 ? 'red' : 'green' }}>
                ₱{(selectedTxn.amount + (Number(selectedTxn.penalty) || 0) - (Number(selectedTxn.paid_amount) || 0)).toFixed(2)}
              </span>
            </p>
            {/* EDIT MODE */}
            <div className="paid-amount-section">
              <label><strong>Amount Paid:</strong></label>
              <input
                type="number"
                className="paid-amount-input"
                placeholder="Enter amount paid"
                value={paidAmountInput}
                /* LOCKS if the mode is 'view' OR if the transaction is already 'paid' */
                disabled={viewMode === 'view' || selectedTxn?.payment_status === 'paid'} 
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
                /* ONLY LOCKS if we are in 'view' mode. Stays editable in 'edit' mode even if paid. */
                disabled={viewMode === 'view'} 
                onChange={(e) => setPenaltyInput(e.target.value)}
              />
              
              {/* Display Change/Balance logic remains the same below */}
              {viewMode === 'edit' && paidParsed !== null && (
                <p className="change-balance">
                  {paidEntered >= requiredPaymentTotal ? (
                    <>Change: ₱{(paidEntered - requiredPaymentTotal).toFixed(2)}</>
                  ) : (
                    <>Balance: ₱{(requiredPaymentTotal - paidEntered).toFixed(2)}</>
                  )}
                </p>
              )}
            </div>

            </div>

            {/* MODAL BUTTONS — outside scroll area so no inner scrollbar */}
             <div className="modal-actions">
  {/* 1. Always show the Close button */}
  <button onClick={() => setSelectedTxn(null)} className="modal-btn secondary">
    Close
  </button>

  {/* 2. Show Archive only in View Mode */}
  {viewMode === 'view' && (
    <button
      onClick={() => { archiveTransaction(selectedTxn.id); setSelectedTxn(null); }}
      className="modal-btn cancel"
    >
      Archive Transaction
    </button>
  )}

  {/* 3. Show the dynamic Submit button only in Edit Mode */}
  {viewMode === 'edit' && (
    <button
      onClick={handleMarkPaid}
      /* Logic: 
         - If status is UNPAID: Disable if paidAmountInput is empty.
         - If status is PAID: Keep enabled so penalty can be updated.
      */
      disabled={
        showInsufficientPayment ||
        (selectedTxn.payment_status !== 'paid' &&
          (!String(paidAmountInput || '').trim() ||
            parseAmountInput(paidAmountInput) === null))
      }
      className="modal-btn primary"
    >
      {selectedTxn.payment_status === 'paid' ? 'Update Transaction' : 'Mark as Paid'}
    </button>
  )}
</div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Inventorymanagement;