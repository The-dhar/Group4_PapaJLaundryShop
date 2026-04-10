import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BsGrid1X2Fill, BsCart3, BsBoxSeam, BsReceiptCutoff, BsDoorOpen, BsCashStack, BsLightningCharge, BsArchive, BsList } from 'react-icons/bs';
import '../componentstyle/sidebarstyle.css';
import { API_URL } from '../config/api';

function getUserFromStorage() {
    try {
        const raw = localStorage.getItem('user');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** First + middle initial + last from API user; falls back to `name` (not email). */
function getUserDisplayName(user) {
    if (!user || typeof user !== 'object') return '';
    const first = String(user.first_name ?? '').trim();
    const middle = String(user.middle_initial ?? '').trim();
    const last = String(user.last_name ?? '').trim();
    const parts = [first, middle, last].filter(Boolean);
    if (parts.length > 0) {
        return parts.join(' ');
    }
    const full = String(user.name ?? '').trim();
    if (full) return full;
    return '';
}

const Sidebar = ({ sidebarOpen, toggleSidebar }) => {
    const navigate = useNavigate();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const user = getUserFromStorage();
    const branchDisplayName =
        user?.branch?.name?.trim() ||
        user?.name?.trim() ||
        'Branch';
    const accountDisplayName = getUserDisplayName(user) || '—';

    const confirmLogout = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                await fetch(`${API_URL}/logout`, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                });
            } catch {
                /* still clear local session */
            }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setShowLogoutConfirm(false);
        navigate('/');
    };

    return (
        <aside id='sidebar' className={sidebarOpen ? "open" : "closed"}>
            <div className='sidebar-title'>
                <div className='sidebar-brand'>Papa J's</div>
                <button type="button" className="sidebar-toggle-btn" onClick={toggleSidebar} aria-label="Toggle sidebar">
                    <BsList />
                </button>
            </div>

            <ul className='sidebar-list'>
                <li className='sidebar-list-items'>
                    <NavLink to="/dashboard">
                        <BsGrid1X2Fill className='icon'/><span>Dashboard</span>
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    <NavLink to="/POS">
                        <BsCart3 className='icon'/><span>POS</span>
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    <NavLink to="/Inventory">
                        <BsCashStack className='icon'/><span>Transaction Log</span>
                    </NavLink>
                </li>
                
                <li className='sidebar-list-items'>
                    <NavLink to="/Express">
                        <BsLightningCharge className='icon'/><span>Rush Orders</span>
                    </NavLink>
                </li>
                
                <li className='sidebar-list-items'>
                    <NavLink to="/Unclaimed">
                        <BsBoxSeam className='icon'/><span>Unclaimed Items</span>
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    <NavLink to="/Receipt">
                        <BsReceiptCutoff className='icon'/><span>Receipt Management</span>
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    <NavLink to="/Archive">
                        <BsArchive className='icon'/><span>Archive</span>
                    </NavLink>
                </li>
            </ul>

            <div className="sidebar-footer">
                <div className="sidebar-account">
                    <div className="account-name">{branchDisplayName}</div>
                    <div className="account-role">{accountDisplayName}</div>
                </div>
                <hr className="sidebar-separator" />
                <a
                    href="/logout"
                    onClick={(e) => {
                        e.preventDefault();
                        setShowLogoutConfirm(true);
                    }}
                    className="sidebar-logout-link"
                >
                    <BsDoorOpen className='icon'/><span>Log Out</span>
                </a>
            </div>

            {showLogoutConfirm && (
                <div className="logout-confirm-overlay" onClick={() => setShowLogoutConfirm(false)}>
                    <div className="logout-confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Confirm Logout</h3>
                        <p>Are you sure you want to log out?</p>
                        <div className="logout-confirm-actions">
                            <button
                                type="button"
                                className="logout-confirm-cancel"
                                onClick={() => setShowLogoutConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="logout-confirm-ok"
                                onClick={confirmLogout}
                            >
                                Log Out
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;
