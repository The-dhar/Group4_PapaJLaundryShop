/**
 * Web-only: jsPDF browser bundle. Import the ESM file directly so SSR/Metro never
 * resolve the package "node" entry (jspdf.node.min.js).
 */
// eslint-disable-next-line import/no-unresolved -- dist path is valid at runtime
import { jsPDF } from "jspdf/dist/jspdf.es.min.js";
import autoTable from "jspdf-autotable";
import { Asset } from "expo-asset";
import type {
  ClerkLogPdfRow,
  ClerkLogsExportContext,
} from "./clerkLogsPdfExport.types";

function uint8ToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(out).set(bytes);
  return out;
}

function downloadBlobWeb(blob: Blob, filename: string) {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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

function buildClerkLogsPdfBytes(
  rows: ClerkLogPdfRow[],
  context: ClerkLogsExportContext,
  logoDataUrl: string
): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setProperties({ title: "Clerk Logs Export" });

  const pageWidth = doc.internal.pageSize.getWidth();

  let tableTop = 130;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 24, 20, 28, 28);
    } catch {
      // Ignore logo draw errors and continue export.
    }
  }

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Papa J's Laundry Shop", 58, 32);
  doc.setFontSize(18);
  doc.text("Clerk Logs Export", 24, 60);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${context.generated_at}`, 24, 76);
  doc.text(`Requested by: ${context.requested_by}`, 24, 88);
  doc.text(`Branch: ${context.branch_label}`, 250, 76);
  doc.text(`Date range: ${context.date_range_label}`, 250, 88);
  doc.text(`Payment: ${context.payment_label}`, 510, 76);
  doc.text(`Inventory: ${context.inventory_label}`, 510, 88);
  doc.text(`Include archived: ${context.include_archived_label}`, 510, 100);
  doc.text(`Rows: ${context.total_rows}`, 24, 100);
  doc.text(`Total amount: ₱${Number(context.total_amount || 0).toFixed(2)}`, 250, 100);

  doc.setDrawColor(226, 232, 240);
  doc.line(24, 112, pageWidth - 24, 112);

  autoTable(doc, {
    head: [["#", "Receipt ID", "Created", "Due", "Customer", "Clerk", "Branch", "Payment", "Inventory", "Amount (PHP)"]],
    body: rows.map((r) => [
      String(r.row_no),
      r.receipt_id,
      r.created_at,
      r.due_date,
      r.customer_name,
      r.clerk_name,
      r.branch,
      r.status,
      r.inventory_status,
      Number(r.amount || 0).toFixed(2),
    ]),
    styles: { fontSize: 7, cellPadding: 2, textColor: [30, 41, 59] },
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold" },
    columnStyles: {
      0: { halign: "center", cellWidth: 24 },
      1: { cellWidth: 68 },
      2: { cellWidth: 78 },
      3: { cellWidth: 56 },
      4: { cellWidth: 110 },
      5: { cellWidth: 92 },
      6: { cellWidth: 90 },
      7: { cellWidth: 58, halign: "center" },
      8: { cellWidth: 76, halign: "center" },
      9: { cellWidth: 70, halign: "right" },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didDrawPage: (data) => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${page}`, pageWidth - 56, doc.internal.pageSize.getHeight() - 10);
      if (data.pageNumber > 1) {
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("Clerk Logs Export", 24, 24);
      }
    },
    margin: { left: 24, right: 24, top: tableTop },
  });
  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf);
}

export async function exportClerkLogsPdf(
  rows: ClerkLogPdfRow[],
  context: ClerkLogsExportContext
): Promise<void> {
  const logoDataUrl = await loadLogoDataUrl();
  const bytes = buildClerkLogsPdfBytes(rows, context, logoDataUrl);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `clerk-logs-${stamp}.pdf`;
  downloadBlobWeb(new Blob([uint8ToArrayBuffer(bytes)], { type: "application/pdf" }), filename);
}
