import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BsGrid1X2Fill, BsCart3, BsBoxSeam, BsReceiptCutoff, BsDoorOpen, BsCashStack, BsLightningCharge, BsArchive, BsList } from 'react-icons/bs';
import '../componentstyle/sidebarstyle.css';

const Sidebar = ({ sidebarOpen, toggleSidebar }) => {
    const navigate = useNavigate();

    const handleLogout = (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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
                    <div className="account-name">Branch Name</div>
                    <div className="account-role">Admin</div>
                </div>
                <hr className="sidebar-separator" />
                <a href="/logout" onClick={handleLogout} className="sidebar-logout-link">
                    <BsDoorOpen className='icon'/><span>Log Out</span>
                </a>
            </div>
        </aside>
    );
};

export default Sidebar;
