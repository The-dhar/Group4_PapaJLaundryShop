import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BsBasket,
  BsBoxSeam,
  BsCreditCard,
  BsExclamationTriangle,
  BsGraphDownArrow,
  BsGraphUpArrow,
  BsPercent,
} from 'react-icons/bs';
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
const formatPeso = (value) => `P${Number(value || 0).toLocaleString()}`;

const DISPUTE_CHART_CONFIG = {
  refund: { label: 'Refund', pluralLabel: 'Refunds', resolutionType: 'refund', lineColor: '#0d9488' },
  backjob: { label: 'Backjob', pluralLabel: 'Backjobs', resolutionType: 'replacement', lineColor: '#7c3aed' },
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

export default function AnalyticsPage() {
  const { transactions, fetchTransactions } = useTransactions();
  const [viewType, setViewType] = useState('week');
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [branches, setBranches] = useState(() => readBranchesCache());
  const [issueReports, setIssueReports] = useState([]);
  const [disputeChartType, setDisputeChartType] = useState('refund');
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

  const disputesInView = useMemo(() => {
    const { start, end } = viewBounds;
    const hasStartDate = Boolean(rangeStartDate);
    const hasEndDate = Boolean(rangeEndDate);
    const startDate = hasStartDate ? new Date(`${rangeStartDate}T00:00:00`) : null;
    const endDate = hasEndDate ? new Date(`${rangeEndDate}T23:59:59.999`) : null;
    const resolutionType = DISPUTE_CHART_CONFIG[disputeChartType]?.resolutionType || 'refund';
    return issueReports.filter((r) => {
      if (!selectedBranchId || String(r.branch_id) !== String(selectedBranchId)) return false;
      if (String(r.status || '').toLowerCase() !== 'resolved') return false;
      if (String(r.resolution_type || '').toLowerCase() !== resolutionType) return false;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      if (dt < start || dt > end) return false;
      if (startDate && dt < startDate) return false;
      if (endDate && dt > endDate) return false;
      return true;
    });
  }, [issueReports, viewBounds, disputeChartType, selectedBranchId, rangeStartDate, rangeEndDate]);

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

  const monthlyLossStack12 = useMemo(() => {
    if (!selectedBranchId) return [];
    const now = new Date();
    const rows = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-PH', { month: 'short', year: '2-digit' });
      rows.push({
        name: label,
        y: d.getFullYear(),
        m: d.getMonth(),
        refund: 0,
        backjob: 0,
      });
    }
    issueReports.forEach((r) => {
      if (String(r.branch_id) !== String(selectedBranchId)) return;
      if (String(r.status || '').toLowerCase() !== 'resolved') return;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      if (Number.isNaN(dt.getTime())) return;
      const row = rows.find((x) => x.y === dt.getFullYear() && x.m === dt.getMonth());
      if (!row) return;
      const rt = String(r.resolution_type || '').toLowerCase();
      const amt = disputeAmountFromReport(r);
      if (rt === 'refund') row.refund += amt;
      else if (rt === 'replacement') row.backjob += amt;
    });
    return rows;
  }, [issueReports, selectedBranchId]);

  const showLossQualitySection = useMemo(
    () => monthlyLossStack12.some((r) => r.refund > 0.005 || r.backjob > 0.005),
    [monthlyLossStack12]
  );

  const newCustomersByMonth12 = useMemo(() => {
    const firstMonthByCustomer = new Map();
    for (const t of branchScopedTxns) {
      const k = customerIdentityKey(t);
      if (!firstMonthByCustomer.has(k)) {
        const d = new Date(t.created_at || t.updated_at || Date.now());
        firstMonthByCustomer.set(
          k,
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        );
      }
    }
    const countByMonth = {};
    firstMonthByCustomer.forEach((ym) => {
      countByMonth[ym] = (countByMonth[ym] || 0) + 1;
    });
    const now = new Date();
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-PH', { month: 'short', year: '2-digit' });
      out.push({ name: label, count: countByMonth[ym] || 0 });
    }
    return out;
  }, [branchScopedTxns]);

  const showGrowthTrendsSection = useMemo(() => branchScopedTxns.length > 0, [branchScopedTxns]);

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
    const buckets = labels.map((name) => ({ name, revenue: 0, unpaid: 0 }));
    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      const hour = dt.getHours();
      if (hour < 8 || hour > 18) return;
      const idx = Math.min(labels.length - 1, Math.floor((hour - 8) / 2));
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') buckets[idx].revenue += amount;
      else buckets[idx].unpaid += amount;
    });
    return buckets;
  }, [filteredTransactions]);

  const weekData = useMemo(() => {
    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const now = new Date();
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const rows = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      return { name: dayLabels[idx], key: d.toDateString(), revenue: 0, unpaid: 0 };
    });
    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt < monday || dt > weekEnd) return;
      const row = rows.find((r) => r.key === dt.toDateString());
      if (!row) return;
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') row.revenue += amount;
      else row.unpaid += amount;
    });
    return rows.map(({ name, revenue, unpaid }) => ({ name, revenue, unpaid }));
  }, [filteredTransactions]);

  const monthData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const rows = [
      { name: 'Week 1', revenue: 0, unpaid: 0 },
      { name: 'Week 2', revenue: 0, unpaid: 0 },
      { name: 'Week 3', revenue: 0, unpaid: 0 },
      { name: 'Week 4', revenue: 0, unpaid: 0 },
    ];
    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt.getFullYear() !== currentYear || dt.getMonth() !== currentMonth) return;
      const idx = Math.min(3, Math.floor((dt.getDate() - 1) / 7));
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') rows[idx].revenue += amount;
      else rows[idx].unpaid += amount;
    });
    return rows;
  }, [filteredTransactions]);

  const yearData = useMemo(() => {
    const rows = [
      { name: 'Jan', revenue: 0, unpaid: 0 }, { name: 'Feb', revenue: 0, unpaid: 0 },
      { name: 'Mar', revenue: 0, unpaid: 0 }, { name: 'Apr', revenue: 0, unpaid: 0 },
      { name: 'May', revenue: 0, unpaid: 0 }, { name: 'Jun', revenue: 0, unpaid: 0 },
      { name: 'Jul', revenue: 0, unpaid: 0 }, { name: 'Aug', revenue: 0, unpaid: 0 },
      { name: 'Sep', revenue: 0, unpaid: 0 }, { name: 'Oct', revenue: 0, unpaid: 0 },
      { name: 'Nov', revenue: 0, unpaid: 0 }, { name: 'Dec', revenue: 0, unpaid: 0 },
    ];
    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      const idx = dt.getMonth();
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') rows[idx].revenue += amount;
      else rows[idx].unpaid += amount;
    });
    return rows;
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    if (viewType === 'today') return todayData;
    if (viewType === 'week') return weekData;
    if (viewType === 'month') return monthData;
    return yearData;
  }, [viewType, todayData, weekData, monthData, yearData]);

  const disputeStats = useMemo(() => {
    const total = disputesInView.reduce((sum, r) => sum + disputeAmountFromReport(r), 0);
    return { total, count: disputesInView.length, chart: buildDisputeSeries(viewType, disputesInView) };
  }, [disputesInView, viewType]);

  const recentTransactions = useMemo(
    () =>
      [...filteredTransactions]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 8),
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
  const disputeConfig = useMemo(
    () => DISPUTE_CHART_CONFIG[disputeChartType] || DISPUTE_CHART_CONFIG.refund,
    [disputeChartType]
  );
  const revenueYAxisTick = useCallback((v) => `P${v}`, []);
  const pesoTooltipFormatter = useCallback((v) => formatPeso(v), []);
  const growthCountTooltipFormatter = useCallback((v) => `${Number(v ?? 0)} new customers`, []);
  const onRangeStartDateChange = useCallback((e) => setRangeStartDate(e.target.value), []);
  const onRangeEndDateChange = useCallback((e) => setRangeEndDate(e.target.value), []);
  const onDisputeChartTypeChange = useCallback((e) => setDisputeChartType(e.target.value), []);

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
      disputeTypeLabel: disputeConfig.label,
      disputeTotal: disputeStats.total,
      disputeCount: disputeStats.count,
      chartData,
      disputeChartData: disputeStats.chart,
      recentTransactions,
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
      disputeConfig.label,
      disputeStats.total,
      disputeStats.count,
      chartData,
      disputeStats.chart,
      recentTransactions,
    ]
  );

  const handleExportCsv = useCallback(() => {
    downloadAnalyticsCsv(buildAnalyticsCsv(exportPayload), 'branch-report');
  }, [exportPayload]);

  const handleExportPdf = useCallback(() => {
    exportAnalyticsPdf(exportPayload);
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
                  CSV
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

            <h2 className="analytics-section-title">Executive summary</h2>
            <div className="analytics-kpi-primary analytics-kpi-exec">
              <div className="analytics-kpi-tile analytics-kpi-revenue">
                <div className="chart-title">Total revenue</div>
                <div className="icon-value">
                  <BsGraphUpArrow className="icon" />
                  <span>{formatPeso(totalRevenue)}</span>
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

            <div className="card-small analytics-secondary-kpis">
              <div className="chart-pending">
                <div className="chart-title">Debit Sales</div>
                <div className="icon-value"><BsCreditCard className="icon" /><span>{debitCount}</span></div>
              </div>
              <div className="card-items">
                <div className="chart-title">Items in Shop</div>
                <div className="icon-value"><BsBoxSeam className="icon" /><span>{inShopCount}</span></div>
              </div>
              <div className="card-inshop">
                <div className="chart-title">Overdue Items</div>
                <div className="icon-value"><BsExclamationTriangle className="icon" /><span>{overdueCount}</span></div>
              </div>
            </div>

            {showLossQualitySection ? (
              <Card title={`Loss & quality — ${selectedBranch?.name || 'Branch'}`}>
                <p className="analytics-card-sub">
                  Resolved dispute amounts by month (refunds vs backjobs). The system records two resolution types:
                  refund and backjobs.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyLossStack12} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis tickFormatter={revenueYAxisTick} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip formatter={pesoTooltipFormatter} />
                    <Legend />
                    <Bar dataKey="refund" stackId="loss" name="Refunds" fill="#0d9488" radius={[0, 0, 0, 0]} />
                    <Bar
                      dataKey="backjob"
                      stackId="loss"
                      name="Backjobs"
                      fill="#7c3aed"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            ) : null}

            {showGrowthTrendsSection ? (
              <Card title={`Growth trends — ${selectedBranch?.name || 'Branch'}`}>
                <p className="analytics-card-sub">
                  New customers by first transaction month (last 12 months), based on name + address from orders.
                </p>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={newCustomersByMonth12} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <Legend verticalAlign="top" align="center" iconType="circle" iconSize={10} wrapperStyle={{ paddingBottom: 8 }} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip formatter={growthCountTooltipFormatter} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="New customers"
                      stroke="#185BCB"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            ) : null}

            <Card title={`Revenue and Debit Sales — ${selectedBranch?.name || 'Branch'}`}>
              <div className="chart-controls">
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
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <Legend verticalAlign="top" align="center" iconType="circle" iconSize={10} wrapperStyle={{ paddingBottom: 8 }} />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={revenueYAxisTick} />
                  <Tooltip formatter={pesoTooltipFormatter} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#185BCB" strokeWidth={3} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="unpaid" name="Debit sales" stroke="#E63946" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <div className="refund-card-header">
                <h3 className="refund-card-title">
                  {`${disputeConfig.pluralLabel} — ${selectedBranch?.name || 'Branch'}`}
                </h3>
                <div className="refund-type-filter">
                  <label htmlFor="analytics-dispute-type">Type</label>
                  <select
                    id="analytics-dispute-type"
                    value={disputeChartType}
                    onChange={onDisputeChartTypeChange}
                  >
                    <option value="refund">Refund</option>
                    <option value="backjob">Backjob</option>
                  </select>
                </div>
              </div>
              <div className="refund-branch-kpis">
                <div className="refund-kpi">
                  <div className="refund-kpi-label">
                    {disputeChartType === 'refund' ? 'Total Refund Amount (Est.)' : 'Total Backjob Amount (Est.)'}
                  </div>
                  <div className="refund-kpi-value">{formatPeso(disputeStats.total)}</div>
                </div>
                <div className="refund-kpi">
                  <div className="refund-kpi-label">
                    {disputeChartType === 'refund' ? 'Refund Cases Resolved' : 'Backjob Cases Resolved'}
                  </div>
                  <div className="refund-kpi-value">{disputeStats.count}</div>
                </div>
              </div>
              <div className="refund-chart-wrap">
                <ResponsiveContainer width="100%" height={228}>
                  <LineChart data={disputeStats.chart} margin={{ top: 12, right: 12, left: 2, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tickFormatter={revenueYAxisTick} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip formatter={pesoTooltipFormatter} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      name={disputeConfig.label}
                      stroke={disputeConfig.lineColor}
                      strokeWidth={3}
                      dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card title={`Recent Transactions — ${selectedBranch?.name || 'Branch'}`}>
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
