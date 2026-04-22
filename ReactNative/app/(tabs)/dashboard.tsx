import { useAuth } from "@/contexts/AuthContext";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { cacheDirectory, copyAsync, writeAsStringAsync } from "expo-file-system/legacy";
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_URL } from "../../config/api";

/** Backend expects `Y-m-d` for `date_from` / `date_to` on GET /transactions */
function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [yy, mm, dd] = ymd.split("-").map((v) => parseInt(v, 10));
  return new Date(yy, mm - 1, dd);
}

function defaultRangeStartYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return toYmd(d);
}

function eachYmdInRange(startYmd: string, endYmd: string): string[] {
  const out: string[] = [];
  const cur = parseYmd(startYmd);
  const end = parseYmd(endYmd);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cur <= end) {
    out.push(toYmd(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function formatRangeSummary(startYmd: string, endYmd: string): string {
  const a = parseYmd(startYmd);
  const b = parseYmd(endYmd);
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (a.getFullYear() !== b.getFullYear()) {
    return `${a.toLocaleDateString("en-US", { ...o, year: "numeric" })} – ${b.toLocaleDateString("en-US", { ...o, year: "numeric" })}`;
  }
  return `${a.toLocaleDateString("en-US", o)} – ${b.toLocaleDateString("en-US", o)}, ${b.getFullYear()}`;
}

/** Monday–Sunday week containing `d` (matches common business-week charts). */
function mondayOfCalendarWeek(d: Date): Date {
  const copy = new Date(d);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatBranchLabel(name: unknown): string {
  return String(name || "")
    .replace(/[-_]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/([.\/,:;!?])(\S)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

/** Refund KPI/chart: use refund_amount. Replacement: estimate from line item (not full receipt). */
function disputeChartAmountFromReport(row: any): number {
  const rt = String(row?.resolution_type || "").toLowerCase();
  if (rt === "refund") {
    const n = Number(row?.refund_amount);
    return Number.isFinite(n) ? n : 0;
  }
  if (rt === "replacement") {
    const line = Number(row?.transaction_item?.line_total);
    return Number.isFinite(line) ? line : 0;
  }
  return 0;
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function lower(v: unknown): string {
  return String(v || "").toLowerCase();
}

function isPaidStatus(status: unknown): boolean {
  const s = lower(status);
  return s === "paid" || s === "completed" || s === "success" || s === "done";
}

function parseMaybeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function issueAmountForBranchStats(row: any): number {
  const primary = disputeChartAmountFromReport(row);
  if (primary > 0) return primary;
  const line = safeNum(row?.transaction_item?.line_total);
  if (line > 0) return line;
  const tx = safeNum(row?.transaction?.amount);
  return tx > 0 ? tx : 0;
}

function shortLabel(label: string, max = 12): string {
  return label.length <= max ? label : `${label.slice(0, max - 1)}…`;
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

type BranchCompareMetricKey =
  | "totalRevenue"
  | "totalLosses"
  | "netProfit"
  | "disputeValue"
  | "resolvedRate"
  | "paidRate"
  | "weeklyRevenueAvg"
  | "backjobLoss"
  | "disputesPerDay"
  | "performanceIndex"
  | "growthTrend"
  | "rushPaidShare"
  | "whiteShare"
  | "serviceItems";

type BranchMetricFormat = "currency" | "count" | "percent";

const BRANCH_COMPARE_METRICS: Array<{ key: BranchCompareMetricKey; label: string; format: BranchMetricFormat }> = [
  { key: "totalRevenue", label: "Total Revenue", format: "currency" },
  { key: "totalLosses", label: "Total Losses", format: "currency" },
  { key: "netProfit", label: "Net Profit", format: "currency" },
  { key: "disputeValue", label: "Dispute Value", format: "currency" },
  { key: "resolvedRate", label: "Resolved vs Unresolved Cases", format: "percent" },
  { key: "paidRate", label: "Paid and Unpaid Orders", format: "percent" },
  { key: "weeklyRevenueAvg", label: "Weekly Revenue Trend", format: "currency" },
  { key: "backjobLoss", label: "Loss & Quality - Backjobs", format: "currency" },
  { key: "disputesPerDay", label: "Disputes Trend", format: "count" },
  { key: "performanceIndex", label: "Branch Performance (Revenue vs Losses)", format: "percent" },
  { key: "growthTrend", label: "Growth Trend", format: "percent" },
  { key: "rushPaidShare", label: "Rush vs Regular (Paid Revenue)", format: "percent" },
  { key: "whiteShare", label: "White and Colored", format: "percent" },
  { key: "serviceItems", label: "Service Items", format: "count" },
];

function formatMetricValue(value: number, format: BranchMetricFormat): string {
  if (format === "currency") {
    return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }
  return `${Math.round(value).toLocaleString()}`;
}

function normalizeMetricValues(values: number[]): number[] {
  const max = Math.max(...values.map((v) => Math.max(0, v)), 0);
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => Number(((Math.max(0, v) / max) * 100).toFixed(2)));
}

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtmlTable(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${headers.length}">No data</td></tr>`}</tbody></table>`;
}

function downloadCsvWeb(content: string, filename: string) {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
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

function looksRush(txn: any): boolean {
  const marker = `${lower(txn?.priority)} ${lower(txn?.service_type)} ${lower(txn?.service_name)} ${lower(txn?.delivery_type)} ${lower(txn?.notes)}`;
  return Boolean(txn?.is_rush) || marker.includes("rush") || marker.includes("express") || marker.includes("same day");
}

function extractLineItems(txn: any): any[] {
  if (Array.isArray(txn?.transaction_items)) return txn.transaction_items;
  if (Array.isArray(txn?.items)) return txn.items;
  if (Array.isArray(txn?.lines)) return txn.lines;
  return [];
}

function issueBranchId(row: any, txToBranch: Map<number, number>): number {
  const direct = safeNum(row?.branch_id || row?.transaction?.branch_id);
  if (direct > 0) return direct;
  const txId = safeNum(row?.transaction_id || row?.transaction?.id);
  if (txId > 0 && txToBranch.has(txId)) {
    return Number(txToBranch.get(txId));
  }
  return 0;
}

type BranchAnalytics = {
  id: number;
  name: string;
  shortName: string;
  metrics: Record<BranchCompareMetricKey, number>;
  trends: {
    weeklyRevenue: number[];
    disputes: number[];
    growthSplit: number[];
    revenueVsLosses: number[];
    resolvedVsUnresolved: number[];
    paidVsUnpaid: number[];
    rushVsRegular: number[];
    whiteVsColored: number[];
    backjobVsOtherLoss: number[];
    serviceItemsVsOrders: number[];
  };
  counts: {
    resolved: number;
    unresolved: number;
    paidOrders: number;
    unpaidOrders: number;
    totalOrders: number;
  };
};

type PeriodPreset = "weekly" | "monthly" | "yearly" | "range";

function rangeForPreset(preset: Exclude<PeriodPreset, "range">): [string, string] {
  const now = new Date();
  if (preset === "weekly") {
    const mon = mondayOfCalendarWeek(now);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    return [toYmd(mon), toYmd(sun)];
  }
  if (preset === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return [toYmd(start), toYmd(end)];
  }
  const y = now.getFullYear();
  return [`${y}-01-01`, `${y}-12-31`];
}

const { width: screenWidth } = Dimensions.get("window");
const isSmallScreen = screenWidth < 375;
const chartPadding = isSmallScreen ? 40 : 60;
const chartWidth = screenWidth - chartPadding;

// Responsive chart width helper: ensures enough horizontal space for x-axis labels on small screens
const getResponsiveChartWidth = (labels: string[]) => {
  const basePadding = 100;
  const estimated = labels.reduce((sum, label) => {
    const len = label.length;
    const widthPerChar = isSmallScreen ? 10 : 8;
    return sum + Math.max(len * widthPerChar, isSmallScreen ? 50 : 80);
  }, 0);
  return Math.max(chartWidth, estimated + basePadding);
};

export default function DashboardAnalytics() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("range");
  const [rangeFrom, setRangeFrom] = useState<string>(defaultRangeStartYmd);
  const [rangeTo, setRangeTo] = useState<string>(() => toYmd(new Date()));
  const [pickerTarget, setPickerTarget] = useState<null | "from" | "to">(null);
  const [iosPickerDraft, setIosPickerDraft] = useState<Date>(() => new Date());

  const [tooltipPos, setTooltipPos] = useState({
    x: 0,
    y: 0,
    value: 0,
    visible: false
  });

  // Tooltip state for branch comparison chart
  const [branchTooltip, setBranchTooltip] = useState({
    x: 0,
    y: 0,
    value: 0,
    label: '',
    visible: false,
  });
  const [branchPerfTooltip, setBranchPerfTooltip] = useState({
    x: 0,
    y: 0,
    value: 0,
    label: "",
    visible: false,
  });

  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { token, logout } = useAuth();

  const [transactions, setTransactions] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [issueReports, setIssueReports] = useState<any[]>([]);
  const [disputeChartType, setDisputeChartType] = useState<"refund" | "backjob">("refund");
  const [disputeTooltip, setDisputeTooltip] = useState({
    x: 0,
    y: 0,
    value: 0,
    label: "",
    visible: false,
  });
  const [branchCompareMetric, setBranchCompareMetric] = useState<BranchCompareMetricKey>("netProfit");
  const [branchCompareTooltip, setBranchCompareTooltip] = useState({
    x: 0,
    y: 0,
    value: 0,
    raw: 0,
    label: "",
    visible: false,
  });
  const [selectedBranchReportId, setSelectedBranchReportId] = useState<number | null>(null);
  const [branchDetailVisible, setBranchDetailVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      if (!token) return;

      let from = rangeFrom;
      let to = rangeTo;
      if (from > to) {
        const t = from;
        from = to;
        to = t;
      }

      const qs = new URLSearchParams({
        include_archived: "1",
        date_from: from,
        date_to: to,
      });

      const [txRes, brRes, issueRes] = await Promise.all([
        fetch(`${API_URL}/transactions?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
        fetch(`${API_URL}/branches`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
        fetch(`${API_URL}/issue-reports`, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        }),
      ]);

      const txData = txRes.ok ? await txRes.json() : [];
      const brData = brRes.ok ? await brRes.json() : [];
      const issueData = issueRes.ok ? await issueRes.json() : [];

      setTransactions(Array.isArray(txData) ? txData : []);
      setBranches(Array.isArray(brData) ? brData : []);
      setIssueReports(Array.isArray(issueData) ? issueData : []);
    } catch (error) {
      console.log(error);
    }
  }, [rangeFrom, rangeTo, token]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  // Ensure charts refresh immediately when date range changes.
  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const dailyRevenue = useMemo(() => {
    const days = eachYmdInRange(rangeFrom <= rangeTo ? rangeFrom : rangeTo, rangeFrom <= rangeTo ? rangeTo : rangeFrom);
    const labels = days.map((day) => {
      const d = parseYmd(day);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    });
    const values = days.map((day) =>
      transactions.reduce((sum, txn) => {
        if (!txn.created_at) return sum;
        if (toYmd(new Date(txn.created_at)) === day) return sum + Number(txn.amount || 0);
        return sum;
      }, 0)
    );
    return { labels, values };
  }, [transactions, rangeFrom, rangeTo]);

  const currentLabels = dailyRevenue.labels;
  const currentRevenue = dailyRevenue.values;

  const branchNames = branches.map((b) => formatBranchLabel(b.name));
  const currentBranchLabels = branchNames.length > 0 ? branchNames : ["No Branches"];

  const currentBranchValues = useMemo(() => {
    const totals = new Map<number, number>();
    branches.forEach((branch) => totals.set(Number(branch.id), 0));
    transactions.forEach((txn) => {
      const branchId = Number(txn.branch_id);
      if (!totals.has(branchId)) return;
      totals.set(branchId, (totals.get(branchId) || 0) + Number(txn.amount || 0));
    });
    if (branches.length === 0) return [0];
    return branches.map((branch) => Number((totals.get(Number(branch.id)) || 0).toFixed(2)));
  }, [transactions, branches]);

  const revenueChartKey = useMemo(
    () => `rev-${rangeFrom}-${rangeTo}-${currentRevenue.join(",")}`,
    [rangeFrom, rangeTo, currentRevenue]
  );
  const branchComparisonChartKey = useMemo(
    () => `brc-${rangeFrom}-${rangeTo}-${currentBranchValues.join(",")}`,
    [rangeFrom, rangeTo, currentBranchValues]
  );
  const branchPerformanceChartKey = useMemo(
    () => `brp-${rangeFrom}-${rangeTo}-${currentBranchValues.join(",")}`,
    [rangeFrom, rangeTo, currentBranchValues]
  );

  // Compute responsive chart widths so x-axis labels fit on narrow screens
  const revenueChartWidth = getResponsiveChartWidth(currentLabels);
  const branchComparisonChartWidth = getResponsiveChartWidth(currentBranchLabels);
  const branchPerformanceChartWidth = getResponsiveChartWidth(currentBranchLabels);

  const filteredResolvedDisputes = useMemo(() => {
    const from = parseYmd(rangeFrom <= rangeTo ? rangeFrom : rangeTo);
    const to = parseYmd(rangeFrom <= rangeTo ? rangeTo : rangeFrom);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    const resolutionType = disputeChartType === "refund" ? "refund" : "replacement";
    return issueReports.filter((row) => {
      if (String(row?.status || "").toLowerCase() !== "resolved") return false;
      if (String(row?.resolution_type || "").toLowerCase() !== resolutionType) return false;
      const dt = new Date(row?.resolved_at || row?.updated_at || 0);
      if (Number.isNaN(dt.getTime())) return false;
      return dt >= from && dt <= to;
    });
  }, [issueReports, rangeFrom, rangeTo, disputeChartType]);

  const disputeSeries = useMemo(() => {
    if (periodPreset === "weekly") {
      const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const start = mondayOfCalendarWeek(parseYmd(rangeTo));
      const rows = labels.map((name, idx) => {
        const d = new Date(start);
        d.setDate(start.getDate() + idx);
        d.setHours(0, 0, 0, 0);
        return { name, key: toYmd(d), amount: 0 };
      });
      filteredResolvedDisputes.forEach((r) => {
        const dt = new Date(r?.resolved_at || r?.updated_at || 0);
        if (Number.isNaN(dt.getTime())) return;
        const key = toYmd(dt);
        const row = rows.find((x) => x.key === key);
        if (row) row.amount += disputeChartAmountFromReport(r);
      });
      return { labels: rows.map((r) => r.name), values: rows.map((r) => Number(r.amount.toFixed(2))) };
    }

    if (periodPreset === "monthly") {
      const rows = [
        { name: "Week 1", amount: 0 },
        { name: "Week 2", amount: 0 },
        { name: "Week 3", amount: 0 },
        { name: "Week 4", amount: 0 },
      ];
      filteredResolvedDisputes.forEach((r) => {
        const dt = new Date(r?.resolved_at || r?.updated_at || 0);
        if (Number.isNaN(dt.getTime())) return;
        const idx = Math.min(3, Math.floor((dt.getDate() - 1) / 7));
        rows[idx].amount += disputeChartAmountFromReport(r);
      });
      return { labels: rows.map((r) => r.name), values: rows.map((r) => Number(r.amount.toFixed(2))) };
    }

    if (periodPreset === "yearly") {
      const rows = [
        { name: "Jan", amount: 0 }, { name: "Feb", amount: 0 }, { name: "Mar", amount: 0 },
        { name: "Apr", amount: 0 }, { name: "May", amount: 0 }, { name: "Jun", amount: 0 },
        { name: "Jul", amount: 0 }, { name: "Aug", amount: 0 }, { name: "Sep", amount: 0 },
        { name: "Oct", amount: 0 }, { name: "Nov", amount: 0 }, { name: "Dec", amount: 0 },
      ];
      filteredResolvedDisputes.forEach((r) => {
        const dt = new Date(r?.resolved_at || r?.updated_at || 0);
        if (Number.isNaN(dt.getTime())) return;
        rows[dt.getMonth()].amount += disputeChartAmountFromReport(r);
      });
      return { labels: rows.map((r) => r.name), values: rows.map((r) => Number(r.amount.toFixed(2))) };
    }

    const days = eachYmdInRange(rangeFrom <= rangeTo ? rangeFrom : rangeTo, rangeFrom <= rangeTo ? rangeTo : rangeFrom);
    const rows = days.map((day) => ({ day, amount: 0 }));
    filteredResolvedDisputes.forEach((r) => {
      const dt = new Date(r?.resolved_at || r?.updated_at || 0);
      if (Number.isNaN(dt.getTime())) return;
      const key = toYmd(dt);
      const row = rows.find((x) => x.day === key);
      if (row) row.amount += disputeChartAmountFromReport(r);
    });
    return {
      labels: rows.map((r) => parseYmd(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })),
      values: rows.map((r) => Number(r.amount.toFixed(2))),
    };
  }, [filteredResolvedDisputes, periodPreset, rangeFrom, rangeTo]);

  const disputeChartWidth = getResponsiveChartWidth(disputeSeries.labels);
  const disputeKpiAmount = useMemo(
    () => filteredResolvedDisputes.reduce((sum, r) => sum + disputeChartAmountFromReport(r), 0),
    [filteredResolvedDisputes]
  );
  const disputeKpiCount = filteredResolvedDisputes.length;

  const branchAnalytics = useMemo<BranchAnalytics[]>(() => {
    const safeFrom = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
    const safeTo = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
    const fromDate = parseYmd(safeFrom);
    const toDate = parseYmd(safeTo);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    const days = eachYmdInRange(safeFrom, safeTo);
    const dayIndex = new Map<string, number>();
    days.forEach((d, idx) => dayIndex.set(d, idx));

    const txToBranch = new Map<number, number>();
    transactions.forEach((txn) => {
      const txId = safeNum(txn?.id);
      const branchId = safeNum(txn?.branch_id);
      if (txId > 0 && branchId > 0) txToBranch.set(txId, branchId);
    });

    const byBranch = new Map<number, any>();

    const ensureBranch = (id: number, fallbackName?: string) => {
      if (byBranch.has(id)) return byBranch.get(id);
      const fromBranch = branches.find((b) => Number(b?.id) === id);
      const prettyName = formatBranchLabel(fromBranch?.name || fallbackName || `Branch ${id}`);
      const draft = {
        id,
        name: prettyName,
        shortName: shortLabel(prettyName),
        totalRevenue: 0,
        totalLosses: 0,
        disputeValue: 0,
        backjobLoss: 0,
        rushRevenue: 0,
        regularRevenue: 0,
        whiteRevenue: 0,
        coloredRevenue: 0,
        serviceItems: 0,
        paidOrders: 0,
        unpaidOrders: 0,
        totalOrders: 0,
        resolved: 0,
        unresolved: 0,
        dailyRevenue: days.map(() => 0),
        dailyDisputes: days.map(() => 0),
      };
      byBranch.set(id, draft);
      return draft;
    };

    branches.forEach((b) => {
      const id = safeNum(b?.id);
      if (id > 0) ensureBranch(id, b?.name);
    });

    transactions.forEach((txn) => {
      const branchId = safeNum(txn?.branch_id);
      if (branchId <= 0) return;
      const dt = parseMaybeDate(txn?.created_at || txn?.updated_at);
      if (!dt || dt < fromDate || dt > toDate) return;

      const bucket = ensureBranch(branchId);
      const amount = safeNum(txn?.amount);
      const paid = isPaidStatus(txn?.payment_status || txn?.status);
      const dayKey = toYmd(dt);
      const idx = dayIndex.get(dayKey);

      bucket.totalOrders += 1;
      if (paid) {
        bucket.paidOrders += 1;
        bucket.totalRevenue += amount;
        if (idx != null) bucket.dailyRevenue[idx] += amount;
      } else {
        bucket.unpaidOrders += 1;
      }

      if (paid) {
        if (looksRush(txn)) {
          bucket.rushRevenue += amount;
        } else {
          bucket.regularRevenue += amount;
        }
      }

      const lines = extractLineItems(txn);
      if (lines.length > 0) {
        lines.forEach((line) => {
          const serviceName = lower(line?.service_name || line?.name || txn?.service_name);
          const pieceCount = Math.max(1, safeNum(line?.piece_count || line?.quantity || 1));
          const lineAmount = safeNum(line?.line_total || line?.amount || 0);
          bucket.serviceItems += pieceCount;
          if (paid && serviceName.includes("white")) bucket.whiteRevenue += lineAmount > 0 ? lineAmount : amount;
          if (paid && (serviceName.includes("colored") || serviceName.includes("colour"))) {
            bucket.coloredRevenue += lineAmount > 0 ? lineAmount : amount;
          }
        });
      } else {
        bucket.serviceItems += Math.max(1, safeNum(txn?.piece_count || txn?.quantity || 1));
        const marker = `${lower(txn?.service_name)} ${lower(txn?.notes)}`;
        if (paid && marker.includes("white")) bucket.whiteRevenue += amount;
        if (paid && (marker.includes("colored") || marker.includes("colour"))) bucket.coloredRevenue += amount;
      }
    });

    issueReports.forEach((row) => {
      const branchId = issueBranchId(row, txToBranch);
      if (branchId <= 0) return;
      const dt = parseMaybeDate(row?.resolved_at || row?.updated_at || row?.created_at);
      if (!dt || dt < fromDate || dt > toDate) return;

      const bucket = ensureBranch(branchId);
      const amount = issueAmountForBranchStats(row);
      const status = lower(row?.status);

      bucket.disputeValue += amount;

      const dayKey = toYmd(dt);
      const idx = dayIndex.get(dayKey);
      if (idx != null) bucket.dailyDisputes[idx] += 1;

      if (status === "resolved") {
        bucket.resolved += 1;
        bucket.totalLosses += amount;
      } else {
        bucket.unresolved += 1;
      }

      if (lower(row?.resolution_type) === "replacement") {
        bucket.backjobLoss += amount;
      }
    });

    const finalReports: BranchAnalytics[] = Array.from(byBranch.values()).map((b) => {
      const weeklySlice = b.dailyRevenue.slice(-7);
      const disputesSlice = b.dailyDisputes.slice(-7);
      const totalCases = b.resolved + b.unresolved;

      const mid = Math.max(1, Math.floor(b.dailyRevenue.length / 2));
      const firstHalf = sum(b.dailyRevenue.slice(0, mid));
      const secondHalf = sum(b.dailyRevenue.slice(mid));
      const growth = firstHalf <= 0 && secondHalf <= 0 ? 0 : ((secondHalf - firstHalf) / Math.max(firstHalf, 1)) * 100;

      const rushTotal = b.rushRevenue + b.regularRevenue;
      const whiteTotal = b.whiteRevenue + b.coloredRevenue;
      const netProfit = b.totalRevenue - b.totalLosses;

      const metrics: Record<BranchCompareMetricKey, number> = {
        totalRevenue: Number(b.totalRevenue.toFixed(2)),
        totalLosses: Number(b.totalLosses.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        disputeValue: Number(b.disputeValue.toFixed(2)),
        resolvedRate: totalCases > 0 ? Number(((b.resolved / totalCases) * 100).toFixed(2)) : 0,
        paidRate: b.totalOrders > 0 ? Number(((b.paidOrders / b.totalOrders) * 100).toFixed(2)) : 0,
        weeklyRevenueAvg: Number((sum(weeklySlice) / Math.max(weeklySlice.length, 1)).toFixed(2)),
        backjobLoss: Number(b.backjobLoss.toFixed(2)),
        disputesPerDay: Number((sum(b.dailyDisputes) / Math.max(b.dailyDisputes.length, 1)).toFixed(2)),
        performanceIndex: b.totalRevenue > 0 ? Number(((netProfit / b.totalRevenue) * 100).toFixed(2)) : 0,
        growthTrend: Number(growth.toFixed(2)),
        rushPaidShare: rushTotal > 0 ? Number(((b.rushRevenue / rushTotal) * 100).toFixed(2)) : 0,
        whiteShare: whiteTotal > 0 ? Number(((b.whiteRevenue / whiteTotal) * 100).toFixed(2)) : 0,
        serviceItems: Number(b.serviceItems.toFixed(0)),
      };

      return {
        id: b.id,
        name: b.name,
        shortName: b.shortName,
        metrics,
        trends: {
          weeklyRevenue: weeklySlice.length ? weeklySlice : [0],
          disputes: disputesSlice.length ? disputesSlice : [0],
          growthSplit: [Number(firstHalf.toFixed(2)), Number(secondHalf.toFixed(2))],
          revenueVsLosses: [Number(b.totalRevenue.toFixed(2)), Number(b.totalLosses.toFixed(2))],
          resolvedVsUnresolved: [b.resolved, b.unresolved],
          paidVsUnpaid: [b.paidOrders, b.unpaidOrders],
          rushVsRegular: [Number(b.rushRevenue.toFixed(2)), Number(b.regularRevenue.toFixed(2))],
          whiteVsColored: [Number(b.whiteRevenue.toFixed(2)), Number(b.coloredRevenue.toFixed(2))],
          backjobVsOtherLoss: [Number(b.backjobLoss.toFixed(2)), Number((b.totalLosses - b.backjobLoss).toFixed(2))],
          serviceItemsVsOrders: [Number(b.serviceItems.toFixed(0)), b.totalOrders],
        },
        counts: {
          resolved: b.resolved,
          unresolved: b.unresolved,
          paidOrders: b.paidOrders,
          unpaidOrders: b.unpaidOrders,
          totalOrders: b.totalOrders,
        },
      };
    });

    return finalReports.sort((a, b) => b.metrics.totalRevenue - a.metrics.totalRevenue);
  }, [transactions, issueReports, branches, rangeFrom, rangeTo]);

  const selectedBranchMetricMeta = useMemo(
    () => BRANCH_COMPARE_METRICS.find((m) => m.key === branchCompareMetric) || BRANCH_COMPARE_METRICS[0],
    [branchCompareMetric]
  );

  const branchCompareLabels = useMemo(
    () => (branchAnalytics.length > 0 ? branchAnalytics.map((b) => b.shortName) : ["No Branches"]),
    [branchAnalytics]
  );

  const branchCompareRawValues = useMemo(() => {
    if (branchAnalytics.length === 0) return [0];
    return branchAnalytics.map((b) => b.metrics[branchCompareMetric]);
  }, [branchAnalytics, branchCompareMetric]);

  const branchCompareNormalizedValues = useMemo(
    () => normalizeMetricValues(branchCompareRawValues),
    [branchCompareRawValues]
  );

  const branchCompareChartWidth = getResponsiveChartWidth(branchCompareLabels);
  const branchCompareChartKey = useMemo(
    () => `branch-kpi-${branchCompareMetric}-${branchCompareNormalizedValues.join(",")}`,
    [branchCompareMetric, branchCompareNormalizedValues]
  );

  const selectedBranchReport = useMemo(
    () => branchAnalytics.find((b) => b.id === selectedBranchReportId) || null,
    [branchAnalytics, selectedBranchReportId]
  );

  const openBranchDetail = (branchId: number) => {
    setSelectedBranchReportId(branchId);
    setBranchDetailVisible(true);
  };

  const renderMiniLine = (values: number[], color: string) => (
    <LineChart
      data={{
        labels: values.map(() => ""),
        datasets: [{ data: values.length ? values : [0] }],
      }}
      width={200}
      height={100}
      withDots={false}
      withInnerLines={false}
      withOuterLines={false}
      withVerticalLabels={false}
      withHorizontalLabels={false}
      chartConfig={{
        backgroundColor: "#ffffff",
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        decimalPlaces: 0,
        color: () => color,
        labelColor: () => "rgba(30,41,59,1)",
      }}
      bezier
      style={styles.detailMiniChart}
    />
  );

  const renderMiniBar = (labels: string[], values: number[], color: string) => (
    <BarChart
      data={{ labels, datasets: [{ data: values.length ? values : [0] }] }}
      width={220}
      height={120}
      withHorizontalLabels={false}
      fromZero
      showValuesOnTopOfBars
      chartConfig={{
        backgroundColor: "#ffffff",
        backgroundGradientFrom: "#ffffff",
        backgroundGradientTo: "#ffffff",
        decimalPlaces: 0,
        color: () => color,
        labelColor: () => "rgba(51,65,85,1)",
        propsForLabels: { fontSize: 10 },
      }}
      style={styles.detailMiniChart}
    />
  );
  
  const totalSales = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const totalOrders = transactions.length;
  const salesTrend = currentRevenue.length ? Math.round(currentRevenue[currentRevenue.length - 1] || 0) : 0;
  const ordersTrend = Math.max(0, transactions.filter((t) => String(t.payment_status) === "paid").length);

  const handleExportDashboard = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const exportedAt = new Date();
      const stamp = toYmd(exportedAt);
      const filename = `dashboard-analytics-${stamp}.csv`;
      const safeFrom = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
      const safeTo = rangeFrom <= rangeTo ? rangeTo : rangeFrom;
      const currentMetricLabel = selectedBranchMetricMeta.label;
      const currentMetricFormat = selectedBranchMetricMeta.format;

      const lines: string[] = [];
      lines.push(csvEscape("DASHBOARD ANALYTICS EXPORT"));
      lines.push([csvEscape("Generated At"), csvEscape(exportedAt.toLocaleString())].join(","));
      lines.push([csvEscape("Date Range"), csvEscape(formatRangeSummary(rangeFrom, rangeTo))].join(","));
      lines.push([csvEscape("Filter • Period Preset"), csvEscape(periodPreset)].join(","));
      lines.push([csvEscape("Filter • Date From"), csvEscape(safeFrom)].join(","));
      lines.push([csvEscape("Filter • Date To"), csvEscape(safeTo)].join(","));
      lines.push([csvEscape("Filter • Dispute Type"), csvEscape(disputeChartType)].join(","));
      lines.push([csvEscape("Filter • Branch KPI Metric"), csvEscape(currentMetricLabel)].join(","));
      lines.push([csvEscape("Filter • Branch KPI Metric Format"), csvEscape(currentMetricFormat)].join(","));
      lines.push("");

      lines.push(csvEscape("SUMMARY"));
      lines.push([csvEscape("Total Sales (PHP)"), csvEscape(totalSales.toFixed(2))].join(","));
      lines.push([csvEscape("Total Orders"), csvEscape(totalOrders)].join(","));
      lines.push([csvEscape("Paid Orders"), csvEscape(ordersTrend)].join(","));
      lines.push([csvEscape("Resolved Dispute Cases"), csvEscape(disputeKpiCount)].join(","));
      lines.push([csvEscape("Dispute Value (PHP)"), csvEscape(disputeKpiAmount.toFixed(2))].join(","));
      lines.push("");

      lines.push(csvEscape("REVENUE TREND (VISIBLE CHART)"));
      lines.push([csvEscape("Bucket"), csvEscape("Revenue (PHP)")].join(","));
      currentLabels.forEach((label, idx) => {
        lines.push([
          csvEscape(label),
          csvEscape(Number(currentRevenue[idx] || 0).toFixed(2)),
        ].join(","));
      });
      lines.push("");

      lines.push(csvEscape("BRANCH REVENUE COMPARISON (VISIBLE CHART)"));
      lines.push([csvEscape("Branch"), csvEscape("Revenue (PHP)")].join(","));
      currentBranchLabels.forEach((label, idx) => {
        lines.push([
          csvEscape(label),
          csvEscape(Number(currentBranchValues[idx] || 0).toFixed(2)),
        ].join(","));
      });
      lines.push("");

      lines.push(csvEscape("DISPUTES TREND (VISIBLE CHART)"));
      lines.push([
        csvEscape("Bucket"),
        csvEscape("Dispute Value (PHP)"),
        csvEscape("Dispute Type Filter"),
      ].join(","));
      disputeSeries.labels.forEach((label, idx) => {
        lines.push([
          csvEscape(label),
          csvEscape(Number(disputeSeries.values[idx] || 0).toFixed(2)),
          csvEscape(disputeChartType),
        ].join(","));
      });
      lines.push("");

      lines.push(csvEscape("BRANCH KPI COMPARISON (SELECTED METRIC, VISIBLE CHART)"));
      lines.push([
        csvEscape("Branch"),
        csvEscape("Metric"),
        csvEscape("Raw Value"),
        csvEscape("Normalized (0-100)"),
      ].join(","));
      branchAnalytics.forEach((row, idx) => {
        lines.push([
          csvEscape(row.name),
          csvEscape(currentMetricLabel),
          csvEscape(Number(branchCompareRawValues[idx] || 0).toFixed(2)),
          csvEscape(Number(branchCompareNormalizedValues[idx] || 0).toFixed(2)),
        ].join(","));
      });
      lines.push("");

      const metricHeaders = BRANCH_COMPARE_METRICS.map((m) => m.label);
      lines.push(csvEscape("BRANCH KPI MATRIX (ALL DASHBOARD METRICS)"));
      lines.push([
        csvEscape("Branch"),
        ...metricHeaders.map((h) => csvEscape(h)),
      ].join(","));

      branchAnalytics.forEach((row) => {
        lines.push([
          csvEscape(row.name),
          ...BRANCH_COMPARE_METRICS.map((m) => csvEscape(row.metrics[m.key].toFixed(2))),
        ].join(","));
      });
      lines.push("");

      lines.push(csvEscape("BRANCH CASES & ORDER COUNTS"));
      lines.push([
        csvEscape("Branch"),
        csvEscape("Resolved Cases"),
        csvEscape("Unresolved Cases"),
        csvEscape("Paid Orders"),
        csvEscape("Unpaid Orders"),
        csvEscape("Total Orders"),
      ].join(","));
      branchAnalytics.forEach((row) => {
        lines.push([
          csvEscape(row.name),
          csvEscape(row.counts.resolved),
          csvEscape(row.counts.unresolved),
          csvEscape(row.counts.paidOrders),
          csvEscape(row.counts.unpaidOrders),
          csvEscape(row.counts.totalOrders),
        ].join(","));
      });
      lines.push("");

      lines.push(csvEscape("BRANCH TREND SERIES (MINI CHART DATA)"));
      lines.push([
        csvEscape("Branch"),
        csvEscape("Weekly Revenue"),
        csvEscape("Disputes"),
        csvEscape("Growth Split"),
        csvEscape("Revenue vs Losses"),
        csvEscape("Resolved vs Unresolved"),
        csvEscape("Paid vs Unpaid"),
        csvEscape("Rush vs Regular"),
        csvEscape("White vs Colored"),
        csvEscape("Backjob vs Other Loss"),
        csvEscape("Service Items vs Orders"),
      ].join(","));
      branchAnalytics.forEach((row) => {
        const joinSeries = (arr: number[]) => arr.map((n) => Number(n).toFixed(2)).join(" | ");
        lines.push([
          csvEscape(row.name),
          csvEscape(joinSeries(row.trends.weeklyRevenue)),
          csvEscape(joinSeries(row.trends.disputes)),
          csvEscape(joinSeries(row.trends.growthSplit)),
          csvEscape(joinSeries(row.trends.revenueVsLosses)),
          csvEscape(joinSeries(row.trends.resolvedVsUnresolved)),
          csvEscape(joinSeries(row.trends.paidVsUnpaid)),
          csvEscape(joinSeries(row.trends.rushVsRegular)),
          csvEscape(joinSeries(row.trends.whiteVsColored)),
          csvEscape(joinSeries(row.trends.backjobVsOtherLoss)),
          csvEscape(joinSeries(row.trends.serviceItemsVsOrders)),
        ].join(","));
      });

      const content = `\uFEFF${lines.join("\r\n")}`;

      if (Platform.OS === "web") {
        downloadCsvWeb(content, filename);
        return;
      }

      if (!cacheDirectory) {
        throw new Error("File storage is not available on this device.");
      }

      const uri = `${cacheDirectory}${filename}`;
      await writeAsStringAsync(uri, content, { encoding: "utf8" });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "text/csv",
          dialogTitle: "Export Dashboard Analytics",
        });
      } else {
        Alert.alert("Export ready", `Saved: ${filename}`);
      }
    } catch (e: any) {
      Alert.alert("Export failed", e?.message || "Could not export dashboard analytics.");
    } finally {
      setIsExporting(false);
    }
  }, [
    isExporting,
    rangeFrom,
    rangeTo,
    periodPreset,
    disputeChartType,
    selectedBranchMetricMeta,
    totalSales,
    totalOrders,
    ordersTrend,
    disputeKpiCount,
    disputeKpiAmount,
    currentLabels,
    currentRevenue,
    currentBranchLabels,
    currentBranchValues,
    disputeSeries,
    branchCompareRawValues,
    branchCompareNormalizedValues,
    branchAnalytics,
  ]);

  const handleExportDashboardPdf = useCallback(async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const exportedAt = new Date();
      const stamp = toYmd(exportedAt);
      const safeFrom = rangeFrom <= rangeTo ? rangeFrom : rangeTo;
      const safeTo = rangeFrom <= rangeTo ? rangeTo : rangeFrom;

      const summaryRows = [
        ["Total Sales (PHP)", Number(totalSales).toFixed(2)],
        ["Total Orders", String(totalOrders)],
        ["Paid Orders", String(ordersTrend)],
        ["Resolved Dispute Cases", String(disputeKpiCount)],
        ["Dispute Value (PHP)", Number(disputeKpiAmount).toFixed(2)],
      ];

      const revenueRows = currentLabels.map((label, idx) => [
        label,
        Number(currentRevenue[idx] || 0).toFixed(2),
      ]);

      const branchRevenueRows = currentBranchLabels.map((label, idx) => [
        label,
        Number(currentBranchValues[idx] || 0).toFixed(2),
      ]);

      const disputesRows = disputeSeries.labels.map((label, idx) => [
        label,
        Number(disputeSeries.values[idx] || 0).toFixed(2),
        disputeChartType,
      ]);

      const selectedKpiRows = branchAnalytics.map((row, idx) => [
        row.name,
        selectedBranchMetricMeta.label,
        Number(branchCompareRawValues[idx] || 0).toFixed(2),
        Number(branchCompareNormalizedValues[idx] || 0).toFixed(2),
      ]);

      const allKpiRows = branchAnalytics.map((row) => [
        row.name,
        ...BRANCH_COMPARE_METRICS.map((m) => Number(row.metrics[m.key]).toFixed(2)),
      ]);

      const countRows = branchAnalytics.map((row) => [
        row.name,
        String(row.counts.resolved),
        String(row.counts.unresolved),
        String(row.counts.paidOrders),
        String(row.counts.unpaidOrders),
        String(row.counts.totalOrders),
      ]);

      const trendsRows = branchAnalytics.map((row) => {
        const joinSeries = (arr: number[]) => arr.map((n) => Number(n).toFixed(2)).join(" | ");
        return [
          row.name,
          joinSeries(row.trends.weeklyRevenue),
          joinSeries(row.trends.disputes),
          joinSeries(row.trends.growthSplit),
          joinSeries(row.trends.revenueVsLosses),
          joinSeries(row.trends.resolvedVsUnresolved),
          joinSeries(row.trends.paidVsUnpaid),
          joinSeries(row.trends.rushVsRegular),
          joinSeries(row.trends.whiteVsColored),
          joinSeries(row.trends.backjobVsOtherLoss),
          joinSeries(row.trends.serviceItemsVsOrders),
        ];
      });

      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 18px; color: #0f172a; }
    h1 { margin: 0 0 6px; font-size: 22px; }
    h2 { margin: 16px 0 8px; font-size: 14px; }
    .meta { font-size: 10px; color: #475569; margin-bottom: 8px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 10px; }
    .meta strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 10px; }
    th, td { border: 1px solid #e2e8f0; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    tr:nth-child(even) td { background: #fafafa; }
    .note { font-size: 10px; color: #64748b; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>Dashboard Analytics Export</h1>
  <div class="meta">
    <div><strong>Generated:</strong> ${escapeHtml(exportedAt.toLocaleString())}</div>
    <div><strong>Date Range:</strong> ${escapeHtml(formatRangeSummary(rangeFrom, rangeTo))}</div>
    <div><strong>Period Preset:</strong> ${escapeHtml(periodPreset)}</div>
    <div><strong>Date From:</strong> ${escapeHtml(safeFrom)}</div>
    <div><strong>Date To:</strong> ${escapeHtml(safeTo)}</div>
    <div><strong>Dispute Type:</strong> ${escapeHtml(disputeChartType)}</div>
    <div><strong>Selected KPI Metric:</strong> ${escapeHtml(selectedBranchMetricMeta.label)}</div>
    <div><strong>Selected KPI Format:</strong> ${escapeHtml(selectedBranchMetricMeta.format)}</div>
  </div>

  <h2>Summary</h2>
  ${renderHtmlTable(["Metric", "Value"], summaryRows)}

  <h2>Revenue Trend (Visible Chart)</h2>
  ${renderHtmlTable(["Bucket", "Revenue (PHP)"], revenueRows)}

  <h2>Branch Revenue Comparison (Visible Chart)</h2>
  ${renderHtmlTable(["Branch", "Revenue (PHP)"], branchRevenueRows)}

  <h2>Disputes Trend (Visible Chart)</h2>
  ${renderHtmlTable(["Bucket", "Dispute Value (PHP)", "Dispute Type Filter"], disputesRows)}

  <h2>Branch KPI Comparison (Selected Metric)</h2>
  ${renderHtmlTable(["Branch", "Metric", "Raw Value", "Normalized (0-100)"], selectedKpiRows)}

  <h2>Branch KPI Matrix (All Metrics)</h2>
  ${renderHtmlTable(["Branch", ...BRANCH_COMPARE_METRICS.map((m) => m.label)], allKpiRows)}

  <h2>Branch Cases and Orders</h2>
  ${renderHtmlTable([
    "Branch",
    "Resolved Cases",
    "Unresolved Cases",
    "Paid Orders",
    "Unpaid Orders",
    "Total Orders",
  ], countRows)}

  <h2>Branch Trend Series (Mini Chart Data)</h2>
  ${renderHtmlTable([
    "Branch",
    "Weekly Revenue",
    "Disputes",
    "Growth Split",
    "Revenue vs Losses",
    "Resolved vs Unresolved",
    "Paid vs Unpaid",
    "Rush vs Regular",
    "White vs Colored",
    "Backjob vs Other Loss",
    "Service Items vs Orders",
  ], trendsRows)}

  <p class="note">This PDF reflects the active dashboard filters and currently visible data slices at export time.</p>
</body>
</html>`;

      if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
      }

      const { uri } = await Print.printToFileAsync({ html });
      const filename = `dashboard-analytics-${stamp}.pdf`;
      let shareUri = uri;

      if (cacheDirectory) {
        const dest = `${cacheDirectory}${filename}`;
        await copyAsync({ from: uri, to: dest });
        shareUri = dest;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: "Export Dashboard Analytics PDF",
        });
      } else {
        Alert.alert("Export ready", filename);
      }
    } catch (e: any) {
      Alert.alert("PDF export failed", e?.message || "Could not export dashboard PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [
    isExportingPdf,
    rangeFrom,
    rangeTo,
    periodPreset,
    disputeChartType,
    selectedBranchMetricMeta,
    totalSales,
    totalOrders,
    ordersTrend,
    disputeKpiCount,
    disputeKpiAmount,
    currentLabels,
    currentRevenue,
    currentBranchLabels,
    currentBranchValues,
    disputeSeries,
    branchCompareRawValues,
    branchCompareNormalizedValues,
    branchAnalytics,
  ]);
  
  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };
  
  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace("/(openingApps)/login");
  };

  const applyPeriodPreset = (p: PeriodPreset) => {
    setPeriodPreset(p);
    if (p === "range") return;
    const [from, to] = rangeForPreset(p);
    setRangeFrom(from);
    setRangeTo(to);
  };

  const applyPickedDate = (d: Date, target: "from" | "to") => {
    setPeriodPreset("range");
    const y = toYmd(d);
    let nf = target === "from" ? y : rangeFrom;
    let nt = target === "to" ? y : rangeTo;
    if (nf > nt) {
      const s = nf;
      nf = nt;
      nt = s;
    }
    setRangeFrom(nf);
    setRangeTo(nt);
  };

  const openDatePicker = (target: "from" | "to") => {
    setPickerTarget(target);
    setIosPickerDraft(parseYmd(target === "from" ? rangeFrom : rangeTo));
  };

  const onAndroidPickerChange = (event: { type?: string }, date?: Date) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (!target || event?.type === "dismissed" || !date) return;
    applyPickedDate(date, target);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* LEFT SIDE: Dashboard title + underline */}
        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Dashboard</Text>
          <View style={styles.headerAccent} />
        </View>

        {/* RIGHT SIDE: Export + Profile */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
            onPress={handleExportDashboard}
            disabled={isExporting}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={16} color="#ffffff" />
            <Text style={styles.exportBtnText}>{isExporting ? "CSV..." : "CSV"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportPdfBtn, isExportingPdf && styles.exportBtnDisabled]}
            onPress={handleExportDashboardPdf}
            disabled={isExportingPdf}
            activeOpacity={0.85}
          >
            <Ionicons name="document-text-outline" size={16} color="#ffffff" />
            <Text style={styles.exportBtnText}>{isExportingPdf ? "PDF..." : "PDF"}</Text>
          </TouchableOpacity>

          <View style={styles.profileContainer}>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => setOpen(!open)}
            >
              <Ionicons name="person-circle-outline" size={30} color="#1e293b" />
            </TouchableOpacity>

            {open && (
              <View style={styles.dropdown}>
                <TouchableOpacity style={styles.dropdownItem} onPress={handleProfile}>
                  <Text style={styles.dropdownText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemLast]} onPress={handleLogout}>
                  <Text style={styles.dropdownText}>Logout</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.dateRangeCard}>
            <Text style={styles.dateRangeTitle}>Date range</Text>
            <View style={styles.presetRow}>
              {(
                [
                  ["weekly", "Weekly"],
                  ["monthly", "Monthly"],
                  ["yearly", "Yearly"],
                  ["range", "Range"],
                ] as const
              ).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.presetChip, periodPreset === key && styles.presetChipActive]}
                  onPress={() => applyPeriodPreset(key)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[styles.presetChipText, periodPreset === key && styles.presetChipTextActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.dateRangeSummary}>{formatRangeSummary(rangeFrom, rangeTo)}</Text>
            <View style={styles.dateRangeRow}>
              <TouchableOpacity style={styles.dateChip} onPress={() => openDatePicker("from")} activeOpacity={0.85}>
                <Text style={styles.dateChipLabel}>From</Text>
                <Text style={styles.dateChipValue}>
                  {parseYmd(rangeFrom).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateChip} onPress={() => openDatePicker("to")} activeOpacity={0.85}>
                <Text style={styles.dateChipLabel}>To</Text>
                <Text style={styles.dateChipValue}>
                  {parseYmd(rangeTo).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {/* CARDS */}
        <View style={styles.cardRow}>
          {/* Total Sales Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Sales</Text>
            <Text style={styles.cardValue}>
              ₱{totalSales.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
              })}
            </Text>
            <View style={styles.cardTrend}>
              <Ionicons name="trending-up" size={16} color="#22c55e" />
              <Text style={styles.trendText}>
                +{salesTrend.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Total Orders Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Total Orders</Text>
            <Text style={styles.cardValue}>
              {totalOrders.toLocaleString()}
            </Text>
            <View style={styles.cardTrend}>
              <Ionicons name="trending-up" size={16} color="#22c55e" />
              <Text style={styles.trendText}>
                +{ordersTrend.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>


        {pickerTarget && Platform.OS === "android" ? (
          <DateTimePicker
            value={parseYmd(pickerTarget === "from" ? rangeFrom : rangeTo)}
            mode="date"
            display="default"
            onChange={onAndroidPickerChange}
          />
        ) : null}

        {pickerTarget && Platform.OS === "ios" ? (
          <Modal transparent animationType="fade" visible>
            <View style={styles.iosPickerOverlay}>
              <View style={styles.iosPickerSheet}>
                <View style={styles.iosPickerHeader}>
                  <TouchableOpacity onPress={() => setPickerTarget(null)}>
                    <Text style={styles.iosPickerCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (pickerTarget) applyPickedDate(iosPickerDraft, pickerTarget);
                      setPickerTarget(null);
                    }}
                  >
                    <Text style={styles.iosPickerDone}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={iosPickerDraft}
                  mode="date"
                  display="spinner"
                  onChange={(_, d) => d && setIosPickerDraft(d)}
                  style={{ alignSelf: "stretch" }}
                />
              </View>
            </View>
          </Modal>
        ) : null}

        {/* REVENUE */}
        <View style={styles.chartBox}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Revenue</Text>
          </View>
          <View style={{ alignItems: "center" }}>

            {/* Tooltip */}
            {tooltipPos.visible && (
              <View
                style={{
                  position: "absolute",
                  left: tooltipPos.x - 40,
                  top: tooltipPos.y - 50,
                  backgroundColor: "#4188faff",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  zIndex: 20,
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  ₱{Number(tooltipPos.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            {/* Pressable wrapping the chart - responsive/horizontally scrollable */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
              <Pressable
                onPressIn={() => setTooltipPos(prev => ({ ...prev, visible: true }))}
                onPressOut={() => setTooltipPos(prev => ({ ...prev, visible: false }))}
                style={{ width: revenueChartWidth + 50 }}
              >
                <LineChart
                  key={revenueChartKey}
                  data={{
                    labels: currentLabels,
                    datasets: [{ data: currentRevenue }],
                  }}
                  width={revenueChartWidth + 50}
                  height={200}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: () => `rgba(59, 130, 246, 1)`,
                    labelColor: () => `rgba(30, 41, 59, 1)`,
                    propsForLabels: {
                      fontSize: isSmallScreen ? 10 : 12,
                    },
                    formatYLabel: (y: string) => `₱${Number(y).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    propsForBackgroundLines: {
                      stroke: "#00000051",
                      strokeWidth: 1,
                    },
                  }}
                  bezier
                  style={{ marginLeft: 20, borderRadius: 20 }}
                  formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  onDataPointClick={(data) => {
                    setTooltipPos({
                      x: data.x,
                      y: data.y,
                      value: data.value,
                      visible: true,
                    });
                  }}
                />
              </Pressable>
            </ScrollView>
          </View>
        </View>
          {/* BRANCH REVENUE COMPARISON */}
          <View style={styles.chartBox}>
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>Branch Revenue Comparison</Text>
            </View>
            <View style={{ alignItems: "center" }}>

              {/* Branch Tooltip */}
              {branchTooltip.visible && (
                <View
                  style={{
                    position: "absolute",
                    left: branchTooltip.x - 40,
                    top: branchTooltip.y - 50,
                    backgroundColor: "#4188faff",
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    zIndex: 20,
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    {branchTooltip.label}: ₱{Number(branchTooltip.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', marginLeft: 0 }}>
                <Pressable
                  onPressIn={() => setBranchTooltip(prev => ({ ...prev, visible: true }))}
                  onPressOut={() => setBranchTooltip(prev => ({ ...prev, visible: false }))}
                  style={{ width: branchComparisonChartWidth + 50 }}
                >
                  <LineChart
                    key={branchComparisonChartKey}
                    data={{
                      labels: currentBranchLabels,
                      datasets: [{ data: currentBranchValues }],
                    }}
                    width={branchComparisonChartWidth + 50}
                    height={220}
                    chartConfig={{
                      backgroundColor: "#ffffff",
                      backgroundGradientFrom: "#ffffff",
                      backgroundGradientTo: "#ffffff",
                      decimalPlaces: 0,
                      color: () => `rgba(59, 130, 246, 1)`,
                      labelColor: () => `rgba(30, 41, 59, 1)`,
                      propsForLabels: {
                        fontSize: isSmallScreen ? 10 : 12,
                      },
                      propsForBackgroundLines: {
                        stroke: "#00000051",
                        strokeWidth: 1,
                      },
                    }}
                    formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    bezier
                    verticalLabelRotation={0}
                    fromZero={true}
                    style={{ marginLeft: 16, borderRadius: 12, marginTop: 8 }}
                    onDataPointClick={(data) => {
                      setBranchTooltip({
                        x: data.x,
                        y: data.y,
                        value: data.value,
                        label: currentBranchLabels[data.index],
                        visible: true,
                      });
                    }}
                  />
                </Pressable>
              </ScrollView>
            </View>
          </View>
        {/* BRANCH PERFORMANCE - Separate Container */}
        <View style={styles.branchPerformanceBox}>
          <View style={styles.branchPerformanceHeader}>
            <Text style={styles.branchPerformanceTitle}>Branch Performance</Text>
          </View>
          <View style={styles.barChartWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', marginLeft: 0 }}>
              <LineChart
                key={branchPerformanceChartKey}
                data={{
                  labels: currentBranchLabels,
                  datasets: [{ data: currentBranchValues }]
                }}
                width={branchPerformanceChartWidth + 50}
                height={isSmallScreen ? 260 : 300}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(30, 41, 59, ${opacity})`,
                  propsForLabels: {
                    fontSize: isSmallScreen ? 10 : 12,
                  },
                  barPercentage: currentBranchLabels.length > 10 ? 0.4 : 0.6,
                  propsForBackgroundLines: {
                    strokeDasharray: "",
                    stroke: "#e2e8f0",
                    strokeWidth: 1,
                  },
                }}
                formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                bezier
                style={{ marginLeft: 16, borderRadius: 12, marginTop: 10 }}
                verticalLabelRotation={0}
                fromZero={true}
                segments={4}
                onDataPointClick={(data) => {
                  setBranchPerfTooltip({
                    x: data.x,
                    y: data.y,
                    value: data.value,
                    label: currentBranchLabels[data.index],
                    visible: true,
                  });
                }}
              />
            </ScrollView>
            {branchPerfTooltip.visible && (
              <View
                style={{
                  position: "absolute",
                  left: branchPerfTooltip.x - 40,
                  top: branchPerfTooltip.y - 50,
                  backgroundColor: "#4188faff",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  zIndex: 20,
                }}
              >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                  {branchPerfTooltip.label}: ₱{Number(branchPerfTooltip.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* NORMALIZED BRANCH KPI COMPARISON */}
        <View style={styles.chartBox}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Branch KPI Comparison</Text>
            <Text style={styles.kpiCompareSubtext}>
              One normalized graph for side-by-side branch comparison. Select a metric, then tap a branch for full detail.
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiMetricSelectorRow}
          >
            {BRANCH_COMPARE_METRICS.map((metric) => (
              <TouchableOpacity
                key={metric.key}
                style={[
                  styles.kpiMetricChip,
                  branchCompareMetric === metric.key && styles.kpiMetricChipActive,
                ]}
                onPress={() => setBranchCompareMetric(metric.key)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.kpiMetricChipText,
                    branchCompareMetric === metric.key && styles.kpiMetricChipTextActive,
                  ]}
                >
                  {metric.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.kpiMetricSummaryText}>
            Metric: {selectedBranchMetricMeta.label} ({selectedBranchMetricMeta.format === "currency" ? "PHP" : selectedBranchMetricMeta.format === "percent" ? "Percent" : "Count"})
          </Text>

          <View style={{ alignItems: "center" }}>
            {branchCompareTooltip.visible && (
              <View
                style={{
                  position: "absolute",
                  left: branchCompareTooltip.x - 50,
                  top: branchCompareTooltip.y - 56,
                  backgroundColor: "#0f172a",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  zIndex: 20,
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {branchCompareTooltip.label}: {formatMetricValue(branchCompareTooltip.raw, selectedBranchMetricMeta.format)}
                </Text>
                <Text style={{ color: "#cbd5e1", fontSize: 11 }}>
                  Normalized: {branchCompareTooltip.value.toFixed(1)}
                </Text>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center" }}>
              <Pressable
                onPressOut={() => setBranchCompareTooltip((prev) => ({ ...prev, visible: false }))}
                style={{ width: branchCompareChartWidth + 30 }}
              >
                <BarChart
                  key={branchCompareChartKey}
                  data={{
                    labels: branchCompareLabels,
                    datasets: [{ data: branchCompareNormalizedValues }],
                  }}
                  width={branchCompareChartWidth + 30}
                  height={240}
                  fromZero
                  yAxisSuffix=""
                  showValuesOnTopOfBars
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: () => "rgba(15,118,110,1)",
                    labelColor: () => "rgba(30,41,59,1)",
                    propsForLabels: {
                      fontSize: isSmallScreen ? 10 : 12,
                    },
                    propsForBackgroundLines: {
                      stroke: "#0000002d",
                      strokeWidth: 1,
                    },
                  }}
                  style={{ marginLeft: 12, borderRadius: 12 }}
                  onDataPointClick={(data) => {
                    const row = branchAnalytics[data.index];
                    if (!row) return;
                    setBranchCompareTooltip({
                      x: data.x,
                      y: data.y,
                      value: data.value,
                      raw: row.metrics[branchCompareMetric],
                      label: row.shortName,
                      visible: true,
                    });
                    openBranchDetail(row.id);
                  }}
                />
              </Pressable>
            </ScrollView>
          </View>

          <View style={styles.branchDrillRow}>
            {branchAnalytics.map((b) => (
              <TouchableOpacity
                key={`drill-${b.id}`}
                style={styles.branchDrillChip}
                onPress={() => openBranchDetail(b.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.branchDrillChipText}>{b.shortName}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* OVERALL DISPUTES (ALL BRANCHES) */}
        <View style={styles.chartBox}>
          <View style={styles.disputeHeaderRow}>
            <Text style={styles.chartTitle}>Disputes</Text>
            <View style={styles.disputeTypeRow}>
              <TouchableOpacity
                style={[styles.disputeTypeChip, disputeChartType === "refund" && styles.disputeTypeChipActive]}
                onPress={() => setDisputeChartType("refund")}
                activeOpacity={0.85}
              >
                <Text style={[styles.disputeTypeChipText, disputeChartType === "refund" && styles.disputeTypeChipTextActive]}>
                  Refund
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.disputeTypeChip, disputeChartType === "backjob" && styles.disputeTypeChipActive]}
                onPress={() => setDisputeChartType("backjob")}
                activeOpacity={0.85}
              >
                <Text style={[styles.disputeTypeChipText, disputeChartType === "backjob" && styles.disputeTypeChipTextActive]}>
                  Backjob
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.disputeKpiRow}>
            <View style={styles.disputeKpiCard}>
              <Text style={styles.disputeKpiLabel}>
                {disputeChartType === "refund" ? "Total Refund Amount (Est.)" : "Total Backjob Amount (Est.)"}
              </Text>
              <Text style={styles.disputeKpiValue}>
                ₱{disputeKpiAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
            <View style={styles.disputeKpiCard}>
              <Text style={styles.disputeKpiLabel}>
                {disputeChartType === "refund" ? "Refund Cases Resolved" : "Backjob Cases Resolved"}
              </Text>
              <Text style={styles.disputeKpiValue}>{disputeKpiCount.toLocaleString()}</Text>
            </View>
          </View>

          <View style={{ alignItems: "center" }}>
            {disputeTooltip.visible && (
              <View
                style={{
                  position: "absolute",
                  left: disputeTooltip.x - 40,
                  top: disputeTooltip.y - 50,
                  backgroundColor: disputeChartType === "refund" ? "#0d9488" : "#7c3aed",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  zIndex: 20,
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {disputeTooltip.label}: ₱{Number(disputeTooltip.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center" }}>
              <Pressable
                onPressOut={() => setDisputeTooltip((prev) => ({ ...prev, visible: false }))}
                style={{ width: disputeChartWidth + 50 }}
              >
                <LineChart
                  key={`disp-${periodPreset}-${disputeChartType}-${disputeSeries.values.join(",")}`}
                  data={{
                    labels: disputeSeries.labels,
                    datasets: [{ data: disputeSeries.values.length ? disputeSeries.values : [0] }],
                  }}
                  width={disputeChartWidth + 50}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: () => (disputeChartType === "refund" ? "rgba(13,148,136,1)" : "rgba(124,58,237,1)"),
                    labelColor: () => `rgba(30, 41, 59, 1)`,
                    propsForLabels: {
                      fontSize: isSmallScreen ? 10 : 12,
                    },
                    propsForBackgroundLines: {
                      stroke: "#00000051",
                      strokeWidth: 1,
                    },
                  }}
                  formatYLabel={(yValue) => `₱${Number(yValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  bezier
                  fromZero
                  style={{ marginLeft: 16, borderRadius: 12, marginTop: 8 }}
                  onDataPointClick={(data) => {
                    setDisputeTooltip({
                      x: data.x,
                      y: data.y,
                      value: data.value,
                      label: disputeSeries.labels[data.index] || "",
                      visible: true,
                    });
                  }}
                />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </ScrollView>

      <Modal visible={branchDetailVisible && !!selectedBranchReport} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.branchDetailContainer}>
          <View style={styles.branchDetailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.branchDetailTitle}>{selectedBranchReport?.name || "Branch Detail"}</Text>
              <Text style={styles.branchDetailSubtitle}>Full report with all KPI sections and mini charts.</Text>
            </View>
            <TouchableOpacity
              style={styles.branchDetailCloseBtn}
              onPress={() => setBranchDetailVisible(false)}
              activeOpacity={0.85}
            >
              <Ionicons name="close" size={22} color="#0f172a" />
            </TouchableOpacity>
          </View>

          {selectedBranchReport ? (
            <ScrollView contentContainerStyle={styles.branchDetailContent}>
              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Total Revenue</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.totalRevenue, "currency")}</Text>
                {renderMiniLine(selectedBranchReport.trends.weeklyRevenue, "rgba(37,99,235,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Total Losses</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.totalLosses, "currency")}</Text>
                {renderMiniBar(["Loss"], [selectedBranchReport.metrics.totalLosses], "rgba(220,38,38,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Net Profit</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.netProfit, "currency")}</Text>
                {renderMiniBar(["Revenue", "Loss"], selectedBranchReport.trends.revenueVsLosses, "rgba(5,150,105,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Dispute Value</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.disputeValue, "currency")}</Text>
                {renderMiniLine(selectedBranchReport.trends.disputes, "rgba(217,119,6,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Resolved vs Unresolved Cases</Text>
                <Text style={styles.branchMetricValue}>
                  {selectedBranchReport.counts.resolved} / {selectedBranchReport.counts.unresolved}
                </Text>
                {renderMiniBar(["Resolved", "Unresolved"], selectedBranchReport.trends.resolvedVsUnresolved, "rgba(14,116,144,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Paid and Unpaid Orders</Text>
                <Text style={styles.branchMetricValue}>
                  {selectedBranchReport.counts.paidOrders} / {selectedBranchReport.counts.unpaidOrders}
                </Text>
                {renderMiniBar(["Paid", "Unpaid"], selectedBranchReport.trends.paidVsUnpaid, "rgba(30,64,175,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Weekly Revenue Trend</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.weeklyRevenueAvg, "currency")}</Text>
                {renderMiniLine(selectedBranchReport.trends.weeklyRevenue, "rgba(37,99,235,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Loss & Quality - Backjobs</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.backjobLoss, "currency")}</Text>
                {renderMiniBar(["Backjob", "Other Loss"], selectedBranchReport.trends.backjobVsOtherLoss, "rgba(124,58,237,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Disputes Trend</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.disputesPerDay, "count")}/day</Text>
                {renderMiniLine(selectedBranchReport.trends.disputes, "rgba(202,138,4,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Branch Performance (Revenue vs Losses)</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.performanceIndex, "percent")}</Text>
                {renderMiniBar(["Revenue", "Loss"], selectedBranchReport.trends.revenueVsLosses, "rgba(2,132,199,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Growth Trend</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.growthTrend, "percent")}</Text>
                {renderMiniBar(["First Half", "Second Half"], selectedBranchReport.trends.growthSplit, "rgba(16,185,129,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Rush vs Regular (Paid Revenue)</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.rushPaidShare, "percent")}</Text>
                {renderMiniBar(["Rush", "Regular"], selectedBranchReport.trends.rushVsRegular, "rgba(217,70,239,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>White and Colored</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.whiteShare, "percent")}</Text>
                {renderMiniBar(["White", "Colored"], selectedBranchReport.trends.whiteVsColored, "rgba(79,70,229,1)")}
              </View>

              <View style={styles.branchMetricCard}>
                <Text style={styles.branchMetricTitle}>Service Items</Text>
                <Text style={styles.branchMetricValue}>{formatMetricValue(selectedBranchReport.metrics.serviceItems, "count")}</Text>
                {renderMiniBar(["Items", "Orders"], selectedBranchReport.trends.serviceItemsVsOrders, "rgba(22,163,74,1)")}
              </View>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000, // Added high z-index to header
  },
  headerText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
  },
  headerAccent: {
    position: "absolute",
    bottom: -8,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  headerLeft: {
    flexDirection: "column",
    position: "relative",
  },
  profileContainer: {
    position: "relative",
    zIndex: 2000, // Higher z-index for profile container
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  exportPdfBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  exportBtnDisabled: {
    opacity: 0.7,
  },
  exportBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  profileBtn: {
    padding: 6,
  },
  cardRow: {
    flexDirection: "row",
    padding: 20,
    gap: 16,
    zIndex: 1, // Lower z-index for cards
  },
  card: {
    flex: 1,
    padding: 24,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 8,
    letterSpacing: -0.5,
    flexShrink: 1,
    flexWrap: 'nowrap',
  },
  cardTrend: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  trendText: {
    marginLeft: 6,
    color: "#22c55e",
    fontSize: 13,
    fontWeight: "700",
  },
  dateRangeCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 8,
    padding: 18,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateRangeTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  presetChipActive: {
    backgroundColor: "#3b82f6",
  },
  presetChipText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
  },
  presetChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  dateRangeSummary: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 14,
  },
  dateRangeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateChip: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dateChipLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  dateChipValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  iosPickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  iosPickerSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  iosPickerCancel: {
    fontSize: 16,
    color: "#64748b",
    fontWeight: "600",
  },
  iosPickerDone: {
    fontSize: 16,
    color: "#3b82f6",
    fontWeight: "700",
  },
  chartBox: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 10,
    paddingLeft: 25,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: "visible", // allow axis labels to render outside rounded container
  },
  chartHeader: {
    marginBottom: 16,
  },
  disputeHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 8,
    gap: 10,
  },
  disputeTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  disputeTypeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
  },
  disputeTypeChipActive: {
    backgroundColor: "#0f172a",
  },
  disputeTypeChipText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
  },
  disputeTypeChipTextActive: {
    color: "#ffffff",
  },
  disputeKpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  disputeKpiCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  disputeKpiLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
    marginBottom: 6,
  },
  disputeKpiValue: {
    fontSize: 22,
    color: "#0f172a",
    fontWeight: "800",
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  kpiCompareSubtext: {
    fontSize: 12,
    lineHeight: 18,
    color: "#64748b",
    marginTop: -6,
  },
  kpiMetricSelectorRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 10,
    paddingRight: 6,
  },
  kpiMetricChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  kpiMetricChipActive: {
    backgroundColor: "#0f766e",
    borderColor: "#0f766e",
  },
  kpiMetricChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  kpiMetricChipTextActive: {
    color: "#ffffff",
  },
  kpiMetricSummaryText: {
    fontSize: 12,
    color: "#0f172a",
    fontWeight: "700",
    marginBottom: 8,
  },
  branchDrillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  branchDrillChip: {
    backgroundColor: "#ecfeff",
    borderColor: "#a5f3fc",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  branchDrillChipText: {
    color: "#155e75",
    fontSize: 12,
    fontWeight: "700",
  },
  branchDetailContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  branchDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  branchDetailTitle: {
    fontSize: 20,
    color: "#0f172a",
    fontWeight: "800",
  },
  branchDetailSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  branchDetailCloseBtn: {
    height: 34,
    width: 34,
    borderRadius: 17,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  branchDetailContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    paddingBottom: 40,
  },
  branchMetricCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  branchMetricTitle: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "700",
    marginBottom: 4,
  },
  branchMetricValue: {
    fontSize: 18,
    color: "#0f172a",
    fontWeight: "800",
    marginBottom: 8,
  },
  detailMiniChart: {
    marginLeft: -12,
    borderRadius: 10,
  },
  branchPerformanceBox: {
    backgroundColor: "#ffffff",
    marginHorizontal: 20,
    marginTop: 16,
    paddingLeft: 25,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: "visible",
  },
  branchPerformanceHeader: {
    marginBottom: 16,
  },
  branchPerformanceTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  barChartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  barChart: {
    borderRadius: 12,
    marginTop: 10,
  },
  dropdown: {
    position: "absolute",
    top: 40,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 999, // Very high elevation for dropdown
    minWidth: 120,
    zIndex: 9999, // Extremely high z-index
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownItemLast: {
    borderBottomWidth: 0, // Remove border from last item
  },
  dropdownText: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "600",
  },
});