import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/loginstyle.css';
import { API_URL } from "../config/api";
import Swal from 'sweetalert2';
import { useTransactions } from '../context/transactionsContext';

export default function LoginPage() {

  const navigate = useNavigate();
  const { fetchTransactions } = useTransactions();

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
        const msg = data.message || 'Invalid credentials.';
        const noBranch =
          response.status === 403 &&
          typeof msg === 'string' &&
          (msg.toLowerCase().includes('not assigned') ||
            msg.toLowerCase().includes('assign you'));
        await Swal.fire({
          title: noBranch ? 'No branch assigned' : 'Login failed',
          html: noBranch
            ? `<p style="text-align:left;margin:0;">${msg}</p>`
            : undefined,
          text: noBranch ? undefined : msg,
          icon: noBranch ? 'info' : 'error',
          width: noBranch ? 440 : 380
        });
        return;
      }

      const webAllowedRoles = ['owner', 'clerk', 'staff'];
      const role = data.user?.role;
      if (!webAllowedRoles.includes(role)) {
        const text =
          role === 'manager'
            ? 'Branch manager logins are no longer used. Sign in with a clerk/staff account or the shop owner account.'
            : 'This account cannot use the web app.';
        await Swal.fire({
          title: 'Access denied',
          text,
          icon: 'warning',
          width: 400
        });
        return;
      }

      const isBranchEmployee = role === 'clerk' || role === 'staff';
      const branchId = data.user?.branch_id;
      const hasBranch =
        branchId !== null && branchId !== undefined && branchId !== '';
      if (isBranchEmployee && !hasBranch) {
        await Swal.fire({
          title: 'No branch assigned',
          html:
            '<p style="text-align:left;margin:0;">Your account is not assigned to any branch. Ask the shop owner to assign you to a branch (Employees / staff settings), then try signing in again.</p>',
          icon: 'info',
          width: 440,
          confirmButtonText: 'OK'
        });
        return;
      }

      localStorage.setItem("token", data.token);

      localStorage.setItem("user", JSON.stringify(data.user));

      await fetchTransactions();

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

    <div className="login-scene">
      <div className="login-bubbles" aria-hidden="true">
        <span className="bubble bubble-1" />
        <span className="bubble bubble-2" />
        <span className="bubble bubble-3" />
        <span className="bubble bubble-4" />
        <span className="bubble bubble-5" />
        <span className="bubble bubble-6" />
      </div>

      <div className="login-panel">
        <div className="login-brand-stack">
          <div className="login-logo-wrap">
            <img src="/pictures/Papa(1).png" alt="Papa J logo" className="login-logo" />
          </div>
          <h1 className="login-brand-title">PAPA J&apos;s</h1>
          <p className="login-brand-subtitle">Laundry Shop</p>
        </div>

        <div className="login-card">
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-subtitle">Please sign in to continue</p>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-shell">
                <input
                  id="email"
                  type="text"
                  name="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-shell">
                <input
                  id="password"
                  type="password"
                  name="password"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input"
                  autoComplete="current-password"
                />
              </div>
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

    </div>

  );

}