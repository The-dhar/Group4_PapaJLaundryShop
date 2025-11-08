import React, { useState } from 'react';
import '../styles/signUp.css';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <div className="signup-container">
      <div className="signup-left">
        <div className="signup-form-wrapper">
          <h2 className="signup-title">Create a Branch Account</h2>
          <form onSubmit={handleSubmit} className="signup-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="Enter your Name..."
                value={formData.name}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                 placeholder="Enter your Email..."
                value={formData.email}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Enter your Password..."
                value={formData.password}
                onChange={handleChange}
                className="form-input"
              />
            </div>

            <button onClick={handleSubmit} className="login-button">
              Submit
            </button>

            <p className="signup-text">
            Have a Account? <a href="/" className="login-link">Log In</a>
            </p>
          </form>
        </div>
      </div>

      <div className="signup-right">
        <img src="/pictures/Papa(1).png" alt="Signup" />
    
      </div>
    </div>
  );
}