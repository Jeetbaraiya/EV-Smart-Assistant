import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './ChangePasswordModal.css';

const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);

const IconEyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
);

const ChangeEmailModal = ({ isOpen, onClose }) => {
  const { requestEmailChange, verifyEmailChange, user } = useAuth();
  
  const [step, setStep] = useState(1); // 1 = Request, 2 = Verify OTP
  const [formData, setFormData] = useState({
    currentPassword: '',
    newEmail: '',
    otp: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (formData.newEmail === user?.email) {
      return setStatus({ type: 'error', message: 'New email must be different from current email.' });
    }

    setLoading(true);
    try {
      const res = await requestEmailChange(formData.newEmail, formData.currentPassword);
      if (res.success) {
        setStatus({ type: 'success', message: 'OTP sent to your current email address!' });
        setStep(2);
      } else {
        setStatus({ type: 'error', message: res.error || 'Failed to request email change.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    
    if (formData.otp.length !== 6) {
      return setStatus({ type: 'error', message: 'OTP must be exactly 6 characters long.' });
    }

    setLoading(true);
    try {
      const res = await verifyEmailChange(formData.otp);
      if (res.success) {
        setStatus({ type: 'success', message: 'Email updated successfully!' });
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setStatus({ type: 'error', message: res.error || 'Invalid OTP.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setFormData({ currentPassword: '', newEmail: '', otp: '' });
      setStatus({ type: '', message: '' });
      setShowPassword(false);
    }, 300); // Wait for modal disappear animation
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-modal">
        <div className="modal-header">
          <h3>✉️ Update Email Address</h3>
          <button className="close-btn" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={step === 1 ? handleRequestSubmit : handleVerifySubmit} className="modal-form">
          {status.message && (
            <div className={`status-alert ${status.type}`}>
              {status.type === 'success' ? '✅' : '❌'} {status.message}
            </div>
          )}

          {step === 1 && (
            <>
              <div className="form-group">
                <label>New Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.newEmail}
                  onChange={(e) => setFormData({ ...formData, newEmail: e.target.value })}
                  placeholder="e.g. yourname@example.com"
                  style={{ width: '100%', padding: '0.9rem', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', fontSize: '0.95rem' }}
                />
              </div>

              <div className="form-group">
                <label>Current Password (for security)</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button type="button" className="eye-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                We've sent a 6-character verification code to your current registered email. <br/>
                Please enter it below to confirm the change to <strong>{formData.newEmail}</strong>.
              </p>
              
              <div className="form-group">
                <label>Verification Code</label>
                <input
                  type="text"
                  required
                  value={formData.otp}
                  onChange={(e) => setFormData({ ...formData, otp: e.target.value })}
                  placeholder="e.g. A1B2C3"
                  maxLength={6}
                  style={{ letterSpacing: '3px', textAlign: 'center', width: '100%', padding: '0.9rem', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', fontSize: '1.2rem', fontWeight: 'bold' }}
                />
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn-confirm" disabled={loading}>
              {loading ? (step === 1 ? 'Sending...' : 'Verifying...') : (step === 1 ? '✉️ Send OTP' : '✅ Verify & Change')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangeEmailModal;
