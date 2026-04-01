import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/loginstyle.css';
import { API_URL } from "../config/api";
import Swal from 'sweetalert2';

export default function LoginPage() {

  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });

  };

  const handleLogin = async (e) => {

    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {

      const response = await fetch(`${API_URL}/login`, {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },

        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })

      });

      const data = await response.json();

      if (!response.ok) {
        await Swal.fire({
          title: 'Login failed',
          text: data.message || 'Invalid credentials.',
          icon: 'error',
          width: 380
        });
        return;
      }

      if (data.user.role !== "manager") {
        await Swal.fire({
          title: 'Access denied',
          text: 'Only branch accounts can login here.',
          icon: 'warning',
          width: 400
        });
        return;
      }

      localStorage.setItem("token", data.token);

      localStorage.setItem("user", JSON.stringify(data.user));

      navigate('/dashboard');

    } catch (error) {

      console.error(error);
      await Swal.fire({
        title: 'Server error',
        text: 'Cannot connect to server. Please try again.',
        icon: 'error',
        width: 400
      });

    } finally {
      setIsLoading(false);
    }

  };

  return (

    <div className="login-container">

      <div className="login-left">

        <div className="login-form-wrapper">

          <h2 className="login-title">Welcome Back!</h2>

          <form onSubmit={handleLogin} className="login-form">

            <div className="form-group">

              <label>Email</label>

              <input
                type="text"
                name="email"
                placeholder="Enter your Email..."
                value={formData.email}
                onChange={handleChange}
                className="form-input"
              />

            </div>

            <div className="form-group">

              <label>Password</label>

              <input
                type="password"
                name="password"
                placeholder="Enter your Password..."
                value={formData.password}
                onChange={handleChange}
                className="form-input"
              />

            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <span className="login-button-content">
                  <span className="login-spinner" />
                  Logging in...
                </span>
              ) : (
                "Log In"
              )}
            </button>

          </form>

        </div>

      </div>

      <div className="login-right">

        <img src="/pictures/Papa(1).png" alt="Login" />

      </div>

    </div>

  );

}