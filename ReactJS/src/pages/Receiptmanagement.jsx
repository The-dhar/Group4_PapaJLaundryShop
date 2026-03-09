import React, { useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import { BsEye, BsPrinter, BsCheck} from 'react-icons/bs';
import DashboardLayout from '../components/dashboardlayout';
import { useTransactions } from '../context/transactionsContext';
import '../styles/receiptstyle.css';
import { jsPDF } from 'jspdf';

const Receiptmanagement = () => {
  const { transactions, archiveTransaction, updateTransaction } = useTransactions();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInventory, setFilterInventory] = useState('All');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [viewMode, setViewMode] = useState('view'); // 'view' or 'edit'

  // Filter for paid items (ready for viewing, or already picked_up ready for printing)
  const readyReceipts = useMemo(
    () => transactions.filter((txn) => (txn.payment_status === 'paid' || txn.payment_status === 'unpaid') && !txn.archived),
    [transactions]
  );

  const filteredData = useMemo(() => {
    return readyReceipts.filter((row) => {
      const matchesInventory =
        filterInventory === 'All' || row.inventory_status === filterInventory;
      const matchesSearch =
        row.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row.receipt.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesInventory && matchesSearch;
    });
  }, [readyReceipts, searchTerm, filterInventory]);

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
    { name: 'Due Date', selector: (row) => row.due_date },
    {
      name: 'Action',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="receipt-action-btn view"
            title="View Receipt"
            onClick={() => {
              setViewMode('view');
              setSelectedReceipt(row);
            }}
          >
            <BsEye />
          </button>
          <button
            className="receipt-action-btn edit"
            title="Print/Archive Receipt"
            onClick={() => {
              setViewMode('edit');
              setSelectedReceipt(row);
            }}
          >
            <BsPrinter />
          </button>
        </div>
      ),
    },
  ];

  // Generate 58mm thermal-style PDF for the selected receipt
  const handlePrint = () => {
    if (!selectedReceipt) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [58, 200], // 58mm thermal width
    });

    let y = 6;
    const centerX = 29; // half of 58mm

    const services = Array.isArray(selectedReceipt.services)
      ? selectedReceipt.services
      : [];

    const subtotalValue = services.reduce(
      (sum, s) => sum + (s.total || 0),
      0
    );

    // HEADER
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text("Papa J's Laundry Shop", centerX, y, { align: 'center' });
    y += 4;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text('123 Sample Street, Barangay, City', centerX, y, {
      align: 'center',
    });
    y += 3;
    doc.text('Contact: 09xx-xxx-xxxx', centerX, y, { align: 'center' });
    y += 3;
    doc.text('TIN: 123-456-789', centerX, y, { align: 'center' });
    y += 3;

    doc.line(2, y, 56, y);
    y += 3;

    // META
    doc.text(`Receipt: ${selectedReceipt.receipt}`, 2, y);
    if (selectedReceipt.due_date) {
      doc.text(String(selectedReceipt.due_date), 56, y, { align: 'right' });
    }
    y += 4;

    doc.text(`Customer: ${selectedReceipt.customer_name}`, 2, y);
    y += 4;
    if (selectedReceipt.customer_address) {
      doc.text(`Address: ${selectedReceipt.customer_address}`, 2, y);
      y += 4;
    }

    doc.line(2, y, 56, y);
    y += 3;

    // SERVICES HEADER
    doc.setFont('courier', 'bold');
    doc.text('Srv', 2, y);
    doc.text('Kg', 30, y, { align: 'center' });
    doc.text('Amt', 56, y, { align: 'right' });
    y += 3;
    doc.line(2, y, 56, y);
    y += 3;

    // SERVICES LIST
    doc.setFont('courier', 'normal');
    services.forEach((svc) => {
      const name = svc.serviceName || '';
      const rate = svc.rate ?? 0;
      const kilos = svc.kilos ?? 0;
      const total = svc.total ?? 0;

      doc.text(name.substring(0, 16), 2, y);
      doc.text(String(kilos), 30, y, { align: 'center' });
      doc.text(`₱${total.toFixed(2)}`, 56, y, { align: 'right' });
      y += 3;

      doc.setFontSize(7);
      doc.text(`@ ₱${rate.toFixed(2)}`, 2, y);
      doc.setFontSize(8);
      y += 3;
    });

    doc.line(2, y, 56, y);
    y += 3;

    // TOTALS
    doc.text('Subtotal', 2, y);
    doc.text(`₱${subtotalValue.toFixed(2)}`, 56, y, { align: 'right' });
    y += 3;

    if (selectedReceipt.extra_charge_type === 'discount') {
      doc.text('Discount', 2, y);
      doc.text(
        `-₱${(selectedReceipt.discount_amount || 0).toFixed(2)}`,
        56,
        y,
        { align: 'right' }
      );
      y += 3;
    }

    if (selectedReceipt.extra_charge_type === 'express') {
      doc.text('Express', 2, y);
      doc.text('+₱100.00', 56, y, { align: 'right' });
      y += 3;
    }

    doc.setFont('courier', 'bold');
    doc.text('Total', 2, y);
    doc.text(`₱${selectedTotal.toFixed(2)}`, 56, y, { align: 'right' });
    y += 4;

    doc.setFont('courier', 'normal');
    doc.line(2, y, 56, y);
    y += 3;

    // PAYMENT INFO
    doc.text('Payment:', 2, y);
    doc.text(selectedReceipt.payment_method || '—', 56, y, {
      align: 'right',
    });
    y += 3;

    doc.text('Paid:', 2, y);
    doc.text(`₱${selectedPaid.toFixed(2)}`, 56, y, { align: 'right' });
    y += 3;

    if (selectedPaid > 0) {
      const label = selectedDiff >= 0 ? 'Change:' : 'Balance:';
      doc.text(label, 2, y);
      doc.text(`₱${Math.abs(selectedDiff).toFixed(2)}`, 56, y, {
        align: 'right',
      });
      y += 3;
    }

    doc.text('Status:', 2, y);
    doc.text(String(selectedReceipt.inventory_status || ''), 56, y, {
      align: 'right',
    });
    y += 4;

    doc.line(2, y, 56, y);
    y += 4;

    // FOOTER
    doc.setFontSize(7);
    doc.text('Thank you for choosing', centerX, y, { align: 'center' });
    y += 3;
    doc.text("Papa J's Laundry Shop!", centerX, y, { align: 'center' });

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl);
  };

const handleArchiveReceipt = () => {
  if (!selectedReceipt) return;

  archiveTransaction(selectedReceipt.id);
  setSelectedReceipt(null);
  setShowArchiveConfirm(false);
};

  const handleMarkPickedUp = () => {
    if (selectedReceipt && window.confirm(`Mark Receipt ${selectedReceipt.receipt} as Picked Up?`)) {
      updateTransaction(selectedReceipt.id, { 
        inventory_status: 'picked_up' 
      });
      setSelectedReceipt({
        ...selectedReceipt,
        inventory_status: 'picked_up'
      });
    }
  };

  // compute paid / diff for selected receipt (safe defaults)
  const selectedPaid = selectedReceipt ? Number(selectedReceipt.paid_amount || 0) : 0;
  const selectedTotal = selectedReceipt ? Number(selectedReceipt.amount || 0) : 0;
  const selectedDiff = selectedPaid - selectedTotal;

  return (
    <DashboardLayout>
      <div className="receipt-container">
        <div className="receipt-background">
          <div className="receipt-filter-row">
            <input
              type="text"
              placeholder="Search receipt or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select 
              value={filterInventory} 
              onChange={(e) => setFilterInventory(e.target.value)}
              style={{ marginLeft: '10px' }}
            >
              <option value="All">All Inventory</option>
              <option value="in_shop">In Shop</option>
              <option value="picked_up">Picked Up</option>
            </select>
          </div>

          <div className="receipt-table-wrapper">
            <DataTable
              columns={columns}
              data={filteredData}
              highlightOnHover
              pagination
              paginationPerPage={10}
              paginationRowsPerPageOptions={[5, 10, 20, 50]}
              noDataComponent="No receipts found. Create one in POs first."
            />
          </div>
        </div>
      </div>

      {selectedReceipt && (
        <div className="receipt-modal">
          <div className="receipt-modal-content">
            <button 
              className="receipt-close-x"
              onClick={() => setSelectedReceipt(null)}
            >
              ✕
            </button>
            <div className="thermal-receipt">
              <div className="tr-header">
                <h3 className="tr-shop-name">Papa J's Laundry Shop</h3>
                <p className="tr-shop-line">123 Sample Street, Barangay, City</p>
                <p className="tr-shop-line">Contact: 09xx-xxx-xxxx</p>
                <p className="tr-shop-line">TIN: 123-456-789</p>
                <div className="tr-divider" />
                <div className="tr-row tr-meta">
                  <span>Receipt: {selectedReceipt.receipt}</span>
                  <span>{selectedReceipt.due_date}</span>
                </div>
                <div className="tr-row tr-meta">
                  <span>Customer: {selectedReceipt.customer_name}</span>
                </div>
                {selectedReceipt.customer_address && (
                  <div className="tr-row tr-meta">
                    <span>Address: {selectedReceipt.customer_address}</span>
                  </div>
                )}
                <div className="tr-divider" />
              </div>

              <div className="tr-body">
                <div className="tr-row tr-head">
                  <span className="tr-item">Service</span>
                  <span className="tr-qty">Kg</span>
                  <span className="tr-amount">Amount</span>
                </div>

                {selectedReceipt.services.map((svc) => (
                  <div className="tr-row tr-item-row" key={svc.id}>
                    <span className="tr-item">
                      {svc.serviceName}
                      <span className="tr-subtext">@ ₱{svc.rate.toFixed(2)}</span>
                    </span>
                    <span className="tr-qty">{svc.kilos}</span>
                    <span className="tr-amount">₱{svc.total.toFixed(2)}</span>
                  </div>
                ))}

                <div className="tr-divider" />

                <div className="tr-row">
                  <span>Subtotal</span>
                  <span>
                    ₱
                    {selectedReceipt.services
                      .reduce((sum, s) => sum + s.total, 0)
                      .toFixed(2)}
                  </span>
                </div>

                {selectedReceipt.extra_charge_type === 'discount' && (
                  <div className="tr-row">
                    <span>Discount</span>
                    <span>-₱{selectedReceipt.discount_amount.toFixed(2)}</span>
                  </div>
                )}

                {selectedReceipt.extra_charge_type === 'express' && (
                  <div className="tr-row">
                    <span>Express Charge</span>
                    <span>+₱100.00</span>
                  </div>
                )}

                <div className="tr-row tr-total">
                  <span>Total</span>
                  <span>₱{selectedTotal.toFixed(2)}</span>
                </div>

                <div className="tr-divider dotted" />

                <div className="tr-row">
                  <span>Payment Method</span>
                  <span>{selectedReceipt.payment_method || '—'}</span>
                </div>
                <div className="tr-row">
                  <span>Paid</span>
                  <span>₱{selectedPaid.toFixed(2)}</span>
                </div>

                {selectedPaid > 0 && (
                  <div className="tr-row">
                    <span>{selectedDiff >= 0 ? 'Change' : 'Balance'}</span>
                    <span>
                      ₱
                      {Math.abs(selectedDiff).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="tr-row">
                  <span>Status</span>
                  <span>{selectedReceipt.inventory_status}</span>
                </div>

                <div className="tr-footer">
                  <p>Thank you for choosing My Laundry Shop!</p>
                  <p>Please keep this receipt for your records.</p>
                </div>
              </div>
            </div>

            <div className="receipt-modal-actions">
              {viewMode === 'view' && (
                <>
                  {selectedReceipt.inventory_status === 'in_shop' && (
                    <button
               onClick={handleMarkPickedUp}
               className="receipt-btn-pickup"
              >
                 <BsCheck /> Mark as Picked Up
                </button>
                  )}
                  {selectedReceipt.inventory_status === 'picked_up' && (
                    <div style={{ color: '#28a745', fontWeight: '600', padding: '10px' }}>
                      ✓ Already Picked Up
                    </div>
                  )}
                </>
              )}
              {viewMode === 'edit' && (
                <>
                  <button
                    onClick={handlePrint}
                    className="receipt-btn-save"
                    disabled={selectedReceipt.inventory_status !== 'picked_up'}
                  >
                    {selectedReceipt.inventory_status === 'picked_up'
                      ? 'Print Receipt'
                      : 'Print (Mark Picked Up First)'}
                  </button>
                  <button
                  onClick={() => setShowArchiveConfirm(true)}
                  className="receipt-btn-archive"
                >
                 Archive Receipt
                </button>
                </>
                
              )}
            </div>
          </div>
        </div>
      )}
      {showArchiveConfirm && selectedReceipt && (
  <div className="confirm-overlay">
    <div className="confirm-modal">
      <h3>Archive Receipt</h3>
      <p>
        Are you sure you want to archive receipt
        <strong> #{selectedReceipt.receipt}</strong>?
      </p>

      <div className="confirm-actions">
        <button
          className="confirm-btn cancel"
          onClick={() => setShowArchiveConfirm(false)}
        >
          Cancel
        </button>

        <button
          className="confirm-btn archive"
          onClick={handleArchiveReceipt}
        >
          Yes, Archive
        </button>
      </div>
    </div>
  </div>
)}

    </DashboardLayout>
  );
};

export default Receiptmanagement;