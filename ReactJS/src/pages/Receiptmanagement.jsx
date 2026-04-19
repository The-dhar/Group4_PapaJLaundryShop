import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DataTable from 'react-data-table-component';
import { BsEye, BsPrinter, BsCheck, BsFlag, BsQuestionCircle } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/dashboardlayout';
import TransactionExtrasSummary from '../components/TransactionExtrasSummary';
import { useTransactions } from '../context/transactionsContext';
import { API_URL } from '../config/api';
import '../styles/receiptstyle.css';
import { jsPDF } from 'jspdf';
import Swal from 'sweetalert2';

/** Blur focused control before Swal so dialogs stack above overlays (see index.css) and reduce aria-hidden warnings. */
function swalFire(options) {
  try {
    document.activeElement?.blur?.();
  } catch {
    /* ignore */
  }
  return Swal.fire(options);
}

const RECEIPT_BACKJOB_IDS_SESSION_KEY = 'receipt_backjob_transaction_ids_v1';

function readBackjobIdsCache() {
  try {
    const raw = sessionStorage.getItem(RECEIPT_BACKJOB_IDS_SESSION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0));
  } catch {
    return new Set();
  }
}

function writeBackjobIdsCache(ids) {
  try {
    sessionStorage.setItem(RECEIPT_BACKJOB_IDS_SESSION_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore quota / private mode
  }
}

function serviceHasPersistedLineId(svc) {
  const n = Number(svc?.id);
  return Number.isFinite(n) && n > 0;
}

/** One issue report per transaction; user still picks which service line it applies to. */
function canCreateIssueReport(receipt, transactionIdsWithReport) {
  const tid = Number(receipt?.id);
  if (!Number.isFinite(tid) || tid <= 0) return false;
  if (transactionIdsWithReport.has(tid)) return false;
  const withIds = (receipt?.services || []).filter(serviceHasPersistedLineId);
  return withIds.length > 0;
}

function receiptLinesMissingPersistedIds(receipt) {
  const svcs = receipt?.services || [];
  if (svcs.length === 0) return true;
  return !svcs.some(serviceHasPersistedLineId);
}

/** Count of service rows with persisted transaction_item ids (matches server line items when in sync). */
function countPersistedServiceLines(receipt) {
  return (receipt?.services || []).filter(serviceHasPersistedLineId).length;
}

function isDamagedOrLostIssueType(type) {
  return type === 'damaged' || type === 'lost';
}

/**
 * Option 2: issue note required for "other", and for damaged/lost when receipt has multiple lines.
 */
function isIssueNoteRequired(issueType, persistedLineCount) {
  if (issueType === 'other') return true;
  if (persistedLineCount > 1 && isDamagedOrLostIssueType(issueType)) return true;
  return false;
}

function formatInventoryStatus(status) {
  if (status == null || status === '') return '—';
  const key = String(status).toLowerCase();
  if (key === 'in_shop') return 'In Shop';
  if (key === 'backjob') return 'Backjob';
  if (key === 'picked_up') return 'Pick Up';
  return String(status)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function openAndAutoPrintPdf(doc) {
  if (!doc) return;

  try {
    if (typeof doc.autoPrint === 'function') {
      doc.autoPrint();
    }
  } catch {
    // continue with fallback print trigger
  }

  const blobUrl = doc.output('bloburl');
  const printWindow = window.open(blobUrl, '_blank');

  if (!printWindow) {
    swalFire({
      title: 'Popup blocked',
      text: 'Allow popups to auto-print the receipt.',
      icon: 'info',
      width: 420,
    });
    return;
  }

  const tryPrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch {
      // Browser PDF viewer may still use embedded print action.
    }
  };

  setTimeout(tryPrint, 450);
  setTimeout(tryPrint, 1300);
}

const Receiptmanagement = () => {
  const navigate = useNavigate();
  const { transactions, archiveTransaction, updateTransaction } = useTransactions();
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInventory, setFilterInventory] = useState('All');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [viewMode, setViewMode] = useState('view'); // 'view' or 'edit'
  const [showReportModal, setShowReportModal] = useState(false);
  const [issueType, setIssueType] = useState('damaged');
  const [issueNote, setIssueNote] = useState('');
  /** Checked transaction_item ids (strings). API still receives one primary id: first checked in receipt line order. */
  const [selectedReportLineIds, setSelectedReportLineIds] = useState([]);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  /** Dispute policy popover: stay open on click (e.g. touch); also show on hover over the (? ) control. */
  const [reportHelpPinned, setReportHelpPinned] = useState(false);
  const [reportHelpHover, setReportHelpHover] = useState(false);
  const reportHelpVisible = reportHelpPinned || reportHelpHover;
  /** Any existing issue report blocks a second report for the same transaction. */
  const [transactionIdsWithIssueReport, setTransactionIdsWithIssueReport] = useState(new Set());
  const [backjobTransactionIds, setBackjobTransactionIds] = useState(() => readBackjobIdsCache());

  const isInShopLike = useCallback(
    (status) => ['in_shop', 'backjob'].includes(String(status || '').toLowerCase()),
    []
  );

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

  const effectiveBackjobTransactionIds = useMemo(() => {
    const next = new Set(backjobTransactionIds);
    transactions.forEach((row) => {
      if (String(row?.inventory_status || '').toLowerCase() === 'backjob') {
        const id = Number(row?.id || 0);
        if (id > 0) next.add(id);
      }
    });
    return next;
  }, [backjobTransactionIds, transactions]);

  const reportableServicesForModal = useMemo(() => {
    if (!selectedReceipt) return [];
    return (selectedReceipt.services || []).filter((s) => serviceHasPersistedLineId(s));
  }, [selectedReceipt]);

  const persistedLineCountForReport = useMemo(() => {
    if (!selectedReceipt || !showReportModal) return 0;
    return countPersistedServiceLines(selectedReceipt);
  }, [selectedReceipt, showReportModal]);

  const issueNoteRequired = useMemo(
    () => isIssueNoteRequired(issueType, persistedLineCountForReport),
    [issueType, persistedLineCountForReport]
  );

  useEffect(() => {
    writeBackjobIdsCache(effectiveBackjobTransactionIds);
  }, [effectiveBackjobTransactionIds]);

  useEffect(() => {
    if (!showReportModal || !reportHelpPinned) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setReportHelpPinned(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showReportModal, reportHelpPinned]);

  const columns = useMemo(() => [
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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className={`status-pill status-${row.inventory_status}`}>
            {formatInventoryStatus(row.inventory_status)}
          </span>
          {effectiveBackjobTransactionIds.has(Number(row.id)) &&
            String(row.inventory_status || '').toLowerCase() !== 'backjob' && (
              <span className="status-pill status-backjob">Backjob</span>
            )}
        </div>
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
  ], [effectiveBackjobTransactionIds]);

  // Generate 58mm thermal-style PDF for the selected receipt
  const handlePrint = () => {
    if (!selectedReceipt) return;
    const txn = selectedReceipt;

    // Always use the detailed paid receipt layout here
    const extrasActive = txn.active_extras || {};
    const slist = txn.sub_extras || {};
    const hasRush =
      txn.is_rush === true ||
      txn.is_rush === 1 ||
      extrasActive.express ||
      (txn.extra_charge_type && txn.extra_charge_type.includes('express'));

    let extraHeight = 0;
    if (hasRush) extraHeight += 4;
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

    if (hasRush) {
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

    openAndAutoPrintPdf(doc);
  };

  const handleArchiveReceipt = () => {
    if (!selectedReceipt) return;

    archiveTransaction(selectedReceipt.id);
    setSelectedReceipt(null);
    setShowArchiveConfirm(false);
  };

  const handleMarkPickedUp = async () => {
    if (!selectedReceipt) return;

    const result = await swalFire({
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

  const resetReportForm = () => {
    setIssueType('damaged');
    setIssueNote('');
    setSelectedReportLineIds([]);
  };

  const toggleReportLine = useCallback((idStr) => {
    setSelectedReportLineIds((prev) => {
      const next = new Set(prev);
      if (next.has(idStr)) next.delete(idStr);
      else next.add(idStr);
      return Array.from(next);
    });
  }, []);

  /** Primary line for API: first service row in receipt order that is checked. */
  const primaryTransactionItemIdFromSelection = useCallback(() => {
    for (const s of reportableServicesForModal) {
      if (selectedReportLineIds.includes(String(s.id))) {
        const n = Number(s.id);
        return Number.isFinite(n) && n > 0 ? n : null;
      }
    }
    return null;
  }, [reportableServicesForModal, selectedReportLineIds]);

  const parseApiError = (payload) => {
    if (!payload || typeof payload !== 'object') return 'Request failed.';
    if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
    if (payload.errors && typeof payload.errors === 'object') {
      const values = Object.values(payload.errors);
      for (const v of values) {
        if (Array.isArray(v) && v.length > 0) return String(v[0]);
        if (typeof v === 'string') return v;
      }
    }
    return 'Request failed.';
  };

  const loadReportedTransactions = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const [issuesRes, backjobsRes] = await Promise.all([
        fetch(`${API_URL}/issue-reports`, { headers }),
        fetch(`${API_URL}/backjobs`, { headers }),
      ]);
      const [issues, backjobs] = await Promise.all([
        issuesRes.ok ? issuesRes.json().catch(() => []) : [],
        backjobsRes.ok ? backjobsRes.json().catch(() => []) : [],
      ]);
      const txnWithReport = new Set();
      (Array.isArray(issues) ? issues : []).forEach((row) => {
        const tid = Number(row?.transaction_id ?? row?.transaction?.id ?? 0);
        if (tid > 0) txnWithReport.add(tid);
      });
      setTransactionIdsWithIssueReport(txnWithReport);
      const nextBackjobs = new Set();
      (Array.isArray(backjobs) ? backjobs : []).forEach((row) => {
        const id = Number(row?.transaction_id || row?.transaction?.id || 0);
        if (id > 0) nextBackjobs.add(id);
      });
      setBackjobTransactionIds(nextBackjobs);
      writeBackjobIdsCache(nextBackjobs);
    } catch {
      // Keep previous cache if refresh fails.
    }
  }, []);

  useEffect(() => {
    loadReportedTransactions();
  }, [loadReportedTransactions]);

  const openReportModal = () => {
    if (!selectedReceipt) return;

    resetReportForm();
    setReportHelpPinned(false);
    setReportHelpHover(false);
    const lines = (selectedReceipt.services || []).filter((s) => serviceHasPersistedLineId(s));
    if (lines.length === 1) {
      setSelectedReportLineIds([String(lines[0].id)]);
    }
    setShowReportModal(true);
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setReportHelpPinned(false);
    setReportHelpHover(false);
    resetReportForm();
  };

  const handleSubmitReport = async () => {
    if (!selectedReceipt) return;
    if (isSubmittingReport) return;

    if (issueType === 'other' && issueNote.trim() === '') {
      await swalFire({ title: 'Missing details', text: 'Please provide issue details for type "other".', icon: 'warning' });
      return;
    }

    const lineCount = countPersistedServiceLines(selectedReceipt);
    if (isIssueNoteRequired(issueType, lineCount) && !issueNote.trim()) {
      await swalFire({
        title: 'Issue note required',
        html:
          lineCount > 1 && isDamagedOrLostIssueType(issueType)
            ? '<p style="text-align:left;margin:0;">This receipt has <strong>multiple service lines</strong>. Describe which line(s) are affected, quantities, and—if both damage and loss appear on different lines—which line has what (see policy in the form).</p>'
            : '<p style="text-align:left;margin:0;">Please enter the issue note.</p>',
        icon: 'warning',
      });
      return;
    }

    const lineId = primaryTransactionItemIdFromSelection();
    if (lineId == null) {
      await swalFire({
        title: 'Select service line(s)',
        text: 'Check at least one service line that this dispute applies to. Use the note for how many damaged/lost per line.',
        icon: 'warning',
      });
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      await swalFire({ title: 'Not authenticated', text: 'Please sign in again.', icon: 'error' });
      return;
    }

    setIsSubmittingReport(true);
    try {
      const orderedAffectedIds = reportableServicesForModal
        .filter((s) => selectedReportLineIds.includes(String(s.id)))
        .map((s) => Number(s.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      const body = {
        transaction_id: selectedReceipt.id,
        transaction_item_id: lineId,
        affected_transaction_item_ids: orderedAffectedIds,
        issue_type: issueType,
        issue_note: issueNote.trim() || null,
      };

      const res = await fetch(`${API_URL}/issue-reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(parseApiError(payload));
      }

      setTransactionIdsWithIssueReport((prev) => {
        const next = new Set(prev);
        next.add(Number(selectedReceipt.id));
        return next;
      });

      // Close the modal immediately after successful submit.
      // (Previously it waited for Swal choice, which looked stuck on "Submitting...".)
      closeReportModal();

      const nextResult = await swalFire({
        title: 'Dispute created',
        text: 'Open the Dispute page now?',
        icon: 'success',
        showCancelButton: true,
        confirmButtonText: 'Go to Dispute',
        cancelButtonText: 'Stay here',
      });

      if (nextResult.isConfirmed) {
        setSelectedReceipt(null);
        navigate('/Reports');
      }
    } catch (e) {
      await swalFire({
        title: 'Could not create report',
        text: e.message || 'Request failed.',
        icon: 'error',
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // compute paid / diff for selected receipt (safe defaults)
  const selectedPaid = selectedReceipt ? Number(selectedReceipt.paid_amount || 0) : 0;
  const selectedTotal = selectedReceipt ? Number(selectedReceipt.amount || 0) : 0;

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
              onClick={() => {
                setSelectedReceipt(null);
                setShowReportModal(false);
              }}
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

                {(selectedReceipt.is_rush === true || selectedReceipt.is_rush === 1 || (selectedReceipt.active_extras || {}).express || (selectedReceipt.extra_charge_type && selectedReceipt.extra_charge_type.includes('express'))) && (
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
                  {receiptLinesMissingPersistedIds(selectedReceipt) ? (
                    <button type="button" className="receipt-btn-report" disabled>
                      <BsFlag /> Cannot report (missing line data)
                    </button>
                  ) : transactionIdsWithIssueReport.has(Number(selectedReceipt.id)) ? (
                    <div className="receipt-report-status-pill" role="status" aria-label="Already reported">
                      <BsFlag aria-hidden /> Already Reported
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openReportModal}
                      className="receipt-btn-report"
                      disabled={isSubmittingReport}
                    >
                      <BsFlag /> Report Dispute
                    </button>
                  )}
                  {isInShopLike(selectedReceipt.inventory_status) && selectedReceipt.payment_status === 'paid' && (
                    <button
                      onClick={handleMarkPickedUp}
                      className="receipt-btn-pickup"
                    >
                      <BsCheck /> Mark as Picked Up
                    </button>
                  )}
                  {isInShopLike(selectedReceipt.inventory_status) && selectedReceipt.payment_status === 'unpaid' && (
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

      {showReportModal && selectedReceipt && (
        <div className="receipt-report-overlay" onClick={closeReportModal}>
          <div className="receipt-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-report-modal-header">
              <h3>Create Report</h3>
              <div
                className="receipt-report-help-anchor"
                onMouseEnter={() => setReportHelpHover(true)}
                onMouseLeave={() => setReportHelpHover(false)}
              >
                <button
                  type="button"
                  className="receipt-report-help-btn"
                  aria-label="Reporting and dispute policy"
                  aria-expanded={reportHelpVisible}
                  title="Show reporting policy"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReportHelpPinned((p) => !p);
                  }}
                >
                  <BsQuestionCircle size={22} aria-hidden />
                </button>
                {reportHelpVisible ? (
                  <div
                    className="receipt-report-help-popover"
                    role="region"
                    aria-label="Reporting instructions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="receipt-report-help-popover-warning">
                      Make sure that the dispute details are correct as this action cannot be edited later on.
                    </p>
                    <strong className="receipt-report-help-popover-title">How reporting works (Option 2)</strong>
                    <ul className="receipt-report-policy-list">
                      <li>
                        <strong>One report per receipt</strong> — Check every service line that has this issue. In the
                        note, say how many damaged/lost per line (or describe clearly if you prefer).
                      </li>
                      <li>
                        <strong>System primary line</strong> — The <strong>topmost checked</strong> line in the list
                        (receipt order) is used for refund limits / linking; add detail in the note if another line
                        should drive resolution.
                      </li>
                      <li>
                        <strong>Dispute type</strong> — One category per report. If damage and loss occur on{' '}
                        <em>different</em> lines, choose <strong>Lost</strong> as the type (more severe) and explain in
                        the note; otherwise use <strong>Damaged</strong> or <strong>Lost</strong> as fits.
                      </li>
                      <li>
                        {persistedLineCountForReport > 1 && isDamagedOrLostIssueType(issueType) ? (
                          <span>
                            This receipt has <strong>multiple lines</strong> — an <strong>issue note is required</strong>{' '}
                            for Damaged/Lost.
                          </span>
                        ) : (
                          <span>
                            Multiple lines + Damaged/Lost: an <strong>issue note is required</strong> to list what
                            happened on each affected line.
                          </span>
                        )}
                      </li>
                    </ul>
                    {reportableServicesForModal.length > 0 ? (
                      <p className="receipt-report-help-popover-extra">
                        Only <strong>checked</strong> lines plus what you write in the note define scope. If only one
                        line had an issue, check that line only.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="receipt-report-sub">
              Receipt: <strong>{selectedReceipt.receipt}</strong> · Customer:{' '}
              <strong>{selectedReceipt.customer_name}</strong>
            </p>

            <label htmlFor="receipt-report-issue-type">Dispute type</label>
            <select
              id="receipt-report-issue-type"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
            >
              <option value="damaged">Damaged</option>
              <option value="lost">Lost</option>
              <option value="poor_quality_cleaning">Poor Quality Cleaning</option>
              <option value="wrinkled_not_folded_well">Wrinkled/ Not Folded Well</option>
              <option value="other">Other</option>
            </select>

            <fieldset className="receipt-report-lines-fieldset">
              <legend className="receipt-report-lines-legend">Service line(s) affected</legend>
              {reportableServicesForModal.length === 0 ? (
                <p className="receipt-report-inline-alert">
                  No service lines with IDs on this receipt. Refresh after upgrading the server if needed.
                </p>
              ) : (
                <div
                  className={
                    reportableServicesForModal.length >= 2
                      ? 'receipt-report-line-grid receipt-report-line-grid--cols2'
                      : 'receipt-report-line-grid'
                  }
                >
                  {reportableServicesForModal.map((s) => {
                    const idStr = String(s.id);
                    const checked = selectedReportLineIds.includes(idStr);
                    return (
                      <div key={s.id} className="receipt-report-line-cell">
                        <label className="receipt-report-line-option">
                          <span className="receipt-report-line-check">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleReportLine(idStr)}
                              aria-label={`Affects ${s.serviceName || 'service line'}`}
                            />
                          </span>
                          <span className="receipt-report-line-option-text">
                            <span className="receipt-report-line-name">{s.serviceName}</span>
                            <span className="receipt-report-line-meta">
                              P{(Number(s.total) || 0).toFixed(2)}
                              {s.piece_count ? ` · ${s.piece_count} pc` : ''}
                            </span>
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}
              {reportableServicesForModal.length > 0 ? (
                <p className="receipt-report-lines-hint">
                  Check each line that applies. Use the note below for how many damaged/lost per line. For system
                  linking/refunds, the <strong>topmost checked line</strong> in this list (receipt order) is used as the
                  primary line.
                </p>
              ) : null}
            </fieldset>

            <label>
              Issue note{' '}
              {issueNoteRequired ? <span className="receipt-report-required-mark">(required)</span> : '(optional)'}
            </label>
            <textarea
              rows={4}
              placeholder={
                persistedLineCountForReport > 1 && isDamagedOrLostIssueType(issueType)
                  ? 'Required: for each checked line, how many damaged/lost (or describe clearly). If only one line checked, say counts for that line.'
                  : 'e.g. 3 damaged on Regular Clothes; or counts per line if you checked more than one.'
              }
              value={issueNote}
              onChange={(e) => setIssueNote(e.target.value)}
              aria-required={issueNoteRequired}
            />

            <div className="receipt-report-actions">
              <button className="receipt-btn-cancel" onClick={closeReportModal} disabled={isSubmittingReport}>
                Cancel
              </button>
              <button
                className="receipt-btn-report-submit"
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
              >
                {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
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