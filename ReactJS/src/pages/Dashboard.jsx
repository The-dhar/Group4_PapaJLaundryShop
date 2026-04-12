import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BsBoxSeam, BsExclamationTriangle, BsCreditCard } from 'react-icons/bs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '../components/card';
import DashboardLayout from '../components/dashboardlayout';
import { useTransactions } from '../context/transactionsContext';
import { API_URL } from '../config/api';
import '../styles/dashboardstyle.css';

const POLL_MS = 45_000;

/** Same calendar windows as revenue charts (transaction dates). Refunds use `resolved_at` with the same windows. */
function getViewDateBounds(viewType) {
  const now = new Date();
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

const Dashboard = () => {
  const { transactions, fetchTransactions } = useTransactions();
  const [viewType, setViewType] = useState('week');
  const [branches, setBranches] = useState([]);
  const [issueReports, setIssueReports] = useState([]);

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
          setBranches(Array.isArray(data) ? data : []);
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

  // Helper to format amount with peso sign
  const formatPeso = (value) => `₱${value.toLocaleString()}`;

  const activeTransactions = useMemo(
    () => transactions.filter((t) => !t.archived),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const { start, end } = getViewDateBounds(viewType);
    return activeTransactions.filter((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      return dt >= start && dt <= end;
    });
  }, [activeTransactions, viewType]);

  const refundsInView = useMemo(() => {
    const { start, end } = getViewDateBounds(viewType);
    return issueReports.filter((r) => {
      if (String(r.status || '').toLowerCase() !== 'resolved') return false;
      if (String(r.resolution_type || '').toLowerCase() !== 'refund') return false;
      const dt = new Date(r.resolved_at || r.updated_at || 0);
      return dt >= start && dt <= end;
    });
  }, [issueReports, viewType]);

  const sortedBranches = useMemo(
    () => [...branches].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [branches]
  );

  const refundStatsByBranch = useMemo(() => {
    const map = new Map();
    sortedBranches.forEach((b) => {
      const id = Number(b.id);
      const list = refundsInView.filter((r) => Number(r.branch_id) === id);
      const total = list.reduce((sum, r) => sum + refundAmountFromReport(r), 0);
      map.set(id, { count: list.length, total, chart: buildRefundSeries(viewType, list) });
    });
    return map;
  }, [sortedBranches, refundsInView, viewType]);

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

  const chartData =
    viewType === 'today'
      ? todayData
      : viewType === 'week'
        ? weekData
        : viewType === 'month'
          ? monthData
          : yearData;

  const recentTransactions = useMemo(
    () =>
      [...filteredTransactions]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 8),
    [filteredTransactions]
  );

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
              onClick={() => setViewType('today')}
            >
              Today
            </button>
            <button 
              className={`chart-toggle-btn ${viewType === 'week' ? 'active' : ''}`}
              onClick={() => setViewType('week')}
            >
              Weekly
            </button>
            <button 
              className={`chart-toggle-btn ${viewType === 'month' ? 'active' : ''}`}
              onClick={() => setViewType('month')}
            >
              Monthly
            </button>
            <button
              className={`chart-toggle-btn ${viewType === 'year' ? 'active' : ''}`}
              onClick={() => setViewType('year')}
            >
              Yearly
            </button>
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
      formatter={(value) => <span style={{ color: '#334155', fontSize: 13 }}>{value}</span>}
    />
    <XAxis dataKey="name" />
    <YAxis tickFormatter={(value) => `₱${value}`} />
    <Tooltip formatter={(value) => formatPeso(value)} />
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
          <h2 className="dashboard-refunds-heading">Refunds by branch</h2>
          <p className="dashboard-refunds-sub">
            Resolved issue cases with refund resolution. Amounts use the linked receipt total. Use the same period as the revenue chart above.
          </p>
          {sortedBranches.length === 0 ? (
            <p className="dashboard-refunds-empty">No branches loaded.</p>
          ) : (
            sortedBranches.map((branch) => {
              const stats = refundStatsByBranch.get(Number(branch.id)) || {
                count: 0,
                total: 0,
                chart: buildRefundSeries(viewType, []),
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
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.chart} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <Legend
                        verticalAlign="top"
                        align="center"
                        iconType="circle"
                        iconSize={10}
                        wrapperStyle={{ paddingBottom: 8 }}
                        formatter={(value) => <span style={{ color: '#334155', fontSize: 13 }}>{value}</span>}
                      />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `₱${value}`} />
                      <Tooltip formatter={(value) => formatPeso(value)} />
                      <Line
                        type="monotone"
                        dataKey="refunds"
                        name="Refunds"
                        stroke="#0d9488"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
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
