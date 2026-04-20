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

/** Full-width separator row (reads as one column in Excel). */
function csvRuleLine() {
  return csvRow(['------------------------------------------------------------']);
}

function fmtIsoReadable(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

function fmtDateInput(ymd) {
  const s = String(ymd || '').trim();
  if (!s) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try {
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', { dateStyle: 'medium' });
  } catch {
    return '—';
  }
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
  const candidates = ['/assets/images/papaj-logo.png', '/logo512.png'];
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
    rangeStartDate = '',
    rangeEndDate = '',
    viewWindowStartIso = '',
    viewWindowEndIso = '',
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
    monthlyLossRefundRows = [],
    monthlyLossBackjobRows = [],
    newCustomersByMonth12 = [],
    customersGrowthByMonth = [],
    rushRegularChartData = [],
  } = payload;

  const revenue = Number(totalRevenue ?? paidTotal);
  const losses =
    totalLossesRaw != null && totalLossesRaw !== ''
      ? Number(totalLossesRaw)
      : Number(unpaidAmountTotal) + Number(refundLossTotal);

  const generatedDisplay = new Date().toLocaleString('en-PH', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // ——— Cover & document information ———
  lines.push(csvRow(['PAPA J LAUNDRY SHOP']));
  lines.push(csvRow(['Branch performance report']));
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push([]);
  lines.push(csvRow(['DOCUMENT INFORMATION']));
  lines.push(csvRow(['Field', 'Detail']));
  lines.push(csvRow(['Report generated', generatedDisplay]));
  lines.push(csvRow(['Branch name', branchName ?? '—']));
  lines.push(csvRow(['Branch ID', String(branchId ?? '—')]));
  lines.push(csvRow(['Chart period (view)', String(viewTypeLabel ?? '—')]));
  lines.push(csvRow(['Custom filter — start date', fmtDateInput(rangeStartDate)]));
  lines.push(csvRow(['Custom filter — end date', fmtDateInput(rangeEndDate)]));
  lines.push(csvRow(['Analysis window — start', fmtIsoReadable(viewWindowStartIso)]));
  lines.push(csvRow(['Analysis window — end', fmtIsoReadable(viewWindowEndIso)]));
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push([]);

  // SECTION 1 — Executive summary (key metrics)
  lines.push(csvRow(['SECTION 1 – Executive summary']));
  lines.push(csvRow(['Metric', 'Value']));
  lines.push(csvRow(['Total revenue, paid orders (PHP)', revenue.toFixed(2)]));
  lines.push(csvRow(['Total losses (PHP)', losses.toFixed(2)]));
  lines.push(csvRow(['Losses, unpaid debit (PHP)', Number(unpaidAmountTotal).toFixed(2)]));
  lines.push(csvRow(['Losses, resolved refunds (PHP)', Number(refundLossTotal).toFixed(2)]));
  lines.push(csvRow(['Branch performance (%)', Number(branchPerformancePct).toFixed(2)]));
  lines.push(csvRow(['Total weight processed (kg)', Number(totalWeightProcessed).toFixed(2)]));
  lines.push(csvRow(['Debit sales, unpaid order count', String(debitCount ?? '—')]));
  lines.push(csvRow(['Items in shop (count)', String(inShopCount ?? '—')]));
  lines.push(csvRow(['Overdue items (count)', String(overdueCount ?? '—')]));
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push([]);

  // SECTION 2 — Revenue by period
  lines.push(csvRow(['SECTION 2 – Revenue by period (same as chart)']));
  lines.push(csvRow(['Period', 'Revenue (PHP)', 'Debit amount (PHP)']));
  (chartData || []).forEach((row) => {
    lines.push(csvRow([row.name, Number(row.revenue || 0).toFixed(2), Number(row.unpaid || 0).toFixed(2)]));
  });
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push([]);

  // SECTION 3 — Disputes
  lines.push(csvRow(['SECTION 3 – Disputes (resolved)']));
  lines.push(csvRow(['Description', 'Value']));
  lines.push(csvRow(['Scope', String(disputeTypeLabel ?? '—')]));
  lines.push(csvRow(['Total dispute amount estimate (PHP)', Number(disputeTotal || 0).toFixed(2)]));
  lines.push(csvRow(['Resolved cases (count)', String(disputeCount ?? '—')]));
  lines.push([]);
  lines.push(csvRow(['Amount by period (aligned to dispute chart)']));
  lines.push(csvRow(['Period', 'Amount (PHP)']));
  (disputeChartData || []).forEach((row) => {
    lines.push(csvRow([row.name, Number(row.amount || 0).toFixed(2)]));
  });
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push([]);

  // SECTION 4 — Loss & quality
  lines.push(csvRow(['SECTION 4 – Loss and quality, monthly totals (PHP)']));
  lines.push(csvRow(['Month', 'Refunds (PHP)', 'Backjobs / replacement (PHP)']));
  (monthlyLossStack12 || []).forEach((row) => {
    lines.push(
      csvRow([row.name, Number(row.refund || 0).toFixed(2), Number(row.backjob || 0).toFixed(2)])
    );
  });
  lines.push([]);
  lines.push(csvRow(['SECTION 4a – Refunds by issue reason (PHP)']));
  lines.push(csvRow(['Month', 'Damaged', 'Lost', 'Other']));
  (monthlyLossRefundRows || []).forEach((row) => {
    lines.push(
      csvRow([
        row.name,
        Number(row.Damaged || 0).toFixed(2),
        Number(row.Lost || 0).toFixed(2),
        Number(row.Other || 0).toFixed(2),
      ])
    );
  });
  lines.push([]);
  lines.push(csvRow(['SECTION 4b – Backjobs by issue reason (PHP)']));
  lines.push(csvRow(['Month', 'Poor quality', 'Wrinkled / not folded', 'Other']));
  (monthlyLossBackjobRows || []).forEach((row) => {
    lines.push(
      csvRow([
        row.name,
        Number(row.PoorQuality || 0).toFixed(2),
        Number(row.Wrinkled || 0).toFixed(2),
        Number(row.Other || 0).toFixed(2),
      ])
    );
  });
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push([]);

  const growthRows =
    customersGrowthByMonth && customersGrowthByMonth.length
      ? customersGrowthByMonth
      : (newCustomersByMonth12 || []).map((r) => ({
          name: r.name,
          newCustomers: r.count ?? 0,
          returningCustomers: 0,
        }));

  // SECTION 5 — Growth
  lines.push(csvRow(['SECTION 5 – Customer growth (by month)']));
  lines.push(csvRow(['Month', 'New customers', 'Active returning customers']));
  growthRows.forEach((row) => {
    lines.push(csvRow([row.name, String(row.newCustomers ?? 0), String(row.returningCustomers ?? 0)]));
  });
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push([]);

  // SECTION 6 — Rush vs regular
  lines.push(csvRow(['SECTION 6 – Rush vs regular paid revenue (PHP)']));
  lines.push(csvRow(['Period', 'Rush (PHP)', 'Regular (PHP)']));
  (rushRegularChartData || []).forEach((row) => {
    lines.push(
      csvRow([row.name, Number(row.rush || 0).toFixed(2), Number(row.regular || 0).toFixed(2)])
    );
  });
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push([]);

  // SECTION 7 — Recent transactions
  lines.push(csvRow(['SECTION 7 – Recent transactions (on screen)']));
  lines.push(csvRow(['Receipt ID', 'Customer', 'Payment', 'Inventory status', 'Amount (PHP)', 'Created']));
  (recentTransactions || []).forEach((t) => {
    lines.push(
      csvRow([
        t.receipt || `TXN-${t.id}`,
        t.customer_name || '—',
        t.payment_status || '—',
        t.inventory_status || '—',
        Number(t.amount || 0).toFixed(2),
        sanitizeDateTime(t.created_at),
      ])
    );
  });
  lines.push([]);
  lines.push(csvRuleLine());
  lines.push(csvRow(['End of report']));

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

/** UTF-8 CSV bytes (e.g. for programmatic use); same content as buildAnalyticsCsv. */
export function buildAnalyticsXlsxBytes(payload) {
  const csv = buildAnalyticsCsv(payload);
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(csv);
  }
  const utf8 = decodeURIComponent(encodeURIComponent(csv));
  const arr = new Uint8Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) arr[i] = utf8.charCodeAt(i);
  return arr;
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

/**
 * Embed a chart data-URL image into the PDF at the specified y position.
 * Returns the new y coordinate after the image.
 * Maintains the original aspect ratio of the captured image.
 */
function embedChartImage(doc, dataUrl, y, margin, maxW, pageH, maxImgH = 65) {
  if (!dataUrl) return y;
  try {
    const fmt = dataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
    // Decode dimensions from the data URL via a temp Image
    const img = new Image();
    img.src = dataUrl;
    const natW = img.naturalWidth || img.width || 800;
    const natH = img.naturalHeight || img.height || 300;
    const aspect = natW / natH;
    let imgW = maxW;
    let imgH = imgW / aspect;
    if (imgH > maxImgH) {
      imgH = maxImgH;
      imgW = imgH * aspect;
    }
    const neededSpace = imgH + 4;
    if (y + neededSpace > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    const xOffset = margin + (maxW - imgW) / 2;
    doc.addImage(dataUrl, fmt, xOffset, y, imgW, imgH);
    y += imgH + 3;
  } catch {
    // Silently skip if image is invalid
  }
  return y;
}

/**
 * Embed two chart images side by side (e.g. Refunds + Backjobs).
 * Returns the new y coordinate after both images.
 */
function embedChartImagePair(doc, leftDataUrl, rightDataUrl, y, margin, maxW, pageH, maxImgH = 55) {
  const halfW = (maxW - 4) / 2;
  const leftH = leftDataUrl ? maxImgH : 0;
  const rightH = rightDataUrl ? maxImgH : 0;
  const rowH = Math.max(leftH, rightH);
  if (rowH <= 0) return y;
  if (y + rowH + 4 > pageH - margin) {
    doc.addPage();
    y = margin;
  }
  if (leftDataUrl) {
    try {
      const fmt = leftDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(leftDataUrl, fmt, margin, y, halfW, maxImgH);
    } catch { /* skip */ }
  }
  if (rightDataUrl) {
    try {
      const fmt = rightDataUrl.startsWith('data:image/jpeg') ? 'JPEG' : 'PNG';
      doc.addImage(rightDataUrl, fmt, margin + halfW + 4, y, halfW, maxImgH);
    } catch { /* skip */ }
  }
  return y + rowH + 3;
}

export async function exportAnalyticsPdf(payload, chartImages = {}, mode = 'download') {
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
    monthlyLossRefundRows = [],
    monthlyLossBackjobRows = [],
    newCustomersByMonth12 = [],
    customersGrowthByMonth = [],
    rushRegularChartData = [],
  } = payload;

  const revenue = Number(totalRevenue ?? paidTotal);
  const losses =
    totalLossesRaw != null && totalLossesRaw !== ''
      ? Number(totalLossesRaw)
      : Number(unpaidAmountTotal) + Number(refundLossTotal);

  const growthRowsPdf =
    customersGrowthByMonth && customersGrowthByMonth.length
      ? customersGrowthByMonth
      : (newCustomersByMonth12 || []).map((r) => ({
          name: r.name,
          newCustomers: r.count ?? 0,
          returningCustomers: 0,
        }));

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
  // Embed revenue chart image if provided
  y = embedChartImage(doc, chartImages.revenueChart, y, margin, maxW, pageH, 65);
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

  y = drawSectionTitle(doc, 'Loss & Quality — totals', y, margin, maxW, pageH);
  // Embed refund + backjob charts side by side
  y = embedChartImagePair(doc, chartImages.refundChart, chartImages.backjobChart, y, margin, maxW, pageH, 55);
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

  y = drawSectionTitle(doc, 'Loss & Quality — refunds by reason', y, margin, maxW, pageH);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'month', label: 'Month', width: 40 },
      { key: 'damaged', label: 'Dam.', width: 36, align: 'right' },
      { key: 'lost', label: 'Lost', width: 36, align: 'right' },
      { key: 'other', label: 'Other', width: 36, align: 'right' },
    ],
    rows: (monthlyLossRefundRows || []).map((row) => ({
      month: row.name,
      damaged: Number(row.Damaged || 0).toFixed(2),
      lost: Number(row.Lost || 0).toFixed(2),
      other: Number(row.Other || 0).toFixed(2),
    })),
  });

  y = drawSectionTitle(doc, 'Loss & Quality — backjobs by reason', y, margin, maxW, pageH);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'month', label: 'Month', width: 40 },
      { key: 'poor', label: 'Poor Q', width: 36, align: 'right' },
      { key: 'wr', label: 'Wrink.', width: 36, align: 'right' },
      { key: 'other', label: 'Other', width: 36, align: 'right' },
    ],
    rows: (monthlyLossBackjobRows || []).map((row) => ({
      month: row.name,
      poor: Number(row.PoorQuality || 0).toFixed(2),
      wr: Number(row.Wrinkled || 0).toFixed(2),
      other: Number(row.Other || 0).toFixed(2),
    })),
  });

  y = drawSectionTitle(doc, 'Growth (new vs returning)', y, margin, maxW, pageH);
  // Embed growth chart image if provided
  y = embedChartImage(doc, chartImages.growthChart, y, margin, maxW, pageH, 60);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'month', label: 'Month', width: 66 },
      { key: 'newC', label: 'New', width: 60, align: 'right' },
      { key: 'retC', label: 'Returning', width: 60, align: 'right' },
    ],
    rows: growthRowsPdf.map((row) => ({
      month: row.name,
      newC: String(Number(row.newCustomers ?? 0)),
      retC: String(Number(row.returningCustomers ?? 0)),
    })),
  });

  y = drawSectionTitle(doc, 'Rush vs regular (paid)', y, margin, maxW, pageH);
  // Embed rush vs regular chart image if provided
  y = embedChartImage(doc, chartImages.rushChart, y, margin, maxW, pageH, 60);
  y = drawTable(doc, {
    y,
    margin,
    pageH,
    columns: [
      { key: 'period', label: 'Period', width: 62 },
      { key: 'rush', label: 'Rush (PHP)', width: 62, align: 'right' },
      { key: 'reg', label: 'Regular (PHP)', width: 62, align: 'right' },
    ],
    rows: (rushRegularChartData || []).map((row) => ({
      period: row.name,
      rush: Number(row.rush || 0).toFixed(2),
      reg: Number(row.regular || 0).toFixed(2),
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

  if (mode === 'print') {
    // Open in a new browser tab and trigger print
    const pdfBlob = doc.output('blob');
    const blobUrl = URL.createObjectURL(pdfBlob);
    const printWin = window.open(blobUrl, '_blank');
    if (printWin) {
      printWin.addEventListener('load', () => {
        setTimeout(() => {
          printWin.focus();
          printWin.print();
        }, 600);
      });
    }
    return;
  }

  doc.save(`branch-report-${stamp}.pdf`);
}
