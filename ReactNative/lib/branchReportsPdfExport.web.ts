// eslint-disable-next-line import/no-unresolved -- runtime path is valid in Metro/web builds
import { jsPDF } from "jspdf/dist/jspdf.es.min.js";
import autoTable from "jspdf-autotable";
import { Asset } from "expo-asset";
import type { BranchReportsExportPayload } from "./branchReportsPdfExport.types";

function formatAmount(value: number): string {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function downloadBlobWeb(blob: Blob, filename: string) {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

async function loadLogoDataUrl(): Promise<string> {
  try {
    const asset = Asset.fromModule(require("../assets/images/papaj logo.png"));
    await asset.downloadAsync();
    const logoUrl = asset.localUri || asset.uri;
    if (!logoUrl) return "";
    const res = await fetch(logoUrl);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function buildBranchReportsPdfBytes(
  payload: BranchReportsExportPayload,
  logoDataUrl: string
): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setProperties({ title: "Branch Reports Export" });

  const pageWidth = doc.internal.pageSize.getWidth();
  let cursorY = 104;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 24, 18, 28, 28);
    } catch {
      // Ignore logo draw errors.
    }
  }

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Papa J's Laundry Shop", 58, 30);
  doc.setFontSize(18);
  doc.text("Branch Reports Export", 24, 58);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${payload.generatedAt}`, 24, 78);
  doc.text(`Branch: ${payload.branchName}`, 24, 90);
  doc.text(`Branch ID: ${payload.branchId}`, 270, 78);
  doc.text(`View: ${payload.viewTypeLabel}`, 270, 90);
  doc.text(`Range start: ${payload.rangeStartDate || "—"}`, 520, 78);
  doc.text(`Range end: ${payload.rangeEndDate || "—"}`, 520, 90);

  doc.setDrawColor(226, 232, 240);
  doc.line(24, 100, pageWidth - 24, 100);

  const summaryCards = [
    ["Total Revenue", `PHP ${formatAmount(payload.totalRevenue)}`],
    ["Total Losses", `PHP ${formatAmount(payload.totalLosses)}`],
    ["Net Profit", `PHP ${formatAmount(payload.netProfit)}`],
    ["Dispute Value", `PHP ${formatAmount(payload.totalDisputeValue)}`],
    ["Weight Processed", `${formatAmount(payload.totalWeightProcessed)} kg`],
  ];

  let x = 24;
  summaryCards.forEach(([label, value]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, 112, 138, 42, 8, 8, "FD");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(label, x + 8, 127);
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text(value, x + 8, 142);
    x += 146;
  });

  const sectionTitle = (title: string) => {
    if (cursorY > doc.internal.pageSize.getHeight() - 70) {
      doc.addPage();
      cursorY = 28;
    }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 24, cursorY);
    cursorY += 8;
  };

  const renderTable = (head: string[], body: string[][], columnStyles: Record<number, { cellWidth?: number; halign?: "left" | "center" | "right" }> = {}) => {
    autoTable(doc, {
      head: [head],
      body: body.length > 0 ? body : [["No data", ...head.slice(1).map(() => "")]],
      startY: cursorY,
      styles: { fontSize: 7, cellPadding: 2, textColor: [30, 41, 59] },
      headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles,
      margin: { left: 24, right: 24 },
    });
    cursorY = (doc.lastAutoTable?.finalY || cursorY) + 16;
  };

  sectionTitle("Issue Status Trend");
  renderTable(
    ["Period", "Resolved", "Unresolved"],
    payload.issueStatusTrend.labels.map((label, index) => [
      label,
      String(payload.issueStatusTrend.resolved?.[index] ?? 0),
      String(payload.issueStatusTrend.unresolved?.[index] ?? 0),
    ]),
    { 1: { cellWidth: 72, halign: "right" }, 2: { cellWidth: 72, halign: "right" } }
  );

  sectionTitle("Payment Trend");
  renderTable(
    ["Period", "Paid", "Unpaid"],
    payload.paymentTrend.labels.map((label, index) => [
      label,
      String(payload.paymentTrend.paid?.[index] ?? 0),
      String(payload.paymentTrend.unpaid?.[index] ?? 0),
    ]),
    { 1: { cellWidth: 72, halign: "right" }, 2: { cellWidth: 72, halign: "right" } }
  );

  sectionTitle("Performance Trend");
  renderTable(
    ["Period", "Revenue", "Unpaid", "Disputes", "Losses", "Profit"],
    payload.performanceRows.map((row) => [
      row.name,
      formatAmount(row.revenue),
      formatAmount(row.unpaid),
      formatAmount(row.disputes),
      formatAmount(row.losses),
      formatAmount(row.profit),
    ]),
    {
      1: { cellWidth: 78, halign: "right" },
      2: { cellWidth: 78, halign: "right" },
      3: { cellWidth: 78, halign: "right" },
      4: { cellWidth: 78, halign: "right" },
      5: { cellWidth: 78, halign: "right" },
    }
  );

  sectionTitle("Growth Trend");
  renderTable(
    ["Period", "New", "Returning"],
    payload.growthSeries.labels.map((label, index) => [
      label,
      String(payload.growthSeries.newCustomers?.[index] ?? 0),
      String(payload.growthSeries.returningCustomers?.[index] ?? 0),
    ])
  );

  sectionTitle("Loss & Quality - Refunds");
  renderTable(
    ["Reason", "Amount"],
    payload.lossReasonSeries.refund.labels.map((label, index) => [
      label,
      formatAmount(payload.lossReasonSeries.refund.values[index] ?? 0),
    ]),
    { 1: { cellWidth: 90, halign: "right" } }
  );

  sectionTitle("Loss & Quality - Backjobs");
  renderTable(
    ["Reason", "Amount"],
    payload.lossReasonSeries.backjob.labels.map((label, index) => [
      label,
      formatAmount(payload.lossReasonSeries.backjob.values[index] ?? 0),
    ]),
    { 1: { cellWidth: 90, halign: "right" } }
  );

  sectionTitle("White vs Colored");
  renderTable(
    ["Category", "Amount"],
    payload.whiteVsColored.labels.map((label, index) => [
      label,
      formatAmount(payload.whiteVsColored.values[index] ?? 0),
    ]),
    { 1: { cellWidth: 90, halign: "right" } }
  );

  sectionTitle("Service Items");
  renderTable(
    ["#", "Service", "Amount"],
    payload.serviceItems.map((item, index) => [String(index + 1), item.name, formatAmount(item.amount)]),
    { 0: { cellWidth: 30, halign: "center" }, 2: { cellWidth: 92, halign: "right" } }
  );

  sectionTitle("Recent Transactions");
  renderTable(
    ["Receipt", "Customer", "Payment", "Status", "Amount", "Date"],
    payload.recentTransactions.map((row) => [
      row.receipt,
      row.customer,
      row.payment,
      row.status,
      formatAmount(row.amount),
      row.date,
    ]),
    { 4: { cellWidth: 78, halign: "right" } }
  );

  return new Uint8Array(doc.output("arraybuffer"));
}

export async function exportBranchReportsPdf(
  payload: BranchReportsExportPayload,
  mode: "download" | "print" = "download"
): Promise<void> {
  const logoDataUrl = await loadLogoDataUrl();
  const bytes = buildBranchReportsPdfBytes(payload, logoDataUrl);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `branch-reports-${stamp}.pdf`;
  if (mode === "print" && typeof window !== "undefined") {
    const blob = new Blob([uint8ToArrayBuffer(bytes)], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (printWindow) {
      printWindow.focus();
      printWindow.onload = () => {
        printWindow.print();
      };
      return;
    }
  }
  downloadBlobWeb(new Blob([uint8ToArrayBuffer(bytes)], { type: "application/pdf" }), filename);
}