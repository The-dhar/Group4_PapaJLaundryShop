import React from 'react';
import { NavLink } from 'react-router-dom'; // Changed from Link
import { BsGrid1X2Fill, BsCart3, BsBoxSeam, BsReceiptCutoff, BsDoorOpen, BsCashStack, BsLightningCharge, BsArchive } from 'react-icons/bs';
import '../componentstyle/sidebarstyle.css';

const Sidebar = ({ sidebarOpen }) => {
    return (
        <aside id='sidebar' className={sidebarOpen ? "open" : "closed"}>
            <div className='sidebar-title'>
                <div className='sidebar-brand'>Papa J's</div>
            </div>

            <ul className='sidebar-list'>
                <li className='sidebar-list-items'>
                    <NavLink to="/dashboard">
                        <BsGrid1X2Fill className='icon'/> Dashboard
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    <NavLink to="/POS">
                        <BsCart3 className='icon'/> POS
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    <NavLink to="/Inventory">
                        <BsCashStack className='icon'/> Transaction Log
                    </NavLink>
                </li>
                
                <li className='sidebar-list-items'>
                    <NavLink to="/Express">
                        <BsLightningCharge className='icon'/> Rush Orders
                    </NavLink>
                </li>
                
                <li className='sidebar-list-items'>
                    <NavLink to="/Unclaimed">
                        <BsBoxSeam className='icon'/> Unclaimed Items
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    <NavLink to="/Receipt">
                        <BsReceiptCutoff className='icon'/> Receipt Management
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    <NavLink to="/Archive">
                        <BsArchive className='icon'/> Archive
                    </NavLink>
                </li>

                <li className='sidebar-list-items'>
                    {/* Logout usually stays as an anchor or button since it triggers an action */}
                    <a href="/logout">
                        <BsDoorOpen className='icon'/> Log Out
                    </a>
                </li>
            </ul>
        </aside>
    );
};

export default Sidebar;

