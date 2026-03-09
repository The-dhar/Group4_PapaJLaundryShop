import React, { useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import { BsEye, BsCashStack } from 'react-icons/bs';
import { useTransactions } from '../context/transactionsContext';
import '../styles/inventorystyle.css';

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

  // Check if past due
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

  const filteredData = useMemo(() => {
    return transactions.filter((row) => {

      const matchesPayment =
        filterPayment === 'All' || row.payment_status === filterPayment;

      const matchesInventory =
        filterInventory === 'All' || row.inventory_status === filterInventory;

      const matchesSearch =
        (row.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (row.receipt || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesPayment && matchesInventory && matchesSearch;

    });
  }, [transactions, filterPayment, filterInventory, searchTerm]);

  const handleMarkPaid = () => {

    if (!selectedTxn) return;

    const paidAmount = Number(paidAmountInput) || 0;
    const penalty = Number(penaltyInput) || 0;

    updateTransactionPaidAmount(
      selectedTxn.id,
      paidAmount,
      penalty,
      "Cash"
    );

    markTransactionPaid(selectedTxn.id);

    setSelectedTxn(null);
    setPaidAmountInput('');
    setPenaltyInput('');
  };

  const columns = [

    {
      name: 'Receipt ID',
      selector: (row) => row.receipt,
      sortable: true
    },

    {
      name: 'Customer',
      selector: (row) => row.customer_name
    },

    {
      name: 'Service',
      selector: (row) => row.receipt_items?.[0]?.laundryType || 'N/A'
    },

    {
      name: 'Payment',
      cell: (row) => (
        <span className={`status-pill status-${row.payment_status}`}>
          {row.payment_status}
        </span>
      ),
    },

    {
      name: 'Status',
      cell: (row) => (
        <span className={`status-pill status-${row.inventory_status}`}>
          {row.inventory_status}
        </span>
      ),
    },

    {
      name: 'Amount',
      selector: (row) => `₱${Number(row.amount || 0).toFixed(2)}`
    },

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
                payment_method: "Cash"
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
                payment_method: "Cash"
              });

              setPaidAmountInput(
                row.paid_amount && row.paid_amount !== 0
                  ? String(row.paid_amount)
                  : ''
              );

              const pen = calculatePenalty(row.amount, row.due_date);

              setPenaltyInput(pen > 0 ? String(pen) : '');

            }}
          >
            <BsCashStack />
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

            <div className="search-filter-row">

              <input
                type="text"
                placeholder="Search receipt or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              <select
                value={filterPayment}
                onChange={(e) => setFilterPayment(e.target.value)}
              >
                <option value="All">All Payments</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>

              <select
                value={filterInventory}
                onChange={(e) => setFilterInventory(e.target.value)}
              >
                <option value="All">All Inventory</option>
                <option value="in_shop">In Shop</option>
                <option value="picked_up">Picked Up</option>
              </select>

            </div>

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

      {selectedTxn && (

        <div className="inventory-modal">

          <div className="inventory-modal-content">

            <h3>Receipt: {selectedTxn.receipt}</h3>

            <p>
              <strong>Customer:</strong> {selectedTxn.customer_name}
            </p>

            <p>
              <strong>Address:</strong> {selectedTxn.customer_address}
            </p>

            <p><strong>Services:</strong></p>

            <ul>

              {selectedTxn.receipt_items?.map((svc) => (

                <li key={svc.id}>
                  ({svc.serviceName}) {svc.kilos} kg @ ₱{Number(svc.rate).toFixed(2)} =
                  ₱{Number(svc.total).toFixed(2)}
                </li>

              ))}

            </ul>

            <p>
              <strong>Total Weight:</strong> {selectedTxn.total_weight} kg
            </p>

            <p>
              <strong>Total Amount:</strong> ₱{Number(selectedTxn.amount).toFixed(2)}
            </p>

            <p><strong>Payment Method:</strong> Cash</p>

            <p>
              <strong>Paid Amount:</strong> ₱{Number(selectedTxn.paid_amount || 0).toFixed(2)}
            </p>

            <p>
              <strong>Penalty:</strong> ₱{Number(selectedTxn.penalty || 0).toFixed(2)}
            </p>

            <p>
              <strong>Payment Status:</strong> {selectedTxn.payment_status}
            </p>

            <p>
              <strong>Inventory Status:</strong> {selectedTxn.inventory_status}
            </p>

            <div className="paid-amount-section">

              <label><strong>Amount Paid:</strong></label>

              <input
                type="text"
                className="paid-amount-input"
                placeholder="Pending - Enter amount paid"
                value={paidAmountInput}
                disabled={viewMode === 'view'}
                onChange={(e) => setPaidAmountInput(e.target.value)}
              />

              <label><strong>Penalty:</strong></label>

              <input
                type="text"
                className="penalty-input"
                placeholder="Enter penalty amount"
                value={penaltyInput}
                disabled={viewMode === 'view'}
                onChange={(e) => setPenaltyInput(e.target.value)}
              />

              {viewMode === 'edit' && paidAmountInput && (

                <p className="change-balance">

                  {Number(paidAmountInput) >=
                  (selectedTxn.amount + Number(penaltyInput)) ? (

                    <>Change: ₱{
                      (Number(paidAmountInput) -
                        selectedTxn.amount -
                        Number(penaltyInput)).toFixed(2)
                    }</>

                  ) : (

                    <>Balance: ₱{
                      (selectedTxn.amount +
                        Number(penaltyInput) -
                        Number(paidAmountInput)).toFixed(2)
                    }</>

                  )}

                </p>

              )}

            </div>

            <div className="modal-actions">

              <button
                onClick={() => setSelectedTxn(null)}
                className="modal-btn secondary"
              >
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
                  onClick={handleMarkPaid}
                  disabled={selectedTxn.payment_status === 'paid'}
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

export default Inventorymanagement;