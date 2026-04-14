import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BsBoxSeam, BsExclamationTriangle, BsCreditCard } from 'react-icons/bs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '../components/card';
import DashboardLayout from '../components/dashboardlayout';
import { useTransactions } from '../context/transactionsContext';
import { API_URL } from '../config/api';
import '../styles/dashboardstyle.css';

const POLL_MS = 45_000;

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
    // ignore quota / private mode
  }
}

const formatPeso = (value) => `₱${Number(value).toLocaleString()}`;

/** Same calendar windows as revenue charts (transaction dates). Refunds use `resolved_at` with the same windows. */
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
  } else if (viewType === 'year') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

function refundAmountFromReport(row) {
  const n = Number(row?.transaction?.amount);
  return Number.isFinite(n) ? n : 0;
}

function buildRefundSeries(viewType, refunds) {
  if (viewType === 'today') {
    const labels = ['12AM', '3AM', '6AM', '9AM', '12PM', '3PM', '6PM', '9PM'];
    const buckets = labels.map((name) => ({ name, refunds: 0 }));
    refunds.forEach((r) => {
      const dt = new Date(r.resolved_at || r.updated_at || Date.now());
      const idx = Math.min(7, Math.floor(dt.getHours() / 3));
      buckets[idx].refunds += refundAmountFromReport(r);
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
      return {
        name: dayLabels[idx],
        key: d.toDateString(),
        refunds: 0,
      };
    });

    refunds.forEach((r) => {
      const dt = new Date(r.resolved_at || r.updated_at || Date.now());
      if (dt < monday || dt > weekEnd) return;
      const key = dt.toDateString();
      const row = rows.find((x) => x.key === key);
      if (row) row.refunds += refundAmountFromReport(r);
    });

    return rows.map(({ name, refunds: ref }) => ({ name, refunds: ref }));
  }

  if (viewType === 'month') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const weekBuckets = [
      { name: 'Week 1', refunds: 0 },
      { name: 'Week 2', refunds: 0 },
      { name: 'Week 3', refunds: 0 },
      { name: 'Week 4', refunds: 0 },
    ];

    refunds.forEach((r) => {
      const dt = new Date(r.resolved_at || r.updated_at || Date.now());
      if (dt.getFullYear() !== currentYear || dt.getMonth() !== currentMonth) return;
      const day = dt.getDate();
      const bucketIdx = Math.min(3, Math.floor((day - 1) / 7));
      weekBuckets[bucketIdx].refunds += refundAmountFromReport(r);
    });

    return weekBuckets;
  }

  const rows = [
    { name: 'Jan', refunds: 0 },
    { name: 'Feb', refunds: 0 },
    { name: 'Mar', refunds: 0 },
    { name: 'Apr', refunds: 0 },
    { name: 'May', refunds: 0 },
    { name: 'Jun', refunds: 0 },
    { name: 'Jul', refunds: 0 },
    { name: 'Aug', refunds: 0 },
    { name: 'Sep', refunds: 0 },
    { name: 'Oct', refunds: 0 },
    { name: 'Nov', refunds: 0 },
    { name: 'Dec', refunds: 0 },
  ];

  refunds.forEach((r) => {
    const dt = new Date(r.resolved_at || r.updated_at || Date.now());
    const monthIdx = dt.getMonth();
    rows[monthIdx].refunds += refundAmountFromReport(r);
  });

  return rows;
}

const REFUND_CHART_H = 228;

/** Fixed-size LineChart driven by container width — avoids ResponsiveContainer delay/clipping with percentage-height cards. */
const RefundLineChart = memo(function RefundLineChart({ data }) {
  const wrapRef = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;

    const measure = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setWidth((prev) => (prev === w ? prev : w));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="refund-chart-inner">
      {width > 0 ? (
        <LineChart
          width={width}
          height={REFUND_CHART_H}
          data={data}
          margin={{ top: 12, right: 12, left: 2, bottom: 28 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#64748b', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
            tickMargin={12}
            padding={{ left: 12, right: 12 }}
            height={44}
          />
          <YAxis
            width={54}
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `₱${value}`}
            domain={[0, 'auto']}
          />
          <Tooltip
            formatter={(value) => formatPeso(value)}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
            }}
          />
          <Line
            type="monotone"
            dataKey="refunds"
            name="Refunds"
            stroke="#0d9488"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      ) : null}
    </div>
  );
}, (prev, next) => prev.data === next.data);

const Dashboard = () => {
  const { transactions, fetchTransactions } = useTransactions();
  const [viewType, setViewType] = useState('week');
  const [yearFilterDate, setYearFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  /** Restored from session on mount so navigating away/back does not flash empty. */
  const [branches, setBranches] = useState(() => readBranchesCache());
  const [issueReports, setIssueReports] = useState([]);
  /** False until the first /branches + /issue-reports attempt finishes (success or fail). */
  const [branchListFetchDone, setBranchListFetchDone] = useState(false);

  const fetchBranchesAndReports = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

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
      console.error('Dashboard refund data:', e);
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
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchTransactions();
        fetchBranchesAndReports();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchTransactions, fetchBranchesAndReports]);

  const activeTransactions = useMemo(
    () => transactions.filter((t) => !t.archived),
    [transactions]
  );

  /** One range object per view — avoids calling getViewDateBounds twice per render. */
  const viewBounds = useMemo(() => {
    const parsedYearDate = new Date(yearFilterDate);
    const hasValidYearDate = !Number.isNaN(parsedYearDate.getTime());
    const referenceDate = viewType === 'year' && hasValidYearDate ? parsedYearDate : new Date();
    return getViewDateBounds(viewType, referenceDate);
  }, [viewType, yearFilterDate]);

  const filteredTransactions = useMemo(() => {
    const { start, end } = viewBounds;
    return activeTransactions.filter((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      return dt >= start && dt <= end;
    });
  }, [activeTransactions, viewBounds]);

  const refundsInView = useMemo(() => {
    const { start, end } = viewBounds;
    return issueReports.filter((r) => {
      if (String(r.status || '').toLowerCase() !== 'resolved') return false;
      if (String(r.resolution_type || '').toLowerCase() !== 'refund') return false;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      return dt >= start && dt <= end;
    });
  }, [issueReports, viewBounds]);

  const sortedBranchesFromApi = useMemo(
    () => [...branches].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [branches]
  );

  /**
   * Prefer GET /branches. If that list is empty (e.g. still loading, or some roles get 403),
   * derive branch rows from issue reports so refund-by-branch still works.
   */
  const branchesForRefunds = useMemo(() => {
    if (sortedBranchesFromApi.length > 0) return sortedBranchesFromApi;
    const map = new Map();
    issueReports.forEach((r) => {
      const id = Number(r.branch_id);
      if (!Number.isFinite(id) || id <= 0) return;
      if (!map.has(id)) {
        map.set(id, { id, name: String(r.branch_name || `Branch ${id}`) });
      }
    });
    return [...map.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [sortedBranchesFromApi, issueReports]);

  const refundStatsByBranch = useMemo(() => {
    const map = new Map();
    branchesForRefunds.forEach((b) => {
      const id = Number(b.id);
      const list = refundsInView.filter((r) => Number(r.branch_id) === id);
      const total = list.reduce((sum, r) => sum + refundAmountFromReport(r), 0);
      map.set(id, { count: list.length, total, chart: buildRefundSeries(viewType, list) });
    });
    return map;
  }, [branchesForRefunds, refundsInView, viewType]);

  const paidTotal = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.payment_status === 'paid')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [filteredTransactions]
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
    const labels = ['12AM', '3AM', '6AM', '9AM', '12PM', '3PM', '6PM', '9PM'];
    const buckets = labels.map((name) => ({ name, revenue: 0, unpaid: 0 }));

    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      const idx = Math.min(7, Math.floor(dt.getHours() / 3));
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
      return {
        name: dayLabels[idx],
        key: d.toDateString(),
        revenue: 0,
        unpaid: 0,
      };
    });

    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt < monday || dt > weekEnd) return;
      const key = dt.toDateString();
      const row = rows.find((r) => r.key === key);
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
    const weekBuckets = [
      { name: 'Week 1', revenue: 0, unpaid: 0 },
      { name: 'Week 2', revenue: 0, unpaid: 0 },
      { name: 'Week 3', revenue: 0, unpaid: 0 },
      { name: 'Week 4', revenue: 0, unpaid: 0 },
    ];

    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt.getFullYear() !== currentYear || dt.getMonth() !== currentMonth) return;
      const day = dt.getDate();
      const bucketIdx = Math.min(3, Math.floor((day - 1) / 7));
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') weekBuckets[bucketIdx].revenue += amount;
      else weekBuckets[bucketIdx].unpaid += amount;
    });

    return weekBuckets;
  }, [filteredTransactions]);

  const yearData = useMemo(() => {
    const rows = [
      { name: 'Jan', revenue: 0, unpaid: 0 },
      { name: 'Feb', revenue: 0, unpaid: 0 },
      { name: 'Mar', revenue: 0, unpaid: 0 },
      { name: 'Apr', revenue: 0, unpaid: 0 },
      { name: 'May', revenue: 0, unpaid: 0 },
      { name: 'Jun', revenue: 0, unpaid: 0 },
      { name: 'Jul', revenue: 0, unpaid: 0 },
      { name: 'Aug', revenue: 0, unpaid: 0 },
      { name: 'Sep', revenue: 0, unpaid: 0 },
      { name: 'Oct', revenue: 0, unpaid: 0 },
      { name: 'Nov', revenue: 0, unpaid: 0 },
      { name: 'Dec', revenue: 0, unpaid: 0 },
    ];

    filteredTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      const monthIdx = dt.getMonth();
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') rows[monthIdx].revenue += amount;
      else rows[monthIdx].unpaid += amount;
    });

    return rows;
  }, [filteredTransactions]);

  const chartData = useMemo(() => {
    if (viewType === 'today') return todayData;
    if (viewType === 'week') return weekData;
    if (viewType === 'month') return monthData;
    return yearData;
  }, [viewType, todayData, weekData, monthData, yearData]);

  /** Stable empty series for refund fallback (avoid buildRefundSeries in render). */
  const emptyRefundChart = useMemo(() => buildRefundSeries(viewType, []), [viewType]);

  const revenueTooltipFormatter = useCallback((value) => formatPeso(value), []);
  const revenueYAxisTick = useCallback((value) => `₱${value}`, []);
  const revenueLegendFormatter = useCallback(
    (value) => <span style={{ color: '#334155', fontSize: 13 }}>{value}</span>,
    []
  );

  const recentTransactions = useMemo(
    () =>
      [...filteredTransactions]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 8),
    [filteredTransactions]
  );

  const setViewToday = useCallback(() => setViewType('today'), []);
  const setViewWeek = useCallback(() => setViewType('week'), []);
  const setViewMonth = useCallback(() => setViewType('month'), []);
  const setViewYear = useCallback(() => setViewType('year'), []);
  const onYearFilterDateChange = useCallback((e) => {
    setYearFilterDate(e.target.value);
  }, []);

  return (
    <DashboardLayout>
      <div className='main-cards'>

        {/* SMALL CARDS */}
        <div className='card-small'>
          <div className="card-total">
            <div className="chart-title">Total Sales</div>
            <div className="icon-value">
              <span>{formatPeso(paidTotal)}</span>
            </div>
          </div>

          <div className='chart-pending'>
            <div className="chart-title"> Debit Sales</div>
            <div className="icon-value">
              <BsCreditCard className="icon" />
              <span>{debitCount}</span>
            </div>
          </div>

        
         

          <div className='card-items'>
            <div className="chart-title">Items in Shop</div>
            <div className="icon-value">
              <BsBoxSeam className="icon" />
              <span>{inShopCount}</span>
            </div>
          </div>
          
          <div className='card-inshop'>
            <div className="chart-title">Overdue Items</div>
            <div className="icon-value">
              <BsExclamationTriangle className="icon" />
              <span>{overdueCount}</span>
            </div>
          </div>
        </div>

        {/* REVENUE LINE CHART */}
        <Card title="Revenue and Debit sales">
          <div className="chart-controls">
            <button
              className={`chart-toggle-btn ${viewType === 'today' ? 'active' : ''}`}
              onClick={setViewToday}
            >
              Today
            </button>
            <button 
              className={`chart-toggle-btn ${viewType === 'week' ? 'active' : ''}`}
              onClick={setViewWeek}
            >
              Weekly
            </button>
            <button 
              className={`chart-toggle-btn ${viewType === 'month' ? 'active' : ''}`}
              onClick={setViewMonth}
            >
              Monthly
            </button>
            <button
              className={`chart-toggle-btn ${viewType === 'year' ? 'active' : ''}`}
              onClick={setViewYear}
            >
              Yearly
            </button>
            {viewType === 'year' && (
              <input
                type="date"
                className="chart-year-date"
                value={yearFilterDate}
                onChange={onYearFilterDateChange}
                aria-label="Select year date for yearly chart"
              />
            )}
          </div>

          <ResponsiveContainer width="100%" height={220}>
  <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <Legend
      verticalAlign="top"
      align="center"
      iconType="circle"
      iconSize={10}
      wrapperStyle={{ paddingBottom: 8 }}
      formatter={revenueLegendFormatter}
    />
    <XAxis dataKey="name" />
    <YAxis tickFormatter={revenueYAxisTick} />
    <Tooltip formatter={revenueTooltipFormatter} />
    <Line
      type="monotone"
      dataKey="revenue"
      name="Revenue"
      stroke="#185BCB"
      strokeWidth={3}
      dot={{ r: 4 }}
    />
    <Line
      type="monotone"
      dataKey="unpaid"
      name="Debit sales"
      stroke="#E63946"
      strokeWidth={3}
      dot={{ r: 4 }}
    />
  </LineChart>
</ResponsiveContainer>
        </Card>

        <div className="dashboard-refunds-section">
          {!branchListFetchDone && branchesForRefunds.length === 0 ? (
            <p className="dashboard-refunds-empty">Loading branch data…</p>
          ) : branchesForRefunds.length === 0 ? (
            <p className="dashboard-refunds-empty">No branches available for your account.</p>
          ) : (
            branchesForRefunds.map((branch) => {
              const stats = refundStatsByBranch.get(Number(branch.id)) || {
                count: 0,
                total: 0,
                chart: emptyRefundChart,
              };
              return (
                <Card key={`refunds-branch-${branch.id}`} title={`Refunds — ${branch.name || `Branch ${branch.id}`}`}>
                  <div className="refund-branch-kpis">
                    <div className="refund-kpi">
                      <span className="refund-kpi-label">Total refunded (est.)</span>
                      <span className="refund-kpi-value">{formatPeso(stats.total)}</span>
                    </div>
                    <div className="refund-kpi">
                      <span className="refund-kpi-label">Refund cases resolved</span>
                      <span className="refund-kpi-value">{stats.count}</span>
                    </div>
                  </div>
                  <div className="refund-chart-wrap">
                    <RefundLineChart data={stats.chart} />
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* RECENT TRANSACTIONS TABLE */}
        <Card title="Recent Transactions">
          <div className='card-transaction'>
            <table>
              <thead>
                <tr>
                  <th>Receipt ID</th>
                  <th>Customer</th>
                  <th>Amount (₱)</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t) => (
                  <tr key={t.id || t.receipt}>
                    <td>{t.receipt || 'N/A'}</td>
                    <td>{t.customer_name || 'N/A'}</td>
                    <td>{formatPeso(Number(t.amount) || 0)}</td>
                    <td>{new Date(t.created_at || Date.now()).toLocaleDateString()}</td>
                    <td>{(t.payment_status || '').toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
