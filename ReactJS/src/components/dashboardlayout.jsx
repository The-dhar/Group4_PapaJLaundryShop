import React, { useEffect, useState } from 'react';
import { BsList } from 'react-icons/bs';
import Sidebar from './sidebar';
import '../componentstyle/dashboardlayoutstyle.css';

const MOBILE_BREAKPOINT = 768;

const DashboardLayout = ({ children }) => {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false
  );

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const sidebarOpen = isMobile ? mobileSidebarOpen : desktopSidebarOpen;

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileSidebarOpen((prev) => !prev);
      return;
    }

    setDesktopSidebarOpen((prev) => !prev);
  };

  const closeSidebarOnMobile = () => {
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  return (
    <div
      className={`dashboard-layout ${isMobile ? 'is-mobile' : 'is-desktop'} ${
        sidebarOpen ? 'sidebar-open' : 'sidebar-closed'
      }`}
    >
      {isMobile && !sidebarOpen && (
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
          onClick={toggleSidebar}
        >
          <BsList />
        </button>
      )}

      <Sidebar
        sidebarOpen={sidebarOpen}
        toggleSidebar={toggleSidebar}
        onNavigate={closeSidebarOnMobile}
      />

      {isMobile && sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation menu"
          onClick={closeSidebarOnMobile}
        />
      )}

      <div className="main-wrapper">
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
