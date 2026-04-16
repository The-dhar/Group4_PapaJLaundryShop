/**
 * CSV + PDF export for the Report page (same data as on-screen filters).
 */
import { jsPDF } from 'jspdf';

function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells) {
  return cells.map(escapeCsvCell).join(',');
}

/**
 * @param {object} payload
 */
export function buildAnalyticsCsv(payload) {
  const lines = [];
  const {
    branchName,
    branchId,
    viewTypeLabel,
    paidTotal,
    totalRevenue,
    unpaidAmountTotal = 0,
    refundLossTotal = 0,
    totalLosses: totalLossesRaw,
    branchPerformancePct = 0,
    debitCount,
    inShopCount,
    overdueCount,
    disputeTypeLabel,
    disputeTotal,
    disputeCount,
    chartData,
    disputeChartData,
    recentTransactions,
    totalWeightProcessed = 0,
    monthlyLossStack12 = [],
    newCustomersByMonth12 = [],
  } = payload;

  const revenue = Number(totalRevenue ?? paidTotal);
  const losses =
    totalLossesRaw != null && totalLossesRaw !== ''
      ? Number(totalLossesRaw)
      : Number(unpaidAmountTotal) + Number(refundLossTotal);

  lines.push(csvRow(['Papa J Laundry Shop - Branch Report']));
  lines.push(csvRow(['Generated', new Date().toISOString()]));
  lines.push([]);
  lines.push(csvRow(['Branch name', branchName]));
  lines.push(csvRow(['Branch ID', branchId]));
  lines.push(csvRow(['Chart period', viewTypeLabel]));
  lines.push([]);
  lines.push(csvRow(['SUMMARY']));
  lines.push(csvRow(['Metric', 'Value']));
  lines.push(csvRow(['Total revenue (paid orders, PHP)', revenue.toFixed(2)]));
  lines.push(csvRow(['Total losses (PHP)', losses.toFixed(2)]));
  lines.push(csvRow(['Losses — unpaid debit (PHP)', Number(unpaidAmountTotal).toFixed(2)]));
  lines.push(csvRow(['Losses — resolved refunds (PHP)', Number(refundLossTotal).toFixed(2)]));
  lines.push(csvRow(['Branch performance (%)', Number(branchPerformancePct).toFixed(2)]));
  lines.push(csvRow(['Total weight processed (kg, this period)', Number(totalWeightProcessed).toFixed(2)]));
  lines.push(csvRow(['Debit sales (unpaid orders count)', debitCount]));
  lines.push(csvRow(['Items in shop (count)', inShopCount]));
  lines.push(csvRow(['Overdue items (count)', overdueCount]));
  lines.push([]);
  lines.push(csvRow(['REVENUE CHART SERIES']));
  lines.push(csvRow(['Period', 'Revenue (PHP)', 'Debit amount (PHP)']));
  (chartData || []).forEach((row) => {
    lines.push(csvRow([row.name, Number(row.revenue || 0).toFixed(2), Number(row.unpaid || 0).toFixed(2)]));
  });
  lines.push([]);
  lines.push(csvRow(['DISPUTES', disputeTypeLabel]));
  lines.push(csvRow(['Total amount (est., PHP)', Number(disputeTotal).toFixed(2)]));
  lines.push(csvRow(['Resolved cases (count)', disputeCount]));
  lines.push(csvRow(['DISPUTE CHART SERIES']));
  lines.push(csvRow(['Period', 'Amount (PHP)']));
  (disputeChartData || []).forEach((row) => {
    lines.push(csvRow([row.name, Number(row.amount || 0).toFixed(2)]));
  });
  lines.push([]);
  lines.push(csvRow(['LOSS & QUALITY (last 12 months, resolved disputes by month)']));
  lines.push(csvRow(['Month', 'Refunds (PHP)', 'Backjobs / replacement (PHP)']));
  (monthlyLossStack12 || []).forEach((row) => {
    lines.push(
      csvRow([
        row.name,
        Number(row.refund || 0).toFixed(2),
        Number(row.backjob || 0).toFixed(2),
      ])
    );
  });
  lines.push([]);
  lines.push(csvRow(['GROWTH TRENDS (last 12 months, new customers by first order month)']));
  lines.push(csvRow(['Month', 'New customers (count)']));
  (newCustomersByMonth12 || []).forEach((row) => {
    lines.push(csvRow([row.name, String(row.count ?? 0)]));
  });
  lines.push([]);
  lines.push(csvRow(['RECENT TRANSACTIONS (up to 8, same as screen)']));
  lines.push(csvRow(['Receipt', 'Customer', 'Payment', 'Inventory', 'Amount (PHP)', 'Created date']));
  (recentTransactions || []).forEach((t) => {
    lines.push(
      csvRow([
        t.receipt || `TXN-${t.id}`,
        t.customer_name || '—',
        t.payment_status || '—',
        t.inventory_status || '—',
        Number(t.amount || 0).toFixed(2),
        t.created_at ? new Date(t.created_at).toISOString() : '—',
      ])
    );
  });

  const body = lines.map((line) => (Array.isArray(line) ? csvRow(line) : line)).join('\r\n');
  return `\uFEFF${body}`;
}

export function downloadAnalyticsCsv(csvString, filenameBase = 'branch-report') {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}-${stamp}.csv`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ensureSpace(doc, y, needed, pageHeight, margin) {
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin + 10;
  }
  return y;
}

export function exportAnalyticsPdf(payload) {
  const {
    branchName,
    branchId,
    viewTypeLabel,
    paidTotal,
    totalRevenue,
    unpaidAmountTotal = 0,
    refundLossTotal = 0,
    totalLosses: totalLossesRaw,
    branchPerformancePct = 0,
    debitCount,
    inShopCount,
    overdueCount,
    disputeTypeLabel,
    disputeTotal,
    disputeCount,
    chartData,
    disputeChartData,
    recentTransactions,
    totalWeightProcessed = 0,
    monthlyLossStack12 = [],
    newCustomersByMonth12 = [],
  } = payload;

  const revenue = Number(totalRevenue ?? paidTotal);
  const losses =
    totalLossesRaw != null && totalLossesRaw !== ''
      ? Number(totalLossesRaw)
      : Number(unpaidAmountTotal) + Number(refundLossTotal);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxW = pageW - margin * 2;
  let y = margin;
  const lh = 5;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Branch Report', margin, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
  y += lh + 2;

  const metaLines = [`Branch: ${branchName} (ID: ${branchId})`, `Chart period: ${viewTypeLabel}`];
  metaLines.forEach((line) => {
    const parts = doc.splitTextToSize(line, maxW);
    parts.forEach((p) => {
      y = ensureSpace(doc, y, lh, pageH, margin);
      doc.text(p, margin, y);
      y += lh;
    });
  });
  y += 4;

  y = ensureSpace(doc, y, 20, pageH, margin);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, y);
  y += lh + 2;
  doc.setFont('helvetica', 'normal');
  const summaryRows = [
    ['Total revenue (paid)', `PHP ${revenue.toFixed(2)}`],
    ['Total losses', `PHP ${losses.toFixed(2)}`],
    ['  — unpaid debit', `PHP ${Number(unpaidAmountTotal).toFixed(2)}`],
    ['  — resolved refunds', `PHP ${Number(refundLossTotal).toFixed(2)}`],
    ['Branch performance', `${Number(branchPerformancePct).toFixed(1)}%`],
    ['Total weight processed (kg, this period)', Number(totalWeightProcessed).toFixed(2)],
    ['Debit sales (count)', String(debitCount)],
    ['Items in shop', String(inShopCount)],
    ['Overdue items', String(overdueCount)],
  ];
  summaryRows.forEach(([k, v]) => {
    y = ensureSpace(doc, y, lh, pageH, margin);
    doc.text(`${k}: ${v}`, margin, y);
    y += lh;
  });
  y += 4;

  y = ensureSpace(doc, y, 30, pageH, margin);
  doc.setFont('helvetica', 'bold');
  doc.text('Revenue series', margin, y);
  y += lh + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  (chartData || []).forEach((row) => {
    const line = `${row.name}: Revenue PHP ${Number(row.revenue || 0).toFixed(2)} | Debit PHP ${Number(row.unpaid || 0).toFixed(2)}`;
    const parts = doc.splitTextToSize(line, maxW);
    parts.forEach((p) => {
      y = ensureSpace(doc, y, lh, pageH, margin);
      doc.text(p, margin, y);
      y += lh;
    });
  });
  doc.setFontSize(9);
  y += 4;

  y = ensureSpace(doc, y, 25, pageH, margin);
  doc.setFont('helvetica', 'bold');
  doc.text(`Disputes (${disputeTypeLabel})`, margin, y);
  y += lh + 2;
  doc.setFont('helvetica', 'normal');
  doc.text(`Total (est.): PHP ${Number(disputeTotal).toFixed(2)} | Resolved: ${disputeCount}`, margin, y);
  y += lh + 2;
  doc.setFontSize(8);
  (disputeChartData || []).forEach((row) => {
    const line = `${row.name}: PHP ${Number(row.amount || 0).toFixed(2)}`;
    y = ensureSpace(doc, y, lh, pageH, margin);
    doc.text(line, margin, y);
    y += lh;
  });
  doc.setFontSize(9);
  y += 4;

  y = ensureSpace(doc, y, 25, pageH, margin);
  doc.setFont('helvetica', 'bold');
  doc.text('Loss & quality (12 months)', margin, y);
  y += lh + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  (monthlyLossStack12 || []).forEach((row) => {
    const line = `${row.name}: Refunds PHP ${Number(row.refund || 0).toFixed(2)} | Backjobs PHP ${Number(row.backjob || 0).toFixed(2)}`;
    const parts = doc.splitTextToSize(line, maxW);
    parts.forEach((p) => {
      y = ensureSpace(doc, y, lh, pageH, margin);
      doc.text(p, margin, y);
      y += lh;
    });
  });
  doc.setFontSize(9);
  y += 4;

  y = ensureSpace(doc, y, 22, pageH, margin);
  doc.setFont('helvetica', 'bold');
  doc.text('Growth trends (12 months)', margin, y);
  y += lh + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  (newCustomersByMonth12 || []).forEach((row) => {
    const line = `${row.name}: ${Number(row.count ?? 0)} new customers`;
    y = ensureSpace(doc, y, lh, pageH, margin);
    doc.text(line, margin, y);
    y += lh;
  });
  doc.setFontSize(9);
  y += 4;

  y = ensureSpace(doc, y, 25, pageH, margin);
  doc.setFont('helvetica', 'bold');
  doc.text('Recent transactions', margin, y);
  y += lh + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  (recentTransactions || []).forEach((t) => {
    const receipt = t.receipt || `TXN-${t.id}`;
    const line = `${receipt} | ${(t.customer_name || '—').slice(0, 24)} | ${t.payment_status} | ${t.inventory_status} | PHP ${Number(t.amount || 0).toFixed(2)}`;
    const parts = doc.splitTextToSize(line, maxW);
    parts.forEach((p) => {
      y = ensureSpace(doc, y, lh, pageH, margin);
      doc.text(p, margin, y);
      y += lh;
    });
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`branch-report-${stamp}.pdf`);
}
