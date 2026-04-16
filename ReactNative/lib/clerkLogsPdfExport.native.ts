/**
 * Native (Expo Go): HTML → PDF via expo-print (no jsPDF/pdf-lib).
 * Copy to cache with a readable name before share (printToFileAsync uses a UUID filename).
 */
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { cacheDirectory, copyAsync } from "expo-file-system/legacy";
import { EncodingType, readAsStringAsync } from "expo-file-system";
import { Asset } from "expo-asset";
import { Alert } from "react-native";
import type {
  ClerkLogPdfRow,
  ClerkLogsExportContext,
} from "./clerkLogsPdfExport.types";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function loadLogoDataUri(): Promise<string> {
  try {
    const asset = Asset.fromModule(require("../assets/images/papaj logo.png"));
    await asset.downloadAsync();
    const fileUri = asset.localUri || asset.uri;
    if (!fileUri) return "";
    const b64 = await readAsStringAsync(fileUri, { encoding: EncodingType.Base64 });
    if (!b64) return "";
    return `data:image/png;base64,${b64}`;
  } catch {
    return "";
  }
}

function buildPrintHtml(
  rows: ClerkLogPdfRow[],
  context: ClerkLogsExportContext,
  logoDataUri: string
): string {
  const header =
    "<tr><th>#</th><th>Receipt ID</th><th>Created</th><th>Due</th><th>Customer</th><th>Clerk</th><th>Branch</th><th>Payment</th><th>Inventory</th><th>Amount (PHP)</th></tr>";
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(String(r.row_no))}</td><td>${escapeHtml(r.receipt_id)}</td><td>${escapeHtml(r.created_at)}</td><td>${escapeHtml(r.due_date)}</td><td>${escapeHtml(r.customer_name)}</td><td>${escapeHtml(r.clerk_name)}</td><td>${escapeHtml(r.branch)}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.inventory_status)}</td><td class="num">${escapeHtml(Number(r.amount || 0).toFixed(2))}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width"/>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; font-size: 9px; color: #1e293b; margin: 16px; }
  .pdf-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .pdf-logo { width: 36px; height: 36px; object-fit: contain; border-radius: 18px; }
  .pdf-brand { display: flex; flex-direction: column; }
  .pdf-shop { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; }
  h2 { margin: 0 0 8px; font-size: 16px; }
  .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 16px; margin-bottom: 10px; font-size: 10px; color: #334155; }
  .meta-grid strong { color: #0f172a; }
  .summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
  .summary-card { border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; padding: 8px 10px; }
  .summary-card-k { margin: 0 0 3px; font-size: 10px; color: #475569; }
  .summary-card-v { margin: 0; font-size: 16px; font-weight: 800; color: #0f172a; }
  .summary-note { margin: 0 0 12px; color: #475569; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 4px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; }
</style></head><body>
<div class="pdf-head">
  ${logoDataUri ? `<img class="pdf-logo" src="${logoDataUri}" alt="Papa J's logo" />` : ""}
  <div class="pdf-brand">
    <p class="pdf-shop">Papa J's Laundry Shop</p>
  </div>
</div>
<h2>Clerk Logs Export</h2>
<div class="meta-grid">
  <div><strong>Generated:</strong> ${escapeHtml(context.generated_at)}</div>
  <div><strong>Requested by:</strong> ${escapeHtml(context.requested_by)}</div>
  <div><strong>Branch:</strong> ${escapeHtml(context.branch_label)}</div>
  <div><strong>Date range:</strong> ${escapeHtml(context.date_range_label)}</div>
  <div><strong>Payment filter:</strong> ${escapeHtml(context.payment_label)}</div>
  <div><strong>Inventory filter:</strong> ${escapeHtml(context.inventory_label)}</div>
  <div><strong>Include archived:</strong> ${escapeHtml(context.include_archived_label)}</div>
  <div><strong>Rows:</strong> ${escapeHtml(String(context.total_rows))}</div>
</div>
<div class="summary-grid">
  <div class="summary-card">
    <p class="summary-card-k">Total exported rows</p>
    <p class="summary-card-v">${escapeHtml(String(context.total_rows))}</p>
  </div>
  <div class="summary-card">
    <p class="summary-card-k">Total exported amount</p>
    <p class="summary-card-v">${escapeHtml(`₱${Number(context.total_amount || 0).toFixed(2)}`)}</p>
  </div>
</div>
<p class="summary-note">This file contains all rows matching the active filters at export time.</p>
<table><thead>${header}</thead><tbody>${body}</tbody></table>
</body></html>`;
}

export async function exportClerkLogsPdf(
  rows: ClerkLogPdfRow[],
  context: ClerkLogsExportContext
): Promise<void> {
  const logoDataUri = await loadLogoDataUri();
  const html = buildPrintHtml(rows, context, logoDataUri);
  const { uri } = await Print.printToFileAsync({ html });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `clerk-logs-${stamp}.pdf`;

  let shareUri = uri;
  if (cacheDirectory) {
    const destUri = `${cacheDirectory}${filename}`;
    await copyAsync({ from: uri, to: destUri });
    shareUri = destUri;
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(shareUri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "Export Clerk Logs PDF",
    });
  } else {
    Alert.alert("Export ready", filename);
  }
}
