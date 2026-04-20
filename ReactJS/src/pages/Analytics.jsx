import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BsBasket, BsGraphDownArrow, BsGraphUpArrow } from 'react-icons/bs';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Card from '../components/card';
import DashboardLayout from '../components/dashboardlayout';
import { useTransactions } from '../context/transactionsContext';
import { API_URL } from '../config/api';
import { buildAnalyticsCsv, downloadAnalyticsCsv, exportAnalyticsPdf } from '../utils/analyticsExport';
import '../styles/dashboardstyle.css';
import '../styles/analyticsstyle.css';
import html2canvas from 'html2canvas';

const POLL_MS = 45_000;
const formatPeso = (value, fractionDigits = 2) => {
  const n = Number(value || 0);
  if (Number.isFinite(Number(fractionDigits))) {
    return `P${n.toLocaleString(undefined, {
      minimumFractionDigits: Number(fractionDigits),
      maximumFractionDigits: Number(fractionDigits),
    })}`;
  }
  return `P${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const VIEW_TYPE_LABELS = {
  today: 'Today',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

/** Same key as Dashboard — instant branch list when navigating between pages. */
const BRANCHES_SESSION_KEY = 'dashboard_refunds_branches_v1';

function readBranchesCache() {
  try {
    const raw = sessionStorage.getItem(BRANCHES_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBranchesCache(rows) {
  try {
    sessionStorage.setItem(BRANCHES_SESSION_KEY, JSON.stringify(rows));
  } catch {
    // ignore
  }
}

function getViewDateBounds(viewType, referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const start = new Date(now);
  const end = new Date(now);

  if (viewType === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (viewType === 'week') {
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    start.setDate(now.getDate() + mondayOffset);
    start.setHours(0, 0, 0, 0);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (viewType === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

/**
 * Refunds: actual refund_amount. Replacements: affected line total (not whole receipt).
 */
function disputeAmountFromReport(row) {
  const rt = String(row?.resolution_type || '').toLowerCase();
  if (rt === 'refund') {
    const n = Number(row?.refund_amount);
    return Number.isFinite(n) ? n : 0;
  }
  if (rt === 'replacement') {
    const line = Number(row?.transaction_item?.line_total);
    return Number.isFinite(line) ? line : 0;
  }
  return 0;
}

function buildDisputeSeries(viewType, reports, referenceDate = new Date()) {
  const ref = new Date(referenceDate);

  if (viewType === 'today') {
    const labels = ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM'];
    const buckets = labels.map((name) => ({ name, amount: 0 }));
    reports.forEach((r) => {
      const dt = new Date(r.resolved_at || r.updated_at || Date.now());
      const hour = dt.getHours();
      if (hour < 8 || hour > 18) return;
      const idx = Math.min(labels.length - 1, Math.floor((hour - 8) / 2));
      buckets[idx].amount += disputeAmountFromReport(r);
    });
    return buckets;
  }

  if (viewType === 'week') {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dow = ref.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const rows = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return { name: dayLabels[idx], key: d.toDateString(), amount: 0 };
    });
    reports.forEach((r) => {
      const dt = new Date(r.resolved_at || r.updated_at || Date.now());
      if (dt < monday || dt > weekEnd) return;
      const row = rows.find((x) => x.key === dt.toDateString());
      if (row) row.amount += disputeAmountFromReport(r);
    });
    return rows.map(({ name, amount }) => ({ name, amount }));
  }

  if (viewType === 'month') {
    const currentYear = ref.getFullYear();
    const currentMonth = ref.getMonth();
    const rows = [
      { name: 'Week 1', amount: 0 },
      { name: 'Week 2', amount: 0 },
      { name: 'Week 3', amount: 0 },
      { name: 'Week 4', amount: 0 },
    ];
    reports.forEach((r) => {
      const dt = new Date(r.resolved_at || r.updated_at || Date.now());
      if (dt.getFullYear() !== currentYear || dt.getMonth() !== currentMonth) return;
      const idx = Math.min(3, Math.floor((dt.getDate() - 1) / 7));
      rows[idx].amount += disputeAmountFromReport(r);
    });
    return rows;
  }

  const yearRows = [
    { name: 'Jan', amount: 0 }, { name: 'Feb', amount: 0 }, { name: 'Mar', amount: 0 },
    { name: 'Apr', amount: 0 }, { name: 'May', amount: 0 }, { name: 'Jun', amount: 0 },
    { name: 'Jul', amount: 0 }, { name: 'Aug', amount: 0 }, { name: 'Sep', amount: 0 },
    { name: 'Oct', amount: 0 }, { name: 'Nov', amount: 0 }, { name: 'Dec', amount: 0 },
  ];
  reports.forEach((r) => {
    const dt = new Date(r.resolved_at || r.updated_at || Date.now());
    if (dt.getFullYear() !== ref.getFullYear()) return;
    yearRows[dt.getMonth()].amount += disputeAmountFromReport(r);
  });
  return yearRows;
}

/** Stable key for “first visit” heuristics (transactions only; no separate CRM id). */
function customerIdentityKey(t) {
  return `${String(t.customer_name || '').trim().toLowerCase()}|${String(t.customer_address || '').trim().toLowerCase()}`;
}

/** Rush / express — aligned with Express page */
function isRushOrder(row) {
  if (row?.is_rush === true || row?.is_rush === 1) return true;
  if (row?.active_extras?.express) return true;
  const ect = row?.extra_charge_type;
  if (typeof ect === 'string' && ect.toLowerCase().includes('express')) return true;
  return false;
}

/** Intersection of view window and optional custom date inputs (same logic as filtered transactions). */
function getEffectiveChartBounds(viewBounds, rangeStartDate, rangeEndDate) {
  let start = new Date(viewBounds.start);
  let end = new Date(viewBounds.end);
  if (rangeStartDate) {
    const rs = new Date(`${rangeStartDate}T00:00:00`);
    if (!Number.isNaN(rs.getTime()) && rs > start) start = rs;
  }
  if (rangeEndDate) {
    const re = new Date(`${rangeEndDate}T23:59:59.999`);
    if (!Number.isNaN(re.getTime()) && re < end) end = re;
  }
  return { start, end };
}

/** Helper: safely extract item list from a transaction object. */
function extractTransactionItems(txn) {
  if (!txn) return [];
  if (Array.isArray(txn.receipt_items) && txn.receipt_items.length) return txn.receipt_items;
  if (Array.isArray(txn.services) && txn.services.length) return txn.services;
  if (Array.isArray(txn.transaction_items) && txn.transaction_items.length) return txn.transaction_items;
  if (Array.isArray(txn.items) && txn.items.length) return txn.items;
  if (txn.transaction_item && typeof txn.transaction_item === 'object') return [txn.transaction_item];
  return [];
}

/** Guess whether an item is 'white' based on item properties. */
function isWhiteItem(item) {
  if (!item) return false;
  if (item.is_white === true || item.is_white === 1 || item.is_white === '1') return true;
  const c = String(item.color || item.colour || item.variant || item.tag || '').toLowerCase();
  if (c.includes('white')) return true;
  const n = String(item.service_name || item.name || item.description || '').toLowerCase();
  if (n.includes('white')) return true;
  return false;
}

/** Friendly service name pickers used by service-items chart. */
function serviceItemName(item) {
  const laundryType = String(item.laundryType || item.laundry_type || '').trim();
  const serviceName = String(item.serviceName || item.service_name || item.name || item.service || item.product || item.item || '').trim();
  if (laundryType && serviceName) return `${laundryType} - ${serviceName}`;
  if (laundryType) return laundryType;
  if (serviceName) return serviceName;
  return 'Unknown';
}


function refundReasonDataKeys(issueType) {
  const t = String(issueType || '').toLowerCase();
  if (t === 'damaged') return 'Damaged';
  if (t === 'lost') return 'Lost';
  return 'Other';
}

function backjobReasonDataKeys(issueType) {
  const t = String(issueType || '').toLowerCase();
  if (t === 'poor_quality_cleaning') return 'PoorQuality';
  if (t === 'wrinkled_not_folded_well') return 'Wrinkled';
  return 'Other';
}

function normalizeIssueTypeKey(issueType) {
  return String(issueType || '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w]/g, '');
}

/** Human-readable issue category (matches Dispute page wording). */
function issueTypeLabelDisplay(issueType) {
  const t = normalizeIssueTypeKey(issueType);
  if (t === 'poor_quality_cleaning') return 'Poor Quality Cleaning';
  if (t === 'wrinkled_not_folded_well') return 'Wrinkled / Not Folded Well';
  if (t === 'damaged') return 'Damaged';
  if (t === 'lost') return 'Lost';
  if (t === 'other') return 'Other';
  return String(issueType || 'Issue').trim() || '—';
}

function issueSummaryForTooltip(report) {
  const category = issueTypeLabelDisplay(report?.issue_type);
  const detail = String(report?.issue_note || '').trim();
  if (!detail) return category;
  const short = detail.length > 80 ? `${detail.slice(0, 80)}…` : detail;
  return `${category}: ${short}`;
}

function LossQualityTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const nonZero = payload.filter((p) => Number(p.value) > 0.0005);
  return (
    <div className="analytics-recharts-tooltip">
      <div className="analytics-recharts-tooltip-title">{label}</div>
      {nonZero.map((p) => (
        <div key={String(p.dataKey)} className="analytics-recharts-tooltip-row">
          <span>{p.name}</span>
          <span>{formatPeso(Number(p.value))}</span>
        </div>
      ))}
      {row?.issuesPreview ? (
        <div className="analytics-recharts-tooltip-issues">
          <span className="analytics-recharts-tooltip-issues-label">Issues</span>
          {row.issuesPreview}
        </div>
      ) : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const { transactions, fetchTransactions } = useTransactions();
  const [viewType, setViewType] = useState('week');
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Refs for chart containers (used to capture chart images for PDF/print)
  const refundChartRef = useRef(null);
  const backjobChartRef = useRef(null);
  const growthChartRef = useRef(null);
  const rushChartRef = useRef(null);

  // Export dropdown state
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);
  const [branches, setBranches] = useState(() => readBranchesCache());
  const [issueReports, setIssueReports] = useState([]);
  /** Avoid flashing "no branches" before the first /branches response (same idea as Dashboard). */
  const [branchListFetchDone, setBranchListFetchDone] = useState(false);

  const storedUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const fetchBranchesAndReports = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` };
      const [brRes, irRes] = await Promise.all([
        fetch(`${API_URL}/branches`, { headers }),
        fetch(`${API_URL}/issue-reports`, { headers }),
      ]);
      if (brRes.ok) {
        const ct = String(brRes.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const data = await brRes.json();
          const rows = Array.isArray(data) ? data : [];
          setBranches(rows);
          writeBranchesCache(rows);
        }
      }
      if (irRes.ok) {
        const ct = String(irRes.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const data = await irRes.json();
          setIssueReports(Array.isArray(data) ? data : []);
        }
      } else if (irRes.status === 401 || irRes.status === 403) {
        setIssueReports([]);
      }
    } catch (e) {
      console.error('Report page data fetch:', e);
    } finally {
      setBranchListFetchDone(true);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchBranchesAndReports();
    const intervalId = setInterval(() => {
      fetchTransactions();
      fetchBranchesAndReports();
    }, POLL_MS);
    return () => clearInterval(intervalId);
  }, [fetchTransactions, fetchBranchesAndReports]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    if (!exportDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportDropdownOpen]);

  const sortedBranches = useMemo(
    () => [...branches].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [branches]
  );

  const selectedBranchId = useMemo(() => {
    const fromRoot = storedUser?.branch_id;
    const fromNested = storedUser?.branch?.id;
    const userBranchId = String(fromRoot ?? fromNested ?? '').trim();
    if (userBranchId && sortedBranches.some((b) => String(b.id) === userBranchId)) return userBranchId;
    if (sortedBranches.length > 0) return String(sortedBranches[0].id);
    // When /branches is still loading or returned empty (some roles), use branch from login — same source as sidebar.
    if (userBranchId) return userBranchId;
    return '';
  }, [sortedBranches, storedUser]);

  const activeTransactions = useMemo(
    () => transactions.filter((t) => !t.archived),
    [transactions]
  );

  const viewBounds = useMemo(() => {
    const parsedReferenceDate = new Date(rangeStartDate || new Date().toISOString().slice(0, 10));
    const hasValidReferenceDate = !Number.isNaN(parsedReferenceDate.getTime());
    const referenceDate = viewType !== 'today' && hasValidReferenceDate ? parsedReferenceDate : new Date();
    return getViewDateBounds(viewType, referenceDate);
  }, [viewType, rangeStartDate]);

  const filteredTransactions = useMemo(() => {
    const { start, end } = viewBounds;
    const hasStartDate = Boolean(rangeStartDate);
    const hasEndDate = Boolean(rangeEndDate);
    const startDate = hasStartDate ? new Date(`${rangeStartDate}T00:00:00`) : null;
    const endDate = hasEndDate ? new Date(`${rangeEndDate}T23:59:59.999`) : null;
    return activeTransactions.filter((t) => {
      if (!selectedBranchId || String(t.branch_id) !== String(selectedBranchId)) return false;
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt < start || dt > end) return false;
      if (startDate && dt < startDate) return false;
      if (endDate && dt > endDate) return false;
      return true;
    });
  }, [activeTransactions, viewBounds, rangeStartDate, rangeEndDate, selectedBranchId]);

  /** Resolved disputes (refunds + backjobs / replacement) in the same filtered window as charts. */
  const disputesInView = useMemo(() => {
    const { start, end } = viewBounds;
    const hasStartDate = Boolean(rangeStartDate);
    const hasEndDate = Boolean(rangeEndDate);
    const startDate = hasStartDate ? new Date(`${rangeStartDate}T00:00:00`) : null;
    const endDate = hasEndDate ? new Date(`${rangeEndDate}T23:59:59.999`) : null;
    return issueReports.filter((r) => {
      if (!selectedBranchId || String(r.branch_id) !== String(selectedBranchId)) return false;
      if (String(r.status || '').toLowerCase() !== 'resolved') return false;
      const rt = String(r.resolution_type || '').toLowerCase();
      if (rt !== 'refund' && rt !== 'replacement') return false;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      if (dt < start || dt > end) return false;
      if (startDate && dt < startDate) return false;
      if (endDate && dt > endDate) return false;
      return true;
    });
  }, [issueReports, viewBounds, selectedBranchId, rangeStartDate, rangeEndDate]);

  /** Resolved refund disputes in the same date window (for total losses KPI, independent of chart type). */
  const resolvedRefundDisputesInView = useMemo(() => {
    const { start, end } = viewBounds;
    const hasStartDate = Boolean(rangeStartDate);
    const hasEndDate = Boolean(rangeEndDate);
    const startDate = hasStartDate ? new Date(`${rangeStartDate}T00:00:00`) : null;
    const endDate = hasEndDate ? new Date(`${rangeEndDate}T23:59:59.999`) : null;
    return issueReports.filter((r) => {
      if (!selectedBranchId || String(r.branch_id) !== String(selectedBranchId)) return false;
      if (String(r.status || '').toLowerCase() !== 'resolved') return false;
      if (String(r.resolution_type || '').toLowerCase() !== 'refund') return false;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      if (dt < start || dt > end) return false;
      if (startDate && dt < startDate) return false;
      if (endDate && dt > endDate) return false;
      return true;
    });
  }, [issueReports, viewBounds, selectedBranchId, rangeStartDate, rangeEndDate]);

  const paidTotal = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.payment_status === 'paid')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [filteredTransactions]
  );

  const totalRevenue = paidTotal;

  const unpaidAmountTotal = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.payment_status === 'unpaid')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [filteredTransactions]
  );

  const refundLossTotal = useMemo(
    () => resolvedRefundDisputesInView.reduce((sum, r) => sum + disputeAmountFromReport(r), 0),
    [resolvedRefundDisputesInView]
  );

  const totalLosses = unpaidAmountTotal + refundLossTotal;

  const branchPerformancePct = useMemo(() => {
    const denom = totalRevenue + totalLosses;
    if (denom <= 0) return totalRevenue > 0 ? 100 : 0;
    return (100 * totalRevenue) / denom;
  }, [totalRevenue, totalLosses]);

  const netProfit = useMemo(() => totalRevenue - totalLosses, [totalRevenue, totalLosses]);

  const totalWeightProcessed = useMemo(
    () =>
      filteredTransactions.reduce((sum, t) => sum + (Number(t.weight ?? t.total_weight) || 0), 0),
    [filteredTransactions]
  );

  const branchScopedTxns = useMemo(
    () =>
      activeTransactions
        .filter((t) => String(t.branch_id) === String(selectedBranchId))
        .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)),
    [activeTransactions, selectedBranchId]
  );

  const lossChartData = useMemo(() => {
    const emptyResult = { refundRows: [], backjobRows: [], lossStack: [] };
    if (!selectedBranchId) return emptyResult;

    const refundTemplate = () => ({ Damaged: 0, Lost: 0, Other: 0, Unresolved: 0, issueSummaries: [] });
    const backjobTemplate = () => ({ PoorQuality: 0, Wrinkled: 0, Other: 0, Unresolved: 0, issueSummaries: [] });

    // Build buckets to match the selected period for every view.
    let buckets;
    let bucketIndexFn; // (Date) => bucket index | undefined
    let filterStart, filterEnd;

    if (viewType === 'today') {
      // Hourly 2-hour slots: 8AM, 10AM, 12PM, 2PM, 4PM, 6PM
      const labels = ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM'];
      buckets = labels.map((name) => ({ name }));
      const bounds = getEffectiveChartBounds(viewBounds, rangeStartDate, rangeEndDate);
      filterStart = bounds.start;
      filterEnd = bounds.end;
      bucketIndexFn = (dt) => {
        const hour = dt.getHours();
        if (hour < 8 || hour > 18) return undefined;
        return Math.min(labels.length - 1, Math.floor((hour - 8) / 2));
      };
    } else if (viewType === 'week') {
      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const monday = new Date(viewBounds.start);
      monday.setHours(0, 0, 0, 0);
      const weekEnd = new Date(monday);
      weekEnd.setDate(monday.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      buckets = Array.from({ length: 7 }).map((_, idx) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + idx);
        return { name: dayLabels[idx], key: d.toDateString() };
      });
      const bounds = getEffectiveChartBounds({ start: monday, end: weekEnd }, rangeStartDate, rangeEndDate);
      filterStart = bounds.start;
      filterEnd = bounds.end;
      bucketIndexFn = (dt) => buckets.findIndex((b) => b.key === dt.toDateString());
    } else if (viewType === 'month') {
      const anchor = new Date(viewBounds.start);
      const anchorYear = anchor.getFullYear();
      const anchorMonth = anchor.getMonth();
      buckets = [
        { name: 'Week 1' },
        { name: 'Week 2' },
        { name: 'Week 3' },
        { name: 'Week 4' },
      ];
      const monthStart = new Date(anchorYear, anchorMonth, 1, 0, 0, 0, 0);
      const monthEnd = new Date(anchorYear, anchorMonth + 1, 0, 23, 59, 59, 999);
      const bounds = getEffectiveChartBounds({ start: monthStart, end: monthEnd }, rangeStartDate, rangeEndDate);
      filterStart = bounds.start;
      filterEnd = bounds.end;
      bucketIndexFn = (dt) => {
        if (dt.getFullYear() !== anchorYear || dt.getMonth() !== anchorMonth) return undefined;
        return Math.min(3, Math.floor((dt.getDate() - 1) / 7));
      };
    } else {
      const anchorYear = viewBounds.start.getFullYear();
      const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      buckets = monthLabels.map((name) => ({ name }));
      const yearStart = new Date(anchorYear, 0, 1, 0, 0, 0, 0);
      const yearEnd = new Date(anchorYear, 11, 31, 23, 59, 59, 999);
      const bounds = getEffectiveChartBounds({ start: yearStart, end: yearEnd }, rangeStartDate, rangeEndDate);
      filterStart = bounds.start;
      filterEnd = bounds.end;
      bucketIndexFn = (dt) => {
        if (dt.getFullYear() !== anchorYear) return undefined;
        return dt.getMonth();
      };
    }

    const refundRows = buckets.map((b) => ({ name: b.name, ...refundTemplate() }));
    const backjobRows = buckets.map((b) => ({ name: b.name, ...backjobTemplate() }));

    const start = filterStart;
    const end = filterEnd;

    issueReports.forEach((r) => {
      if (String(r.branch_id) !== String(selectedBranchId)) return;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      if (Number.isNaN(dt.getTime()) || dt < start || dt > end) return;
      const ix = bucketIndexFn(dt);
      if (ix === undefined || ix < 0) return;
      const rt = String(r.resolution_type || '').toLowerCase();
      const amt = disputeAmountFromReport(r);
      const summary = issueSummaryForTooltip(r);
      const isResolved = String(r.status || '').toLowerCase() === 'resolved';
      if (rt === 'refund') {
        const row = refundRows[ix];
        if (isResolved) {
          const reason = refundReasonDataKeys(r.issue_type);
          row[reason] += amt;
        } else {
          row.Unresolved += amt;
        }
        row.issueSummaries.push(summary);
      } else if (rt === 'replacement') {
        const row = backjobRows[ix];
        if (isResolved) {
          const reason = backjobReasonDataKeys(r.issue_type);
          row[reason] += amt;
        } else {
          row.Unresolved += amt;
        }
        row.issueSummaries.push(summary);
      }
    });

    const uniqIssuePreview = (arr) => [...new Set(arr)].slice(0, 8).join(' · ');

    const refundOut = refundRows.map(
      ({ issueSummaries, Damaged, Lost, Other, Unresolved, name }) => ({
        name, Damaged, Lost, Other, Unresolved,
        issuesPreview: uniqIssuePreview(issueSummaries),
      })
    );
    const backjobOut = backjobRows.map(
      ({ issueSummaries, PoorQuality, Wrinkled, Other, Unresolved, name }) => ({
        name, PoorQuality, Wrinkled, Other, Unresolved,
        issuesPreview: uniqIssuePreview(issueSummaries),
      })
    );

    const lossStack = buckets.map((_, i) => ({
      name: buckets[i].name,
      refund: refundRows[i].Damaged + refundRows[i].Lost + refundRows[i].Other + refundRows[i].Unresolved,
      backjob: backjobRows[i].PoorQuality + backjobRows[i].Wrinkled + backjobRows[i].Other + backjobRows[i].Unresolved,
    }));

    return { refundRows: refundOut, backjobRows: backjobOut, lossStack };
  }, [issueReports, selectedBranchId, viewType, viewBounds, rangeStartDate, rangeEndDate]);

  const { refundRows: lossRefundRows, backjobRows: lossBackjobRows, lossStack: monthlyLossStack12 } =
    lossChartData;


  /** New vs returning customers — always follows the selected period filters. */
  const customersGrowthData = useMemo(() => {
    if (branchScopedTxns.length === 0) return [];

    const { start: effectiveStart, end: effectiveEnd } = getEffectiveChartBounds(viewBounds, rangeStartDate, rangeEndDate);

    // Build time buckets to match the selected period
    let buckets; // { name, bucketStart (ms), bucketEnd (ms) }[]

    if (viewType === 'today') {
      const labels = ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM'];
      const dayStart = new Date(viewBounds.start);
      dayStart.setHours(0, 0, 0, 0);
      buckets = labels.map((name, idx) => {
        const h = 8 + idx * 2;
        const bs = new Date(dayStart); bs.setHours(h, 0, 0, 0);
        const be = new Date(dayStart); be.setHours(h + 1, 59, 59, 999);
        return { name, bucketStart: bs.getTime(), bucketEnd: be.getTime() };
      });
    } else if (viewType === 'week') {
      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const monday = new Date(viewBounds.start);
      monday.setHours(0, 0, 0, 0);
      buckets = Array.from({ length: 7 }).map((_, idx) => {
        const bs = new Date(monday);
        bs.setDate(monday.getDate() + idx);
        bs.setHours(0, 0, 0, 0);
        const be = new Date(bs);
        be.setHours(23, 59, 59, 999);
        return { name: dayLabels[idx], bucketStart: bs.getTime(), bucketEnd: be.getTime() };
      });
    } else if (viewType === 'month') {
      const anchorYear = viewBounds.start.getFullYear();
      const anchorMonth = viewBounds.start.getMonth();
      buckets = [0, 1, 2, 3].map((w) => {
        const startDay = w * 7 + 1;
        const endDay = w === 3 ? new Date(anchorYear, anchorMonth + 1, 0).getDate() : (w + 1) * 7;
        const bs = new Date(anchorYear, anchorMonth, startDay, 0, 0, 0, 0);
        const be = new Date(anchorYear, anchorMonth, endDay, 23, 59, 59, 999);
        return { name: `Week ${w + 1}`, bucketStart: bs.getTime(), bucketEnd: be.getTime() };
      });
    } else {
      const y = viewBounds.start.getFullYear();
      const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      buckets = monthLabels.map((name, idx) => {
        const bs = new Date(y, idx, 1, 0, 0, 0, 0);
        const be = new Date(y, idx + 1, 0, 23, 59, 59, 999);
        return { name, bucketStart: bs.getTime(), bucketEnd: be.getTime() };
      });
    }

    // Build sorted dates per customer across all branch transactions
    const datesByCustomer = new Map();
    branchScopedTxns.forEach((t) => {
      const k = customerIdentityKey(t);
      const raw = new Date(t.created_at || t.updated_at || 0).getTime();
      if (Number.isNaN(raw)) return;
      if (!datesByCustomer.has(k)) datesByCustomer.set(k, []);
      datesByCustomer.get(k).push(raw);
    });
    datesByCustomer.forEach((arr) => arr.sort((a, b) => a - b));

    return buckets.map((bucket) => {
      let newCustomers = 0;
      let returningCustomers = 0;
      const activeStart = Math.max(bucket.bucketStart, effectiveStart.getTime());
      const activeEnd = Math.min(bucket.bucketEnd, effectiveEnd.getTime());
      if (activeStart > activeEnd) return { name: bucket.name, newCustomers, returningCustomers };
      datesByCustomer.forEach((dates) => {
        const inBucket = dates.some((d) => d >= activeStart && d <= activeEnd);
        if (!inBucket) return;
        const firstEver = dates[0];
        if (firstEver >= activeStart && firstEver <= activeEnd) newCustomers += 1;
        if (firstEver < activeStart) returningCustomers += 1;
      });
      return { name: bucket.name, newCustomers, returningCustomers };
    });
  }, [branchScopedTxns, viewType, viewBounds, rangeStartDate, rangeEndDate]);

  const showGrowthTrendsSection = useMemo(
    () => customersGrowthData.length > 0,
    [customersGrowthData]
  );

  const debitCount = useMemo(
    () => filteredTransactions.filter((t) => t.payment_status === 'unpaid').length,
    [filteredTransactions]
  );
  const inShopCount = useMemo(
    () => filteredTransactions.filter((t) => t.inventory_status === 'in_shop').length,
    [filteredTransactions]
  );
  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredTransactions.filter((t) => {
      if (t.inventory_status !== 'in_shop' || !t.due_date) return false;
      const due = new Date(t.due_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;
  }, [filteredTransactions]);

  const todayData = useMemo(() => {
    const labels = ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM'];
    const dayStart = new Date(viewBounds.start);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(viewBounds.end);
    const buckets = labels.map((name) => ({
      name,
      revenue: 0,
      unpaid: 0,
      rush: 0,
      regular: 0,
    }));
    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt < dayStart || dt > dayEnd) return;
      const hour = dt.getHours();
      if (hour < 8 || hour > 18) return;
      const idx = Math.min(labels.length - 1, Math.floor((hour - 8) / 2));
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') {
        buckets[idx].revenue += amount;
        if (isRushOrder(t)) buckets[idx].rush += amount;
        else buckets[idx].regular += amount;
      } else buckets[idx].unpaid += amount;
    });
    return buckets;
  }, [filteredTransactions, viewBounds]);

  const weekData = useMemo(() => {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const anchor = new Date(viewBounds.start);
    const dow = anchor.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const rows = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return {
        name: dayLabels[idx],
        key: d.toDateString(),
        revenue: 0,
        unpaid: 0,
        rush: 0,
        regular: 0,
      };
    });
    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt < monday || dt > weekEnd) return;
      const row = rows.find((r) => r.key === dt.toDateString());
      if (!row) return;
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') {
        row.revenue += amount;
        if (isRushOrder(t)) row.rush += amount;
        else row.regular += amount;
      } else row.unpaid += amount;
    });
    return rows.map(({ name, revenue, unpaid, rush, regular }) => ({
      name,
      revenue,
      unpaid,
      rush,
      regular,
    }));
  }, [filteredTransactions, viewBounds]);

  const monthData = useMemo(() => {
    const anchor = new Date(viewBounds.start);
    const anchorYear = anchor.getFullYear();
    const anchorMonth = anchor.getMonth();
    const rows = [
      { name: 'Week 1', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Week 2', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Week 3', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Week 4', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
    ];
    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt.getFullYear() !== anchorYear || dt.getMonth() !== anchorMonth) return;
      const idx = Math.min(3, Math.floor((dt.getDate() - 1) / 7));
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') {
        rows[idx].revenue += amount;
        if (isRushOrder(t)) rows[idx].rush += amount;
        else rows[idx].regular += amount;
      } else rows[idx].unpaid += amount;
    });
    return rows;
  }, [filteredTransactions, viewBounds]);

  const yearData = useMemo(() => {
    const rows = [
      { name: 'Jan', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Feb', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Mar', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Apr', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'May', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Jun', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Jul', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Aug', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Sep', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Oct', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Nov', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
      { name: 'Dec', revenue: 0, unpaid: 0, rush: 0, regular: 0 },
    ];
    const anchorYear = viewBounds.start.getFullYear();
    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt.getFullYear() !== anchorYear) return;
      const idx = dt.getMonth();
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') {
        rows[idx].revenue += amount;
        if (isRushOrder(t)) rows[idx].rush += amount;
        else rows[idx].regular += amount;
      } else rows[idx].unpaid += amount;
    });
    return rows;
  }, [filteredTransactions, viewBounds]);

  const chartData = useMemo(() => {
    if (viewType === 'today') return todayData;
    if (viewType === 'week') return weekData;
    if (viewType === 'month') return monthData;
    return yearData;
  }, [viewType, todayData, weekData, monthData, yearData]);

  const rushRegularChartData = useMemo(() => {
    return chartData.map(({ name, rush, regular }) => ({ name, rush, regular }));
  }, [
    chartData,
  ]);

  const disputeStats = useMemo(() => {
    const total = disputesInView.reduce((sum, r) => sum + disputeAmountFromReport(r), 0);
    return { total, count: disputesInView.length, chart: buildDisputeSeries(viewType, disputesInView, viewBounds.start) };
  }, [disputesInView, viewType, viewBounds.start]);

  // Disputes trend: follows Today/Weekly/Monthly/Yearly toggle + custom date filter intersection
  const disputesTrendReports = useMemo(() => {
    if (!selectedBranchId) return [];
    const { start, end } = getEffectiveChartBounds(viewBounds, rangeStartDate, rangeEndDate);
    return issueReports.filter((r) => {
      if (String(r.branch_id) !== String(selectedBranchId)) return false;
      const rt = String(r.resolution_type || '').toLowerCase();
      if (rt !== 'refund' && rt !== 'replacement') return false;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      if (Number.isNaN(dt.getTime()) || dt < start || dt > end) return false;
      return true;
    });
  }, [issueReports, selectedBranchId, viewBounds, rangeStartDate, rangeEndDate]);

  const disputesTrendData = useMemo(
    () => buildDisputeSeries(viewType, disputesTrendReports, viewBounds.start),
    [viewType, disputesTrendReports, viewBounds.start]
  );

  // Branch performance trend for the selected branch, aligned to current period buckets.
  const branchPerformanceData = useMemo(() => {
    const disputesByBucket = new Map(
      disputesTrendData.map((row) => [String(row.name), Number(row.amount) || 0])
    );
    return chartData.map((row) => {
      const revenue = Number(row.revenue) || 0;
      const unpaid = Number(row.unpaid) || 0;
      const disputeLoss = disputesByBucket.get(String(row.name)) || 0;
      const losses = unpaid + disputeLoss;
      return {
        name: String(row.name),
        revenue,
        losses,
        profit: revenue - losses,
      };
    });
  }, [chartData, disputesTrendData]);

  // White vs Colored clothes (branch-scoped, uses filteredTransactions which is branch+date filtered)
  const whiteVsColoredData = useMemo(() => {
    const out = [{ name: 'White', amount: 0 }, { name: 'Colored', amount: 0 }];
    filteredTransactions.forEach((t) => {
      const items = extractTransactionItems(t);
      const txnAmount = Number(t.amount) || 0;
      if (items.length === 0) {
        // fallback: count entire txn as 'Colored' (unknown)
        out[1].amount += txnAmount;
        return;
      }
      const per = txnAmount / Math.max(items.length, 1);
      items.forEach((it) => {
        const amt = Number(it.line_total) || per || 0;
        if (isWhiteItem(it)) out[0].amount += amt; else out[1].amount += amt;
      });
    });
    return out;
  }, [filteredTransactions]);

  // Service items aggregation (top services by amount)
  const serviceItemsData = useMemo(() => {
    const map = new Map();
    filteredTransactions.forEach((t) => {
      const items = extractTransactionItems(t);
      const txnAmount = Number(t.amount) || 0;
      if (items.length === 0) return;
      const per = txnAmount / Math.max(items.length, 1);
      items.forEach((it) => {
        const key = serviceItemName(it) || 'Unknown';
        const amt = Number(it.line_total ?? it.total ?? it.amount) || per || 0;
        map.set(key, (map.get(key) || 0) + amt);
      });
    });
    const arr = Array.from(map.entries()).map(([name, amount]) => ({ name, amount }));
    arr.sort((a, b) => b.amount - a.amount);
    return arr.slice(0, 12);
  }, [filteredTransactions]);

  const recentTransactions = useMemo(
    () =>
      [...filteredTransactions]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5),
    [filteredTransactions]
  );

  const selectedBranch = useMemo(() => {
    const fromList = sortedBranches.find((b) => String(b.id) === String(selectedBranchId));
    if (fromList) return fromList;
    const ub = storedUser?.branch;
    if (ub && String(ub.id) === String(selectedBranchId)) {
      return { id: ub.id, name: ub.name || 'Branch' };
    }
    if (selectedBranchId) {
      return { id: selectedBranchId, name: 'Branch' };
    }
    return undefined;
  }, [sortedBranches, selectedBranchId, storedUser]);
  const revenueYAxisTick = useCallback((v) => formatPeso(v, 2), []);
  const pesoTooltipFormatter = useCallback((v) => formatPeso(v, 2), []);
  const growthTooltipFormatter = useCallback((value, name) => {
    const n = String(name || '');
    const label = n.toLowerCase().includes('returning') ? 'Active returning customers' : 'New customers';
    return [`${Number(value ?? 0)}`, label];
  }, []);
  const onRangeStartDateChange = useCallback((e) => {
    const v = e.target.value;
    setRangeStartDate(v);
    // If new start is after current end, auto-clear end so range stays valid
    if (v && rangeEndDate && v > rangeEndDate) setRangeEndDate('');
  }, [rangeEndDate]);
  const onRangeEndDateChange = useCallback((e) => {
    const v = e.target.value;
    setRangeEndDate(v);
    // If new end is before current start, auto-clear start so range stays valid
    if (v && rangeStartDate && v < rangeStartDate) setRangeStartDate('');
  }, [rangeStartDate]);
  const clearDateRange = useCallback(() => {
    setRangeStartDate('');
    setRangeEndDate('');
  }, []);

  const exportPayload = useMemo(
    () => ({
      branchName: (selectedBranch && selectedBranch.name) || '—',
      branchId: selectedBranchId || '—',
      viewTypeLabel: VIEW_TYPE_LABELS[viewType] || viewType,
      rangeStartDate,
      rangeEndDate,
      viewWindowStartIso: viewBounds.start.toISOString(),
      viewWindowEndIso: viewBounds.end.toISOString(),
      paidTotal,
      totalRevenue,
      unpaidAmountTotal,
      refundLossTotal,
      totalLosses,
      branchPerformancePct,
      debitCount,
      inShopCount,
      overdueCount,
      disputeTypeLabel: 'Refunds & backjobs',
      disputeTotal: disputeStats.total,
      disputeCount: disputeStats.count,
      chartData,
      disputeChartData: disputeStats.chart,
      recentTransactions,
      totalWeightProcessed,
      monthlyLossStack12,
      monthlyLossRefundRows: lossRefundRows,
      monthlyLossBackjobRows: lossBackjobRows,
      disputesTrendData,
      branchPerformanceData,
      whiteVsColoredData,
      serviceItemsData,
      customersGrowthByMonth: customersGrowthData,
      rushRegularChartData,
    }),
    [
      selectedBranch,
      selectedBranchId,
      viewType,
      rangeStartDate,
      rangeEndDate,
      viewBounds.start,
      viewBounds.end,
      paidTotal,
      totalRevenue,
      unpaidAmountTotal,
      refundLossTotal,
      totalLosses,
      branchPerformancePct,
      debitCount,
      inShopCount,
      overdueCount,
      disputeStats.total,
      disputeStats.count,
      chartData,
      disputeStats.chart,
      recentTransactions,
      totalWeightProcessed,
      monthlyLossStack12,
      lossRefundRows,
      lossBackjobRows,
      disputesTrendData,
      branchPerformanceData,
      whiteVsColoredData,
      serviceItemsData,
      customersGrowthData,
      rushRegularChartData,
    ]
  );

  const handleExportCsv = useCallback(() => {
    downloadAnalyticsCsv(buildAnalyticsCsv(exportPayload), 'branch-report');
  }, [exportPayload]);

  /** Capture all visible chart containers as PNG data URLs for PDF embedding. */
  const captureChartImages = useCallback(async () => {
    const result = {};

    /** Inline computed SVG styles so html2canvas can see fill/stroke colors. */
    const inlineSvgStyles = (container) => {
      const svgEls = container.querySelectorAll('svg *');
      svgEls.forEach((el) => {
        const cs = window.getComputedStyle(el);
        if (cs.fill && cs.fill !== 'none') el.style.fill = cs.fill;
        if (cs.stroke && cs.stroke !== 'none') el.style.stroke = cs.stroke;
        if (cs.opacity) el.style.opacity = cs.opacity;
      });
    };

    const captureRef = async (ref, key) => {
      if (!ref.current) return;
      try {
        inlineSvgStyles(ref.current);
        const canvas = await html2canvas(ref.current, {
          backgroundColor: '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false,
          foreignObjectRendering: false,
        });
        result[key] = canvas.toDataURL('image/png');
      } catch (err) {
        console.warn(`Chart capture failed for ${key}:`, err);
      }
    };
    await Promise.all([
      captureRef(refundChartRef, 'refundChart'),
      captureRef(backjobChartRef, 'backjobChart'),
      captureRef(growthChartRef, 'growthChart'),
      captureRef(rushChartRef, 'rushChart'),
    ]);
    return result;
  }, []);

  const handleExportPdf = useCallback(async () => {
    const chartImages = await captureChartImages();
    await exportAnalyticsPdf(exportPayload, chartImages, 'download');
  }, [exportPayload, captureChartImages]);

  const handlePrint = useCallback(async () => {
    const chartImages = await captureChartImages();
    await exportAnalyticsPdf(exportPayload, chartImages, 'print');
  }, [exportPayload, captureChartImages]);

  return (
    <DashboardLayout>
      <div className="main-cards analytics-page">
        {!selectedBranchId &&
          (!branchListFetchDone ? (
            <p className="analytics-empty">Loading branch data…</p>
          ) : (
            <p className="analytics-empty">No branches available for your account.</p>
          ))}

        {selectedBranchId ? (
          <>
            <div className="analytics-page-header">
              <h1 className="analytics-page-heading">Report</h1>
              <div className="analytics-export-dropdown" ref={exportDropdownRef}>
                <button
                  type="button"
                  className="analytics-export-toggle"
                  onClick={() => setExportDropdownOpen((prev) => !prev)}
                  aria-haspopup="true"
                  aria-expanded={exportDropdownOpen}
                >
                  Export ▾
                </button>
                {exportDropdownOpen && (
                  <div className="analytics-export-menu">
                    <button
                      type="button"
                      className="analytics-export-menu-item"
                      onClick={() => { handleExportCsv(); setExportDropdownOpen(false); }}
                    >
                      📊 Excel (.csv)
                    </button>
                    <button
                      type="button"
                      className="analytics-export-menu-item"
                      onClick={() => { handleExportPdf(); setExportDropdownOpen(false); }}
                    >
                      📄 PDF
                    </button>
                    <button
                      type="button"
                      className="analytics-export-menu-item"
                      onClick={() => { handlePrint(); setExportDropdownOpen(false); }}
                    >
                      🖨️ Print
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p className="analytics-print-meta">
              Branch: {selectedBranch?.name || '—'} · Chart period: {VIEW_TYPE_LABELS[viewType] || viewType}
              {(rangeStartDate || rangeEndDate) && (
                <> · Custom range: {rangeStartDate || '—'} to {rangeEndDate || '—'}</>
              )}
            </p>

            <div className="analytics-exec-header">
              <h2 className="analytics-section-title">Executive summary</h2>
              <div className="chart-controls analytics-chart-controls">
                <button className={`chart-toggle-btn ${viewType === 'today' ? 'active' : ''}`} onClick={() => setViewType('today')}>Today</button>
                <button className={`chart-toggle-btn ${viewType === 'week' ? 'active' : ''}`} onClick={() => setViewType('week')}>Weekly</button>
                <button className={`chart-toggle-btn ${viewType === 'month' ? 'active' : ''}`} onClick={() => setViewType('month')}>Monthly</button>
                <button className={`chart-toggle-btn ${viewType === 'year' ? 'active' : ''}`} onClick={() => setViewType('year')}>Yearly</button>
                <div className={`chart-date-range${rangeStartDate || rangeEndDate ? ' chart-date-range--active' : ''}`}>
                  <input
                    type="date"
                    className="chart-year-date"
                    value={rangeStartDate}
                    max={rangeEndDate || todayIso}
                    onChange={onRangeStartDateChange}
                    aria-label="Filter start date"
                  />
                  <span className="chart-date-range-sep">to</span>
                  <input
                    type="date"
                    className="chart-year-date"
                    value={rangeEndDate}
                    min={rangeStartDate || undefined}
                    max={todayIso}
                    onChange={onRangeEndDateChange}
                    aria-label="Filter end date"
                  />
                  {(rangeStartDate || rangeEndDate) && (
                    <button
                      type="button"
                      className="chart-date-range-clear"
                      onClick={clearDateRange}
                      title="Clear date range"
                      aria-label="Clear date range"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="analytics-kpi-primary analytics-kpi-exec">
              <div className="analytics-kpi-tile analytics-kpi-revenue">
                <div className="chart-title">Total revenue</div>
                <div className="icon-value">
                  <BsGraphUpArrow className="icon" />
                  <span>{formatPeso(totalRevenue, 2)}</span>
                </div>
                <p className="analytics-kpi-caption">Paid orders in this period</p>
              </div>
              <div className="analytics-kpi-tile analytics-kpi-loss">
                <div className="chart-title">Total losses</div>
                <div className="icon-value">
                  <BsGraphDownArrow className="icon" />
                  <span>{formatPeso(totalLosses)}</span>
                </div>
                <p className="analytics-kpi-caption">Unpaid debit + resolved refunds</p>
              </div>
              <div className="analytics-kpi-tile analytics-kpi-profit">
                <div className="chart-title">Net profit</div>
                <div className="icon-value">
                  <BsGraphUpArrow className="icon" />
                  <span>{formatPeso(netProfit, 2)}</span>
                </div>
                <p className="analytics-kpi-caption">Revenue − losses (excl. taxes)</p>
              </div>
              <div className="analytics-kpi-tile analytics-kpi-weight">
                <div className="chart-title">Total weight processed</div>
                <div className="icon-value">
                  <BsBasket className="icon" />
                  <span>
                    {totalWeightProcessed.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    kg
                  </span>
                </div>
                <p className="analytics-kpi-caption">Sum of order weights in this period</p>
              </div>
            </div>

            <div className="analytics-chart-pair">
                <Card title="Loss & quality — Refunds">
                  <p className="analytics-card-sub">
                    Refund resolutions by issue reason (damaged, lost, other). Tooltip lists reported issues
                    (category and optional customer note), not resolution remarks.
                  </p>
                  <div ref={refundChartRef}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={lossRefundRows} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis
                        width={78}
                        tickFormatter={revenueYAxisTick}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                      />
                      <Tooltip content={<LossQualityTooltip />} />
                      <Legend />
                      <Bar dataKey="Damaged" stackId="ref" name="Damaged" fill="#0f766e" />
                      <Bar dataKey="Lost" stackId="ref" name="Lost" fill="#14b8a6" />
                      <Bar dataKey="Other" stackId="ref" name="Other" fill="#99f6e4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Unresolved" stackId="ref" name="Unresolved" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </Card>
                <Card title="Loss & quality — Backjobs">
                  <p className="analytics-card-sub">
                    Backjob / replacement resolutions by issue reason. Tooltip lists reported issues (category
                    and optional customer note), not resolution remarks.
                  </p>
                  <div ref={backjobChartRef}>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={lossBackjobRows} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <YAxis
                        width={78}
                        tickFormatter={revenueYAxisTick}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                      />
                      <Tooltip content={<LossQualityTooltip />} />
                      <Legend />
                      <Bar dataKey="PoorQuality" stackId="bj" name="Poor quality cleaning" fill="#5b21b6" />
                      <Bar dataKey="Wrinkled" stackId="bj" name="Wrinkled / not folded" fill="#7c3aed" />
                      <Bar dataKey="Other" stackId="bj" name="Other" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Unresolved" stackId="bj" name="Unresolved" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                </Card>
            </div>

            <div className="analytics-chart-pair">
              <Card title="Disputes trend">
                <p className="analytics-card-sub">Dispute amounts follow the selected Today/Weekly/Monthly/Yearly filter.</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={disputesTrendData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis width={78} tickFormatter={revenueYAxisTick} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip formatter={pesoTooltipFormatter} />
                    <Bar dataKey="amount" name="Disputes" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Branch performance (revenue vs losses)">
                <p className="analytics-card-sub">
                  Selected branch: {selectedBranch?.name || '—'}. X-axis follows the active filter
                  (Today/Weekly/Monthly/Yearly) so you can see period-by-period performance.
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={branchPerformanceData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis width={78} tickFormatter={revenueYAxisTick} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip formatter={pesoTooltipFormatter} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#059669" />
                    <Bar dataKey="losses" name="Losses" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div
              className={
                showGrowthTrendsSection
                  ? 'analytics-chart-pair'
                  : 'analytics-chart-pair analytics-chart-pair--single'
              }
            >
              {showGrowthTrendsSection ? (
                <Card title="Growth trends">
                  <p className="analytics-card-sub">
                    New customers: first order at this branch falls in the period. Active returning customers: had orders
                    before that period and at least one order in it (name + address match).
                  </p>
                  <div ref={growthChartRef}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={customersGrowthData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <Legend
                        verticalAlign="top"
                        align="center"
                        iconType="circle"
                        iconSize={10}
                        wrapperStyle={{ paddingBottom: 8 }}
                      />
                      <XAxis dataKey="name" />
                      <YAxis width={44} allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip formatter={growthTooltipFormatter} />
                      <Line
                        type="monotone"
                        dataKey="newCustomers"
                        name="New customers"
                        stroke="#185BCB"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="returningCustomers"
                        name="Active returning customers"
                        stroke="#059669"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                </Card>
              ) : null}

              <Card title="Rush vs regular (paid revenue)">
                <p className="analytics-card-sub">
                  Paid rush (express) vs regular for the selected period. Today uses 2-hour slots, Weekly uses Mon–Sun,
                  Monthly uses Week 1–4 of the selected month, and Yearly uses Jan–Dec of the selected year.
                </p>
                <div ref={rushChartRef}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={rushRegularChartData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis width={78} tickFormatter={revenueYAxisTick} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip formatter={pesoTooltipFormatter} />
                    <Legend />
                    <Bar dataKey="rush" name="Rush" fill="#ea580c" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="regular" name="Regular" fill="#64748b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div className="analytics-chart-pair">
              <Card title="White vs Colored">
                <p className="analytics-card-sub">Breakdown of transaction amount for white vs colored items in the selected filters.</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={whiteVsColoredData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis width={78} tickFormatter={revenueYAxisTick} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip formatter={pesoTooltipFormatter} />
                    <Bar dataKey="amount" name="Amount" fill="#1e40af" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card title="Service items">
                <p className="analytics-card-sub">Top service items by amount for the selected filters.</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={serviceItemsData} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis width={78} tickFormatter={revenueYAxisTick} tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip formatter={pesoTooltipFormatter} />
                    <Bar dataKey="amount" name="Amount" fill="#9333ea" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <Card title={`Recent Transactions`}>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Customer</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.length === 0 ? (
                      <tr><td colSpan={6}>No transactions in selected filters.</td></tr>
                    ) : (
                      recentTransactions.map((t) => (
                        <tr key={`analytics-txn-${t.id}`}>
                          <td>{t.receipt || `TXN-${t.id}`}</td>
                          <td>{t.customer_name || '—'}</td>
                          <td>{t.payment_status || '—'}</td>
                          <td>{t.inventory_status || '—'}</td>
                          <td>{formatPeso(Number(t.amount || 0))}</td>
                          <td>{new Date(t.created_at || Date.now()).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
