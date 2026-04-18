import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BsBasket, BsGraphDownArrow, BsGraphUpArrow, BsPercent } from 'react-icons/bs';
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

function disputeAmountFromReport(row) {
  const n = Number(row?.transaction?.amount);
  return Number.isFinite(n) ? n : 0;
}

function buildDisputeSeries(viewType, reports) {
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
    const n = new Date();
    const dow = n.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(n);
    monday.setDate(n.getDate() + mondayOffset);
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
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
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

/** One entry per calendar month from start through end (inclusive), capped for safety. */
function eachMonthInRange(start, end) {
  const rows = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonthStart = new Date(end.getFullYear(), end.getMonth(), 1);
  let guard = 0;
  while (cur <= endMonthStart && guard < 48) {
    const label = cur.toLocaleString('en-PH', { month: 'short', year: '2-digit' });
    rows.push({
      name: label,
      y: cur.getFullYear(),
      m: cur.getMonth(),
      monthStart: new Date(cur.getFullYear(), cur.getMonth(), 1),
      monthEnd: new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999),
    });
    cur.setMonth(cur.getMonth() + 1);
    guard += 1;
  }
  return rows;
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
    const parsedYearDate = new Date(rangeStartDate || new Date().toISOString().slice(0, 10));
    const hasValidYearDate = !Number.isNaN(parsedYearDate.getTime());
    const referenceDate = viewType === 'year' && hasValidYearDate ? parsedYearDate : new Date();
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

  const lossMonthlyCharts = useMemo(() => {
    if (!selectedBranchId) {
      return {
        refundRows: [],
        backjobRows: [],
        monthlyLossStack12: [],
      };
    }
    const { start, end } = getEffectiveChartBounds(viewBounds, rangeStartDate, rangeEndDate);
    const months = eachMonthInRange(start, end);
    if (months.length === 0) {
      return { refundRows: [], backjobRows: [], monthlyLossStack12: [] };
    }

    const refundTemplate = () => ({
      Damaged: 0,
      Lost: 0,
      Other: 0,
      issueSummaries: [],
    });
    const backjobTemplate = () => ({
      PoorQuality: 0,
      Wrinkled: 0,
      Other: 0,
      issueSummaries: [],
    });

    const refundRows = months.map((mo) => ({ name: mo.name, y: mo.y, m: mo.m, ...refundTemplate() }));
    const backjobRows = months.map((mo) => ({ name: mo.name, y: mo.y, m: mo.m, ...backjobTemplate() }));
    const idxKey = (y, m) => `${y}-${m}`;
    const refundIdx = new Map(months.map((mo, i) => [idxKey(mo.y, mo.m), i]));

    issueReports.forEach((r) => {
      if (String(r.branch_id) !== String(selectedBranchId)) return;
      if (String(r.status || '').toLowerCase() !== 'resolved') return;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      if (Number.isNaN(dt.getTime()) || dt < start || dt > end) return;
      const ix = refundIdx.get(idxKey(dt.getFullYear(), dt.getMonth()));
      if (ix === undefined) return;
      const rt = String(r.resolution_type || '').toLowerCase();
      const amt = disputeAmountFromReport(r);
      const summary = issueSummaryForTooltip(r);
      if (rt === 'refund') {
        const row = refundRows[ix];
        const reason = refundReasonDataKeys(r.issue_type);
        row[reason] += amt;
        row.issueSummaries.push(summary);
      } else if (rt === 'replacement') {
        const row = backjobRows[ix];
        const reason = backjobReasonDataKeys(r.issue_type);
        row[reason] += amt;
        row.issueSummaries.push(summary);
      }
    });

    const uniqIssuePreview = (arr) => [...new Set(arr)].slice(0, 8).join(' · ');

    const refundOut = refundRows.map(
      ({ issueSummaries, Damaged, Lost, Other, name }) => ({
        name,
        Damaged,
        Lost,
        Other,
        issuesPreview: uniqIssuePreview(issueSummaries),
      })
    );
    const backjobOut = backjobRows.map(
      ({ issueSummaries, PoorQuality, Wrinkled, Other, name }) => ({
        name,
        PoorQuality,
        Wrinkled,
        Other,
        issuesPreview: uniqIssuePreview(issueSummaries),
      })
    );

    const monthlyLossStack12 = months.map((_, i) => ({
      name: months[i].name,
      refund: refundRows[i].Damaged + refundRows[i].Lost + refundRows[i].Other,
      backjob: backjobRows[i].PoorQuality + backjobRows[i].Wrinkled + backjobRows[i].Other,
    }));

    return {
      refundRows: refundOut,
      backjobRows: backjobOut,
      monthlyLossStack12,
    };
  }, [issueReports, selectedBranchId, viewBounds, rangeStartDate, rangeEndDate]);

  const { refundRows: monthlyLossRefundRows, backjobRows: monthlyLossBackjobRows, monthlyLossStack12 } =
    lossMonthlyCharts;

  const showLossQualitySection = useMemo(() => {
    return (
      monthlyLossRefundRows.some(
        (r) => r.Damaged > 0.005 || r.Lost > 0.005 || r.Other > 0.005
      ) ||
      monthlyLossBackjobRows.some(
        (r) => r.PoorQuality > 0.005 || r.Wrinkled > 0.005 || r.Other > 0.005
      )
    );
  }, [monthlyLossRefundRows, monthlyLossBackjobRows]);

  /** New vs returning customers by month (same date window as loss charts). */
  const customersGrowthByMonth = useMemo(() => {
    const { start, end } = getEffectiveChartBounds(viewBounds, rangeStartDate, rangeEndDate);
    const months = eachMonthInRange(start, end);
    if (months.length === 0 || branchScopedTxns.length === 0) return [];

    const datesByCustomer = new Map();
    branchScopedTxns.forEach((t) => {
      const k = customerIdentityKey(t);
      const raw = new Date(t.created_at || t.updated_at || 0).getTime();
      if (Number.isNaN(raw)) return;
      if (!datesByCustomer.has(k)) datesByCustomer.set(k, []);
      datesByCustomer.get(k).push(raw);
    });
    datesByCustomer.forEach((arr) => arr.sort((a, b) => a - b));

    return months.map((mo) => {
      const ms = mo.monthStart.getTime();
      const me = mo.monthEnd.getTime();
      let newCustomers = 0;
      let returningCustomers = 0;
      datesByCustomer.forEach((dates) => {
        const inMonth = dates.some((d) => d >= ms && d <= me);
        if (!inMonth) return;
        const firstEver = dates[0];
        if (firstEver >= ms && firstEver <= me) newCustomers += 1;
        if (firstEver < ms) returningCustomers += 1;
      });
      return {
        name: mo.name,
        newCustomers,
        returningCustomers,
      };
    });
  }, [branchScopedTxns, viewBounds, rangeStartDate, rangeEndDate]);

  const showGrowthTrendsSection = useMemo(
    () => customersGrowthByMonth.length > 0,
    [customersGrowthByMonth]
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
    if (viewType === 'today') return todayData.map(({ name, rush, regular }) => ({ name, rush, regular }));
    if (viewType === 'week') return weekData.map(({ name, rush, regular }) => ({ name, rush, regular }));
    if (viewType === 'month') return monthData.map(({ name, rush, regular }) => ({ name, rush, regular }));
    return yearData.map(({ name, rush, regular }) => ({ name, rush, regular }));
  }, [viewType, todayData, weekData, monthData, yearData]);

  const disputeStats = useMemo(() => {
    const total = disputesInView.reduce((sum, r) => sum + disputeAmountFromReport(r), 0);
    return { total, count: disputesInView.length, chart: buildDisputeSeries(viewType, disputesInView) };
  }, [disputesInView, viewType]);

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
  const onRangeStartDateChange = useCallback((e) => setRangeStartDate(e.target.value), []);
  const onRangeEndDateChange = useCallback((e) => setRangeEndDate(e.target.value), []);

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
      monthlyLossRefundRows,
      monthlyLossBackjobRows,
      customersGrowthByMonth,
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
      monthlyLossRefundRows,
      monthlyLossBackjobRows,
      customersGrowthByMonth,
      rushRegularChartData,
    ]
  );

  const handleExportCsv = useCallback(() => {
    downloadAnalyticsCsv(buildAnalyticsCsv(exportPayload), 'branch-report');
  }, [exportPayload]);

  const handleExportPdf = useCallback(async () => {
    await exportAnalyticsPdf(exportPayload);
  }, [exportPayload]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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
              <div className="analytics-export-toolbar">
                <span className="analytics-export-label">Export</span>
                <button type="button" className="analytics-export-btn" onClick={handleExportCsv}>
                  Excel(.csv)
                </button>
                <button type="button" className="analytics-export-btn" onClick={handleExportPdf}>
                  PDF
                </button>
                <button type="button" className="analytics-export-btn" onClick={handlePrint}>
                  Print
                </button>
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
                <div className="chart-date-range">
                  <input type="date" className="chart-year-date" value={rangeStartDate} onChange={onRangeStartDateChange} />
                  <span className="chart-date-range-sep">to</span>
                  <input type="date" className="chart-year-date" value={rangeEndDate} onChange={onRangeEndDateChange} />
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
              <div className="analytics-kpi-tile analytics-kpi-performance">
                <div className="chart-title">Branch performance</div>
                <div className="icon-value">
                  <BsPercent className="icon" />
                  <span>{branchPerformancePct.toFixed(1)}%</span>
                </div>
                <p className="analytics-kpi-caption">Revenue ÷ (revenue + losses)</p>
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

            {showLossQualitySection ? (
              <div className="analytics-chart-pair">
                <Card title="Loss & quality — Refunds (resolved)">
                  <p className="analytics-card-sub">
                    Refund resolutions by month and issue reason (damaged, lost, other). Tooltip lists reported issues
                    (category and optional customer note), not resolution remarks.
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyLossRefundRows} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
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
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card title="Loss & quality — Backjobs (resolved)">
                  <p className="analytics-card-sub">
                    Backjob / replacement resolutions by month and issue reason. Tooltip lists reported issues (category
                    and optional customer note), not resolution remarks.
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={monthlyLossBackjobRows} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
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
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            ) : null}

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
                    New customers: first order at this branch falls in the month. Active returning customers: had orders
                    before that month and at least one order in the month (name + address match).
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={customersGrowthByMonth} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
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
                </Card>
              ) : null}

              <Card title="Rush vs regular (paid revenue)">
                <p className="analytics-card-sub">
                  Paid revenue grouped as rush (express) vs regular for the same period as the executive summary charts.
                </p>
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
