import React, { useMemo, useState, useEffect, useRef } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import TransactionExtrasSummary from '../components/TransactionExtrasSummary';
import { BsEye, BsExclamationTriangle } from 'react-icons/bs';
import { useTransactions } from '../context/transactionsContext';
import Swal from 'sweetalert2';
import '../styles/unclaimedstyle.css';
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

const UnclaimLaundry = () => {
  const { transactions } = useTransactions();

  const [filterPayment, setFilterPayment] = useState('All');
  const [filterInventory, setFilterInventory] = useState('in_shop');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('none');
  const [selectedTxn, setSelectedTxn] = useState(null);

  /**
   * Full calendar days after the due date (0 = due today, 1 = 1 day past due, …).
   * Uses local date parsing so YYYY-MM-DD stays aligned with the calendar.
   */
  const getDaysPastDue = (dueDate) => {
    if (!dueDate) return -Infinity;
    const s = String(dueDate).trim();
    const parts = s.split('-').map(Number);
    let due;
    if (parts.length === 3 && parts[0] > 1000) {
      due = new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
      due = new Date(s);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.floor((today - due) / (86400000));
  };

  /** Unclaimed page: only if due date is 3+ days in the past (3+ days past due date). */
  const isThreeOrMoreDaysPastDueDate = (dueDate) => getDaysPastDue(dueDate) >= 3;

  /** Due column icon / row highlight — same “3 days past due date” rule */
  const showUnclaimedWarning = (dueDate) => isThreeOrMoreDaysPastDueDate(dueDate);

  const overdueAlertKeyRef = useRef('');

  // Still In Shop + 3+ calendar days past due_date only
  const filteredData = useMemo(() => {
    return transactions.filter((row) => {
      if (row.archived) return false;
      if (row.inventory_status !== 'in_shop') return false;
      if (!isThreeOrMoreDaysPastDueDate(row.due_date)) return false;

      const matchesPayment = filterPayment === 'All' || row.payment_status === filterPayment;
      const matchesInventory = filterInventory === 'All' || row.inventory_status === filterInventory;
      const matchesSearch =
        row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.receipt.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPayment && matchesInventory && matchesSearch;
    });
  }, [transactions, filterPayment, filterInventory, searchTerm]);

  // Sorted data based on selected sort order
  const sortedData = useMemo(() => {
    const data = [...filteredData];
    if (sortOrder === 'amount_desc') {
      data.sort((a, b) => b.amount - a.amount);
    } else if (sortOrder === 'amount_asc') {
      data.sort((a, b) => a.amount - b.amount);
    }
    return data;
  }, [filteredData, sortOrder]);

  // Alert: in-shop orders that are 3+ days past due date
  useEffect(() => {
    const overdueItems = transactions.filter(
      (row) =>
        !row.archived &&
        row.inventory_status === 'in_shop' &&
        isThreeOrMoreDaysPastDueDate(row.due_date)
    );
    if (overdueItems.length === 0) return;

    const key = overdueItems
      .map((r) => r.id)
      .sort()
      .join('|');
    if (overdueAlertKeyRef.current === key) return;
    overdueAlertKeyRef.current = key;

    const receiptList = overdueItems.map((item) => item.receipt).join(', ');
    Swal.fire({
      title: 'Overdue Laundry Alert',
      html: `
            <div style="text-align:left; font-size:15px; line-height:1.6;">
              <b>${overdueItems.length}</b> item${overdueItems.length !== 1 ? 's are' : ' is'} <b>3 or more days past the due date</b> and still <b>In Shop</b>.<br><br>

              <b>Receipt ID(s):</b><br>
              ${receiptList}<br><br>

              Please check these items in the <b>Unclaimed</b> table.
            </div>
          `,
      icon: 'warning',
      width: 420,
      confirmButtonText: 'Okay',
      confirmButtonColor: '#d9534f',
      background: '#fff8e6',
      color: '#333',
      customClass: { popup: 'swal-border' },
    });
  }, [transactions]);

  // Table columns
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
    { name: 'Amount', selector: (row) => row.amount, sortable: true, cell: (row) => `₱${row.amount.toFixed(2)}` },
    {
      name: 'Due Date',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{row.due_date}</span>
          {showUnclaimedWarning(row.due_date) && (
            <BsExclamationTriangle
              className="overdue-alert-icon"
              title="3+ days past due date — still unclaimed"
            />
          )}
        </div>
      ),
    },
    {
      name: 'Action',
      center: true,
      cell: (row) => (
        <div className="unclaimed-action-cell">
          <button
            className="inventory-action-btn view"
            title="View"
            onClick={() => setSelectedTxn(row)}
          >
            <BsEye />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="unclaimed-page">
        <div className="unclaimed-table-container">
          <div className="unclaimed-background-table">
            <div className="unclaimed-search-filter-row">
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
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="none">Sort: None</option>
                <option value="amount_desc">Amount: High → Low</option>
                <option value="amount_asc">Amount: Low → High</option>
              </select>
            </div>

            <div className="unclaimed-table-wrapper">
              <DataTable
                columns={columns}
                data={sortedData}
                highlightOnHover
                pagination
                paginationPerPage={10}
                paginationRowsPerPageOptions={[5, 10, 20, 50]}
                conditionalRowStyles={[
                  {
                    when: (row) =>
                      row.inventory_status === 'in_shop' &&
                      isThreeOrMoreDaysPastDueDate(row.due_date),
                    style: {
                      backgroundColor: '#fecaca',
                      borderLeft: '4px solid #dc2626',
                    },
                    classNames: ['overdue-row'],
                  },
                ]}
                noDataComponent={
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No orders here yet. This list only shows laundry that is still <strong>In Shop</strong> and{' '}
                    <strong>3 or more calendar days past the due date</strong>.
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </div>

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
              <p><strong>Payment Method:</strong> {selectedTxn.payment_method || 'Cash'}</p>
              <p><strong>Paid Amount:</strong> ₱{(Number(selectedTxn.paid_amount) || 0).toFixed(2)}</p>
              <p><strong>Penalty:</strong> ₱{(Number(selectedTxn.penalty) || 0).toFixed(2)}</p>
              <p><strong>Due Date:</strong> {selectedTxn.due_date}</p>
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
            </div>

            <div className="modal-actions">
              <button type="button" onClick={() => setSelectedTxn(null)} className="modal-btn secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default UnclaimLaundry;
