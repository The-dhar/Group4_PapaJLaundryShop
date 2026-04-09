import React, { useEffect, useMemo, useState } from 'react';
import { BsBoxSeam, BsExclamationTriangle, BsCreditCard } from 'react-icons/bs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Card from '../components/card';
import DashboardLayout from '../components/dashboardlayout';
import { useTransactions } from '../context/transactionsContext';
import '../styles/dashboardstyle.css';

const POLL_MS = 45_000;

const Dashboard = () => {
  const { transactions, fetchTransactions } = useTransactions();
  const [viewType, setViewType] = useState('week');

  useEffect(() => {
    fetchTransactions();
    const intervalId = setInterval(() => fetchTransactions(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchTransactions();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchTransactions]);

  // Helper to format amount with peso sign
  const formatPeso = (value) => `₱${value.toLocaleString()}`;

  const activeTransactions = useMemo(
    () => transactions.filter((t) => !t.archived),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
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

    return activeTransactions.filter((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      return dt >= start && dt <= end;
    });
  }, [activeTransactions, viewType]);

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
