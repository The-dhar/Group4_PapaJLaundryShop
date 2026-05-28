import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { BarChart, LineChart } from "react-native-chart-kit";
import { useAuth } from "@/contexts/AuthContext";
import { useBranchPages } from "@/contexts/BranchPagesContext";
import { API_URL } from "../../config/api";
import { exportBranchReportsPdf } from "@/lib/branchReportsPdfExport";

type ViewType = "today" | "week" | "month" | "year";

type TransactionLike = {
  id?: number;
  receipt?: string;
  amount?: number | string;
  payment_status?: string;
  inventory_status?: string;
  is_rush?: boolean | number;
  extra_charge_type?: string;
  active_extras?: {
    express?: boolean;
  };
  customer_name?: string;
  customer_address?: string;
  created_at?: string;
  updated_at?: string;
  branch_id?: number | string;
  weight?: number | string;
  total_weight?: number | string;
  receipt_items?: TransactionItemLike[];
  services?: TransactionItemLike[];
  transaction_items?: TransactionItemLike[];
  items?: TransactionItemLike[];
  transaction_item?: TransactionItemLike;
};

type TransactionItemLike = {
  line_total?: number | string;
  total?: number | string;
  amount?: number | string;
  is_white?: boolean | number | string;
  color?: string;
  colour?: string;
  variant?: string;
  tag?: string;
  laundryType?: string;
  laundry_type?: string;
  serviceName?: string;
  service_name?: string;
  name?: string;
  service?: string;
  product?: string;
  item?: string;
};

type IssueReportLike = {
  id?: number | string;
  status?: string;
  issue_type?: string;
  issue_note?: string;
  resolution_type?: string;
  refund_amount?: number | string;
  created_at?: string;
  resolved_at?: string;
  updated_at?: string;
  branch_id?: number | string;
  transaction?: {
    branch_id?: number | string;
  };
  transaction_item?: {
    line_total?: number | string;
    transaction?: {
      branch_id?: number | string;
    };
  };
};

function getViewDateBounds(viewType: ViewType, referenceDate: Date = new Date()) {
  const now = new Date(referenceDate);
  const start = new Date(now);
  const end = new Date(now);

  if (viewType === "today") {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (viewType === "week") {
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (viewType === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(11, 31);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

type TimeBucket = {
  name: string;
  start: Date;
  end: Date;
};

function buildBuckets(viewType: ViewType, referenceDate: Date): TimeBucket[] {
  const bounds = getViewDateBounds(viewType, referenceDate);

  if (viewType === "today") {
    const labels = ["8AM", "10AM", "12PM", "2PM", "4PM", "6PM"];
    const day = new Date(bounds.start);
    return labels.map((label, idx) => {
      const start = new Date(day);
      start.setHours(8 + idx * 2, 0, 0, 0);
      const end = new Date(start);
      end.setHours(start.getHours() + 1, 59, 59, 999);
      return { name: label, start, end };
    });
  }

  if (viewType === "week") {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return labels.map((label, idx) => {
      const start = new Date(bounds.start);
      start.setDate(bounds.start.getDate() + idx);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { name: label, start, end };
    });
  }

  if (viewType === "month") {
    const y = bounds.start.getFullYear();
    const m = bounds.start.getMonth();
    const monthEnd = new Date(y, m + 1, 0).getDate();
    return [0, 1, 2, 3].map((w) => {
      const startDay = w * 7 + 1;
      const endDay = w === 3 ? monthEnd : (w + 1) * 7;
      const start = new Date(y, m, startDay, 0, 0, 0, 0);
      const end = new Date(y, m, endDay, 23, 59, 59, 999);
      return { name: `Week ${w + 1}`, start, end };
    });
  }

  const year = bounds.start.getFullYear();
  const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return labels.map((label, month) => {
    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return { name: label, start, end };
  });
}

function disputeAmountFromReport(row: IssueReportLike): number {
  const resolutionType = String(row?.resolution_type || "").toLowerCase();
  if (resolutionType === "refund") {
    const refund = Number(row?.refund_amount);
    return Number.isFinite(refund) ? refund : 0;
  }

  if (resolutionType === "replacement") {
    const replacement = Number(row?.transaction_item?.line_total);
    return Number.isFinite(replacement) ? replacement : 0;
  }

  return 0;
}

function reportDate(row: IssueReportLike): Date {
  const dt = new Date(row?.resolved_at || row?.updated_at || 0);
  return dt;
}

function issueStatusDate(row: IssueReportLike): Date {
  const isResolved = String(row?.status || "").toLowerCase() === "resolved";
  const dt = new Date(isResolved ? (row?.resolved_at || row?.updated_at || 0) : (row?.created_at || row?.updated_at || 0));
  return dt;
}

function reportBranchId(row: IssueReportLike): string {
  if (row?.branch_id != null) return String(row.branch_id);
  if (row?.transaction?.branch_id != null) return String(row.transaction.branch_id);
  if (row?.transaction_item?.transaction?.branch_id != null) {
    return String(row.transaction_item.transaction.branch_id);
  }
  return "";
}

function formatPhp(amount: number): string {
  return `PHP ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function isRushOrder(row: TransactionLike): boolean {
  if (row?.is_rush === true || row?.is_rush === 1) return true;
  if (row?.active_extras?.express) return true;
  const extraChargeType = String(row?.extra_charge_type || "").toLowerCase();
  return extraChargeType.includes("express");
}

function extractTransactionItems(txn: TransactionLike): TransactionItemLike[] {
  if (Array.isArray(txn.receipt_items) && txn.receipt_items.length > 0) return txn.receipt_items;
  if (Array.isArray(txn.services) && txn.services.length > 0) return txn.services;
  if (Array.isArray(txn.transaction_items) && txn.transaction_items.length > 0) return txn.transaction_items;
  if (Array.isArray(txn.items) && txn.items.length > 0) return txn.items;
  if (txn.transaction_item && typeof txn.transaction_item === "object") return [txn.transaction_item];
  return [];
}

function isWhiteItem(item: TransactionItemLike): boolean {
  if (item?.is_white === true || item?.is_white === 1 || item?.is_white === "1") return true;
  const color = String(item?.color || item?.colour || item?.variant || item?.tag || "").toLowerCase();
  if (color.includes("white")) return true;
  const serviceName = String(item?.service_name || item?.serviceName || item?.name || item?.item || "").toLowerCase();
  return serviceName.includes("white");
}

function serviceItemName(item: TransactionItemLike): string {
  const washType = String(item?.laundryType || item?.laundry_type || "").trim().toLowerCase();
  const candidates = [
    item?.serviceName,
    item?.service_name,
    item?.item,
    item?.product,
    item?.name,
    item?.service,
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();
    if (!washType) return candidate;
    if (normalized === washType) continue;

    const withDashPrefix = `${washType} - `;
    const withColonPrefix = `${washType}: `;
    if (normalized.startsWith(withDashPrefix)) {
      const stripped = candidate.slice(withDashPrefix.length).trim();
      if (stripped) return stripped;
      continue;
    }
    if (normalized.startsWith(withColonPrefix)) {
      const stripped = candidate.slice(withColonPrefix.length).trim();
      if (stripped) return stripped;
      continue;
    }

    return candidate;
  }

  if (washType) return String(item?.laundryType || item?.laundry_type || "").trim();
  return "Unknown";
}

function customerIdentityKey(txn: TransactionLike): string {
  return `${String(txn.customer_name || "").trim().toLowerCase()}|${String(txn.customer_address || "").trim().toLowerCase()}`;
}

function issueTypeKey(issueType?: string): string {
  return String(issueType || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "");
}

function inRange(date: Date, start: Date, end: Date): boolean {
  return !Number.isNaN(date.getTime()) && date >= start && date <= end;
}

function bucketIndexForDate(date: Date, buckets: TimeBucket[]): number {
  return buckets.findIndex((b) => date >= b.start && date <= b.end);
}

export default function BranchReportsScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = useMemo(() => {
    // Keep chart width aligned with card's inner content to avoid overflow on phones.
    const cardInnerWidth = screenWidth - 56;
    return Math.max(220, cardInnerWidth);
  }, [screenWidth]);

  const { token } = useAuth();
  const { branchId, branchName } = useBranchPages();

  const [isLoading, setIsLoading] = useState(true);
  const [viewType, setViewType] = useState<ViewType>("week");
  const [transactions, setTransactions] = useState<TransactionLike[]>([]);
  const [reports, setReports] = useState<IssueReportLike[]>([]);
  const [chartPointHint, setChartPointHint] = useState<string>("");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const loadBranchReports = useCallback(async () => {
    try {
      if (!token) return;
      setIsLoading(true);

      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      const [txRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/transactions?include_archived=1`, { headers }),
        fetch(`${API_URL}/issue-reports`, { headers }),
      ]);

      const txData = txRes.ok ? await txRes.json() : [];
      const reportData = reportsRes.ok ? await reportsRes.json() : [];

      setTransactions(Array.isArray(txData) ? txData : []);
      setReports(Array.isArray(reportData) ? reportData : []);
    } catch (error) {
      console.log(error);
      setTransactions([]);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadBranchReports();
    }, [loadBranchReports])
  );

  const branchTransactions = useMemo(() => {
    if (!branchId) return [];
    return transactions.filter((row) => String(row?.branch_id ?? "") === String(branchId));
  }, [transactions, branchId]);

  const viewBounds = useMemo(() => getViewDateBounds(viewType, new Date()), [viewType]);
  const buckets = useMemo(() => buildBuckets(viewType, new Date()), [viewType]);

  const branchTransactionsInView = useMemo(() => {
    return branchTransactions.filter((row) => {
      const dt = new Date(row?.created_at || row?.updated_at || 0);
      return inRange(dt, viewBounds.start, viewBounds.end);
    });
  }, [branchTransactions, viewBounds]);

  const branchReports = useMemo(() => {
    if (!branchId) return [];
    return reports.filter((row) => reportBranchId(row) === String(branchId));
  }, [reports, branchId]);

  const branchReportsInView = useMemo(() => {
    return branchReports.filter((row) => inRange(reportDate(row), viewBounds.start, viewBounds.end));
  }, [branchReports, viewBounds]);

  const issueStatusTrend = useMemo(() => {
    const rows = buckets.map((bucket) => ({
      name: bucket.name,
      resolved: 0,
      unresolved: 0,
    }));

    branchReports.forEach((row) => {
      const dt = issueStatusDate(row);
      const index = bucketIndexForDate(dt, buckets);
      if (index < 0) return;
      if (String(row?.status || "").toLowerCase() === "resolved") rows[index].resolved += 1;
      else rows[index].unresolved += 1;
    });

    return {
      labels: rows.map((row) => row.name),
      resolved: rows.map((row) => row.resolved),
      unresolved: rows.map((row) => row.unresolved),
    };
  }, [branchReports, buckets]);

  const resolvedBranchReports = useMemo(() => {
    return branchReportsInView.filter((row) => {
      if (String(row?.status || "").toLowerCase() !== "resolved") return false;
      const resolutionType = String(row?.resolution_type || "").toLowerCase();
      return resolutionType === "refund" || resolutionType === "replacement";
    });
  }, [branchReportsInView]);

  const totalRevenue = useMemo(
    () =>
      branchTransactionsInView
        .filter((row) => String(row?.payment_status || "").toLowerCase() === "paid")
        .reduce((sum, row) => sum + Number(row?.amount || 0), 0),
    [branchTransactionsInView]
  );

  const unpaidAmountTotal = useMemo(
    () =>
      branchTransactionsInView
        .filter((row) => String(row?.payment_status || "").toLowerCase() === "unpaid")
        .reduce((sum, row) => sum + Number(row?.amount || 0), 0),
    [branchTransactionsInView]
  );

  const paidUnpaidSeries = useMemo(() => {
    const rows = buckets.map((bucket) => ({
      name: bucket.name,
      paid: 0,
      unpaid: 0,
    }));

    branchTransactionsInView.forEach((row) => {
      const dt = new Date(row?.created_at || row?.updated_at || 0);
      const index = bucketIndexForDate(dt, buckets);
      if (index < 0) return;
      const status = String(row?.payment_status || "").toLowerCase();
      if (status === "paid") rows[index].paid += 1;
      else if (status === "unpaid") rows[index].unpaid += 1;
    });

    return {
      labels: rows.map((row) => row.name),
      paid: rows.map((row) => row.paid),
      unpaid: rows.map((row) => row.unpaid),
    };
  }, [buckets, branchTransactionsInView]);

  const totalDisputeValue = useMemo(
    () => resolvedBranchReports.reduce((sum, row) => sum + disputeAmountFromReport(row), 0),
    [resolvedBranchReports]
  );

  const resolvedRefundDisputes = useMemo(
    () =>
      resolvedBranchReports.filter(
        (row) => String(row?.resolution_type || "").toLowerCase() === "refund"
      ),
    [resolvedBranchReports]
  );

  const refundLossTotal = useMemo(
    () => resolvedRefundDisputes.reduce((sum, row) => sum + disputeAmountFromReport(row), 0),
    [resolvedRefundDisputes]
  );

  const totalLosses = useMemo(() => unpaidAmountTotal + refundLossTotal, [unpaidAmountTotal, refundLossTotal]);
  const netProfit = useMemo(() => totalRevenue - totalLosses, [totalRevenue, totalLosses]);

  const performanceRows = useMemo(() => {
    const rows = buckets.map((bucket) => ({
      name: bucket.name,
      revenue: 0,
      unpaid: 0,
      disputes: 0,
      rush: 0,
      regular: 0,
    }));

    branchTransactionsInView.forEach((row) => {
      const dt = new Date(row?.created_at || row?.updated_at || 0);
      const index = bucketIndexForDate(dt, buckets);
      if (index < 0) return;
      const amount = Number(row?.amount || 0);
      const isPaid = String(row?.payment_status || "").toLowerCase() === "paid";
      if (isPaid) {
        rows[index].revenue += amount;
        if (isRushOrder(row)) rows[index].rush += amount;
        else rows[index].regular += amount;
      } else {
        rows[index].unpaid += amount;
      }
    });

    resolvedBranchReports.forEach((row) => {
      const dt = reportDate(row);
      const index = bucketIndexForDate(dt, buckets);
      if (index < 0) return;
      rows[index].disputes += disputeAmountFromReport(row);
    });

    return rows.map((row) => ({
      ...row,
      losses: row.unpaid + row.disputes,
      profit: row.revenue - (row.unpaid + row.disputes),
    }));
  }, [buckets, branchTransactionsInView, resolvedBranchReports]);

  const revenueTrend = useMemo(
    () => ({
      labels: performanceRows.map((row) => row.name),
      values: performanceRows.map((row) => Number(row.revenue.toFixed(2))),
    }),
    [performanceRows]
  );

  const disputesTrend = useMemo(
    () => ({
      labels: performanceRows.map((row) => row.name),
      values: performanceRows.map((row) => Number(row.disputes.toFixed(2))),
    }),
    [performanceRows]
  );

  const branchPerformanceSeries = useMemo(
    () => ({
      labels: performanceRows.map((row) => row.name),
      revenue: performanceRows.map((row) => Number(row.revenue.toFixed(2))),
      losses: performanceRows.map((row) => Number(row.losses.toFixed(2))),
    }),
    [performanceRows]
  );

  const branchPerformancePercentSeries = useMemo(() => {
    const combined = [...branchPerformanceSeries.revenue, ...branchPerformanceSeries.losses];
    const maxValue = Math.max(...combined, 0);
    if (maxValue <= 0) {
      return {
        labels: branchPerformanceSeries.labels,
        revenue: branchPerformanceSeries.revenue.map(() => 0),
        losses: branchPerformanceSeries.losses.map(() => 0),
      };
    }
    const normalize = (value: number) => Number(((Math.max(0, value) / maxValue) * 100).toFixed(2));
    return {
      labels: branchPerformanceSeries.labels,
      revenue: branchPerformanceSeries.revenue.map(normalize),
      losses: branchPerformanceSeries.losses.map(normalize),
    };
  }, [branchPerformanceSeries]);

  const rushRegularSeries = useMemo(
    () => ({
      labels: performanceRows.map((row) => row.name),
      rush: performanceRows.map((row) => Number(row.rush.toFixed(2))),
      regular: performanceRows.map((row) => Number(row.regular.toFixed(2))),
    }),
    [performanceRows]
  );

  const lossReasonSeries = useMemo(() => {
    const refundTotals = {
      Damaged: 0,
      Lost: 0,
      Other: 0,
      Unresolved: 0,
    };
    const backjobTotals = {
      PoorQuality: 0,
      Wrinkled: 0,
      Other: 0,
      Unresolved: 0,
    };

    branchReportsInView.forEach((row) => {
      const amount = disputeAmountFromReport(row);
      const key = issueTypeKey(row?.issue_type);
      const resolutionType = String(row?.resolution_type || "").toLowerCase();
      const isResolved = String(row?.status || "").toLowerCase() === "resolved";

      if (resolutionType === "refund") {
        if (!isResolved) {
          refundTotals.Unresolved += amount;
          return;
        }
        if (key === "damaged") refundTotals.Damaged += amount;
        else if (key === "lost") refundTotals.Lost += amount;
        else refundTotals.Other += amount;
      }

      if (resolutionType === "replacement") {
        if (!isResolved) {
          backjobTotals.Unresolved += amount;
          return;
        }
        if (key === "poor_quality_cleaning") backjobTotals.PoorQuality += amount;
        else if (key === "wrinkled_not_folded_well") backjobTotals.Wrinkled += amount;
        else backjobTotals.Other += amount;
      }
    });

    return {
      refund: {
        labels: ["Damaged", "Lost", "Other", "Unresolved"],
        values: [
          Number(refundTotals.Damaged.toFixed(2)),
          Number(refundTotals.Lost.toFixed(2)),
          Number(refundTotals.Other.toFixed(2)),
          Number(refundTotals.Unresolved.toFixed(2)),
        ],
      },
      backjob: {
        labels: ["Poor", "Wrinkled", "Other", "Unresolved"],
        values: [
          Number(backjobTotals.PoorQuality.toFixed(2)),
          Number(backjobTotals.Wrinkled.toFixed(2)),
          Number(backjobTotals.Other.toFixed(2)),
          Number(backjobTotals.Unresolved.toFixed(2)),
        ],
      },
    };
  }, [branchReportsInView]);

  const growthSeries = useMemo(() => {
    const datesByCustomer = new Map<string, number[]>();

    branchTransactions.forEach((row) => {
      const key = customerIdentityKey(row);
      const ts = new Date(row?.created_at || row?.updated_at || 0).getTime();
      if (Number.isNaN(ts)) return;
      if (!datesByCustomer.has(key)) datesByCustomer.set(key, []);
      datesByCustomer.get(key)?.push(ts);
    });

    datesByCustomer.forEach((arr) => arr.sort((a, b) => a - b));

    const rows = buckets.map((bucket) => {
      let newCustomers = 0;
      let returningCustomers = 0;
      const start = bucket.start.getTime();
      const end = bucket.end.getTime();

      datesByCustomer.forEach((dates) => {
        const activeInBucket = dates.some((dt) => dt >= start && dt <= end);
        if (!activeInBucket) return;
        const first = dates[0];
        if (first >= start && first <= end) newCustomers += 1;
        if (first < start) returningCustomers += 1;
      });

      return {
        name: bucket.name,
        newCustomers,
        returningCustomers,
      };
    });

    return {
      labels: rows.map((row) => row.name),
      newCustomers: rows.map((row) => row.newCustomers),
      returningCustomers: rows.map((row) => row.returningCustomers),
    };
  }, [branchTransactions, buckets]);

  const whiteVsColored = useMemo(() => {
    let white = 0;
    let colored = 0;

    branchTransactionsInView.forEach((txn) => {
      const items = extractTransactionItems(txn);
      const txnAmount = Number(txn?.amount || 0);

      if (items.length === 0) {
        colored += txnAmount;
        return;
      }

      const perItem = txnAmount / Math.max(items.length, 1);
      items.forEach((item) => {
        const amount = Number(item?.line_total ?? item?.total ?? item?.amount) || perItem || 0;
        if (isWhiteItem(item)) white += amount;
        else colored += amount;
      });
    });

    return {
      labels: ["White", "Colored"],
      values: [Number(white.toFixed(2)), Number(colored.toFixed(2))],
    };
  }, [branchTransactionsInView]);

  const serviceItems = useMemo(() => {
    const totals = new Map<string, number>();

    branchTransactionsInView.forEach((txn) => {
      const items = extractTransactionItems(txn);
      const txnAmount = Number(txn?.amount || 0);
      if (items.length === 0) return;
      const perItem = txnAmount / Math.max(items.length, 1);

      items.forEach((item) => {
        const name = serviceItemName(item);
        const amount = Number(item?.line_total ?? item?.total ?? item?.amount) || perItem || 0;
        totals.set(name, (totals.get(name) || 0) + amount);
      });
    });

    const sorted = Array.from(totals.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);

    return {
      labels: sorted.map((row) => row.name),
      values: sorted.map((row) => Number(row.amount.toFixed(2))),
    };
  }, [branchTransactionsInView]);

  const recentTransactions = useMemo(() => {
    return [...branchTransactionsInView]
      .sort((a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime())
      .slice(0, 5)
      .map((row) => ({
        receipt: row?.receipt || (row?.id != null ? `TXN-${row.id}` : "TXN"),
        customer: row?.customer_name || "—",
        payment: row?.payment_status || "—",
        status: row?.inventory_status || "—",
        amount: Number(row?.amount || 0),
        date: new Date(row?.created_at || row?.updated_at || Date.now()).toLocaleDateString(),
      }));
  }, [branchTransactionsInView]);

  const viewTypeLabel = useMemo(() => {
    if (viewType === "today") return "Today";
    if (viewType === "week") return "Weekly";
    if (viewType === "month") return "Monthly";
    return "Yearly";
  }, [viewType]);

  const safeBarValues = useCallback((values: number[]) => {
    if (values.length === 0) return [0];
    return values;
  }, []);

  const safeLabels = useCallback((labels: string[]) => {
    if (labels.length === 0) return ["N/A"];
    return labels;
  }, []);

  const chartWidthForLabels = useCallback(
    (labels: string[], minPerLabel = 48) => {
      const labelCount = Math.max(1, labels.length);
      return Math.max(chartWidth, labelCount * minPerLabel);
    },
    [chartWidth]
  );

  const exportPayload = useMemo(
    () => ({
      generatedAt: new Date().toISOString(),
      branchName: branchName || "Branch Reports",
      branchId: branchId ? String(branchId) : "—",
      viewTypeLabel,
      rangeStartDate: viewBounds.start.toISOString().slice(0, 10),
      rangeEndDate: viewBounds.end.toISOString().slice(0, 10),
      totalRevenue,
      totalLosses,
      netProfit,
      totalDisputeValue,
      totalWeightProcessed: branchTransactionsInView.reduce((sum, row) => sum + Number(row?.weight ?? row?.total_weight ?? 0), 0),
      issueStatusTrend,
      paymentTrend: paidUnpaidSeries,
      performanceRows,
      growthSeries,
      lossReasonSeries,
      whiteVsColored,
      serviceItems: serviceItems.labels.map((name, index) => ({
        name,
        amount: Number(serviceItems.values[index] || 0),
      })),
      recentTransactions,
    }),
    [
      branchId,
      branchName,
      branchTransactionsInView,
      growthSeries,
      issueStatusTrend,
      lossReasonSeries,
      netProfit,
      paidUnpaidSeries,
      performanceRows,
      recentTransactions,
      serviceItems.labels,
      serviceItems.values,
      totalDisputeValue,
      totalLosses,
      totalRevenue,
      viewBounds.end,
      viewBounds.start,
      viewTypeLabel,
      whiteVsColored,
    ]
  );

  const handleExportPdf = useCallback(async () => {
    setExportMenuOpen(false);
    try {
      await exportBranchReportsPdf(exportPayload, "download");
    } catch (error) {
      console.log(error);
      Alert.alert("Export failed", error instanceof Error ? error.message : "Could not export reports.");
    }
  }, [exportPayload]);

  const handlePrintReports = useCallback(async () => {
    setExportMenuOpen(false);
    try {
      await exportBranchReportsPdf(exportPayload, "print");
    } catch (error) {
      console.log(error);
      Alert.alert("Print failed", error instanceof Error ? error.message : "Could not open the print dialog.");
    }
  }, [exportPayload]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>{branchName ? `${branchName} Reports` : "Branch Reports"}</Text>
          <View style={styles.underline} />
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.exportBtn} onPress={() => setExportMenuOpen((prev) => !prev)}>
            <Text style={styles.exportText}>Export ▾</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshBtn} onPress={loadBranchReports}>
            <Text style={styles.refreshText}>{isLoading ? "Loading..." : "Refresh"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal transparent visible={exportMenuOpen} animationType="fade" onRequestClose={() => setExportMenuOpen(false)}>
        <View style={styles.exportModalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setExportMenuOpen(false)} />
          <View style={styles.exportMenuCard}>
            <Text style={styles.exportMenuTitle}>Export reports</Text>
            <TouchableOpacity style={styles.exportMenuItem} onPress={handleExportPdf}>
              <Text style={styles.exportMenuItemText}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportMenuItem} onPress={handlePrintReports}>
              <Text style={styles.exportMenuItemText}>Print</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {isLoading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewType === "today" && styles.toggleBtnActive]}
              onPress={() => setViewType("today")}
            >
              <Text style={[styles.toggleText, viewType === "today" && styles.toggleTextActive]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewType === "week" && styles.toggleBtnActive]}
              onPress={() => setViewType("week")}
            >
              <Text style={[styles.toggleText, viewType === "week" && styles.toggleTextActive]}>Weekly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewType === "month" && styles.toggleBtnActive]}
              onPress={() => setViewType("month")}
            >
              <Text style={[styles.toggleText, viewType === "month" && styles.toggleTextActive]}>Monthly</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewType === "year" && styles.toggleBtnActive]}
              onPress={() => setViewType("year")}
            >
              <Text style={[styles.toggleText, viewType === "year" && styles.toggleTextActive]}>Yearly</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.kpiGrid}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Revenue</Text>
              <Text style={styles.kpiValue}>{formatPhp(totalRevenue)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Losses</Text>
              <Text style={styles.kpiValue}>{formatPhp(totalLosses)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Net Profit</Text>
              <Text style={styles.kpiValue}>{formatPhp(netProfit)}</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Dispute Value</Text>
              <Text style={styles.kpiValue}>{formatPhp(totalDisputeValue)}</Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Resolved vs Unresolved Cases</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: issueStatusTrend.labels,
                  datasets: [
                    {
                      data: issueStatusTrend.resolved,
                      color: () => "rgba(37, 99, 235, 1)",
                    },
                    {
                      data: issueStatusTrend.unresolved,
                      color: () => "rgba(239, 68, 68, 1)",
                    },
                  ],
                }}
                width={chartWidthForLabels(issueStatusTrend.labels, 72)}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(37, 99, 235, 1)",
                  labelColor: () => "#475569",
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                fromZero
                showValuesOnTopOfBars
                withInnerLines={false}
                flatColor
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Paid and Unpaid Orders</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: safeLabels(paidUnpaidSeries.labels),
                  datasets: [
                    {
                      data: safeBarValues(paidUnpaidSeries.paid),
                      color: () => "rgba(37, 99, 235, 1)",
                      strokeWidth: 2,
                    },
                    {
                      data: safeBarValues(paidUnpaidSeries.unpaid),
                      color: () => "rgba(239, 68, 68, 1)",
                      strokeWidth: 2,
                    },
                  ],
                  legend: ["Paid", "Unpaid"],
                }}
                width={chartWidthForLabels(paidUnpaidSeries.labels, 72)}
                height={220}
                withShadow={false}
                yAxisLabel=""
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(37, 99, 235, 1)",
                  labelColor: () => "#475569",
                  propsForDots: { r: "3", strokeWidth: "1", stroke: "#2563eb" },
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>{viewTypeLabel} Revenue Trend</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Pressable onPressIn={() => setChartPointHint("Tap points in line charts to inspect values")}> 
                <LineChart
                  data={{
                    labels: safeLabels(revenueTrend.labels),
                    datasets: [{ data: safeBarValues(revenueTrend.values) }],
                  }}
                  width={chartWidthForLabels(revenueTrend.labels)}
                  height={220}
                  withShadow={false}
                  yAxisLabel=""
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: () => "rgba(37, 99, 235, 1)",
                    labelColor: () => "#475569",
                    propsForDots: { r: "4", strokeWidth: "1", stroke: "#1d4ed8" },
                    propsForBackgroundLines: { stroke: "#e2e8f0" },
                  }}
                  bezier
                  style={styles.chart}
                />
              </Pressable>
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Loss & Quality - Refunds</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: safeLabels(lossReasonSeries.refund.labels),
                  datasets: [{ data: safeBarValues(lossReasonSeries.refund.values) }],
                }}
                width={chartWidthForLabels(lossReasonSeries.refund.labels, 72)}
                height={230}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(15, 118, 110, 1)",
                  labelColor: () => "#475569",
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                showValuesOnTopOfBars
                fromZero
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Loss & Quality - Backjobs</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: safeLabels(lossReasonSeries.backjob.labels),
                  datasets: [{ data: safeBarValues(lossReasonSeries.backjob.values) }],
                }}
                width={chartWidthForLabels(lossReasonSeries.backjob.labels, 72)}
                height={230}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(124, 58, 237, 1)",
                  labelColor: () => "#475569",
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                showValuesOnTopOfBars
                fromZero
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Disputes Trend</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: safeLabels(disputesTrend.labels),
                  datasets: [{ data: safeBarValues(disputesTrend.values) }],
                }}
                width={chartWidthForLabels(disputesTrend.labels)}
                height={230}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(239, 68, 68, 1)",
                  labelColor: () => "#475569",
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                fromZero
                showValuesOnTopOfBars
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Branch Performance (Revenue vs Losses)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: safeLabels(branchPerformancePercentSeries.labels),
                  datasets: [
                    {
                      data: safeBarValues(branchPerformancePercentSeries.revenue),
                      color: () => "rgba(5, 150, 105, 1)",
                      strokeWidth: 2,
                    },
                    {
                      data: safeBarValues(branchPerformancePercentSeries.losses),
                      color: () => "rgba(239, 68, 68, 1)",
                      strokeWidth: 2,
                    },
                  ],
                  legend: ["Revenue %", "Losses %"],
                }}
                width={chartWidthForLabels(branchPerformancePercentSeries.labels)}
                height={240}
                withShadow={false}
                yAxisSuffix="%"
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(30, 64, 175, 1)",
                  labelColor: () => "#475569",
                  propsForDots: { r: "3", strokeWidth: "1", stroke: "#1d4ed8" },
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Growth Trends</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: safeLabels(growthSeries.labels),
                  datasets: [
                    {
                      data: safeBarValues(growthSeries.newCustomers),
                      color: () => "rgba(24, 91, 203, 1)",
                      strokeWidth: 2,
                    },
                    {
                      data: safeBarValues(growthSeries.returningCustomers),
                      color: () => "rgba(5, 150, 105, 1)",
                      strokeWidth: 2,
                    },
                  ],
                  legend: ["New", "Returning"],
                }}
                width={chartWidthForLabels(growthSeries.labels)}
                height={240}
                withShadow={false}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(24, 91, 203, 1)",
                  labelColor: () => "#475569",
                  propsForDots: { r: "3", strokeWidth: "1", stroke: "#1d4ed8" },
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Rush vs Regular (Paid Revenue)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: safeLabels(rushRegularSeries.labels),
                  datasets: [
                    {
                      data: safeBarValues(rushRegularSeries.rush),
                      color: () => "rgba(234, 88, 12, 1)",
                      strokeWidth: 2,
                    },
                    {
                      data: safeBarValues(rushRegularSeries.regular),
                      color: () => "rgba(100, 116, 139, 1)",
                      strokeWidth: 2,
                    },
                  ],
                  legend: ["Rush", "Regular"],
                }}
                width={chartWidthForLabels(rushRegularSeries.labels)}
                height={240}
                withShadow={false}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(234, 88, 12, 1)",
                  labelColor: () => "#475569",
                  propsForDots: { r: "3", strokeWidth: "1", stroke: "#ea580c" },
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>White vs Colored</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: safeLabels(whiteVsColored.labels),
                  datasets: [{ data: safeBarValues(whiteVsColored.values) }],
                }}
                width={chartWidthForLabels(whiteVsColored.labels, 88)}
                height={230}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(30, 64, 175, 1)",
                  labelColor: () => "#475569",
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                fromZero
                showValuesOnTopOfBars
                style={styles.chart}
              />
            </ScrollView>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Service Items</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: safeLabels(serviceItems.labels).map((_, index) => String(index + 1)),
                  datasets: [{ data: safeBarValues(serviceItems.values) }],
                }}
                width={chartWidthForLabels(serviceItems.labels, 150)}
                height={265}
                yAxisLabel=""
                yAxisSuffix=""
                verticalLabelRotation={26}
                xLabelsOffset={10}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 0,
                  color: () => "rgba(147, 51, 234, 1)",
                  labelColor: () => "#475569",
                  propsForBackgroundLines: { stroke: "#e2e8f0" },
                }}
                fromZero
                showValuesOnTopOfBars
                style={styles.chart}
              />
            </ScrollView>
            {serviceItems.labels.length > 0 ? (
              <View style={styles.serviceItemsLegend}>
                {serviceItems.labels.map((label, index) => (
                  <Text key={`service-item-full-label-${label}-${index}`} style={styles.serviceItemsLegendItem}>
                    {index + 1}. {label}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>

          {chartPointHint ? <Text style={styles.chartHint}>{chartPointHint}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
  },
  underline: {
    marginTop: 4,
    height: 3,
    width: 86,
    backgroundColor: "#2563eb",
    borderRadius: 6,
  },
  refreshBtn: {
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  exportBtn: {
    backgroundColor: "#dbeafe",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  exportText: {
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 12,
  },
  refreshText: {
    color: "#1e293b",
    fontWeight: "700",
    fontSize: 12,
  },
  exportModalOverlay: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 64,
    paddingRight: 16,
    backgroundColor: "rgba(15, 23, 42, 0.22)",
  },
  exportMenuCard: {
    width: 180,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  exportMenuTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  exportMenuItem: {
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  exportMenuItemText: {
    color: "#1e293b",
    fontSize: 12,
    fontWeight: "700",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    paddingBottom: 30,
    gap: 14,
  },
  toggleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  toggleBtn: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toggleBtnActive: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  toggleText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: "#1d4ed8",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  kpiCard: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  kpiLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600",
  },
  kpiValue: {
    marginTop: 8,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  chartCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  chartTitle: {
    color: "#1e293b",
    fontWeight: "800",
    fontSize: 15,
    marginBottom: 8,
  },
  chart: {
    borderRadius: 10,
  },
  chartHint: {
    fontSize: 12,
    color: "#475569",
    textAlign: "center",
  },
  serviceItemsLegend: {
    marginTop: 10,
    gap: 6,
  },
  serviceItemsLegendItem: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
});

export { BranchReportsScreen };
