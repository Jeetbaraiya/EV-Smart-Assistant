import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message);
        setTimeout(() => {
          navigate('/reset-password', { state: { email } });
        }, 3000);
      } else {
        setError(data.error || data.errors?.[0]?.msg || 'Failed to request password reset');
      }
    } catch (err) {
      setError('Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel: Visual & Messaging */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-left-logo">
            <div className="auth-left-logo-icon">⚡</div>
            <div className="auth-left-logo-text">EV Assistant</div>
          </div>
          <h1 className="auth-left-headline">
            Recover Your <span>Access.</span>
          </h1>
          <p className="auth-left-subtitle">
            Don't worry, even the smartest planners forget sometimes. 
            Enter your email and we'll send you back on the right route.
          </p>
        </div>
      </div>

      {/* Right Panel: The Form */}
      <div className="auth-right">
        <div className="auth-form-box">
          <div className="auth-form-logo">
            <div className="auth-form-logo-icon">🔒</div>
            <div className="auth-form-logo-text">Security Portal</div>
          </div>

          <div className="auth-form-header">
            <h2>Forgot Password</h2>
            <p>Enter the email address associated with your account.</p>
          </div>

          {error && (
            <div className="auth-error">
              <span>⚠️</span> {error}
            </div>
          )}

          {message && (
            <div style={{ 
              background: '#ecfdf5', 
              color: '#059669', 
              padding: '1rem', 
              borderRadius: '12px', 
              fontSize: '0.9rem', 
              fontWeight: '600', 
              marginBottom: '1.5rem',
              border: '1px solid #d1fae5',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <span>✅</span> {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label>Registered Email</label>
              <div className="auth-input-wrap">
                <input
                  type="email"
                  className="auth-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Requesting...' : 'Send OTP Code'}
            </button>
          </form>

          <div className="auth-links">
            <p>
              Remember your password? <Link to="/login">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
