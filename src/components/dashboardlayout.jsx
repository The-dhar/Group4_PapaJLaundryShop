import React from 'react';
import Sidebar from './sidebar';
import Header from './header';
import '../componentstyle/dashboardlayoutstyle.css';

const DashboardLayout = ({ children }) => {
  return (
    <div className="dashboard-layout">
      <Sidebar />

      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;