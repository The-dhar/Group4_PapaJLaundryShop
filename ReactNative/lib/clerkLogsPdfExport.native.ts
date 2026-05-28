/**
 * Native (Expo Go): HTML → PDF via expo-print (no jsPDF/pdf-lib).
 * Copy to cache with a readable name before share (printToFileAsync uses a UUID filename).
 */
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { cacheDirectory, copyAsync, downloadAsync } from "expo-file-system/legacy";
import { readAsStringAsync } from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import { Alert } from "react-native";
import type {
  ClerkLogPdfRow,
  ClerkLogsExportContext,
} from "./clerkLogsPdfExport.types";

const A4_LANDSCAPE_WIDTH = 842;
const A4_LANDSCAPE_HEIGHT = 595;
const BASE64_ENCODING = "base64";

function formatAmount(value: number): string {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type LogoLoadResult = {
  src: string;
  debug: string[];
};

async function loadLogoDataUri(): Promise<LogoLoadResult> {
  const debug: string[] = [];
  const detectMimeType = (b64: string): string => {
    const sample = b64.slice(0, 16);
    if (sample.startsWith("/9j/")) return "image/jpeg";
    if (sample.startsWith("iVBOR")) return "image/png";
    if (sample.startsWith("R0lGOD")) return "image/gif";
    if (sample.startsWith("UklGR")) return "image/webp";
    return "image/png";
  };
  const asDataUri = (b64: string) => {
    const clean = b64.replace(/\s+/g, "");
    const mime = detectMimeType(clean);
    debug.push(`asDataUri mime=${mime} len=${clean.length}`);
    return `data:${mime};base64,${clean}`;
  };
  const assetRef = require("../assets/images/papaj logo.png");
  const tryRead = async (uri?: string | null): Promise<string> => {
    if (!uri) {
      debug.push("tryRead: uri missing");
      return "";
    }
    debug.push(`tryRead: uri=${uri.slice(0, 80)}`);
    try {
      const b64 = await readAsStringAsync(uri, { encoding: BASE64_ENCODING });
      debug.push(`tryRead: success len=${b64?.length || 0}`);
      return b64 ? asDataUri(b64) : "";
    } catch (e) {
      debug.push(`tryRead: fail ${(e as Error)?.message || "unknown error"}`);
      return "";
    }
  };
  const tryDownloadAndRead = async (
    uri?: string | null
  ): Promise<{ dataUri: string; fileUri: string }> => {
    if (!uri) {
      debug.push("tryDownloadAndRead: uri missing");
      return { dataUri: "", fileUri: "" };
    }
    if (!cacheDirectory) {
      debug.push("tryDownloadAndRead: cacheDirectory missing");
      return { dataUri: "", fileUri: "" };
    }
    try {
      const tempUri = `${cacheDirectory}papaj-logo-export.png`;
      debug.push(`tryDownloadAndRead: downloading uri=${uri.slice(0, 80)} to=${tempUri}`);
      const res = await downloadAsync(uri, tempUri);
      const downloadedUri = res?.uri || tempUri;
      debug.push(`tryDownloadAndRead: downloaded to=${downloadedUri}`);
      const dataUri = await tryRead(downloadedUri);
      return { dataUri, fileUri: downloadedUri };
    } catch (e) {
      debug.push(`tryDownloadAndRead: fail ${(e as Error)?.message || "unknown error"}`);
      return { dataUri: "", fileUri: "" };
    }
  };

  try {
    debug.push("Asset.loadAsync start");
    const [asset] = await Asset.loadAsync(assetRef);
    debug.push(
      `Asset.loadAsync done localUri=${String(asset?.localUri || "").slice(0, 80)} uri=${String(asset?.uri || "").slice(0, 80)}`
    );
    const fromLocal = await tryRead(asset?.localUri);
    if (fromLocal) return { src: fromLocal, debug: [...debug, "logo source=asset.localUri(base64)"] };
    const fromUri = await tryRead(asset?.uri);
    if (fromUri) return { src: fromUri, debug: [...debug, "logo source=asset.uri(base64)"] };
    const fromDownloadedAsset = await tryDownloadAndRead(asset?.uri);
    if (fromDownloadedAsset.dataUri) {
      return { src: fromDownloadedAsset.dataUri, debug: [...debug, "logo source=download(asset.uri)->base64"] };
    }
    if (fromDownloadedAsset.fileUri) {
      return { src: fromDownloadedAsset.fileUri, debug: [...debug, "logo source=download(asset.uri)->file"] };
    }
    if (asset?.localUri) return { src: asset.localUri, debug: [...debug, "logo source=asset.localUri(file)"] };

    // Fallback path for environments where loadAsync is unavailable.
    debug.push("Asset.fromModule fallback start");
    const fallback = Asset.fromModule(assetRef);
    await fallback.downloadAsync();
    debug.push(
      `Asset.fromModule done localUri=${String(fallback.localUri || "").slice(0, 80)} uri=${String(fallback.uri || "").slice(0, 80)}`
    );
    const fallbackLocal = await tryRead(fallback.localUri);
    if (fallbackLocal) return { src: fallbackLocal, debug: [...debug, "logo source=fallback.localUri(base64)"] };
    const fallbackUri = await tryRead(fallback.uri);
    if (fallbackUri) return { src: fallbackUri, debug: [...debug, "logo source=fallback.uri(base64)"] };
    const downloadedFallback = await tryDownloadAndRead(fallback.uri);
    if (downloadedFallback.dataUri) {
      return { src: downloadedFallback.dataUri, debug: [...debug, "logo source=download(fallback.uri)->base64"] };
    }
    if (downloadedFallback.fileUri) {
      return { src: downloadedFallback.fileUri, debug: [...debug, "logo source=download(fallback.uri)->file"] };
    }
    if (fallback.localUri) return { src: fallback.localUri, debug: [...debug, "logo source=fallback.localUri(file)"] };
    if (fallback.uri) return { src: fallback.uri, debug: [...debug, "logo source=fallback.uri(file)"] };
    return { src: "", debug: [...debug, "logo source=none"] };
  } catch (e) {
    debug.push(`loadLogoDataUri catch: ${(e as Error)?.message || "unknown error"}`);
    return { src: "", debug: [...debug, "logo source=none"] };
  }
}

function buildPrintHtml(
  rows: ClerkLogPdfRow[],
  context: ClerkLogsExportContext,
  logoDataUri: string
): string {
  const pesoSymbol = "&#8369;";
  const totalAmountText = `${pesoSymbol}${formatAmount(context.total_amount || 0)}`;
  const body = rows
    .map(
      (r) =>
        `<tr>
          <td class="c col-idx">${escapeHtml(String(r.row_no))}</td>
          <td class="col-receipt">${escapeHtml(r.receipt_id)}</td>
          <td class="col-created">${escapeHtml(String(r.created_at || "").slice(0, 16).replace("T", " "))}</td>
          <td class="col-due">${escapeHtml(r.due_date)}</td>
          <td class="col-customer">${escapeHtml(r.customer_name)}</td>
          <td class="col-clerk">${escapeHtml(r.clerk_name)}</td>
          <td class="col-branch">${escapeHtml(r.branch)}</td>
          <td class="c col-payment">${escapeHtml(r.status)}</td>
          <td class="c col-inventory">${escapeHtml(r.inventory_status)}</td>
          <td class="num col-amount">${escapeHtml(formatAmount(r.amount || 0))}</td>
        </tr>`
    )
    .join("") ||
    `<tr><td class="c" colspan="10">No rows matched the selected filters.</td></tr>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    box-sizing: border-box;
  }
  @page {
    size: A4 landscape;
    margin: 22px;
  }
  html,
  body {
    margin: 0;
    padding: 0;
  }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10px;
    color: #334155;
    background: #ffffff;
  }
  .report {
    width: 100%;
  }
  .banner {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #1e40af;
    color: #ffffff;
    padding: 12px 14px;
    border: 1px solid #1d4ed8;
    margin-bottom: 12px;
  }
  .logo {
    width: 32px;
    height: 32px;
    border-radius: 16px;
    object-fit: contain;
    display: block;
    flex: 0 0 auto;
    background: #ffffff;
  }
  .shop {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    color: #dbeafe;
  }
  .title {
    margin: 0;
    font-size: 34px;
    line-height: 1.1;
    font-weight: 700;
    color: #ffffff;
  }
  .meta-box {
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    padding: 10px 12px;
    margin-bottom: 12px;
    color: #334155;
  }
  .meta-line {
    margin: 0 0 6px;
  }
  .section-title {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #1e293b;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 10px;
    margin: 0 0 0;
  }
  .summary-table {
    margin-top: 0;
    margin-bottom: 12px;
  }
  .note-line {
    margin: 4px 0 0;
    color: #64748b;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin-top: 0;
  }
  th,
  td {
    border: 1px solid #e2e8f0;
    padding: 6px 7px;
    text-align: left;
    vertical-align: middle;
  }
  th {
    background: #f1f5f9;
    font-weight: 700;
    color: #334155;
    font-size: 10px;
  }
  td {
    font-size: 10px;
    color: #1e293b;
  }
  tbody tr:nth-child(even) td {
    background: #fafafa;
  }
  .col-idx { width: 24px; }
  .col-receipt { width: 76px; }
  .col-created { width: 86px; }
  .col-due { width: 64px; }
  .col-customer { width: 138px; }
  .col-clerk { width: 108px; }
  .col-branch { width: 92px; }
  .col-payment { width: 60px; }
  .col-inventory { width: 82px; }
  .col-amount { width: 74px; }
  .c { text-align: center; }
  .num { text-align: right; }
  .footer {
    margin-top: 5px;
    text-align: right;
    font-size: 7px;
    color: #64748b;
  }
</style></head><body>
<div class="report">
  <div class="banner">
    ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="Papa J logo" />` : ""}
    <div>
      <p class="shop">Papa J's Laundry Shop</p>
      <h1 class="title">Clerk Logs Report</h1>
    </div>
  </div>
  <div class="meta-box">
    <p class="meta-line">Generated: ${escapeHtml(context.generated_at)}</p>
    <p class="meta-line">Requested by: ${escapeHtml(context.requested_by)}</p>
    <p class="meta-line">Branch: ${escapeHtml(context.branch_label)}</p>
    <p class="meta-line">Date range: ${escapeHtml(context.date_range_label)}</p>
    <p class="meta-line">Payment: ${escapeHtml(context.payment_label)}</p>
    <p class="meta-line">Inventory: ${escapeHtml(context.inventory_label)}</p>
    <p class="meta-line">Include archived: ${escapeHtml(context.include_archived_label)}</p>
    <p class="note-line">All rows matching the active filters are included.</p>
  </div>

  <h2 class="section-title">Summary</h2>
  <table class="summary-table">
    <thead>
      <tr>
        <th>Metric</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Total exported rows</td><td class="num">${escapeHtml(String(context.total_rows))}</td></tr>
      <tr><td>Total exported amount</td><td class="num">${totalAmountText}</td></tr>
    </tbody>
  </table>

  <h2 class="section-title">Clerk Log Entries</h2>
  <table>
    <thead>
      <tr>
        <th class="c col-idx">#</th>
        <th class="col-receipt">Receipt ID</th>
        <th class="col-created">Created</th>
        <th class="col-due">Due</th>
        <th class="col-customer">Customer</th>
        <th class="col-clerk">Clerk</th>
        <th class="col-branch">Branch</th>
        <th class="c col-payment">Payment</th>
        <th class="c col-inventory">Inventory</th>
        <th class="num col-amount">Amount (${pesoSymbol})</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
  <p class="footer">Generated from mobile export</p>
</div>
</body></html>`;
}

export async function exportClerkLogsPdf(
  rows: ClerkLogPdfRow[],
  context: ClerkLogsExportContext
): Promise<void> {
  const logoLoad = await loadLogoDataUri();
  const logoSrc = logoLoad.src;
  // TEMP silent debug for device-specific print renderer behavior
  console.log("[clerk-pdf-logo]", logoLoad.debug.join(" | "));
  const html = buildPrintHtml(rows, context, logoSrc);
  const { uri } = await Print.printToFileAsync({
    html,
    width: A4_LANDSCAPE_WIDTH,
    height: A4_LANDSCAPE_HEIGHT,
  });
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
