import React, { useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import { BsEye, BsPrinter, BsCheck } from 'react-icons/bs';
import DashboardLayout from '../components/dashboardlayout';
import TransactionExtrasSummary from '../components/TransactionExtrasSummary';
import { useTransactions } from '../context/transactionsContext';
import '../styles/receiptstyle.css';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

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

const Receiptmanagement = () => {
  const { transactions, archiveTransaction, updateTransaction } = useTransactions();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInventory, setFilterInventory] = useState('All');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [viewMode, setViewMode] = useState('view'); // 'view' or 'edit'

  // Receipt Management: paid transactions only (unpaid belong in POS / collection flow)
  const readyReceipts = useMemo(
    () =>
      transactions.filter((txn) => {
        if (txn.archived) return false;
        const ps = String(txn.payment_status || '').toLowerCase();
        return ps === 'paid';
      }),
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
        <span className={`status-pill status-${row.inventory_status}`}>
          {formatInventoryStatus(row.inventory_status)}
        </span>
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
    const txn = selectedReceipt;

    // Always use the detailed paid receipt layout here
    const extrasActive = txn.active_extras || {};
    const slist = txn.sub_extras || {};

    let extraHeight = 0;
    if (extrasActive.express || (txn.extra_charge_type && txn.extra_charge_type.includes('express'))) extraHeight += 4;
    if (slist.extra_detergent) extraHeight += 4;
    if (slist.extra_softener) extraHeight += 4;
    if (slist.stain_removal) extraHeight += 4;
    if (txn.additional_amount > 0) extraHeight += 4;
    if (txn.discount_amount > 0) extraHeight += 4;

    const baseHeight = 130;
    const itemHeight = (txn.services || []).length * 12;
    const dynamicHeight = baseHeight + itemHeight + extraHeight;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, dynamicHeight] });
    let y = 8;

    const centerText = (text, yPos, size = 8) => {
      doc.setFontSize(size);
      doc.text(text, 29, yPos, { align: 'center' });
    };

    // Header
    doc.setFont('courier', 'bold');
    centerText("PAPA J'S LAUNDRY SHOP", y, 10);
    y += 4;


    y += 6;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);

    y += 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(`RCPT NO : ${txn.receipt || 'RCPT-100001'}`, 2, y);
    y += 4;
    doc.setFont('courier', 'normal');
    doc.text(`DATE    : ${new Date(txn.created_at || Date.now()).toLocaleDateString()}`, 2, y);
    y += 4;
    doc.text(`DUE DATE: ${txn.due_date}`, 2, y);

    y += 4;
    doc.text(`NAME    : ${txn.customer_name}`, 2, y);
    y += 4;

    const splitAddress = doc.splitTextToSize(`ADDRESS : ${txn.customer_address}`, 54);
    doc.text(splitAddress, 2, y);
    y += (splitAddress.length * 4);

    y += 2;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 5;

    // Items
    doc.setFont('courier', 'bold');
    doc.text("QTY/KG", 2, y);
    doc.text("ITEM", 16, y);
    doc.text("TOTAL", 56, y, { align: 'right' });
    y += 2;
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 4;

    doc.setFont('courier', 'normal');
    let computedSubtotal = 0;
    (txn.services || []).forEach(svc => {
      doc.setFontSize(8);
      doc.text(`${svc.kilos || 0}kg`, 2, y);

      const itemName = doc.splitTextToSize(`${svc.serviceName || ''}`, 28);
      doc.text(itemName, 16, y);

      doc.text(`P${(svc.rate || 0).toFixed(2)}`, 56, y, { align: 'right' });
      computedSubtotal += (svc.rate || 0);
      y += (itemName.length * 4);

      if (svc.notes) {
        doc.setFontSize(7);
        const notes = doc.splitTextToSize(`Note: ${svc.notes}`, 40);
        doc.text(notes, 16, y);
        y += (notes.length * 3.5);
      }
    });

    y += 2;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 5;

    // Totals and Extras
    doc.setFontSize(8);
    doc.text("Subtotal:", 2, y);
    doc.text(`P${computedSubtotal.toFixed(2)}`, 56, y, { align: 'right' });
    y += 4;

    if (extrasActive.express || (txn.extra_charge_type && txn.extra_charge_type.includes('express'))) {
      doc.text("Rush Charge:", 2, y);
      doc.text("P100.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.extra_detergent > 0) {
      doc.text(`Extra Detergent (x${slist.extra_detergent}):`, 2, y);
      doc.text(`P${(20 * slist.extra_detergent).toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    } else if (slist.extra_detergent === true) {
      doc.text("Extra Detergent:", 2, y);
      doc.text("P20.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.extra_softener > 0) {
      doc.text(`Extra Softener (x${slist.extra_softener}):`, 2, y);
      doc.text(`P${(20 * slist.extra_softener).toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    } else if (slist.extra_softener === true) {
      doc.text("Extra Softener:", 2, y);
      doc.text("P20.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.stain_removal) {
      doc.text("Stain Removal:", 2, y);
      doc.text("P50.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (txn.additional_amount > 0) {
      doc.text("Other Additional:", 2, y);
      doc.text(`P${txn.additional_amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    if (txn.discount_amount > 0) {
      doc.text("Discount:", 2, y);
      doc.text(`-P${txn.discount_amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    y += 2;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text("TOTAL PAYMENT:", 2, y);
    doc.text(`P${(txn.amount || 0).toFixed(2)}`, 56, y, { align: 'right' });

    y += 6;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);

    // Payment Status Information
    doc.text("PAYMENT STATUS:", 2, y);
    doc.setFont('courier', 'bold');
    doc.text((txn.payment_status || '').toUpperCase(), 56, y, { align: 'right' });
    y += 4;

    if (txn.payment_status === 'paid') {
      doc.setFont('courier', 'normal');
      doc.text("Amount Paid:", 2, y);
      doc.text(`P${(txn.paid_amount || 0).toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;

      const change = (txn.paid_amount || 0) - (txn.amount || 0);
      if (change > 0) {
        doc.text("Change:", 2, y);
        doc.text(`P${change.toFixed(2)}`, 56, y, { align: 'right' });
        y += 4;
      }
    } else {
      doc.setFont('courier', 'bold');
      doc.text("BALANCE DUE:", 2, y);
      doc.text(`P${(txn.amount || 0).toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    y += 4;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 6;

    // Footer
    centerText("Thank you for choosing", y, 7);
    y += 4;
    centerText("Papa J's Laundry Shop!", y, 7);
    y += 6;

    doc.setFont('courier', 'italic');
    doc.setFontSize(6);
    centerText("This is not an official receipt.", y, 6);

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl);
  };

  const handleArchiveReceipt = () => {
    if (!selectedReceipt) return;

    archiveTransaction(selectedReceipt.id);
    setSelectedReceipt(null);
    setShowArchiveConfirm(false);
  };

  const handleMarkPickedUp = async () => {
    if (!selectedReceipt) return;

    const result = await Swal.fire({
      title: 'Mark as Picked Up?',
      text: `Receipt ${selectedReceipt.receipt} will be marked as picked up.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, mark picked up',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#16a34a',
      width: 420,
    });

    if (!result.isConfirmed) return;

    await updateTransaction(selectedReceipt.id, {
      inventory_status: 'picked_up'
    });
    setSelectedReceipt({
      ...selectedReceipt,
      inventory_status: 'picked_up'
    });
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
              noDataComponent="No paid receipts yet. Record payment in POS or Transaction Log first."
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
            <div style={{ padding: '0 12px 12px', textAlign: 'left' }}>
              <TransactionExtrasSummary txn={selectedReceipt} />
            </div>
            <div className="thermal-receipt">
              <div className="tr-header">
                <h3 className="tr-shop-name">PAPA J'S LAUNDRY SHOP</h3>
                <p className="tr-shop-line" style={{ textTransform: 'none' }}>PAPA J'S LAUNDRY SHOP</p>
                <div className="tr-divider dashed" style={{ borderTop: '1px dashed #333', background: 'none', height: '0', margin: '6px 0' }} />
                <div className="tr-row tr-meta" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span>RCPT NO : {selectedReceipt.receipt || 'RCPT-100001'}</span>
                  <span>DATE    : {new Date(selectedReceipt.created_at || Date.now()).toLocaleDateString()}</span>
                  <span>DUE DATE: {selectedReceipt.due_date}</span>
                  <div style={{ height: '4px' }} />
                  <span>NAME    : {selectedReceipt.customer_name}</span>
                  <span style={{ wordWrap: 'break-word' }}>ADDRESS : {selectedReceipt.customer_address}</span>
                </div>
                <div className="tr-divider dashed" style={{ borderTop: '1px dashed #333', background: 'none', height: '0', margin: '6px 0' }} />
              </div>

              <div className="tr-body">
                <div className="tr-row tr-head" style={{ fontWeight: 'bold' }}>
                  <span className="tr-qty" style={{ flex: '0.4', textAlign: 'left' }}>QTY/KG</span>
                  <span className="tr-item" style={{ flex: '1', textAlign: 'left' }}>ITEM</span>
                  <span className="tr-amount" style={{ flex: '0.6', textAlign: 'right' }}>TOTAL</span>
                </div>
                <div className="tr-divider solid" style={{ borderTop: '1px solid #333', background: 'none', height: '0', margin: '2px 0' }} />

                {(selectedReceipt.services || []).map((svc) => (
                  <div className="tr-row tr-item-row" key={svc.id} style={{ alignItems: 'flex-start', margin: '4px 0' }}>
                    <span className="tr-qty" style={{ flex: '0.4', textAlign: 'left' }}>{svc.kilos || 0}kg</span>
                    <span className="tr-item" style={{ flex: '1', textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
                      <span>{svc.serviceName}</span>
                      {svc.notes && <span style={{ fontSize: '0.8em', color: '#555', marginTop: '2px' }}>Note: {svc.notes}</span>}
                    </span>
                    <span className="tr-amount" style={{ flex: '0.6', textAlign: 'right' }}>P{(svc.rate || 0).toFixed(2)}</span>
                  </div>
                ))}

                <div className="tr-divider dashed" style={{ borderTop: '1px dashed #333', background: 'none', height: '0', margin: '6px 0' }} />

                <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                  <span>Subtotal:</span>
                  <span>P{((selectedReceipt.services || []).reduce((sum, s) => sum + (s.rate || 0), 0)).toFixed(2)}</span>
                </div>

                {((selectedReceipt.active_extras || {}).express || (selectedReceipt.extra_charge_type && selectedReceipt.extra_charge_type.includes('express'))) && (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                    <span>Rush Charge:</span>
                    <span>P100.00</span>
                  </div>
                )}

                {(selectedReceipt.sub_extras || {}).extra_detergent > 0 ? (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                    <span>Extra Detergent (x{(selectedReceipt.sub_extras || {}).extra_detergent}):</span>
                    <span>P{(20 * (selectedReceipt.sub_extras || {}).extra_detergent).toFixed(2)}</span>
                  </div>
                ) : (selectedReceipt.sub_extras || {}).extra_detergent === true && (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                    <span>Extra Detergent:</span>
                    <span>P20.00</span>
                  </div>
                )}

                {(selectedReceipt.sub_extras || {}).extra_softener > 0 ? (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                    <span>Extra Softener (x{(selectedReceipt.sub_extras || {}).extra_softener}):</span>
                    <span>P{(20 * (selectedReceipt.sub_extras || {}).extra_softener).toFixed(2)}</span>
                  </div>
                ) : (selectedReceipt.sub_extras || {}).extra_softener === true && (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                    <span>Extra Softener:</span>
                    <span>P20.00</span>
                  </div>
                )}

                {(selectedReceipt.sub_extras || {}).stain_removal && (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                    <span>Stain Removal:</span>
                    <span>P50.00</span>
                  </div>
                )}

                {selectedReceipt.additional_amount > 0 && (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                    <span>Other Additional:</span>
                    <span>P{selectedReceipt.additional_amount.toFixed(2)}</span>
                  </div>
                )}

                {selectedReceipt.discount_amount > 0 && (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                    <span>Discount:</span>
                    <span>-P{selectedReceipt.discount_amount.toFixed(2)}</span>
                  </div>
                )}

                <div className="tr-row tr-total" style={{ fontWeight: 'bold', fontSize: '1.2em', margin: '4px 0' }}>
                  <span>TOTAL PAYMENT:</span>
                  <span>P{selectedTotal.toFixed(2)}</span>
                </div>

                <div style={{ height: '6px' }} />

                <div className="tr-row" style={{ fontSize: '0.9em' }}>
                  <span>PAYMENT STATUS:</span>
                  <span style={{ fontWeight: 'bold' }}>{(selectedReceipt.payment_status || '').toUpperCase()}</span>
                </div>

                {selectedReceipt.payment_status === 'paid' ? (
                  <>
                    <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                      <span>Amount Paid:</span>
                      <span>P{selectedPaid.toFixed(2)}</span>
                    </div>
                    {selectedPaid - selectedTotal > 0 && (
                      <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0' }}>
                        <span>Change:</span>
                        <span>P{(selectedPaid - selectedTotal).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="tr-row" style={{ fontSize: '0.9em', padding: '2px 0', fontWeight: 'bold' }}>
                    <span>BALANCE DUE:</span>
                    <span>P{selectedTotal.toFixed(2)}</span>
                  </div>
                )}

                <div className="tr-divider dashed" style={{ borderTop: '1px dashed #333', background: 'none', height: '0', margin: '6px 0' }} />

                <div className="tr-footer" style={{ marginTop: '10px' }}>
                  <p>Thank you for choosing</p>
                  <p>Papa J's Laundry Shop!</p>
                  <p style={{ fontSize: '0.8em', fontStyle: 'italic', marginTop: '6px', textTransform: 'none' }}>This is not an official receipt.</p>
                </div>
              </div>
            </div>

            <div className="receipt-modal-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              {viewMode === 'view' && (
                <>
                  {selectedReceipt.inventory_status === 'in_shop' && selectedReceipt.payment_status === 'paid' && (
                    <button
                      onClick={handleMarkPickedUp}
                      className="receipt-btn-pickup"
                    >
                      <BsCheck /> Mark as Picked Up
                    </button>
                  )}
                  {selectedReceipt.inventory_status === 'in_shop' && selectedReceipt.payment_status === 'unpaid' && (
                    <div style={{ color: '#dc3545', fontWeight: 'bold', padding: '10px', textAlign: 'center' }}>
                      Cannot mark picked up (Transaction requires payment first)
                    </div>
                  )}
                  {selectedReceipt.inventory_status === 'picked_up' && (
                    <div style={{ color: '#28a745', fontWeight: '600', padding: '10px' }}>
                      ✓ Already Picked Up
                    </div>
                  )}
                </>
              )}
              {viewMode === 'edit' && (
                <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center' }}>
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
                </div>
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