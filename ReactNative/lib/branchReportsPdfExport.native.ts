import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Asset } from "expo-asset";
import { cacheDirectory, copyAsync } from "expo-file-system/legacy";
import { EncodingType, readAsStringAsync } from "expo-file-system";
import { Alert } from "react-native";
import type { BranchReportsExportPayload } from "./branchReportsPdfExport.types";

function formatAmount(value: number): string {
  return Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(value: string): string {
  return String(value)
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
    return b64 ? `data:image/png;base64,${b64}` : "";
  } catch {
    return "";
  }
}

function renderTable(headers: string[], rows: string[][]): string {
  const headHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyHtml = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
    )
    .join("");
  return `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function renderKpi(label: string, value: string): string {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function buildPrintHtml(payload: BranchReportsExportPayload, logoDataUri: string): string {
  const summaryCards = [
    renderKpi("Total Revenue", `PHP ${formatAmount(payload.totalRevenue)}`),
    renderKpi("Total Losses", `PHP ${formatAmount(payload.totalLosses)}`),
    renderKpi("Net Profit", `PHP ${formatAmount(payload.netProfit)}`),
    renderKpi("Dispute Value", `PHP ${formatAmount(payload.totalDisputeValue)}`),
    renderKpi("Weight Processed", `${formatAmount(payload.totalWeightProcessed)} kg`),
  ].join("");

  const issueRows = payload.issueStatusTrend.labels.map((label, index) => [
    label,
    String(payload.issueStatusTrend.resolved?.[index] ?? 0),
    String(payload.issueStatusTrend.unresolved?.[index] ?? 0),
  ]);

  const paymentRows = payload.paymentTrend.labels.map((label, index) => [
    label,
    String(payload.paymentTrend.paid?.[index] ?? 0),
    String(payload.paymentTrend.unpaid?.[index] ?? 0),
  ]);

  const performanceRows = payload.performanceRows.map((row) => [
    row.name,
    formatAmount(row.revenue),
    formatAmount(row.unpaid),
    formatAmount(row.disputes),
    formatAmount(row.losses),
    formatAmount(row.profit),
  ]);

  const growthRows = payload.growthSeries.labels.map((label, index) => [
    label,
    String(payload.growthSeries.newCustomers?.[index] ?? 0),
    String(payload.growthSeries.returningCustomers?.[index] ?? 0),
  ]);

  const refundRows = payload.lossReasonSeries.refund.labels.map((label, index) => [
    label,
    formatAmount(payload.lossReasonSeries.refund.values[index] ?? 0),
  ]);

  const backjobRows = payload.lossReasonSeries.backjob.labels.map((label, index) => [
    label,
    formatAmount(payload.lossReasonSeries.backjob.values[index] ?? 0),
  ]);

  const whiteRows = payload.whiteVsColored.labels.map((label, index) => [
    label,
    formatAmount(payload.whiteVsColored.values[index] ?? 0),
  ]);

  const serviceRows = payload.serviceItems.map((item, index) => [
    String(index + 1),
    item.name,
    formatAmount(item.amount),
  ]);

  const recentRows = payload.recentTransactions.map((row) => [
    row.receipt,
    row.customer,
    row.payment,
    row.status,
    formatAmount(row.amount),
    row.date,
  ]);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 18px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .brand img { width: 36px; height: 36px; object-fit: contain; border-radius: 18px; }
  .brand-name { font-size: 13px; font-weight: 800; margin: 0; }
  h1 { margin: 0 0 6px; font-size: 20px; }
  .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 14px; font-size: 10px; color: #475569; margin-bottom: 12px; }
  .meta strong { color: #0f172a; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 14px; }
  .kpi-card { border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; padding: 10px; }
  .kpi-label { font-size: 10px; color: #64748b; margin-bottom: 4px; }
  .kpi-value { font-size: 15px; font-weight: 800; color: #0f172a; }
  .section { margin-top: 14px; }
  .section h2 { margin: 0 0 8px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 6px; text-align: left; }
  th { background: #f1f5f9; font-weight: 700; }
  tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; }
  .note { font-size: 10px; color: #64748b; margin-top: 6px; }
</style></head><body>
<div class="brand">
  ${logoDataUri ? `<img src="${logoDataUri}" alt="Papa J's logo" />` : ""}
  <div><p class="brand-name">Papa J's Laundry Shop</p></div>
</div>
<h1>Branch Reports Export</h1>
<div class="meta">
  <div><strong>Generated:</strong> ${escapeHtml(payload.generatedAt)}</div>
  <div><strong>Branch:</strong> ${escapeHtml(payload.branchName)}</div>
  <div><strong>Branch ID:</strong> ${escapeHtml(payload.branchId)}</div>
  <div><strong>View:</strong> ${escapeHtml(payload.viewTypeLabel)}</div>
  <div><strong>Range start:</strong> ${escapeHtml(payload.rangeStartDate || "—")}</div>
  <div><strong>Range end:</strong> ${escapeHtml(payload.rangeEndDate || "—")}</div>
</div>
<div class="kpi-grid">${summaryCards}</div>
<div class="section">
  <h2>Issue Status Trend</h2>
  ${renderTable(["Period", "Resolved", "Unresolved"], issueRows.length > 0 ? issueRows : [["No data", "0", "0"]])}
</div>
<div class="section">
  <h2>Payment Trend</h2>
  ${renderTable(["Period", "Paid", "Unpaid"], paymentRows.length > 0 ? paymentRows : [["No data", "0", "0"]])}
</div>
<div class="section">
  <h2>Performance Trend</h2>
  ${renderTable(["Period", "Revenue", "Unpaid", "Disputes", "Losses", "Profit"], performanceRows.length > 0 ? performanceRows : [["No data", "0.00", "0.00", "0.00", "0.00", "0.00"]])}
</div>
<div class="section">
  <h2>Growth Trend</h2>
  ${renderTable(["Period", "New", "Returning"], growthRows.length > 0 ? growthRows : [["No data", "0", "0"]])}
</div>
<div class="section">
  <h2>Loss & Quality - Refunds</h2>
  ${renderTable(["Reason", "Amount"], refundRows.length > 0 ? refundRows : [["No data", "0.00"]])}
</div>
<div class="section">
  <h2>Loss & Quality - Backjobs</h2>
  ${renderTable(["Reason", "Amount"], backjobRows.length > 0 ? backjobRows : [["No data", "0.00"]])}
</div>
<div class="section">
  <h2>White vs Colored</h2>
  ${renderTable(["Category", "Amount"], whiteRows.length > 0 ? whiteRows : [["No data", "0.00"]])}
</div>
<div class="section">
  <h2>Service Items</h2>
  ${renderTable(["#", "Service", "Amount"], serviceRows.length > 0 ? serviceRows : [["No data", "", "0.00"]])}
</div>
<div class="section">
  <h2>Recent Transactions</h2>
  ${renderTable(["Receipt", "Customer", "Payment", "Status", "Amount", "Date"], recentRows.length > 0 ? recentRows : [["No transactions", "", "", "", "0.00", ""]])}
</div>
<p class="note">This export reflects the current branch filter and the active date view at the moment of export.</p>
</body></html>`;
}

export async function exportBranchReportsPdf(
  payload: BranchReportsExportPayload,
  mode: "download" | "print" = "download"
): Promise<void> {
  const logoDataUri = await loadLogoDataUri();
  const html = buildPrintHtml(payload, logoDataUri);
  if (mode === "print") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `branch-reports-${stamp}.pdf`;

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
      dialogTitle: "Export Branch Reports PDF",
    });
  } else {
    Alert.alert("Export ready", filename);
  }
}