import React, { useState } from 'react';
import { BsClockHistory, BsBoxSeam, BsExclamationTriangle } from 'react-icons/bs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Card from '../components/card';
import DashboardLayout from '../components/dashboardlayout';
import '../styles/dashboardstyle.css';

const Dashboard = () => {
  const [viewType, setViewType] = useState('week');

  // WEEKLY DATA
  const weekData = [
    { name: 'Monday', revenue: 4000 },
    { name: 'Tuesday', revenue: 3000 },
    { name: 'Wednesday', revenue: 2000 },
    { name: 'Thursday', revenue: 2780 },
    { name: 'Friday', revenue: 1890 },
    { name: 'Saturday', revenue: 2390 },
    { name: 'Sunday', revenue: 3090 },
  ];

  // MONTHLY DATA (Week 1–4)
  const monthData = [
    { name: 'Week 1', revenue: 12000 },
    { name: 'Week 2', revenue: 15000 },
    { name: 'Week 3', revenue: 11000 },
    { name: 'Week 4', revenue: 18000 },
  ];

  const chartData = viewType === 'week' ? weekData : monthData;

  const transactions = [
    { id: 'RCPT-00123', customer: 'Juan Dela Cruz', amount: 1250, date: 'Oct 20, 2025', status: 'Paid' },
    { id: 'RCPT-00124', customer: 'Maria Santos', amount: 870, date: 'Oct 21, 2025', status: 'Unpaid' },
    { id: 'RCPT-00125', customer: 'Jose Ramirez', amount: 1050, date: 'Oct 22, 2025', status: 'Paid' },
  ];

  // Helper to format amount with peso sign
  const formatPeso = (value) => `₱${value.toLocaleString()}`;

  return (
    <DashboardLayout>
      <div className='main-cards'>

        {/* SMALL CARDS */}
        <div className='card-small'>
          <div className="card-total">
            <div className="chart-title">Total Orders</div>
            <div className="icon-value">
              <span>{formatPeso(transactions.reduce((sum, t) => sum + t.amount, 0))}</span>
            </div>
          </div>

          <div className='chart-pending'>
            <div className="chart-title">Pending Sales</div>
            <div className="icon-value">
              <BsClockHistory className="icon" />
              <span>{transactions.filter(t => t.status === 'Unpaid').length}</span>
            </div>
          </div>

          <div className='card-items'>
            <div className="chart-title">Items in Shop</div>
            <div className="icon-value">
              <BsBoxSeam className="icon" />
              <span>5</span>
            </div>
          </div>

          <div className='card-inshop'>
            <div className="chart-title">Overdue Items</div>
            <div className="icon-value">
              <BsExclamationTriangle className="icon" />
              <span>2</span>
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
              <Line 
                type="monotone"
                dataKey="revenue"
                stroke="#185BCB"
                strokeWidth={3}
                dot={{ r: 5 }}
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
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.customer}</td>
                    <td>{formatPeso(t.amount)}</td>
                    <td>{t.date}</td>
                    <td>{t.status}</td>
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
