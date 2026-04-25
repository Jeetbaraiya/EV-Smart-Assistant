import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ChangeEmailModal from '../components/ChangeEmailModal';
import './Profile.css';

const IconMail = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
);

const IconUserCircle = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
);

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);

const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
);

const IconLock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
);

const Profile = () => {
  const { user } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);



  return (
    <div className="dashboard-page">
      <div className="profile-container">
        
        <header className="admin-page-header">
          <div>
            <h2>👤 My Profile</h2>
            <p>Full control over your global account identity</p>
          </div>
        </header>

        <div className="profile-card">
          <div className="profile-hero">
            <div className="profile-avatar-wrapper">
              <div className="profile-avatar-large">
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="profile-identity">
              <h1>{user?.username?.toUpperCase()}</h1>
              <div className="profile-badges">
                <span className="badge badge-profile badge-blue">{user?.role?.toUpperCase()}</span>
                {user?.is_verified ? (
                  <span className="badge badge-profile badge-green">Verified</span>
                ) : (
                  <span className="badge badge-profile badge-yellow">Pending</span>
                )}
              </div>
            </div>
          </div>

          <div className="profile-info-grid">
            <div className="info-item">
              <div className="info-icon-box">
                <IconMail />
              </div>
              <div className="info-content">
                <label>Email Address</label>
                <span>{user?.email || 'Not provided'}</span>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon-box">
                <IconUserCircle />
              </div>
              <div className="info-content">
                <label>Account Type</label>
                <span>{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}</span>
              </div>
            </div>

            <div className="info-item">
              <div className="info-icon-box">
                <IconCalendar />
              </div>
              <div className="info-content">
                <label>Date Joined</label>
                <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Not available'}</span>
              </div>
            </div>

            {/* <div className="info-item">
              <div className="info-icon-box">
                <IconShield />
              </div>
              <div className="info-content">
                <label>Login Mode</label>
                <span>JWT Secure Auth</span>
              </div>
            </div> */}
          </div>
        </div>

        <div className="security-center">
          <div className="security-text">
            <h3><IconLock /> Security Center</h3>
            <p>Your security is our priority. We use end-to-end encryption for all sensitive data. You can update your credentials below at any time.</p>
          </div>
          <div className="security-actions">
            <button className="btn-premium btn-premium-primary" onClick={() => setIsEmailModalOpen(true)}>
              <IconMail size={16} /> Update Email
            </button>
            <button className="btn-premium btn-premium-outline" onClick={() => setIsPasswordModalOpen(true)}>
              <IconLock size={16} /> Change Password
            </button>

          </div>
        </div>
      </div>

      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />
      <ChangeEmailModal 
        isOpen={isEmailModalOpen} 
        onClose={() => setIsEmailModalOpen(false)} 
      />
    </div>
  );
};

export default Profile;
