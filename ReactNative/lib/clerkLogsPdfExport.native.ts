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
import type { ClerkLogPdfRow } from "./clerkLogsPdfExport.types";

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

function buildPrintHtml(rows: ClerkLogPdfRow[], logoDataUri: string): string {
  const header =
    "<tr><th>Receipt ID</th><th>Clerk</th><th>Branch</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Inventory</th><th>Due</th></tr>";
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.receipt_id)}</td><td>${escapeHtml(r.clerk_name)}</td><td>${escapeHtml(r.branch)}</td><td>${escapeHtml(r.customer_name)}</td><td>${escapeHtml(String(r.amount))}</td><td>${escapeHtml(r.status)}</td><td>${escapeHtml(r.inventory_status)}</td><td>${escapeHtml(r.due_date)}</td></tr>`
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
  .meta { color: #64748b; margin-bottom: 12px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 4px; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  tr:nth-child(even) td { background: #fafafa; }
</style></head><body>
<div class="pdf-head">
  ${logoDataUri ? `<img class="pdf-logo" src="${logoDataUri}" alt="Papa J's logo" />` : ""}
  <div class="pdf-brand">
    <p class="pdf-shop">Papa J's Laundry Shop</p>
  </div>
</div>
<h2>Clerk Logs</h2>
<p class="meta">${rows.length} row(s)</p>
<table><thead>${header}</thead><tbody>${body}</tbody></table>
</body></html>`;
}

export async function exportClerkLogsPdf(rows: ClerkLogPdfRow[]): Promise<void> {
  const logoDataUri = await loadLogoDataUri();
  const html = buildPrintHtml(rows, logoDataUri);
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
