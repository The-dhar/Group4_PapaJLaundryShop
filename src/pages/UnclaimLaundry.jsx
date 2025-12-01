import React, { useMemo, useState, useEffect } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import { BsEye, BsExclamationTriangle } from 'react-icons/bs';
import { useTransactions } from '../context/transactionsContext';
import Swal from 'sweetalert2';
import '../styles/unclaimedstyle.css';

const UnclaimLaundry = () => {
  const { transactions } = useTransactions();

  const [filterPayment, setFilterPayment] = useState('All');
  const [filterInventory, setFilterInventory] = useState('in_shop');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);

  // Check if due date is 7–30 days late
  const isPastDue = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = today - due;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 7 && diffDays <= 30;
  };

  // Filter table data
  const filteredData = useMemo(() => {
    return transactions.filter((row) => {
      const matchesPayment = filterPayment === 'All' || row.payment_status === filterPayment;
      const matchesInventory = filterInventory === 'All' || row.inventory_status === filterInventory;
      const matchesSearch =
        row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.receipt.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesPayment && matchesInventory && matchesSearch;
    });
  }, [transactions, filterPayment, filterInventory, searchTerm]);

  // Alert overdue items
  useEffect(() => {
    if (transactions.length > 0) {
      const overdueItems = transactions.filter(
        (row) => isPastDue(row.due_date) && row.inventory_status === 'in_shop'
      );
      if (overdueItems.length > 0) {
        const receiptList = overdueItems.map((item) => item.receipt).join(', ');
        Swal.fire({
          title: "⚠️ Overdue Laundry Alert",
          html: `
            <div style="text-align:left; font-size:15px; line-height:1.6;">
              <b>${overdueItems.length}</b> item${overdueItems.length !== 1 ? "s are" : " is"} past due 
              (<b>7–30 days overdue</b>) and still in the shop.<br><br>

              <b>Receipt ID(s):</b><br>
              ${receiptList}<br><br>

              Please check these items in the <b>Unclaimed</b> table.
            </div>
          `,
          icon: "warning",
          width: 420,
          confirmButtonText: "Okay",
          confirmButtonColor: "#d9534f",
          background: "#fff8e6",
          color: "#333",
          customClass: { popup: 'swal-border' }
        });
      }
    }
  }, [transactions.length]);

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
        <span className={`status-pill status-${row.inventory_status}`}>{row.inventory_status}</span>
      ),
    },
    { name: 'Amount', selector: (row) => `₱${row.amount.toFixed(2)}` },
    {
      name: 'Due Date',
      cell: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>{row.due_date}</span>
          {isPastDue(row.due_date) && (
            <BsExclamationTriangle className="overdue-alert-icon" title="Past Due: 7-30 days overdue" />
          )}
        </div>
      ),
    },
    {
      name: 'Action',
      cell: (row) => (
        <button
          className="inventory-action-btn view"
          title="View"
          onClick={() => setSelectedTxn(row)}
        >
          <BsEye />
        </button>
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
            </div>

            <div className="unclaimed-table-wrapper">
              <DataTable
                columns={columns}
                data={filteredData}
                highlightOnHover
                pagination
                paginationPerPage={10}
                paginationRowsPerPageOptions={[5, 10, 20, 50]}
                conditionalRowStyles={[
                  {
                    when: (row) => isPastDue(row.due_date) && row.inventory_status === 'in_shop',
                    style: {
                      backgroundColor: '#fecaca',
                      borderLeft: '4px solid #dc2626',
                    },
                    classNames: ['overdue-row'],
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {selectedTxn && (
        <div className="inventory-modal">
          <div className="inventory-modal-content">
            <h3>Receipt: {selectedTxn.receipt}</h3>
            <p><strong>Customer:</strong> {selectedTxn.customer_name}</p>
            <p><strong>Address:</strong> {selectedTxn.customer_address}</p>
            <p><strong>Services:</strong></p>
            <ul>
              {selectedTxn.services.map((svc) => (
                <li key={svc.id}>
                  {svc.serviceName} - {svc.kilos} kg @ ₱{svc.rate.toFixed(2)} = ₱{svc.total.toFixed(2)}
                </li>
              ))}
            </ul>
            <p><strong>Total Weight:</strong> {selectedTxn.weight} kg</p>
            <p><strong>Total Amount:</strong> ₱{selectedTxn.amount.toFixed(2)}</p>
            <p><strong>Payment Method:</strong> {selectedTxn.payment_method || '—'}</p>
            <p><strong>Paid Amount:</strong> ₱{(Number(selectedTxn.paid_amount) || 0).toFixed(2)}</p>
            <p><strong>Due Date:</strong> {selectedTxn.due_date}</p>
            <p><strong>Payment Status:</strong> {selectedTxn.payment_status}</p>
            <p><strong>Inventory Status:</strong> {selectedTxn.inventory_status}</p>

            <div className="modal-actions">
              <button onClick={() => setSelectedTxn(null)} className="modal-btn secondary">
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
