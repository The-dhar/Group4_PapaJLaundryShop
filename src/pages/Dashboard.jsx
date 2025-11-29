import React from 'react';
import {  BsClockHistory, BsBoxSeam, BsExclamationTriangle } from 'react-icons/bs';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; 
import { useState } from 'react';
import Card from '../components/card';
import DashboardLayout from '../components/dashboardlayout';
import '../styles/dashboardstyle.css';
const Dashboard = () => {
  const [viewType, setViewType] = useState('week'); 

  const weekData = [
    { name: 'Monday', uv: 4000, pv: 2400, amt: 2400 },
    { name: 'Tuesday', uv: 3000, pv: 1398, amt: 2210 },
    { name: 'Wednesday', uv: 2000, pv: 9800, amt: 2290 },
    { name: 'Thursday', uv: 2780, pv: 3908, amt: 2000 },
    { name: 'Friday', uv: 1890, pv: 4800, amt: 2181 },
    { name: 'Saturday', uv: 2390, pv: 3800, amt: 2500 },
    { name: 'Sunday', uv: 3090, pv: 3800, amt: 3500 },
  ];
  const monthData = [
    { name: 'Jan', uv: 4000, pv: 2400, amt: 2400 },
    { name: 'Feb', uv: 3000, pv: 1398, amt: 2210 },
    { name: 'Mar', uv: 2000, pv: 9800, amt: 2290 },
    { name: 'Apr', uv: 2780, pv: 3908, amt: 2000 },
    { name: 'May', uv: 1890, pv: 4800, amt: 2181 },
    { name: 'Jun', uv: 2390, pv: 3800, amt: 2500 },
    { name: 'Jul', uv: 3490, pv: 4300, amt: 2100 },
    { name: 'Aug', uv: 4200, pv: 5200, amt: 2300 },
    { name: 'Sep', uv: 3800, pv: 4100, amt: 2200 },
    { name: 'Oct', uv: 4500, pv: 4800, amt: 2400 },
    { name: 'Nov', uv: 5000, pv: 5500, amt: 2600 },
    { name: 'Dec', uv: 5500, pv: 6000, amt: 2800 },
  ];

  const chartData = viewType === 'week' ? weekData : monthData;
  
  const transactions = [
    { id: 'RCPT-00123', customer: 'Juan Dela Cruz', amount: '1,250.00', date: 'Oct 20, 2025', status: 'Paid' },
    { id: 'RCPT-00124', customer: 'Maria Santos', amount: '870.00', date: 'Oct 21, 2025', status: 'Unpaid' },
    { id: 'RCPT-00125', customer: 'Jose Ramirez', amount: '1,050.00', date: 'Oct 22, 2025', status: 'Paid' },
  ];
  
    return (
     <DashboardLayout>
      <div className='main-cards'>
        <div className='card-small'>
           <div className="card-total">
          <div className="chart-title">Total Orders</div>
           <div className="icon-value">
            <span>₱5,010</span>
            </div>
            </div>

           <div className='chart-pending'>
              <div class="chart-title">Pending Sales</div>
               <div className="icon-value">
              <BsClockHistory className="icon" />
            <span>10</span>
            </div>
            </div>
           

            <div className='card-items'>
                 <div class="chart-title">Items in Shop </div>
                  <div className="icon-value">
            <BsBoxSeam className="icon" />
            <span>5</span>
            </div>
            </div>
               
            <div className='card-inshop'>
                <div class="chart-title">Overdue Items </div>
                <div className="icon-value">
            < BsExclamationTriangle className="icon" />
            <span>2</span>
            </div>
            </div>
        </div>

          <Card title="Revenue">
          <div className="chart-controls">
            <button 
              className={`chart-toggle-btn ${viewType === 'week' ? 'active' : ''}`}
              onClick={() => setViewType('week')}>
              Week
            </button>
            <button 
              className={`chart-toggle-btn ${viewType === 'month' ? 'active' : ''}`}
              onClick={() => setViewType('month')}>
              Month
            </button>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid/>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="uv" stroke="#8884d8" fill="#185BCB" />
            </AreaChart>
          </ResponsiveContainer>
          </Card>


         <Card title="Recent Transactions">
          <div className='card-transaction'>
          <div class="chart-title"> </div>
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
              {transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.id}</td>
                  <td>{transaction.customer}</td>
                  <td>{transaction.amount}</td>
                  <td>{transaction.date}</td>
                  <td>{transaction.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
            </Card>  
        </div>
    </DashboardLayout>
    );
}



export default Dashboard;