/**
 * Web-only: jsPDF browser bundle. Import the ESM file directly so SSR/Metro never
 * resolve the package "node" entry (jspdf.node.min.js).
 */
// eslint-disable-next-line import/no-unresolved -- dist path is valid at runtime
import { jsPDF } from "jspdf/dist/jspdf.es.min.js";
import autoTable from "jspdf-autotable";
import type { ClerkLogPdfRow } from "./clerkLogsPdfExport.types";

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

function buildClerkLogsPdfBytes(rows: ClerkLogPdfRow[]): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setProperties({ title: "Clerk Logs" });
  autoTable(doc, {
    head: [["Receipt ID", "Clerk", "Branch", "Customer", "Amount", "Payment", "Inventory", "Due"]],
    body: rows.map((r) => [
      r.receipt_id,
      r.clerk_name,
      r.branch,
      r.customer_name,
      String(r.amount),
      r.status,
      r.inventory_status,
      r.due_date,
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: "bold" },
    margin: { left: 24, right: 24, top: 36 },
  });
  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf);
}

export async function exportClerkLogsPdf(rows: ClerkLogPdfRow[]): Promise<void> {
  const bytes = buildClerkLogsPdfBytes(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `clerk-logs-${stamp}.pdf`;
  downloadBlobWeb(new Blob([uint8ToArrayBuffer(bytes)], { type: "application/pdf" }), filename);
}
