import React, { useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import { BsEye, BsPencil } from 'react-icons/bs';
import { useTransactions } from '../context/transactionsContext';
import '../styles/archivestyle.css';

const Archive = () => {
  const { transactions, restoreTransaction } = useTransactions();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);

  const archivedData = useMemo(() => {
    return transactions.filter((row) => row.archived === true && (
      row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.receipt.toLowerCase().includes(searchTerm.toLowerCase())
    ));
  }, [transactions, searchTerm]);

  const columns = [
    { name: 'Receipt ID', selector: (row) => row.receipt, sortable: true },
    { name: 'Customer', selector: (row) => row.customer_name },
    { name: 'Service', selector: (row) => row.receipt_items?.[0]?.laundryType || 'N/A' },
    {
      name: 'Payment',
      cell: (row) => (
        <span className={`status-pill status-${row.payment_status} status-archived`}>{row.payment_status}</span>
      ),
    },
    {
      name: 'Status',
      cell: (row) => (
        <span className={`status-pill status-${row.inventory_status} status-archived`}>{row.inventory_status}</span>
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
            onClick={() => setSelectedTxn(row)}
          >
            <BsEye />
          </button>
          <button
            className="inventory-action-btn edit"
            title="Restore"
            onClick={() => { restoreTransaction(row.id); }}
          >
            <BsPencil />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="archive-page">
        <div className="table-container">
          <div className="background-table">
            <div className="search-filter-row">
              <input
                type="text"
                placeholder="Search archived receipt or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="table-wrapper">
              <DataTable
                columns={columns}
                data={archivedData}
                highlightOnHover
                pagination
                paginationPerPage={10}
                conditionalRowStyles={[
                  {
                    when: (row) => row.archived === true,
                    style: {
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                    },
                    classNames: ['archived-row'],
                  },
                ]}
              />
            </div>
          </div>
        </div>

        {/* MODAL for viewing with Restore action */}
        {selectedTxn && (
          <div className="inventory-modal">
            <div className="inventory-modal-content">
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

              <p><strong>Total Amount:</strong> ₱{selectedTxn.amount.toFixed(2)}</p>
              <p><strong>Payment Status:</strong> {selectedTxn.payment_status}</p>
              <p><strong>Inventory Status:</strong> {selectedTxn.inventory_status}</p>

              <div className="modal-actions">
                <button onClick={() => setSelectedTxn(null)} className="modal-btn secondary">Close</button>
                <button
                  onClick={() => { restoreTransaction(selectedTxn.id); setSelectedTxn(null); }}
                  className="modal-btn primary"
                >
                  Restore Transaction
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Archive;