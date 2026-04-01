import React, { useMemo, useState } from 'react';
import { BsBoxSeam, BsExclamationTriangle, BsCreditCard } from 'react-icons/bs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/card';
import DashboardLayout from '../components/dashboardlayout';
import { useTransactions } from '../context/transactionsContext';
import '../styles/dashboardstyle.css';

const Dashboard = () => {
  const { transactions } = useTransactions();
  const [viewType, setViewType] = useState('week');

  // Helper to format amount with peso sign
  const formatPeso = (value) => `₱${value.toLocaleString()}`;

  const activeTransactions = useMemo(
    () => transactions.filter((t) => !t.archived),
    [transactions]
  );

  const paidTotal = useMemo(
    () =>
      activeTransactions
        .filter((t) => t.payment_status === 'paid')
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0),
    [activeTransactions]
  );

  const debitCount = useMemo(
    () => activeTransactions.filter((t) => t.payment_status === 'unpaid').length,
    [activeTransactions]
  );

  const inShopCount = useMemo(
    () => activeTransactions.filter((t) => t.inventory_status === 'in_shop').length,
    [activeTransactions]
  );

  const overdueCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return activeTransactions.filter((t) => {
      if (t.inventory_status !== 'in_shop' || !t.due_date) return false;
      const due = new Date(t.due_date);
      due.setHours(0, 0, 0, 0);
      return due < today;
    }).length;
  }, [activeTransactions]);

  const weekData = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const rows = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      return {
        name: dayNames[d.getDay()],
        key: d.toDateString(),
        revenue: 0,
        unpaid: 0,
      };
    });

    activeTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      const key = dt.toDateString();
      const row = rows.find((r) => r.key === key);
      if (!row) return;
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') row.revenue += amount;
      else row.unpaid += amount;
    });

    return rows.map(({ name, revenue, unpaid }) => ({ name, revenue, unpaid }));
  }, [activeTransactions]);

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

    activeTransactions.forEach((t) => {
      const dt = new Date(t.created_at || t.updated_at || Date.now());
      if (dt.getFullYear() !== currentYear || dt.getMonth() !== currentMonth) return;
      const day = dt.getDate();
      const bucketIdx = Math.min(3, Math.floor((day - 1) / 7));
      const amount = Number(t.amount) || 0;
      if (t.payment_status === 'paid') weekBuckets[bucketIdx].revenue += amount;
      else weekBuckets[bucketIdx].unpaid += amount;
    });

    return weekBuckets;
  }, [activeTransactions]);

  const chartData = viewType === 'week' ? weekData : monthData;

  const recentTransactions = useMemo(
    () =>
      [...activeTransactions]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 8),
    [activeTransactions]
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
        <Card title="Revenue">
          <div className="chart-controls">
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
          </div>

          <ResponsiveContainer width="100%" height={200}>
  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis tickFormatter={(value) => `₱${value}`} />
    <Tooltip formatter={(value) => formatPeso(value)} />
    
    {/* Revenue Line (Blue) */}
    <Line 
      type="monotone"
      dataKey="revenue"
      name="Revenue"
      stroke="#185BCB"
      strokeWidth={3}
      dot={{ r: 4 }}
    />

    {/* Unpaid/Debit Line (Red) */}
    <Line 
      type="monotone"
      dataKey="unpaid"
      name="Debit Sales"
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
