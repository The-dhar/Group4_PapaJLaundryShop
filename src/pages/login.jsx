import React, { useState } from 'react';
import { useNavigate} from 'react-router-dom';
import '../styles/loginstyle.css';

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const navigate = useNavigate(); 
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
    const handleLogin = (e) => {
    e.preventDefault(); 
    navigate('/Dashboard'); 
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-form-wrapper">
          <h2 className="login-title">Welcome Back!</h2>
          <form onSubmit={handleSubmit} className="login-form">
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

             <form onSubmit={handleLogin}>
            <button onClick={handleLogin} className="login-button">
              Log In
            </button>
           </form>
            <p className="login-text">
           Dont Have an Branch Account? <a href="signUp" className="signup-link">Create here</a>
            </p>
          </form>
        </div>
      </div>

      <div className="login-right">
        <img src="/pictures/Papa(1).png" alt="Signup" />
    
      </div>
    </div>
  );
}
