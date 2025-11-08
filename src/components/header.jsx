import React, { useState } from "react";
import "../componentstyle/hederstyle.css";
import { BsBell } from "react-icons/bs";

const Header = () => {
  const [open, setOpen] = useState(false);

  const notifications = [
    { id: "RCPT-01933", name: "Johnny", message: "laundry has not been claimed for 3 days" },
    { id: "RCPT-01334", name: "Ana Marie", message: "laundry has not been claimed for 3 days" },
    { id: "RCPT-13843", name: "Rowan Ismael", message: "laundry has not been claimed for 3 days" },
    { id: "RCPT-01933", name: "Johnny", message: "laundry has not been claimed for 3 days" },
  ];

  return (
    <div className="header">
      <div className="header-left">
        <h1 className="dashboard-title">Welcome Back Admin!</h1>
      </div>

      {/* Right side — bell + account info */}
      <div className="header-right">
        <div className="bell">
          <button onClick={() => setOpen(!open)} className="bell-button">
            <BsBell size={22} />
            <span className="notification-badge">{notifications.length}</span>
          </button>

          {open && (
            <div className="notification-dropdown">
              <h3 className="dropdown-header">Inbox</h3>
              <div className="notification-list">
                {notifications.map((n, index) => (
                  <div key={index} className="notification-item">
                    <p>
                      <span className="notification-id">{n.id}</span> ({n.name}) {n.message}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Account Info beside the bell */}
        <div className="account-info">
          <div className="account-name">Branch Name</div>
          <div className="account-role">Admin</div>
        </div>
      </div>
    </div>
  );
};

export default Header;
