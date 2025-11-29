import React from 'react';
import { Link } from 'react-router-dom';
import { BsGrid1X2Fill, BsCart3, BsBoxSeam, BsReceiptCutoff, BsDoorOpen,BsCashStack, Image  } from 'react-icons/bs';
import '../componentstyle/sidebarstyle.css';

const Sidebar = () => {
    return (
        <aside id='sidebar'>
            <div className='sidebar-title'>
                <div className='sidebar-brand'>
                    Papa J's
                </div>
                           
            </div>
            <ul className='sidebar-list'>
                <li className='sidebar-list-items'>
                    <Link to ="/dashboard">
                        <BsGrid1X2Fill className='icon'/>
                        Dashboard  
                    </Link>
                </li>
                <li className='sidebar-list-items'>
                    <Link to ="/POS">
                        <BsCart3 className='icon'/>
                        POS 
                    </Link>
                </li>
                <li className='sidebar-list-items'>
                    <Link to="/Inventory">
                        <BsCashStack  className='icon'/>
                        Transaction Management
                    </Link>
                </li>
                 <li className='sidebar-list-items'>
                    <a href="/Unclaimed">
                        <BsBoxSeam className='icon'/>
                        Unclaimed Items
                    </a>
                </li>
                <li className='sidebar-list-items'>
                    <a href="/Receipt">
                        <BsReceiptCutoff className='icon'/>
                        Receipt Management
                    </a>
                </li>
                <li className='sidebar-list-items'>
                    <a href="/logout">
                        <BsDoorOpen className='icon'/>
                        Log Out
                    </a>
                </li>
            </ul> 
        </aside>
    );
}

export default Sidebar;
