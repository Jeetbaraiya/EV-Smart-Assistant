import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './ChangePasswordModal.css';

const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
);

const IconEyeOff = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
);

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const { requestPasswordChange, verifyPasswordChange } = useAuth();
  
  const [step, setStep] = useState(1); // 1 = Request, 2 = Verify OTP + New PW
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    otp: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const toggleVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    setLoading(true);
    try {
      const res = await requestPasswordChange(formData.currentPassword);
      if (res.success) {
        setStatus({ type: 'success', message: 'OTP sent to your registered email address!' });
        setStep(2);
      } else {
        setStatus({ type: 'error', message: res.error || 'Failed to request password change.' });
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

    if (formData.newPassword !== formData.confirmPassword) {
      return setStatus({ type: 'error', message: 'New passwords do not match' });
    }

    // Password strength validation
    const password = formData.newPassword;
    if (password.length < 6) {
      return setStatus({ type: 'error', message: 'Password must be at least 6 characters' });
    }
    if (!/[a-z]/.test(password)) {
      return setStatus({ type: 'error', message: 'Password must contain at least one lowercase letter' });
    }
    if (!/[A-Z]/.test(password)) {
      return setStatus({ type: 'error', message: 'Password must contain at least one uppercase letter' });
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return setStatus({ type: 'error', message: 'Password must contain at least one symbol (e.g. @, #, $, etc.)' });
    }

    if (formData.otp.length !== 6) {
      return setStatus({ type: 'error', message: 'OTP must be exactly 6 characters long.' });
    }

    setLoading(true);
    try {
      const res = await verifyPasswordChange(formData.otp, formData.newPassword);
      if (res.success) {
        setStatus({ type: 'success', message: 'Password updated successfully!' });
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
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '', otp: '' });
      setStatus({ type: '', message: '' });
      setShowPasswords({ current: false, new: false, confirm: false });
    }, 300);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-modal">
        <div className="modal-header">
          <h3>🔐 Update Security Credentials</h3>
          <button className="close-btn" onClick={handleClose}>&times;</button>
        </div>

        <form onSubmit={step === 1 ? handleRequestSubmit : handleVerifySubmit} className="modal-form">
          {status.message && (
            <div className={`status-alert ${status.type}`}>
              {status.type === 'success' ? '✅' : '❌'} {status.message}
            </div>
          )}

          {step === 1 && (
            <div className="form-group">
              <label>Current Password (for security)</label>
              <div className="password-input-wrapper">
                <input
                  type={showPasswords.current ? "text" : "password"}
                  required
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                  placeholder="••••••••"
                />
                <button type="button" className="eye-toggle" onClick={() => toggleVisibility('current')}>
                  {showPasswords.current ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: '1.4' }}>
                Enter the 6-character code sent to your email and your new password.
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
                  style={{ letterSpacing: '3px', textAlign: 'center', width: '100%', padding: '0.9rem', border: '1.5px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc', fontSize: '1.1rem', fontWeight: 'bold' }}
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    required
                    value={formData.newPassword}
                    onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                    placeholder="Min 6 characters"
                  />
                  <button type="button" className="eye-toggle" onClick={() => toggleVisibility('new')}>
                    {showPasswords.new ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="••••••••"
                  />
                  <button type="button" className="eye-toggle" onClick={() => toggleVisibility('confirm')}>
                    {showPasswords.confirm ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={handleClose}>Cancel</button>
            <button type="submit" className="btn-confirm" disabled={loading}>
              {loading ? (step === 1 ? 'Sending...' : 'Updating...') : (step === 1 ? '✉️ Send OTP' : '🔒 Change Password')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
