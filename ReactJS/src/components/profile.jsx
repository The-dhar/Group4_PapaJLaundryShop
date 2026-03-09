import React from 'react';
import '../componentstyle/profilestyle.css';

const Profile = () => {
  return (
    <div className="profile">
      <div className="profile-header">
        <h2>User Profile</h2>
      </div>
      <div className="profile-content">
        <div className="profile-avatar-large"></div>
        <div className="profile-info">
          <div className="profile-item">
            <label>Full Name:</label>
            <span>Account Name</span>
          </div>
          <div className="profile-item">
            <label>Role:</label>
            <span>Admin</span>
          </div>
          <div className="profile-item">
            <label>Email:</label>
            <span>admin@papajs.com</span>
          </div>
          <div className="profile-item">
            <label>Phone:</label>
            <span>+63 123 456 7890</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
