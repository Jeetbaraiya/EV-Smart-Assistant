import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

// EV Driver icon — electric car
const IconEVCar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2v-4l2-5h14l2 5v4a2 2 0 0 1-2 2h-2"/>
    <circle cx="7" cy="17" r="2"/>
    <circle cx="17" cy="17" r="2"/>
    <path d="M9 9h1l1-2h2l1 2h1"/>
    <line x1="12" y1="5" x2="12" y2="9"/>
  </svg>
);

// Charging Station icon — for Owner
const IconChargingStation = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="13" height="20" rx="2"/>
    <path d="M15 7h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/>
    <line x1="7" y1="22" x2="10" y2="22"/>
    <line x1="8.5" y1="16" x2="8.5" y2="22"/>
    <path d="M6 8h5l-2 4h4l-5 6v-4H6l2-4H6V8z"/>
  </svg>
);

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Password strength validation
    const password = formData.password;
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!/[a-z]/.test(password)) {
      setError('Password must contain at least one lowercase letter');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      setError('Password must contain at least one symbol (e.g. @, #, $, etc.)');
      return;
    }

    setLoading(true);
    const result = await register(formData.username, formData.email, formData.password, formData.role);
    if (result.success) {
      // Redirect based on role
      if (result.user?.role === 'owner') {
        navigate('/owner/dashboard');
      } else {
        navigate('/');
      }
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="auth-page">
      {/* ── Left: Image + overlay ── */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-left-logo">
            <div className="auth-left-logo-icon">⚡</div>
            <span className="auth-left-logo-text">EV Smart Assistant</span>
          </div>
          <h1 className="auth-left-headline">
            Join Our<br />
            <span>Community.</span>
          </h1>
          <p className="auth-left-subtitle">
            Create your account to access all EV route planning services,
            charging stations, and smart range predictions across India.
          </p>
        </div>
      </div>

      {/* ── Right: Form ── */}
      <div className="auth-right">
        <div className="auth-form-box">
          <div className="auth-form-logo">
            <div className="auth-form-logo-icon">⚡</div>
            <span className="auth-form-logo-text">EV Smart Assistant</span>
          </div>

          <div className="auth-form-header">
            <h2>Create Account</h2>
            <p>Get started with your EV Smart access.</p>
          </div>

          {error && (
            <div className="auth-error">⚠️ {error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="reg-username">Full Name / Username</label>
              <div className="auth-input-wrap">
                <input
                  id="reg-username"
                  className="auth-input"
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="reg-email">Email Address</label>
              <div className="auth-input-wrap">
                <input
                  id="reg-email"
                  className="auth-input"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
            </div>

          

            <div className="auth-field-row">
              <div className="auth-field">
                <label htmlFor="reg-password">Password</label>
                <div className="auth-input-wrap">
                  <input
                    id="reg-password"
                    className="auth-input"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex="-1" aria-label="Toggle password visibility">
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="reg-confirm">Confirm Password</label>
                <div className="auth-input-wrap">
                  <input
                    id="reg-confirm"
                    className="auth-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button type="button" className="auth-eye-btn" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex="-1" aria-label="Toggle confirm password visibility">
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>
            </div>

              <div className="auth-field">
              <label>Account Type</label>
              <div className="role-cards">
                <label className={`role-card ${formData.role === 'user' ? 'active' : ''}`} onClick={() => handleRoleSelect('user')}>
                  <input type="radio" name="role" value="user" readOnly checked={formData.role === 'user'} />
                  <span className="role-card-icon">🚗</span>
                  <span className="role-card-title">EV Driver</span>
                  <span className="role-card-desc">Find stations &amp; plan routes</span>
                </label>
                <label className={`role-card ${formData.role === 'owner' ? 'active' : ''}`} onClick={() => handleRoleSelect('owner')}>
                  <input type="radio" name="role" value="owner" readOnly checked={formData.role === 'owner'} />
                  <span className="role-card-icon">🏢</span>
                  <span className="role-card-title">Station Owner</span>
                  <span className="role-card-desc">Manage charging stations</span>
                </label>
              </div>
            </div>

            {formData.role === 'owner' && (
              <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '-0.25rem', marginBottom: '0.75rem' }}>
                ℹ️ Owner accounts require admin verification before adding stations.
              </p>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              <span>{loading ? 'Creating account…' : 'Create My Account'}</span>
            </button>
          </form>

          <div className="auth-links">
            <p>Already have an account? <Link to="/login">Login here</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
