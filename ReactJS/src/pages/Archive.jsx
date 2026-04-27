import React, { useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import TransactionExtrasSummary from '../components/TransactionExtrasSummary';
import { BsPencil } from 'react-icons/bs';
import { useTransactions } from '../context/transactionsContext';
import '../styles/archivestyle.css';
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
        <span className={`status-pill status-${row.inventory_status} status-archived`}>
          {formatInventoryStatus(row.inventory_status)}
        </span>
      ),
    },
    { name: 'Amount', selector: (row) => `₱${row.amount.toFixed(2)}` },
    {
      name: 'Action',
      cell: (row) => (
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <button
            type="button"
            className="inventory-action-btn edit"
            title="View details"
            onClick={() => setSelectedTxn(row)}
          >
            <BsPencil />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DashboardLayout>
      <div className="page-header-block page-header-block--table">
        <h2 className="page-header-title">Archive</h2>
        <p className="page-header-subtitle">View and restore previously archived transactions</p>
      </div>
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

        {selectedTxn && (
          <div className="inventory-modal">
            <div className="inventory-modal-content">
              <div className="inventory-modal-body">
                <h3>Receipt: {selectedTxn.receipt}</h3>
                <p><strong>Customer:</strong> {selectedTxn.customer_name}</p>
                <p><strong>Address:</strong> {selectedTxn.customer_address}</p>

                <div className="modal-services-block">
                  <strong>Services:</strong>
                  <ul>
                    {selectedTxn.services.map((svc) => (
                      <li key={svc.id}>
                        ({svc.serviceName}) {svc.kilos} kg @ ₱{svc.rate.toFixed(2)} = ₱{svc.total.toFixed(2)}
                      </li>
                    ))}
                  </ul>
                </div>

                <TransactionExtrasSummary txn={selectedTxn} />

                <p><strong>Total Weight:</strong> {selectedTxn.weight} kg</p>
                <p><strong>Total Amount:</strong> ₱{selectedTxn.amount.toFixed(2)}</p>
                <p><strong>Payment Method:</strong> {selectedTxn.payment_method || 'Cash'}</p>
                <p><strong>Paid Amount:</strong> ₱{(Number(selectedTxn.paid_amount) || 0).toFixed(2)}</p>
                <p><strong>Penalty:</strong> ₱{(Number(selectedTxn.penalty_amount ?? selectedTxn.penalty) || 0).toFixed(2)}</p>
                <p><strong>Payment Status:</strong> {selectedTxn.payment_status}</p>
                <p><strong>Inventory Status:</strong> {formatInventoryStatus(selectedTxn.inventory_status)}</p>
                <p>
                  <strong>Remaining Balance:</strong>{' '}
                  <span
                    style={{
                      color:
                        selectedTxn.amount +
                          (Number(selectedTxn.penalty_amount ?? selectedTxn.penalty) || 0) -
                          (Number(selectedTxn.paid_amount) || 0) >
                        0
                          ? 'red'
                          : 'green',
                    }}
                  >
                    ₱
                    {(
                      selectedTxn.amount +
                      (Number(selectedTxn.penalty_amount ?? selectedTxn.penalty) || 0) -
                      (Number(selectedTxn.paid_amount) || 0)
                    ).toFixed(2)}
                  </span>
                </p>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setSelectedTxn(null)} className="modal-btn secondary">
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    restoreTransaction(selectedTxn.id);
                    setSelectedTxn(null);
                  }}
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