import React from "react";
import "../componentstyle/hederstyle.css";
import { BsList } from "react-icons/bs";

const Header = ({ toggleSidebar }) => {
  return (
    <div className="header">

      {/* Burger button */}
      <button className="burger-btn" onClick={toggleSidebar}>
        <BsList size={26} />
      </button>

    

      <div className="header-right">
        <div className="account-info">
          <div className="account-name">Branch Name</div>
          <div className="account-role">Admin</div>
        </div>
      </div>
    </div>
  );
};

export default Header;
