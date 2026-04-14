/**
 * Web-only: jsPDF browser bundle. Import the ESM file directly so SSR/Metro never
 * resolve the package "node" entry (jspdf.node.min.js).
 */
// eslint-disable-next-line import/no-unresolved -- dist path is valid at runtime
import { jsPDF } from "jspdf/dist/jspdf.es.min.js";
import autoTable from "jspdf-autotable";
import { Asset } from "expo-asset";
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

function buildClerkLogsPdfBytes(rows: ClerkLogPdfRow[], logoDataUrl: string): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setProperties({ title: "Clerk Logs" });

  let tableTop = 72;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 24, 20, 28, 28);
    } catch {
      // Ignore logo draw errors and continue export.
    }
  }
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Papa J's Laundry Shop", 58, 32);
  doc.setFontSize(18);
  doc.text("Clerk Logs", 24, 60);

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
    margin: { left: 24, right: 24, top: tableTop },
  });
  const buf = doc.output("arraybuffer");
  return new Uint8Array(buf);
}

export async function exportClerkLogsPdf(rows: ClerkLogPdfRow[]): Promise<void> {
  const logoDataUrl = await loadLogoDataUrl();
  const bytes = buildClerkLogsPdfBytes(rows, logoDataUrl);
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `clerk-logs-${stamp}.pdf`;
  downloadBlobWeb(new Blob([uint8ToArrayBuffer(bytes)], { type: "application/pdf" }), filename);
}
