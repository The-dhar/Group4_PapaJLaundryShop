/**
 * CSV + PDF export for the Report page (same data as on-screen filters).
 */
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells) {
  return cells.map(escapeCsvCell).join(',');
}

function uint8ToArrayBuffer(bytes) {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function downloadBlobWeb(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchImageAsDataUrl(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
}

async function loadStoreLogoDataUrl() {
  const candidates = ['/pictures/Papa(1).png', '/logo512.png'];
  for (const path of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const dataUrl = await fetchImageAsDataUrl(path);
    if (dataUrl) return dataUrl;
  }
  return '';
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

export function buildAnalyticsXlsxBytes(payload) {
  const {
    branchName,
    branchId,
    viewTypeLabel,
    rangeStartDate,
    rangeEndDate,
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

  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ["PAPA J'S LAUNDRY SHOP - BRANCH REPORT", '', '', '', ''],
    [`Generated: ${sanitizeDateTime(new Date().toISOString())}`, '', '', '', ''],
    [`Branch: ${branchName || '—'} (ID: ${branchId || '—'})`, '', '', '', ''],
    [`Chart period: ${viewTypeLabel || '—'}`, '', '', '', ''],
    [
      `Custom range: ${sanitizeDateOnly(rangeStartDate)} to ${sanitizeDateOnly(rangeEndDate)}`,
      '',
      '',
      '',
      '',
    ],
    [],
    ['SUMMARY', '', '', '', ''],
    ['Metric', 'Value', '', '', ''],
    ['Total revenue (paid)', Number(revenue || 0).toFixed(2), '', '', ''],
    ['Total losses', Number(losses || 0).toFixed(2), '', '', ''],
    ['Losses — unpaid debit', Number(unpaidAmountTotal || 0).toFixed(2), '', '', ''],
    ['Losses — resolved refunds', Number(refundLossTotal || 0).toFixed(2), '', '', ''],
    ['Branch performance (%)', Number(branchPerformancePct || 0).toFixed(2), '', '', ''],
    ['Total weight processed (kg)', Number(totalWeightProcessed || 0).toFixed(2), '', '', ''],
    ['Debit sales (count)', String(debitCount ?? 0), '', '', ''],
    ['Items in shop (count)', String(inShopCount ?? 0), '', '', ''],
    ['Overdue items (count)', String(overdueCount ?? 0), '', '', ''],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  wsSummary['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 4 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 4 } },
    { s: { r: 6, c: 0 }, e: { r: 6, c: 4 } },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const seriesRows = [
    ['REVENUE SERIES'],
    ['Period', 'Revenue (PHP)', 'Debit amount (PHP)'],
    ...(chartData || []).map((row) => [
      row.name,
      Number(row.revenue || 0).toFixed(2),
      Number(row.unpaid || 0).toFixed(2),
    ]),
    [],
    [`DISPUTES (${disputeTypeLabel || '—'})`],
    ['Period', 'Amount (PHP)'],
    ['Total (est.)', Number(disputeTotal || 0).toFixed(2)],
    ['Resolved cases', String(disputeCount ?? 0)],
    ...(disputeChartData || []).map((row) => [row.name, Number(row.amount || 0).toFixed(2)]),
    [],
    ['LOSS & QUALITY (12 months)'],
    ['Month', 'Refunds (PHP)', 'Backjobs (PHP)'],
    ...(monthlyLossStack12 || []).map((row) => [
      row.name,
      Number(row.refund || 0).toFixed(2),
      Number(row.backjob || 0).toFixed(2),
    ]),
    [],
    ['GROWTH TRENDS (12 months)'],
    ['Month', 'New customers'],
    ...(newCustomersByMonth12 || []).map((row) => [row.name, String(Number(row.count ?? 0))]),
  ];
  const wsSeries = XLSX.utils.aoa_to_sheet(seriesRows);
  wsSeries['!cols'] = [{ wch: 18 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSeries, 'Series');

  const txRows = [
    ['RECENT TRANSACTIONS (same screen rows)'],
    ['Receipt', 'Customer', 'Payment', 'Inventory', 'Amount (PHP)', 'Created date'],
    ...(recentTransactions || []).map((t) => [
      t.receipt || `TXN-${t.id}`,
      t.customer_name || '—',
      String(t.payment_status || '—').toUpperCase(),
      t.inventory_status || '—',
      Number(t.amount || 0).toFixed(2),
      sanitizeDateTime(t.created_at),
    ]),
  ];
  const wsTransactions = XLSX.utils.aoa_to_sheet(txRows);
  wsTransactions['!cols'] = [
    { wch: 16 },
    { wch: 26 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
  ];
  wsTransactions['!autofilter'] = {
    ref: `A2:F${Math.max(2, txRows.length)}`,
  };
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Recent Transactions');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

export function downloadAnalyticsXlsx(payload, filenameBase = 'branch-report') {
  const stamp = new Date().toISOString().slice(0, 10);
  const bytes = buildAnalyticsXlsxBytes(payload);
  const filename = `${filenameBase}-${stamp}.xlsx`;
  downloadBlobWeb(
    new Blob([uint8ToArrayBuffer(bytes)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename
  );
}

function ensureSpace(doc, y, needed, pageHeight, margin) {
  if (y + needed > pageHeight - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function sanitizeDateOnly(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '—';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sanitizeDateTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '—';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function fmtPhp(value) {
  return `PHP ${Number(value || 0).toFixed(2)}`;
}

function ellipsizeCell(doc, value, maxWidth) {
  const text = String(value ?? '—');
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 0 && doc.getTextWidth(`${trimmed}...`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed || '—'}...`;
}

function drawSectionTitle(doc, title, y, margin, maxW, pageH) {
  y = ensureSpace(doc, y, 9, pageH, margin);
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, maxW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(title, margin + 2, y + 5);
  return y + 9;
}

function drawTable(doc, { columns, rows, y, margin, pageH, rowH = 6, headH = 7 }) {
  const drawHead = (yy) => {
    let x = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    columns.forEach((col) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(x, yy, col.width, headH, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(x, yy, col.width, headH);
      doc.setTextColor(30, 41, 59);
      doc.text(col.label, x + 1.5, yy + 4.5);
      x += col.width;
    });
    return yy + headH;
  };

  y = ensureSpace(doc, y, headH + rowH, pageH, margin);
  y = drawHead(y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  rows.forEach((row) => {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
      y = drawHead(y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }

    let x = margin;
    columns.forEach((col) => {
      doc.setDrawColor(226, 232, 240);
      doc.rect(x, y, col.width, rowH);
      const cellRaw = row[col.key] ?? '—';
      const text = ellipsizeCell(doc, cellRaw, col.width - 3);
      if (col.align === 'right') {
        doc.text(text, x + col.width - 1.5, y + 4.2, { align: 'right' });
      } else if (col.align === 'center') {
        doc.text(text, x + col.width / 2, y + 4.2, { align: 'center' });
      } else {
        doc.text(text, x + 1.5, y + 4.2);
      }
      x += col.width;
    });

    y += rowH;
  });

  return y + 3;
}

export async function exportAnalyticsPdf(payload) {
  const {
    branchName,
    branchId,
    viewTypeLabel,
    rangeStartDate,
    rangeEndDate,
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
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const maxW = 186;
  const rightX = margin + maxW;
  const generatedAt = sanitizeDateTime(new Date().toISOString());
  const customRangeLabel = `${sanitizeDateOnly(rangeStartDate)} to ${sanitizeDateOnly(rangeEndDate)}`;
  const logoDataUrl = await loadStoreLogoDataUrl();
  let y = margin;

  doc.setFillColor(30, 64, 175);
  doc.rect(margin, y, maxW, 16, 'F');
  const titleX = logoDataUrl ? margin + 18 : margin + 3;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin + 2.5, y + 2, 12, 12);
    } catch {
      // Ignore invalid image decode errors and continue with text-only header.
    }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Papa J's Laundry Shop", titleX, y + 5.8);
  doc.setFontSize(15);
  doc.text('Branch Report', titleX, y + 12.5);
  y += 18;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, maxW, 21, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Generated: ${generatedAt}`, margin + 2, y + 5);
  doc.text(`Branch: ${branchName || '—'} (ID: ${branchId || '—'})`, margin + 2, y + 10);
  doc.text(`Chart period: ${viewTypeLabel || '—'}`, margin + 2, y + 15);
  doc.text(`Custom range: ${customRangeLabel}`, margin + 2, y + 20);
  y += 24;

  y = drawSectionTitle(doc, 'Summary', y, margin, maxW, pageH);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'metric', label: 'Metric', width: 126 },
      { key: 'value', label: 'Value', width: 60, align: 'right' },
    ],
    rows: [
      { metric: 'Total revenue (paid)', value: fmtPhp(revenue) },
      { metric: 'Total losses', value: fmtPhp(losses) },
      { metric: 'Losses — unpaid debit', value: fmtPhp(unpaidAmountTotal) },
      { metric: 'Losses — resolved refunds', value: fmtPhp(refundLossTotal) },
      { metric: 'Branch performance', value: `${Number(branchPerformancePct).toFixed(1)}%` },
      { metric: 'Total weight processed (kg)', value: Number(totalWeightProcessed || 0).toFixed(2) },
      { metric: 'Debit sales (count)', value: String(debitCount ?? 0) },
      { metric: 'Items in shop', value: String(inShopCount ?? 0) },
      { metric: 'Overdue items', value: String(overdueCount ?? 0) },
    ],
  });

  y = drawSectionTitle(doc, 'Revenue Series', y, margin, maxW, pageH);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'period', label: 'Period', width: 46 },
      { key: 'revenue', label: 'Revenue (PHP)', width: 70, align: 'right' },
      { key: 'debit', label: 'Debit (PHP)', width: 70, align: 'right' },
    ],
    rows: (chartData || []).map((row) => ({
      period: row.name,
      revenue: Number(row.revenue || 0).toFixed(2),
      debit: Number(row.unpaid || 0).toFixed(2),
    })),
  });

  y = drawSectionTitle(doc, `Disputes (${disputeTypeLabel})`, y, margin, maxW, pageH);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'period', label: 'Period', width: 46 },
      { key: 'amount', label: 'Amount (PHP)', width: 70, align: 'right' },
      { key: 'resolved', label: 'Resolved Cases', width: 70, align: 'right' },
    ],
    rows: [
      {
        period: 'Total (est.)',
        amount: Number(disputeTotal || 0).toFixed(2),
        resolved: String(disputeCount ?? 0),
      },
      ...(disputeChartData || []).map((row) => ({
        period: row.name,
        amount: Number(row.amount || 0).toFixed(2),
        resolved: '—',
      })),
    ],
  });

  y = drawSectionTitle(doc, 'Loss & Quality (12 Months)', y, margin, maxW, pageH);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'month', label: 'Month', width: 46 },
      { key: 'refund', label: 'Refunds (PHP)', width: 70, align: 'right' },
      { key: 'backjob', label: 'Backjobs (PHP)', width: 70, align: 'right' },
    ],
    rows: (monthlyLossStack12 || []).map((row) => ({
      month: row.name,
      refund: Number(row.refund || 0).toFixed(2),
      backjob: Number(row.backjob || 0).toFixed(2),
    })),
  });

  y = drawSectionTitle(doc, 'Growth Trends (12 Months)', y, margin, maxW, pageH);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'month', label: 'Month', width: 96 },
      { key: 'count', label: 'New Customers', width: 90, align: 'right' },
    ],
    rows: (newCustomersByMonth12 || []).map((row) => ({
      month: row.name,
      count: String(Number(row.count ?? 0)),
    })),
  });

  y = drawSectionTitle(doc, 'Recent Transactions', y, margin, maxW, pageH);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'receipt', label: 'Receipt', width: 32 },
      { key: 'customer', label: 'Customer', width: 52 },
      { key: 'payment', label: 'Payment', width: 24, align: 'center' },
      { key: 'inventory', label: 'Inventory', width: 30, align: 'center' },
      { key: 'amount', label: 'Amount (PHP)', width: 30, align: 'right' },
      { key: 'created', label: 'Created', width: 18, align: 'center' },
    ],
    rows: (recentTransactions || []).map((t) => ({
      receipt: t.receipt || `TXN-${t.id}`,
      customer: t.customer_name || '—',
      payment: String(t.payment_status || '—').toUpperCase(),
      inventory: t.inventory_status || '—',
      amount: Number(t.amount || 0).toFixed(2),
      created: sanitizeDateOnly(t.created_at),
    })),
    rowH: 6,
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${pages}`, rightX, pageH - 4, { align: 'right' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`branch-report-${stamp}.pdf`);
}
